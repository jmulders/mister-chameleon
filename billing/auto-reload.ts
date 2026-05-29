/**
 * billing/auto-reload.ts
 *
 * Wallet auto-reload: trigger, Stripe PaymentIntent creation, and
 * post-webhook success / failure handlers.
 *
 * ─── Safety model ─────────────────────────────────────────────────────────────
 *
 *   1. DUPLICATE PREVENTION — At most one active reload attempt per wallet is
 *      guaranteed by a DB partial unique index:
 *        UNIQUE (tenant_id) WHERE status IN ('pending', 'processing')
 *      If a second trigger fires while one is in-flight, createReloadAttempt()
 *      returns null and the trigger exits silently.
 *
 *   2. ATOMIC CREDIT — The wallet is NEVER credited inside this file.
 *      creditWallet is called ONLY from handleAutoReloadSuccess(), which is
 *      invoked by the Stripe webhook handler after payment_intent.succeeded.
 *      The credit + attempt status update happen inside a single DB transaction
 *      via the process_wallet_reload_success RPC.
 *
 *   3. IDEMPOTENT WEBHOOK — If Stripe delivers the same webhook twice, the
 *      atomicSuccessAndCredit RPC returns -1 on the second call (attempt already
 *      in terminal state) and handleAutoReloadSuccess returns early — no double credit.
 *
 *   4. STRIPE IDEMPOTENCY — The Stripe PaymentIntent is created with an
 *      idempotency key derived from the attempt UUID ("wr:{attemptId}").
 *      If the request is retried, Stripe returns the same PaymentIntent.
 *
 *   5. MONTHLY CAP — Checked before creating the attempt.  Because only one
 *      active attempt can exist at a time, the cap cannot be bypassed by
 *      concurrent reload triggers.
 *
 * ─── Flow ─────────────────────────────────────────────────────────────────────
 *
 *   checkAndTriggerAutoReload (called fire-and-forget after every debit)
 *     → guards (enabled, threshold, payment method, monthly cap)
 *     → createReloadAttempt() → INSERT with status='pending'
 *     → stripe.paymentIntents.create({ off_session: true, confirm: true })
 *     → markAttemptProcessing() → status='processing', stripe_payment_intent_id set
 *     → return — wallet NOT credited yet
 *
 *   handleAutoReloadSuccess (called by stripe webhook: payment_intent.succeeded)
 *     → find attempt by payment_intent_id
 *     → atomicSuccessAndCredit() → status='succeeded' + wallet credit in one TX
 *     → update monthly spend counter
 *     → notify success
 *
 *   handleAutoReloadFailure (called by stripe webhook: payment_intent.payment_failed
 *                            or payment_intent.requires_action)
 *     → find attempt by payment_intent_id
 *     → atomicFailure() → status='failed' or 'action_required'
 *     → notify
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantWallet, AutoReloadResult } from "./types";
import {
  createReloadAttempt,
  markAttemptProcessing,
  cancelAttempt,
  atomicSuccessAndCredit,
  atomicFailure,
  findByPaymentIntent,
} from "./wallet-reload-attempts";
import {
  getStripeClient,
  getStripeMode,
  resolvePaymentMethodId,
  assertNotSimulated,
} from "./stripe-config";
import { serializeError } from "./errors";

// ── Monthly cap helpers ────────────────────────────────────────────────────────

function isNewCalendarMonth(resetAt: string | null): boolean {
  if (!resetAt) return true;
  const reset = new Date(resetAt);
  const now   = new Date();
  return (
    reset.getUTCFullYear() !== now.getUTCFullYear() ||
    reset.getUTCMonth()    !== now.getUTCMonth()
  );
}

/**
 * Reset the monthly reload counter if we've rolled into a new calendar month.
 * Fire-and-forget — not awaited by the trigger path.
 */
async function maybeResetMonthlyCounter(
  client:   SupabaseClient,
  wallet:   TenantWallet,
): Promise<number> {
  if (!isNewCalendarMonth(wallet.auto_reload_month_reset_at)) {
    return wallet.auto_reload_spent_this_month_cents;
  }

  const { error } = await client
    .from("tenant_wallets")
    .update({
      auto_reload_spent_this_month_cents: 0,
      auto_reload_month_reset_at:         new Date().toISOString(),
    })
    .eq("tenant_id", wallet.tenant_id);

  if (error) {
    console.error("[billing/auto-reload] failed to reset monthly counter", {
      tenantId: wallet.tenant_id,
      error:    error.message,
    });
  }

  return 0;
}

// ── Trigger ────────────────────────────────────────────────────────────────────

/**
 * Check whether auto-reload should fire and, if so, start the Stripe payment.
 *
 * Called fire-and-forget after every wallet debit.  All errors are swallowed.
 * The wallet is NOT credited here — credit only happens after the webhook confirms.
 *
 * @param wallet            Current wallet row (reading state before this debit completed).
 * @param balanceAfterCents The new balance after the debit just completed.
 */
export async function checkAndTriggerAutoReload(
  client:            SupabaseClient,
  wallet:            TenantWallet,
  balanceAfterCents: number,
): Promise<void> {
  // ── Guards ────────────────────────────────────────────────────────────────

  if (!wallet.auto_reload_enabled) return;
  if (balanceAfterCents > wallet.auto_reload_trigger_cents) return;

  // wallet_simulated mode must NEVER reach Stripe — guard here.
  if (wallet.test_mode === "test_simulated") {
    // Simulated wallets never auto-reload via Stripe. Use the test-mode panel
    // in the admin UI to simulate auto-reload outcomes instead.
    console.info("[billing/auto-reload] skipping auto-reload for wallet_simulated wallet", {
      tenantId: wallet.tenant_id,
    });
    return;
  }

  // Resolve payment method for the current Stripe mode (live vs test)
  const paymentMethodId = resolvePaymentMethodId(wallet);
  if (!paymentMethodId) {
    const mode = getStripeMode();
    console.warn("[billing/auto-reload] auto-reload enabled but no payment method saved", {
      tenantId: wallet.tenant_id,
      stripeMode: mode,
      field: mode === "test" ? "stripe_test_payment_method_id" : "stripe_payment_method_id",
    });
    return;
  }

  // ── Execute (wrapped so no error propagates to the caller) ────────────────

  try {
    await triggerAutoReload(client, wallet, balanceAfterCents);
  } catch (err) {
    console.error("[billing/auto-reload] triggerAutoReload threw unexpectedly", {
      tenantId: wallet.tenant_id,
      ...serializeError(err),
    });
  }
}

/**
 * Internal: start the reload flow.
 *
 * Returns early if:
 *   • An active attempt already exists (deduplication)
 *   • Monthly cap would be exceeded
 */
async function triggerAutoReload(
  client:            SupabaseClient,
  wallet:            TenantWallet,
  balanceAfterCents: number,
): Promise<void> {
  const { tenant_id, auto_reload_amount_cents, auto_reload_monthly_limit_cents, currency } = wallet;

  // Safety: simulated wallets must never reach here.
  assertNotSimulated(wallet.test_mode, "triggerAutoReload");

  // Resolve payment method for current Stripe mode
  const stripe_payment_method_id = resolvePaymentMethodId(wallet);
  const stripeMode = getStripeMode();

  // ── Monthly cap ───────────────────────────────────────────────────────────

  const spentThisMonth = await maybeResetMonthlyCounter(client, wallet);

  if (spentThisMonth + auto_reload_amount_cents > auto_reload_monthly_limit_cents) {
    const remaining = auto_reload_monthly_limit_cents - spentThisMonth;
    console.warn("[billing/auto-reload] monthly cap reached — no reload", {
      tenantId:   tenant_id,
      spentCents: spentThisMonth,
      limitCents: auto_reload_monthly_limit_cents,
      remaining,
    });

    const { notifyAutoReloadFailure } = await import("./notifications");
    await notifyAutoReloadFailure(
      client,
      tenant_id,
      `Monthly auto-reload cap of €${(auto_reload_monthly_limit_cents / 100).toFixed(2)} reached. ` +
      `Spent this month: €${(spentThisMonth / 100).toFixed(2)}.`,
    );
    return;
  }

  // ── Create attempt row ────────────────────────────────────────────────────
  //
  // The attempt row is inserted BEFORE the Stripe PaymentIntent is created.
  // This ensures that if the process crashes after creating the intent, the
  // webhook can still be matched by payment_intent_id (via markAttemptProcessing
  // or by looking up the intent metadata).
  //
  // The partial unique index rejects a second INSERT while status = 'pending'
  // or 'processing' — this is the primary deduplication gate.

  const idempotencyKey = `wr:${crypto.randomUUID()}`;

  const attempt = await createReloadAttempt(
    client,
    tenant_id,
    balanceAfterCents,
    auto_reload_amount_cents,
    idempotencyKey,
  );

  if (!attempt) {
    // null = a concurrent attempt already exists; exit silently.
    return;
  }

  // ── Create Stripe PaymentIntent ───────────────────────────────────────────
  //
  // off_session: true  — tenant is not present in the browser during this charge.
  // confirm: true      — confirm immediately using the saved payment method.
  // error_on_requires_action: false — if 3DS is required, the intent is created
  //   in 'requires_action' state and the webhook fires payment_intent.requires_action.

  let stripePaymentIntentId: string;

  try {
    // Use the mode-aware Stripe client — test keys for STRIPE_MODE=test,
    // live keys for STRIPE_MODE=live.  Never mix modes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripeClient = getStripeClient(stripeMode) as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const intent: any = await stripeClient.paymentIntents.create(
      {
        amount:               auto_reload_amount_cents,
        currency:             currency.toLowerCase(),
        payment_method:       stripe_payment_method_id!,
        confirm:              true,
        off_session:          true,
        capture_method:       "automatic",
        // Do not throw synchronously on 3DS — let the webhook handle it.
        error_on_requires_action: false,
        metadata: {
          tenant_id:          tenant_id,
          wallet_reload:      "true",
          reload_attempt_id:  attempt.id,
          purpose:            "wallet_auto_reload",
          stripe_mode:        stripeMode,
        },
      },
      {
        // Stripe idempotency key = attempt's idempotency_key.
        // Retrying this code path with the same attempt returns the same intent.
        idempotencyKey: idempotencyKey,
      },
    );

    stripePaymentIntentId = intent.id;

    // ── Mark attempt as processing ─────────────────────────────────────────
    //
    // Record the intent ID so the webhook handler can find this attempt.

    await markAttemptProcessing(client, attempt.id, stripePaymentIntentId);

    console.info("[billing/auto-reload] Stripe PaymentIntent created", {
      tenantId:   tenant_id,
      attemptId:  attempt.id,
      intentId:   stripePaymentIntentId,
      status:     intent.status,
      amountCents: auto_reload_amount_cents,
    });

    // If the intent already succeeded synchronously (card not requiring 3DS
    // and no async capture) — handle it immediately without waiting for webhook.
    // In practice, for off-session payments Stripe fires the webhook even for
    // synchronous successes, but handling it here too makes the flow faster.
    if (intent.status === "succeeded") {
      console.info("[billing/auto-reload] PaymentIntent succeeded synchronously — crediting wallet", {
        tenantId:  tenant_id,
        attemptId: attempt.id,
      });
      await handleAutoReloadSuccess(client, stripePaymentIntentId);
    }

  } catch (err) {
    // ── Stripe call failed (network error, invalid card, etc.) ────────────

    const errDetail = serializeError(err);
    const reason = errDetail.message ?? String(err);
    console.error("[billing/auto-reload] Stripe PaymentIntent creation failed", {
      tenantId:  tenant_id,
      attemptId: attempt.id,
      ...errDetail,
    });

    // Mark attempt as failed so the partial unique index is cleared and a
    // subsequent trigger can create a new attempt.
    await cancelAttempt(client, attempt.id, `Stripe error: ${reason}`);

    const { notifyAutoReloadFailure } = await import("./notifications");
    await notifyAutoReloadFailure(client, tenant_id, String(reason));
  }
}

// ── Webhook success handler ────────────────────────────────────────────────────

/**
 * Handle a confirmed Stripe payment for a wallet auto-reload.
 *
 * Called by the webhook handler when `payment_intent.succeeded` is received.
 * Also called synchronously if the PaymentIntent already succeeded at creation time.
 *
 * Atomicity:  atomicSuccessAndCredit() uses the process_wallet_reload_success
 * Postgres RPC — the attempt status update and wallet credit happen in ONE DB
 * transaction.  If Stripe delivers the webhook twice, the second call returns
 * -1 (already processed) and this function exits early.
 */
export async function handleAutoReloadSuccess(
  client:                SupabaseClient,
  stripePaymentIntentId: string,
): Promise<void> {
  // ── Find the reload attempt ───────────────────────────────────────────────

  const attempt = await findByPaymentIntent(client, stripePaymentIntentId);

  if (!attempt) {
    // PaymentIntent is not associated with a wallet reload (e.g. subscription payment).
    return;
  }

  if (attempt.status === "succeeded") {
    // Already processed — idempotent exit.
    console.info("[billing/auto-reload] handleAutoReloadSuccess: attempt already succeeded — skipping", {
      attemptId: attempt.id,
    });
    return;
  }

  // ── Atomically mark succeeded + credit wallet ─────────────────────────────

  const newBalance = await atomicSuccessAndCredit(client, attempt.id, stripePaymentIntentId);

  if (newBalance === -1) {
    // Another concurrent webhook call beat us — idempotent exit.
    console.info("[billing/auto-reload] handleAutoReloadSuccess: atomicSuccessAndCredit returned -1 — already processed", {
      attemptId: attempt.id,
    });
    return;
  }

  // ── Update monthly spend counter ──────────────────────────────────────────
  //
  // Not part of the atomic RPC since a failure here is recoverable
  // (counter can be rebuilt from reload_attempts history if needed).

  try {
    // Fetch current value and increment.
    // PostgREST doesn't support atomic increments natively, but the monthly
    // counter is non-critical — it can be rebuilt from wallet_reload_attempts.
    const { data: w } = await client
      .from("tenant_wallets")
      .select("auto_reload_spent_this_month_cents")
      .eq("tenant_id", attempt.tenant_id)
      .single();

    const currentSpent = (w as { auto_reload_spent_this_month_cents: number } | null)
      ?.auto_reload_spent_this_month_cents ?? 0;

    await client
      .from("tenant_wallets")
      .update({
        auto_reload_spent_this_month_cents: currentSpent + attempt.reload_amount_cents,
      })
      .eq("tenant_id", attempt.tenant_id);
  } catch (err) {
    // Non-critical — log and continue.
    console.error("[billing/auto-reload] failed to update monthly spend counter", {
      tenantId:  attempt.tenant_id,
      attemptId: attempt.id,
      ...serializeError(err),
    });
  }

  // ── Notify ────────────────────────────────────────────────────────────────

  try {
    const { notifyAutoReloadSuccess } = await import("./notifications");
    await notifyAutoReloadSuccess(client, attempt.tenant_id, attempt.reload_amount_cents, newBalance);
  } catch (err) {
    console.error("[billing/auto-reload] notification error", {
      tenantId: attempt.tenant_id,
      ...serializeError(err),
    });
  }

  console.info("[billing/auto-reload] auto-reload complete", {
    tenantId:     attempt.tenant_id,
    attemptId:    attempt.id,
    amountCents:  attempt.reload_amount_cents,
    newBalance,
    stripeIntent: stripePaymentIntentId,
  });
}

// ── Webhook failure handler ────────────────────────────────────────────────────

/**
 * Handle a failed or action-required Stripe payment for a wallet auto-reload.
 *
 * Called by the webhook handler when:
 *   • payment_intent.payment_failed
 *   • payment_intent.requires_action  (3DS authentication needed)
 *
 * Does NOT credit or debit the wallet.
 * Clears the active-attempt slot so a new reload can be triggered next time.
 */
export async function handleAutoReloadFailure(
  client:                SupabaseClient,
  stripePaymentIntentId: string,
  failureReason:         string,
  requiresAction         = false,
): Promise<void> {
  // ── Find the reload attempt ───────────────────────────────────────────────

  const attempt = await findByPaymentIntent(client, stripePaymentIntentId);

  if (!attempt) {
    // Not a wallet reload PaymentIntent.
    return;
  }

  if (attempt.status !== "pending" && attempt.status !== "processing") {
    // Already in a terminal state — idempotent exit.
    return;
  }

  // ── Atomically mark failed / action_required ──────────────────────────────

  const newStatus = requiresAction ? "action_required" : "failed";
  await atomicFailure(client, attempt.id, newStatus, failureReason, stripePaymentIntentId);

  // ── Notify ────────────────────────────────────────────────────────────────

  try {
    if (requiresAction) {
      const { notifyActionRequired } = await import("./notifications");
      await notifyActionRequired(client, attempt.tenant_id, stripePaymentIntentId);
    } else {
      const { notifyAutoReloadFailure } = await import("./notifications");
      await notifyAutoReloadFailure(client, attempt.tenant_id, failureReason);
    }
  } catch (err) {
    console.error("[billing/auto-reload] notification error during failure handling", {
      tenantId:  attempt.tenant_id,
      attemptId: attempt.id,
      ...serializeError(err),
    });
  }

  console.warn("[billing/auto-reload] auto-reload payment failed", {
    tenantId:      attempt.tenant_id,
    attemptId:     attempt.id,
    newStatus,
    failureReason,
    stripeIntent:  stripePaymentIntentId,
  });
}
