"use server";

/**
 * app/admin/tenants/[tenantId]/billing/actions.ts
 *
 * Server actions for the Billing & Wallet admin dashboard.
 *
 * ─── What these actions manage ────────────────────────────────────────────────
 *
 *   Credit settings (platform_settings):
 *   • getCreditSettingsAction      — load per-tenant Chameleon Credits controls
 *   • saveCreditSettingsAction     — persist updated credit controls
 *
 *   Wallet cap (tenant_wallets):
 *   • saveWalletCapAction          — save monthly_credit_cap_cents + fallback_mode
 *
 *   Auto-reload (tenant_wallets):
 *   • saveAutoReloadAction         — save all auto-reload settings
 *
 *   Notification settings (tenant_wallets):
 *   • saveNotificationSettingsAction — save notification preferences
 *
 *   Subscription checkout confirmation (idempotent):
 *   • confirmSubscriptionCheckoutAction — retrieve Stripe session after Checkout
 *                                         return and write subscription row + seed
 *                                         credits.  Works without webhooks (local dev).
 *
 *   Manual credit grants (SUPER ADMIN ONLY):
 *   • addCreditsAction             — add credits to wallet with ledger entry
 *                                    Requires role = "superadmin" or "admin".
 *                                    Rejected server-side for tenant_admin users.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   All actions verify the admin session cookie before executing.
 *   addCreditsAction additionally verifies super admin role — a tenant_admin
 *   session is rejected even if they somehow reach this action.
 *   Service-role Supabase is used — never exposed to the client.
 */

import { createClient }                        from "@supabase/supabase-js";
import { cookies }                             from "next/headers";
import Stripe                                  from "stripe";
import { verifySession, ADMIN_TOKEN_COOKIE }   from "@/lib/admin-auth";
import type { AdminSession }                   from "@/lib/admin-auth";
import { isSuperAdmin }                        from "@/lib/admin-auth/authorization";
import type { CreditSettings }                 from "@/billing/credits";
import { CREDIT_SETTINGS_DEFAULTS }            from "@/billing/credits";
import type { FallbackMode }                   from "@/billing/credits";
import { creditWallet, debitWallet, ensureWallet, updateWalletStatus } from "@/billing/wallet";
import { CREDIT_BUNDLES, SESSION_CREDIT_BUNDLES } from "@/billing/plans";
import { addCredits }                          from "@/billing/usage";
import { upsertSubscription, syncPackageKeyFromPlan, renewSubscriptionPeriod } from "@/billing/subscriptions";
import { getPlatformStripeSettings }           from "@/platform/platform-store";
import { getStripeMode }                       from "@/billing/stripe-config";

// ── Auth helper ────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ email: string }> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) throw new Error("Admin session required");
  const session = await verifySession(token);
  if (!session) throw new Error("Invalid or expired admin session");
  return { email: session.email };
}

async function requireAdminSession(): Promise<AdminSession> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) throw new Error("Admin session required");
  const session = await verifySession(token);
  if (!session) throw new Error("Invalid or expired admin session");
  return session;
}

function getServiceClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── Settings key helper ────────────────────────────────────────────────────────

function settingsKey(tenantId: string): string {
  return `credit_settings:${tenantId}`;
}

// ── Credit settings actions ────────────────────────────────────────────────────

/**
 * Load Chameleon Credits settings for a tenant.
 *
 * Returns safe defaults when no row exists in platform_settings — this means
 * a tenant with no explicit config has unlimited spend and all categories on.
 */
export async function getCreditSettingsAction(tenantId: string): Promise<
  | { ok: true;  settings: CreditSettings }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const client = getServiceClient();

    const { data, error } = await client
      .from("platform_settings")
      .select("value")
      .eq("key", settingsKey(tenantId))
      .maybeSingle();

    if (error) {
      // 42P01 = table missing — treat as no settings (return defaults)
      if (error.code === "42P01" || error.code === "PGRST205") {
        console.warn(
          `[billing/actions] platform_settings table missing — returning defaults for tenantId=${tenantId}`,
        );
        return { ok: true, settings: { ...CREDIT_SETTINGS_DEFAULTS } };
      }
      throw new Error(`${error.message} (code: ${error.code})`);
    }

    const stored = data?.value as Partial<CreditSettings> | undefined;
    const settings: CreditSettings = stored
      ? {
          ...CREDIT_SETTINGS_DEFAULTS,
          ...stored,
          // Merge nested enabledCategories so partial rows don't lose fields
          enabledCategories: {
            ...CREDIT_SETTINGS_DEFAULTS.enabledCategories,
            ...(stored.enabledCategories ?? {}),
          },
        }
      : { ...CREDIT_SETTINGS_DEFAULTS };

    return { ok: true, settings };
  } catch (err) {
    console.error(`[billing/actions] getCreditSettingsAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Persist updated Chameleon Credits settings for a tenant.
 * Creates the row if it doesn't exist; updates it if it does.
 */
export async function saveCreditSettingsAction(
  tenantId: string,
  settings: CreditSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { email } = await requireAdmin();
    const client    = getServiceClient();

    const { error } = await client
      .from("platform_settings")
      .upsert(
        {
          key:        settingsKey(tenantId),
          value:      settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

    if (error) throw new Error(`${error.message} (code: ${error.code})`);

    console.info(
      `[billing/actions] credit settings saved tenantId=${tenantId} by=${email} ` +
      `limit=${settings.monthlyLimitCredits} fallback=${settings.fallbackMode}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] saveCreditSettingsAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Wallet cap action ──────────────────────────────────────────────────────────

export interface WalletCapInput {
  monthlyCreditCapCents: number;   // 0 = unlimited
  fallbackMode:          FallbackMode;
}

/**
 * Save the monthly credit cap and fallback mode for a tenant's wallet.
 * Writes directly to tenant_wallets — requires migration 051 to be applied.
 *
 * Calls ensureWallet() first so an UPDATE on a not-yet-initialized wallet
 * never silently does nothing (0 rows affected → settings lost).
 */
export async function saveWalletCapAction(
  tenantId: string,
  input:    WalletCapInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { email } = await requireAdmin();
    const client    = getServiceClient();

    // Guarantee the wallet row exists before attempting an UPDATE.
    await ensureWallet(client, tenantId);

    const { error } = await client
      .from("tenant_wallets")
      .update({
        monthly_credit_cap_cents: Math.max(0, Math.round(input.monthlyCreditCapCents)),
        fallback_mode:            input.fallbackMode,
      })
      .eq("tenant_id", tenantId);

    if (error) {
      // 42P01 / 42703 = migration 051 not yet applied — fail gracefully
      if (error.code === "42P01" || error.code === "42703") {
        return { ok: false, error: "Wallet cap columns not yet available — run supabase db push." };
      }
      throw new Error(`${error.message} (code: ${error.code})`);
    }

    console.info(
      `[billing/actions] wallet cap saved tenantId=${tenantId} by=${email} ` +
      `cap=${input.monthlyCreditCapCents} fallback=${input.fallbackMode}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] saveWalletCapAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Auto-reload action ─────────────────────────────────────────────────────────

export interface AutoReloadInput {
  auto_reload_enabled:              boolean;
  auto_reload_trigger_cents:        number;
  auto_reload_amount_cents:         number;
  auto_reload_monthly_limit_cents:  number;
}

/**
 * Save auto-reload configuration for a tenant's wallet.
 *
 * Calls ensureWallet() first so an UPDATE on a not-yet-initialized wallet
 * never silently does nothing.
 */
export async function saveAutoReloadAction(
  tenantId: string,
  input:    AutoReloadInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { email } = await requireAdmin();
    const client    = getServiceClient();

    // Guarantee the wallet row exists before attempting an UPDATE.
    await ensureWallet(client, tenantId);

    const { error } = await client
      .from("tenant_wallets")
      .update({
        auto_reload_enabled:             input.auto_reload_enabled,
        auto_reload_trigger_cents:       Math.max(0, Math.round(input.auto_reload_trigger_cents)),
        auto_reload_amount_cents:        Math.max(0, Math.round(input.auto_reload_amount_cents)),
        auto_reload_monthly_limit_cents: Math.max(0, Math.round(input.auto_reload_monthly_limit_cents)),
      })
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`${error.message} (code: ${error.code})`);

    console.info(
      `[billing/actions] auto-reload saved tenantId=${tenantId} by=${email} ` +
      `enabled=${input.auto_reload_enabled} trigger=${input.auto_reload_trigger_cents} amount=${input.auto_reload_amount_cents}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] saveAutoReloadAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Notification settings action ───────────────────────────────────────────────

export interface NotificationSettingsInput {
  notify_email:                 boolean;
  notify_sms:                   boolean;
  notification_email:           string | null;
  notification_phone:           string | null;
  low_balance_threshold_cents:  number;
}

/**
 * Save notification preferences for a tenant's wallet.
 *
 * Calls ensureWallet() first so an UPDATE on a not-yet-initialized wallet
 * never silently does nothing.
 */
export async function saveNotificationSettingsAction(
  tenantId: string,
  input:    NotificationSettingsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { email } = await requireAdmin();
    const client    = getServiceClient();

    // Guarantee the wallet row exists before attempting an UPDATE.
    await ensureWallet(client, tenantId);

    const { error } = await client
      .from("tenant_wallets")
      .update({
        notify_email:                input.notify_email,
        notify_sms:                  input.notify_sms,
        notification_email:          input.notification_email,
        notification_phone:          input.notification_phone,
        low_balance_threshold_cents: Math.max(0, Math.round(input.low_balance_threshold_cents)),
      })
      .eq("tenant_id", tenantId);

    if (error) throw new Error(`${error.message} (code: ${error.code})`);

    console.info(
      `[billing/actions] notification settings saved tenantId=${tenantId} by=${email}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] saveNotificationSettingsAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Add Credits action (SUPER ADMIN ONLY) ─────────────────────────────────────

export type AddCreditsAdjustmentType = "admin_grant" | "adjustment" | "refund";

export interface AddCreditsInput {
  amountCredits:  number;                  // Non-zero integer; 1 credit = 1 cent.
                                           // Negative only allowed for "adjustment" type (deduction).
  reason:         string;                  // Required non-empty note for the ledger
  adjustmentType: AddCreditsAdjustmentType;
}

/**
 * Manually add credits to a tenant wallet.
 *
 * ─── Permission model ─────────────────────────────────────────────────────────
 *
 *   SUPER ADMIN ONLY — enforced server-side (not UI-only).
 *   A tenant_admin session is rejected even if they somehow reach this action.
 *   Requires role = "superadmin" or legacy "admin" (isSuperAdmin returns true
 *   for both; see lib/admin-auth/authorization.ts for rationale).
 *
 * ─── Backend behaviour ────────────────────────────────────────────────────────
 *
 *   Calls creditWallet() which uses the credit_wallet Postgres RPC.
 *   The RPC atomically: updates wallet balance + inserts ledger row.
 *   If the wallet does not exist it is created (lazy init inside the RPC).
 *
 * ─── Ledger entry ─────────────────────────────────────────────────────────────
 *
 *   entryType:     top_up_manual
 *   referenceType: admin_manual
 *   referenceId:   admin email (makes the actor visible in ledger queries)
 *   note:          reason provided in the form
 *   category:      "topup" | "refund" | "adjustment" — mapped from adjustmentType
 *
 * ─── Sanity limits ────────────────────────────────────────────────────────────
 *
 *   • amountCredits must be > 0
 *   • amountCredits must be ≤ 1,000,000 (anti-runaway guard — superadmin typo)
 *   • reason must be non-empty (audit trail requirement)
 */
export async function addCreditsAction(
  tenantId: string,
  input:    AddCreditsInput,
): Promise<{ ok: true; newBalanceCents: number } | { ok: false; error: string }> {
  try {
    // ── 1. Verify admin session + super admin role ───────────────────────────
    const session = await requireAdminSession();

    if (!isSuperAdmin(session)) {
      // Explicit rejection — never rely on UI gating alone.
      console.warn(
        `[billing/actions] addCreditsAction rejected — not superadmin: role=${session.role} email=${session.email} tenantId=${tenantId}`,
      );
      return { ok: false, error: "Permission denied: super admin role required." };
    }

    // ── 2. Validate input ────────────────────────────────────────────────────
    const amount = input.amountCredits;   // keep full decimal precision — no rounding
    if (!Number.isFinite(amount) || amount === 0) {
      return { ok: false, error: "Amount must be a non-zero number." };
    }
    // Negative amounts are only permitted for "adjustment" type (balance correction).
    if (amount < 0 && input.adjustmentType !== "adjustment") {
      return { ok: false, error: "Negative amounts are only allowed for the Adjustment type." };
    }
    if (Math.abs(amount) > 1_000_000) {
      return { ok: false, error: "Amount exceeds the single-grant limit of 1,000,000 credits." };
    }
    const reason = input.reason.trim();
    if (!reason) {
      return { ok: false, error: "A reason is required for the audit ledger." };
    }
    if (!["admin_grant", "adjustment", "refund"].includes(input.adjustmentType)) {
      return { ok: false, error: "Invalid adjustment type." };
    }

    // ── 3. Map adjustmentType → wallet category ──────────────────────────────
    const categoryMap: Record<AddCreditsAdjustmentType, "topup" | "refund" | "adjustment"> = {
      admin_grant: "topup",
      adjustment:  "adjustment",
      refund:      "refund",
    };

    const client = getServiceClient();

    // ── 4a. Negative adjustment — deduct via debit_wallet RPC ────────────────
    if (amount < 0) {
      const absAmount  = Math.abs(amount);
      const debitResult = await debitWallet(
        client,
        tenantId,
        absAmount,
        "admin_manual",
        session.email,              // referenceId = actor for ledger visibility
        reason,
        categoryMap[input.adjustmentType],
      );

      if (!debitResult.success) {
        const errMsg = debitResult.error === "insufficient_balance"
          ? "Insufficient balance — the deduction would bring the wallet below zero."
          : debitResult.error === "wallet_not_active"
          ? "Wallet is not active (frozen or suspended). Reactivate it first."
          : debitResult.error === "wallet_not_found"
          ? "Wallet not found for this tenant."
          : `Debit failed: ${debitResult.error ?? "unknown error"}`;
        return { ok: false, error: errMsg };
      }

      const newBalanceCents = typeof debitResult.balanceAfter === "number"
        ? Math.round(debitResult.balanceAfter)
        : 0;

      console.info(
        `[billing/actions] addCreditsAction (deduction) success — tenantId=${tenantId} by=${session.email} ` +
        `amount=${amount} type=${input.adjustmentType} reason="${reason}" newBalance=${newBalanceCents}`,
      );

      return { ok: true, newBalanceCents };
    }

    // ── 4b. Positive amount — credit via credit_wallet RPC ───────────────────
    const newBalanceCents = await creditWallet(
      client,
      tenantId,
      amount,   // decimal credits; 1 credit = €0.01
      "top_up_manual",
      "admin_manual",
      session.email,              // referenceId = actor for ledger visibility
      reason,
      categoryMap[input.adjustmentType],
    );

    console.info(
      `[billing/actions] addCreditsAction success — tenantId=${tenantId} by=${session.email} ` +
      `amount=${amount} type=${input.adjustmentType} reason="${reason}" ` +
      `newBalance=${newBalanceCents}`,
    );

    return { ok: true, newBalanceCents };
  } catch (err) {
    console.error(`[billing/actions] addCreditsAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Reactivate wallet action (SUPER ADMIN ONLY) ────────────────────────────────

/**
 * Set a suspended or frozen wallet back to 'active'.
 *
 * Only meaningful when the wallet was manually frozen (status = 'frozen') or
 * was automatically suspended when the balance hit 0 (status = 'suspended').
 * In the suspended case the admin is expected to also top up credits so the
 * wallet doesn't suspend again immediately on the next enrichment call.
 *
 * Super admin only — enforced server-side.
 */
export async function reactivateWalletAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();

    if (!isSuperAdmin(session)) {
      console.warn(
        `[billing/actions] reactivateWalletAction rejected — not superadmin: role=${session.role} tenantId=${tenantId}`,
      );
      return { ok: false, error: "Permission denied: super admin role required." };
    }

    const client = getServiceClient();
    await updateWalletStatus(client, tenantId, "active");

    console.info(
      `[billing/actions] reactivateWalletAction success — tenantId=${tenantId} by=${session.email}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] reactivateWalletAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Stripe checkout confirmation ───────────────────────────────────────────────

/**
 * Verify a completed Stripe Checkout session and add credits to the tenant
 * wallet if the payment succeeded.
 *
 * Called server-side from the billing page when it detects
 * ?bundle=success&session_id=cs_xxx in the URL.  This lets credits land
 * immediately without depending on the Stripe webhook reaching localhost
 * (which requires the Stripe CLI in local development).
 *
 * Idempotent: uses the checkout session ID (cs_xxx) as reference_id in the
 * wallet ledger.  If credits were already added by the webhook handler the
 * ledger entry already exists and this action returns { alreadyCredited: true }
 * without adding a second credit.
 */
export async function confirmBundlePurchaseAction(
  tenantId:          string,
  checkoutSessionId: string,
): Promise<
  | { ok: true;  alreadyCredited: boolean; credits: number; bundleLabel: string }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    if (!checkoutSessionId.startsWith("cs_")) {
      return { ok: false, error: "Invalid checkout session ID." };
    }

    const client = getServiceClient();

    // ── 1. Idempotency check ─────────────────────────────────────────────────
    //
    // The webhook handler stores credits with reference_id = stripe_event_id
    // (evt_xxx).  This action uses the checkout session ID (cs_xxx) as its own
    // reference_id.  They're different — so we check BOTH:
    //   • wallet_ledger.reference_id = cs_xxx  (added by this action before)
    //   • wallet_webhook_events where the session was already processed
    //     (added by webhook handler — reference via stripe_event_id is indirect
    //      so we rely on wallet_ledger reference_id = cs_xxx set below)

    const { data: existingLedgerRow } = await client
      .from("wallet_ledger")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("reference_id", checkoutSessionId)
      .maybeSingle();

    if (existingLedgerRow) {
      // Already credited by a previous call to this action.
      const bundleId = checkoutSessionId; // unknown at this point — look up below for label
      return { ok: true, alreadyCredited: true, credits: 0, bundleLabel: "" };
    }

    // ── 2. Resolve Stripe secret key ─────────────────────────────────────────

    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ??
      process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const settings = await getPlatformStripeSettings();
        if (settings.ok) stripeSecretKey = settings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return { ok: false, error: "Stripe secret key not configured." };
    }

    // ── 3. Fetch the Stripe checkout session ─────────────────────────────────

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    });

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    } catch (err) {
      return { ok: false, error: `Could not retrieve Stripe session: ${(err as Error).message}` };
    }

    // ── 4. Validate payment succeeded and is a credit bundle ─────────────────

    if (session.payment_status !== "paid") {
      return { ok: false, error: `Payment not completed (status: ${session.payment_status}).` };
    }

    if (session.metadata?.type !== "credit_bundle") {
      return { ok: false, error: "Session is not a credit bundle purchase." };
    }

    const bundleId = session.metadata.bundle_id;
    const bundle   = CREDIT_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) {
      return { ok: false, error: `Unknown bundle ID in session metadata: ${bundleId}` };
    }

    // Verify the session belongs to this tenant.
    if (session.metadata.tenant_id !== tenantId) {
      return { ok: false, error: "Session tenant does not match." };
    }

    // ── 5. Credit the wallet (idempotent via reference_id = cs_xxx) ──────────

    await addCredits(client, tenantId, bundle.credits, "purchase", {
      stripeEventId: checkoutSessionId,   // stored as reference_id in ledger
      bundleId,
      description: `Purchased ${bundle.label} (confirmed via checkout session)`,
    });

    console.info(
      `[billing/actions] confirmBundlePurchaseAction: credited ${bundle.credits} to tenant ${tenantId} ` +
      `for bundle ${bundleId} via session ${checkoutSessionId}`,
    );

    return { ok: true, alreadyCredited: false, credits: bundle.credits, bundleLabel: bundle.label };

  } catch (err) {
    console.error("[billing/actions] confirmBundlePurchaseAction failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Subscription checkout confirmation ─────────────────────────────────────────

/**
 * Verify a completed Stripe Checkout session for a subscription and write the
 * subscription row + seed credits into the database.
 *
 * Called server-side from the billing page when it detects
 * ?checkout=success&session_id=cs_xxx in the URL.  This lets the subscription
 * activate immediately without depending on the Stripe webhook reaching
 * localhost (which requires the Stripe CLI in local development).
 *
 * Idempotent:
 *   • If the subscription row for this Stripe subscription ID already exists
 *     (written by the webhook), the upsert is a no-op and we return
 *     { alreadyConfirmed: true }.
 *   • The addCredits call uses the checkout session ID as stripeEventId in the
 *     wallet ledger; a duplicate insert is silently ignored by the DB constraint.
 */
export async function confirmSubscriptionCheckoutAction(
  tenantId:          string,
  checkoutSessionId: string,
): Promise<
  | { ok: true;  alreadyConfirmed: boolean }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    if (!checkoutSessionId.startsWith("cs_")) {
      return { ok: false, error: "Invalid checkout session ID." };
    }

    const client = getServiceClient();

    // ── 1. Resolve Stripe secret key (env → DB fallback) ────────────────────

    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ??
      process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const settings = await getPlatformStripeSettings();
        if (settings.ok) stripeSecretKey = settings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return { ok: false, error: "Stripe secret key not configured." };
    }

    // ── 2. Fetch the Stripe checkout session (expand subscription) ───────────

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    });

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        // subscription.items needed for period dates (API >= 2024-09-30.acacia
        // moved current_period_start/end from subscription root to each item).
        expand: ["subscription", "subscription.default_payment_method", "subscription.items"],
      });
    } catch (err) {
      return { ok: false, error: `Could not retrieve Stripe session: ${(err as Error).message}` };
    }

    // ── 3. Validate it is a completed subscription checkout ──────────────────

    if (session.payment_status !== "paid") {
      return { ok: false, error: `Payment not completed (status: ${session.payment_status}).` };
    }

    if (session.mode !== "subscription") {
      return { ok: false, error: "Session is not a subscription checkout." };
    }

    if (!session.metadata?.tenant_id) {
      return { ok: false, error: "Session is missing tenant_id metadata." };
    }

    if (session.metadata.tenant_id !== tenantId) {
      return { ok: false, error: "Session tenant does not match." };
    }

    // ── 4. Extract subscription data ─────────────────────────────────────────

    const stripeSubId  = typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null;

    const customerId   = typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | null)?.id ?? null;

    if (!stripeSubId || !customerId) {
      return { ok: false, error: "Stripe session is missing subscription or customer ID." };
    }

    // ── 5. Idempotency check — did the webhook already write this sub row? ────

    const { data: existingRow } = await client
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .eq("stripe_subscription_id", stripeSubId)
      .maybeSingle();

    if (existingRow) {
      // Webhook already handled this — nothing to do.
      console.info(
        `[billing/actions] confirmSubscriptionCheckoutAction: already confirmed via webhook ` +
        `tenantId=${tenantId} subId=${stripeSubId}`,
      );
      return { ok: true, alreadyConfirmed: true };
    }

    // ── 6. Upsert subscription row ───────────────────────────────────────────

    const planId      = session.metadata.plan_id ?? "starter";
    const billingCycle: "monthly" | "annual" =
      (session.metadata.billing_cycle as "monthly" | "annual") ?? "monthly";

    // Pull period dates from the expanded subscription.
    // Since API 2024-09-30.acacia, current_period_start/end moved from the
    // subscription root to each subscription item — read from the first item
    // and fall back to the root for older API responses.
    const expandedSub = typeof session.subscription === "object" && session.subscription !== null
      ? (session.subscription as Stripe.Subscription & {
          items?: { data: Array<{ current_period_start?: number; current_period_end?: number }> };
        })
      : null;

    const subFirstItem   = expandedSub?.items?.data?.[0];
    const rawPeriodStart = subFirstItem?.current_period_start ?? (expandedSub as unknown as { current_period_start?: number })?.current_period_start;
    const rawPeriodEnd   = subFirstItem?.current_period_end   ?? (expandedSub as unknown as { current_period_end?: number })?.current_period_end;

    await upsertSubscription(client, tenantId, {
      stripe_customer_id:     customerId,
      stripe_subscription_id: stripeSubId,
      plan:                   planId,
      status:                 "active",
      billing_cycle:          billingCycle,
      ...(rawPeriodStart ? { current_period_start: new Date(rawPeriodStart * 1000).toISOString() } : {}),
      ...(rawPeriodEnd   ? { current_period_end:   new Date(rawPeriodEnd   * 1000).toISOString() } : {}),
    });

    // ── 7. Persist payment method ID to tenant_wallets ───────────────────────
    //
    // The subscription's default_payment_method is the card Stripe will charge
    // for recurring invoices.  We copy it into tenant_wallets so the auto-reload
    // system (and the "Payment method" display in the UI) can use it without
    // requiring a separate setup step.
    //
    // Live mode  → stripe_payment_method_id
    // Test mode  → stripe_test_payment_method_id

    // Try subscription.default_payment_method first.
    // Stripe often puts the PM on the customer (invoice_settings) rather than
    // the subscription, so we fall back through multiple sources.
    let paymentMethodId: string | null =
      typeof expandedSub?.default_payment_method === "string"
        ? expandedSub.default_payment_method
        : (expandedSub?.default_payment_method as Stripe.PaymentMethod | null)?.id ?? null;

    // Fallback 1: customer.invoice_settings.default_payment_method
    if (!paymentMethodId) {
      try {
        const customer = await stripe.customers.retrieve(customerId, {
          expand: ["invoice_settings.default_payment_method"],
        });
        if (!("deleted" in customer)) {
          const custPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
          paymentMethodId = typeof custPm === "string"
            ? custPm
            : (custPm as Stripe.PaymentMethod | null)?.id ?? null;
        }
      } catch { /* non-fatal — continue */ }
    }

    // Fallback 2: most recent card attached to the customer
    if (!paymentMethodId) {
      try {
        const methods = await stripe.paymentMethods.list({
          customer: customerId,
          type:     "card",
          limit:    1,
        });
        paymentMethodId = methods.data[0]?.id ?? null;
      } catch { /* non-fatal */ }
    }

    if (paymentMethodId) {
      const pmField = getStripeMode() === "test"
        ? "stripe_test_payment_method_id"
        : "stripe_payment_method_id";

      // Upsert rather than ensureWallet + update — same reason as
      // syncPaymentMethodFromStripeAction: ensure_wallet RPC can return 0 rows.
      await client
        .from("tenant_wallets")
        .upsert(
          { tenant_id: tenantId, [pmField]: paymentMethodId },
          { onConflict: "tenant_id", ignoreDuplicates: false },
        );
    }

    // Note: no credit seeding on subscription.
    // Plans define features and limits only — credits are purchased separately.
    // (Option B model: same as Anthropic, OpenAI, Resend, etc.)

    // Sync packageKey in tenant_settings to match the activated plan.
    await syncPackageKeyFromPlan(client, tenantId, planId);

    console.info(
      `[billing/actions] confirmSubscriptionCheckoutAction: confirmed tenantId=${tenantId} ` +
      `plan=${planId} cycle=${billingCycle} subId=${stripeSubId} session=${checkoutSessionId}`,
    );

    return { ok: true, alreadyConfirmed: false };

  } catch (err) {
    console.error("[billing/actions] confirmSubscriptionCheckoutAction failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Sync payment method from Stripe ────────────────────────────────────────────

/**
 * Pull the active payment method from Stripe and persist it in tenant_wallets.
 *
 * Called when the user returns from the Stripe Billing Portal (?portal=return)
 * so that any card added or updated via the portal is immediately reflected in
 * the "Payment method" display without requiring a webhook.
 *
 * Resolution order (stops at the first non-null value):
 *   1. subscription.default_payment_method
 *   2. customer.invoice_settings.default_payment_method
 *   3. Most recently attached card on the customer
 *
 * Mode-aware: writes stripe_test_payment_method_id in test mode,
 * stripe_payment_method_id in live mode.
 */
export async function syncPaymentMethodFromStripeAction(
  tenantId: string,
): Promise<{ ok: true; paymentMethodId: string | null } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const client = getServiceClient();

    // ── 1. Get the Stripe customer ID ────────────────────────────────────────
    const { data: subRow } = await client
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const customerId     = (subRow as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
    const subscriptionId = (subRow as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ?? null;

    if (!customerId) {
      return { ok: true, paymentMethodId: null };
    }

    // ── 2. Resolve Stripe secret key ─────────────────────────────────────────
    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ?? process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const settings = await getPlatformStripeSettings();
        if (settings.ok) stripeSecretKey = settings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return { ok: false, error: "Stripe secret key not configured." };
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    });

    // ── 3. Resolve payment method (subscription → customer → list) ────────────
    let paymentMethodId: string | null = null;

    // Source A: subscription.default_payment_method
    if (subscriptionId && !paymentMethodId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const pm = sub.default_payment_method;
        paymentMethodId = typeof pm === "string" ? pm : (pm as Stripe.PaymentMethod | null)?.id ?? null;
      } catch { /* non-fatal */ }
    }

    // Source B: customer.invoice_settings.default_payment_method
    if (!paymentMethodId) {
      try {
        const customer = await stripe.customers.retrieve(customerId, {
          expand: ["invoice_settings.default_payment_method"],
        });
        if (!("deleted" in customer)) {
          const pm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
          paymentMethodId = typeof pm === "string" ? pm : (pm as Stripe.PaymentMethod | null)?.id ?? null;
        }
      } catch { /* non-fatal */ }
    }

    // Source C: most recently attached card
    if (!paymentMethodId) {
      try {
        const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
        paymentMethodId = methods.data[0]?.id ?? null;
      } catch { /* non-fatal */ }
    }

    // ── 4. Persist to tenant_wallets ─────────────────────────────────────────
    //
    // Use upsert (INSERT … ON CONFLICT DO UPDATE) so we create the wallet row
    // if it doesn't exist yet AND set the PM field in one atomic statement.
    // This avoids ensureWallet(), which throws when the ensure_wallet RPC
    // returns 0 rows — a known edge case for tenants whose wallet was never
    // explicitly initialised.

    if (paymentMethodId) {
      const pmField = getStripeMode() === "test"
        ? "stripe_test_payment_method_id"
        : "stripe_payment_method_id";

      const { error: upsertErr } = await client
        .from("tenant_wallets")
        .upsert(
          { tenant_id: tenantId, [pmField]: paymentMethodId },
          { onConflict: "tenant_id", ignoreDuplicates: false },
        );

      if (upsertErr) {
        console.warn(
          `[billing/actions] syncPaymentMethodFromStripeAction: upsert failed for ` +
          `tenant ${tenantId} — ${upsertErr.message}`,
        );
      } else {
        console.info(
          `[billing/actions] syncPaymentMethodFromStripeAction: synced ${pmField}=${paymentMethodId} ` +
          `for tenant ${tenantId}`,
        );
      }
    }

    return { ok: true, paymentMethodId };
  } catch (err) {
    console.error("[billing/actions] syncPaymentMethodFromStripeAction failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Session bundle purchase confirmation ───────────────────────────────────────

/**
 * Verify a completed Stripe Checkout session for a session credit bundle and
 * credit the tenant's session_credit_balances via the add_session_credits() RPC.
 *
 * Called by the billing page when Stripe redirects back with
 *   ?session_bundle=success&session_id=cs_xxx
 *
 * Idempotent: the session_credit_ledger is checked for an existing row with
 * note containing the checkout session ID before crediting, so duplicate calls
 * (e.g. two tab loads after checkout) never double-credit.
 */
export async function confirmSessionBundlePurchaseAction(
  tenantId:          string,
  checkoutSessionId: string,
): Promise<
  | { ok: true;  alreadyCredited: boolean; sessions: number; bundleLabel: string }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    if (!checkoutSessionId.startsWith("cs_")) {
      return { ok: false, error: "Invalid checkout session ID." };
    }

    const client = getServiceClient();

    // ── 1. Idempotency check ─────────────────────────────────────────────────
    // We store the cs_xxx in the ledger note. Check if we've already credited it.
    const { data: existingRow } = await client
      .from("session_credit_ledger")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entry_type", "purchase")
      .ilike("note", `%${checkoutSessionId}%`)
      .maybeSingle();

    if (existingRow) {
      return { ok: true, alreadyCredited: true, sessions: 0, bundleLabel: "" };
    }

    // ── 2. Resolve Stripe secret key ─────────────────────────────────────────

    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ??
      process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const settings = await getPlatformStripeSettings();
        if (settings.ok) stripeSecretKey = settings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return { ok: false, error: "Stripe secret key not configured." };
    }

    // ── 3. Fetch and validate the Stripe Checkout session ────────────────────

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    });

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    } catch (err) {
      return { ok: false, error: `Could not retrieve Stripe session: ${(err as Error).message}` };
    }

    if (session.payment_status !== "paid") {
      return { ok: false, error: `Payment not completed (status: ${session.payment_status}).` };
    }

    if (session.metadata?.type !== "session_bundle") {
      return { ok: false, error: "Session is not a session bundle purchase." };
    }

    if (session.metadata.tenant_id !== tenantId) {
      return { ok: false, error: "Session tenant does not match." };
    }

    const bundleId = session.metadata.bundle_id;
    const bundle   = SESSION_CREDIT_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) {
      return { ok: false, error: `Unknown session bundle ID in metadata: ${bundleId}` };
    }

    // ── 4. Credit via add_session_credits() RPC ──────────────────────────────

    const { error: rpcError } = await client.rpc("add_session_credits", {
      p_tenant_id: tenantId,
      p_amount:    bundle.sessions,
      p_bundle_id: bundleId,
      p_stripe_id: checkoutSessionId,
      p_note:      `${bundle.label} — Stripe checkout ${checkoutSessionId}`,
    });

    if (rpcError) {
      return { ok: false, error: `Failed to credit sessions: ${rpcError.message}` };
    }

    console.info(
      `[billing/actions] confirmSessionBundlePurchaseAction: credited ${bundle.sessions} sessions ` +
      `to tenant ${tenantId} for bundle ${bundleId} via session ${checkoutSessionId}`,
    );

    return { ok: true, alreadyCredited: false, sessions: bundle.sessions, bundleLabel: bundle.label };

  } catch (err) {
    console.error("[billing/actions] confirmSessionBundlePurchaseAction failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Subscription management actions (SUPER ADMIN ONLY) ─────────────────────────

export type SubscriptionStatus =
  | "active" | "trialing" | "past_due"
  | "canceled" | "unpaid" | "paused";

export type PlanId = "starter" | "growth" | "pro";
export type BillingCycle = "monthly" | "annual";

export interface UpdateSubscriptionInput {
  status?:               SubscriptionStatus;
  plan?:                 PlanId;
  billing_cycle?:        BillingCycle;
  current_period_start?: string | null;   // ISO timestamp or null
  current_period_end?:   string | null;   // ISO timestamp or null
  trial_end?:            string | null;   // ISO timestamp or null
  cancel_at_period_end?: boolean;
}

/**
 * Update a tenant's subscription row directly (super-admin only).
 *
 * Allows super-admins to:
 *  - Change subscription status (active/trialing/canceled/etc.)
 *  - Edit period start and end dates
 *  - Set a trial end date
 *  - Switch billing cycle
 *  - Set cancel-at-period-end flag
 *
 * When the plan changes, also syncs packageKey in tenant_settings.
 * When status changes to "canceled", sets canceled_at = now.
 */
export async function updateSubscriptionAction(
  tenantId: string,
  update:   UpdateSubscriptionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();
    if (!isSuperAdmin(session)) {
      return { ok: false, error: "Super-admin role required." };
    }

    const client = getServiceClient();

    // Build the update payload — only include defined fields.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };

    if (update.status !== undefined) {
      payload["status"] = update.status;
      if (update.status === "canceled") {
        payload["canceled_at"] = new Date().toISOString();
      }
    }
    if (update.plan                 !== undefined) payload["plan"]                 = update.plan;
    if (update.billing_cycle        !== undefined) payload["billing_cycle"]        = update.billing_cycle;
    if (update.current_period_start !== undefined) payload["current_period_start"] = update.current_period_start;
    if (update.current_period_end   !== undefined) payload["current_period_end"]   = update.current_period_end;
    if (update.trial_end            !== undefined) payload["trial_end"]            = update.trial_end;
    if (update.cancel_at_period_end !== undefined) payload["cancel_at_period_end"] = update.cancel_at_period_end;

    const { error } = await client
      .from("subscriptions")
      .update(payload)
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`${error.message} (code: ${error.code})`);
    }

    // Sync packageKey when plan changes.
    if (update.plan) {
      await syncPackageKeyFromPlan(client, tenantId, update.plan);
    }

    console.info(
      `[billing/actions] updateSubscriptionAction: tenantId=${tenantId} by=${session.email} ` +
      `fields=${Object.keys(payload).filter(k => k !== "updated_at").join(",")}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] updateSubscriptionAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Create a subscription row for a tenant that has no Stripe subscription
 * (e.g. trial tenants created via the old /api/trial/start route, or manually
 * provisioned tenants).
 *
 * Super-admin only.  Idempotent — if a row already exists, returns an error.
 */
export async function createSubscriptionAction(
  tenantId: string,
  data: {
    plan:                 PlanId;
    status:               SubscriptionStatus;
    billing_cycle:        BillingCycle;
    current_period_start: string;   // ISO timestamp
    current_period_end:   string;   // ISO timestamp
    trial_end?:           string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();
    if (!isSuperAdmin(session)) {
      return { ok: false, error: "Super-admin role required." };
    }

    const client = getServiceClient();

    // Check for existing row.
    const { data: existing } = await client
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "A subscription row already exists for this tenant. Use 'Update' instead." };
    }

    const { error } = await client
      .from("subscriptions")
      .insert({
        tenant_id:            tenantId,
        plan:                 data.plan,
        status:               data.status,
        billing_cycle:        data.billing_cycle,
        current_period_start: data.current_period_start,
        current_period_end:   data.current_period_end,
        trial_end:            data.trial_end ?? null,
      });

    if (error) {
      throw new Error(`${error.message} (code: ${error.code})`);
    }

    // Sync packageKey in tenant_settings.
    await syncPackageKeyFromPlan(client, tenantId, data.plan);

    console.info(
      `[billing/actions] createSubscriptionAction: tenantId=${tenantId} by=${session.email} ` +
      `plan=${data.plan} status=${data.status} cycle=${data.billing_cycle}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] createSubscriptionAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Force-activate a pending plan immediately (super-admin only).
 *
 * When a tenant has scheduled a plan downgrade/switch for the next billing
 * period, this action applies it right now instead of waiting.
 *
 * Clears pending_plan, pending_plan_billing_cycle, and pending_plan_effective_date.
 */
export async function activatePendingPlanNowAction(
  tenantId: string,
): Promise<{ ok: true; plan: string } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();
    if (!isSuperAdmin(session)) {
      return { ok: false, error: "Super-admin role required." };
    }

    const client = getServiceClient();

    const { data: sub } = await client
      .from("subscriptions")
      .select("pending_plan, pending_plan_billing_cycle")
      .eq("tenant_id", tenantId)
      .maybeSingle() as {
        data: { pending_plan: string | null; pending_plan_billing_cycle: string | null } | null
      };

    if (!sub?.pending_plan) {
      return { ok: false, error: "No pending plan change found for this tenant." };
    }

    const newPlan  = sub.pending_plan;
    const newCycle = (sub.pending_plan_billing_cycle ?? "monthly") as BillingCycle;

    const { error } = await client
      .from("subscriptions")
      .update({
        plan:                        newPlan,
        billing_cycle:               newCycle,
        pending_plan:                null,
        pending_plan_billing_cycle:  null,
        pending_plan_effective_date: null,
        updated_at:                  new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    if (error) {
      throw new Error(`${error.message} (code: ${error.code})`);
    }

    await syncPackageKeyFromPlan(client, tenantId, newPlan);

    console.info(
      `[billing/actions] activatePendingPlanNowAction: tenantId=${tenantId} by=${session.email} ` +
      `plan=${newPlan} cycle=${newCycle}`,
    );

    return { ok: true, plan: newPlan };
  } catch (err) {
    console.error(`[billing/actions] activatePendingPlanNowAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Pull the live subscription data from Stripe and write it into our DB row.
 *
 * Useful when:
 *  • The webhook has not fired yet (local dev without STRIPE_WEBHOOK_SECRET).
 *  • The subscription was created manually and dates are missing.
 *  • Dates / status drifted out of sync for any reason.
 *
 * Fetches subscriptions.retrieve(stripeSubId) and upserts:
 *   current_period_start, current_period_end, status, cancel_at_period_end,
 *   trial_end, stripe_customer_id (from the live Stripe sub).
 */
export async function syncSubscriptionFromStripeAction(
  tenantId: string,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();
    if (!isSuperAdmin(session)) {
      return { ok: false, error: "Super-admin role required." };
    }

    const client = getServiceClient();

    // ── 1. Load the subscription row ─────────────────────────────────────────
    const { data: subRow, error: subErr } = await client
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subErr) throw new Error(`${subErr.message} (code: ${subErr.code})`);
    if (!subRow) return { ok: false, error: "No subscription row found for this tenant." };

    const stripeSubId = (subRow as { stripe_subscription_id?: string | null }).stripe_subscription_id;
    if (!stripeSubId) return { ok: false, error: "No Stripe subscription ID on the subscription row. Link a Stripe sub first." };

    // ── 2. Resolve Stripe secret key ─────────────────────────────────────────
    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ??
      process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const platformSettings = await getPlatformStripeSettings();
        if (platformSettings.ok) stripeSecretKey = platformSettings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return { ok: false, error: "Stripe secret key not configured." };
    }

    // ── 3. Fetch from Stripe ──────────────────────────────────────────────────
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    });
    // Expand items so we can read period dates from the first item.
    // Since API version 2024-09-30.acacia, current_period_start/end were
    // removed from the subscription root and live on each subscription item.
    const stripeSub = await (stripe.subscriptions as unknown as {
      retrieve(id: string, params: Record<string, unknown>): Promise<{
        id: string;
        status: string;
        current_period_start?: number;  // present on older API versions only
        current_period_end?: number;
        cancel_at_period_end: boolean;
        trial_end: number | null;
        customer: string | { id: string };
        items: {
          data: Array<{
            current_period_start?: number;
            current_period_end?: number;
          }>;
        };
      }>;
    }).retrieve(stripeSubId, { expand: ["items"] });

    const customerId = typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : stripeSub.customer?.id ?? null;

    // Prefer item-level period (API >= 2024-09-30), fall back to root-level.
    const firstItem       = stripeSub.items?.data?.[0];
    const rawPeriodStart  = firstItem?.current_period_start  ?? stripeSub.current_period_start;
    const rawPeriodEnd    = firstItem?.current_period_end    ?? stripeSub.current_period_end;

    const periodStart = rawPeriodStart
      ? new Date(rawPeriodStart * 1000).toISOString()
      : null;
    const periodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null;
    const trialEnd = stripeSub.trial_end
      ? new Date(stripeSub.trial_end * 1000).toISOString()
      : null;

    // Map Stripe status to our status values.
    const statusMap: Record<string, string> = {
      active:             "active",
      past_due:           "past_due",
      canceled:           "canceled",
      unpaid:             "past_due",
      trialing:           "trialing",
      incomplete:         "incomplete",
      incomplete_expired: "canceled",
      paused:             "paused",
    };
    const mappedStatus = statusMap[stripeSub.status] ?? stripeSub.status;

    // ── 4. Write to DB ────────────────────────────────────────────────────────
    // subscriptions table only has stripe_customer_id (no test/live split).
    // stripe_test_customer_id lives on tenant_wallets — not updated here.
    const { error: updErr } = await client
      .from("subscriptions")
      .update({
        status:               mappedStatus,
        current_period_start: periodStart,
        current_period_end:   periodEnd,
        cancel_at_period_end: stripeSub.cancel_at_period_end,
        trial_end:            trialEnd,
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      })
      .eq("tenant_id", tenantId);

    if (updErr) throw new Error(`${updErr.message} (code: ${updErr.code})`);

    const summary = `status=${mappedStatus}, period ${periodStart?.slice(0, 10) ?? "?"} → ${periodEnd?.slice(0, 10) ?? "?"}`;
    console.info(`[billing/actions] syncSubscriptionFromStripeAction: tenantId=${tenantId} by=${session.email} ${summary}`);
    return { ok: true, summary };

  } catch (err) {
    console.error("[billing/actions] syncSubscriptionFromStripeAction failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Manually advance the subscription period (renew now) — super-admin only.
 *
 * For monthly plans: advances current_period_start to today, current_period_end
 * to today + 1 month.
 * For annual plans: advances by 1 year.
 *
 * Also activates any pending_plan and sets status = "active".
 */
export async function renewSubscriptionNowAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();
    if (!isSuperAdmin(session)) {
      return { ok: false, error: "Super-admin role required." };
    }

    const client = getServiceClient();

    const result = await renewSubscriptionPeriod(client, tenantId, { force: true });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    console.info(
      `[billing/actions] renewSubscriptionNowAction: tenantId=${tenantId} by=${session.email} ` +
      `newPeriodEnd=${result.current_period_end}`,
    );

    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] renewSubscriptionNowAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Dunning settings ───────────────────────────────────────────────────────────

import {
  getTenantDunningSettings as _getTenantDunningSettings,
  saveTenantDunningSettings as _saveTenantDunningSettings,
  clearTenantDunning        as _clearTenantDunning,
  type TenantDunningSettings,
  type TenantDunningSettingsInput,
} from "@/billing/dunning";

/**
 * Fetch the dunning settings for a tenant.
 * Returns defaults when no row exists.
 */
export async function getDunningSettingsAction(
  tenantId: string,
): Promise<{ ok: true; data: TenantDunningSettings } | { ok: false; error: string }> {
  try {
    await requireAdminSession();
    const client = getServiceClient();
    const data   = await _getTenantDunningSettings(client, tenantId);
    return { ok: true, data };
  } catch (err) {
    console.error(`[billing/actions] getDunningSettingsAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Save dunning settings for a tenant.
 */
export async function saveDunningSettingsAction(
  tenantId: string,
  input:    TenantDunningSettingsInput,
): Promise<{ ok: true; data: TenantDunningSettings } | { ok: false; error: string }> {
  try {
    await requireAdminSession();
    const client = getServiceClient();
    const data   = await _saveTenantDunningSettings(client, tenantId, input);
    console.info(`[billing/actions] saveDunningSettingsAction: tenantId=${tenantId}`);
    return { ok: true, data };
  } catch (err) {
    console.error(`[billing/actions] saveDunningSettingsAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Manually clear dunning state and restore subscription to active.
 * Super-admin only — use when payment has been confirmed via bank transfer, etc.
 */
export async function clearDunningAction(
  tenantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requireAdminSession();
    if (!isSuperAdmin(session)) {
      return { ok: false, error: "Super-admin role required." };
    }
    const client = getServiceClient();
    await _clearTenantDunning(client, tenantId);
    console.info(
      `[billing/actions] clearDunningAction: tenantId=${tenantId} by=${session.email}`,
    );
    return { ok: true };
  } catch (err) {
    console.error(`[billing/actions] clearDunningAction failed tenantId=${tenantId}`, err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── Confirm plan-change checkout ───────────────────────────────────────────────

/**
 * Verify a completed Stripe Checkout session for a one-time plan-change
 * payment and mark the pending plan as paid on the subscription row.
 *
 * Called server-side from the billing page when it detects
 * ?plan_change=success&session_id=cs_xxx in the URL.
 *
 * ─── What it does ─────────────────────────────────────────────────────────────
 *
 *   1. Retrieve the Stripe Checkout session.
 *   2. Verify mode = "payment" and payment_status = "paid".
 *   3. Confirm session metadata points to this tenant and the pending_plan
 *      on the subscription row still matches (guards against stale redirects).
 *   4. Set pending_plan_paid_at = now on the subscription row.
 *   5. Save the card used (via setup_future_usage = "off_session") to
 *      tenant_wallets so the monthly cron can charge it at renewal.
 *
 * Idempotent — repeated calls return { alreadyConfirmed: true } when
 * pending_plan_paid_at is already set.
 */
export async function confirmPlanChangeCheckoutAction(
  tenantId:          string,
  checkoutSessionId: string,
): Promise<
  | { ok: true;  alreadyConfirmed: boolean }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();

    if (!checkoutSessionId.startsWith("cs_")) {
      return { ok: false, error: "Invalid checkout session ID." };
    }

    const client = getServiceClient();

    // ── 1. Resolve Stripe secret key ─────────────────────────────────────────
    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ??
      process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const settings = await getPlatformStripeSettings();
        if (settings.ok) stripeSecretKey = settings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return { ok: false, error: "Stripe secret key not configured." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    // ── 2. Retrieve the Stripe Checkout session ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let session: any;
    try {
      session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: ["payment_intent.payment_method"],
      });
    } catch (err) {
      return { ok: false, error: `Could not retrieve Stripe session: ${(err as Error).message}` };
    }

    // ── 3. Validate ───────────────────────────────────────────────────────────
    if (session.mode !== "payment") {
      return { ok: false, error: "Session is not a payment checkout." };
    }
    if (session.payment_status !== "paid") {
      return { ok: false, error: `Payment not completed (status: ${String(session.payment_status)}).` };
    }
    if ((session.metadata as Record<string, string> | null)?.tenant_id !== tenantId) {
      return { ok: false, error: "Session tenant does not match." };
    }
    if ((session.metadata as Record<string, string> | null)?.type !== "plan_change") {
      return { ok: false, error: "Session is not a plan-change checkout." };
    }

    const paidPlanId = (session.metadata as Record<string, string> | null)?.plan_id ?? null;

    // ── 4. Load current subscription row ─────────────────────────────────────
    const { data: subRow } = await client
      .from("subscriptions")
      .select("pending_plan, pending_plan_paid_at, stripe_customer_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const row = subRow as {
      pending_plan:         string | null;
      pending_plan_paid_at: string | null;
      stripe_customer_id:   string | null;
    } | null;

    if (!row) {
      return { ok: false, error: "Subscription not found for this tenant." };
    }

    // Idempotency — already confirmed?
    if (row.pending_plan_paid_at) {
      return { ok: true, alreadyConfirmed: true };
    }

    // Guard: make sure the session plan still matches what's pending.
    if (paidPlanId && row.pending_plan && paidPlanId !== row.pending_plan) {
      return {
        ok:    false,
        error: `Session plan (${paidPlanId}) does not match pending plan (${row.pending_plan}).`,
      };
    }

    // ── 5. Mark pending plan as paid ─────────────────────────────────────────
    await client
      .from("subscriptions")
      .update({
        pending_plan_paid_at: new Date().toISOString(),
        updated_at:           new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    // ── 6. Persist the payment method to tenant_wallets ──────────────────────
    //
    // The checkout session was created with setup_future_usage = "off_session"
    // which attaches the card to the Stripe customer for future charges.
    // We copy the payment method ID into tenant_wallets so the billing-renewal
    // cron can charge subsequent months via attemptSubscriptionCharge.

    const customerId: string | null = typeof session.customer === "string"
      ? session.customer as string
      : (session.customer as { id?: string } | null)?.id ?? row.stripe_customer_id ?? null;

    // Resolve payment method: from expanded payment intent or customer list.
    let paymentMethodId: string | null = null;

    const pi = typeof session.payment_intent === "object" && session.payment_intent !== null
      ? (session.payment_intent as Record<string, unknown>)
      : null;

    if (pi) {
      const pm = pi["payment_method"];
      paymentMethodId = typeof pm === "string" ? pm : (pm as { id?: string } | null)?.id ?? null;
    }

    if (!paymentMethodId && customerId) {
      try {
        const methods = await stripe.paymentMethods.list({
          customer: customerId,
          type:     "card",
          limit:    1,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paymentMethodId = (methods.data as any[])[0]?.id ?? null;
      } catch { /* non-fatal */ }
    }

    if (paymentMethodId) {
      const pmField = getStripeMode() === "test"
        ? "stripe_test_payment_method_id"
        : "stripe_payment_method_id";

      const customerField = getStripeMode() === "test"
        ? "stripe_test_customer_id"
        : "stripe_customer_id";

      await client
        .from("tenant_wallets")
        .upsert(
          {
            tenant_id:        tenantId,
            [pmField]:        paymentMethodId,
            ...(customerId ? { [customerField]: customerId } : {}),
          },
          { onConflict: "tenant_id", ignoreDuplicates: false },
        );
    }

    // Also persist the Stripe customer ID on the subscription row if we just got one.
    if (customerId && !row.stripe_customer_id) {
      await client
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("tenant_id", tenantId);
    }

    console.info(
      `[billing/actions] confirmPlanChangeCheckoutAction: confirmed tenantId=${tenantId} ` +
      `plan=${paidPlanId ?? "unknown"} session=${checkoutSessionId}`,
    );

    return { ok: true, alreadyConfirmed: false };

  } catch (err) {
    console.error("[billing/actions] confirmPlanChangeCheckoutAction failed", err);
    return { ok: false, error: (err as Error).message };
  }
}

// ── getStripeInvoicesAction ───────────────────────────────────────────────────
//
// Returns up to 50 payment records for the tenant's Stripe customer, newest first.
//
// Two sources are merged and deduplicated:
//
//   1. stripe.invoices.list()      — subscription renewals (mode: "subscription")
//   2. stripe.paymentIntents.list() — one-off payments such as plan-change checkouts
//                                     (mode: "payment"); these never create an Invoice
//
// PaymentIntents that are already represented by an Invoice (i.e. subscription
// charges) are filtered out using the invoice's payment_intent field, so nothing
// appears twice.
//
// The returned shape is a minimal serialisable subset — no Stripe SDK types leak.
// ─────────────────────────────────────────────────────────────────────────────

export interface StripeInvoiceRow {
  id:          string;
  number:      string | null;  // "INV-0001" for invoices, null for standalone payments
  status:      string | null;  // "paid" | "open" | "void" | "uncollectible" | "draft" | "succeeded" | "failed"
  source:      "invoice" | "payment";  // which Stripe object this came from
  amountPaid:  number;         // cents
  amountDue:   number;         // cents
  currency:    string;
  description: string | null;
  periodStart: string | null;  // ISO — subscription period (invoices only)
  periodEnd:   string | null;
  createdAt:   string;         // ISO
  hostedUrl:   string | null;  // Stripe-hosted invoice URL (invoices only)
  pdfUrl:      string | null;  // PDF download URL (invoices only)
}

export async function getStripeInvoicesAction(
  tenantId: string,
): Promise<
  | { ok: true;  invoices: StripeInvoiceRow[]; customerId: string }
  | { ok: false; error: string; customerId: string | null }
> {
  try {
    await requireAdmin();
    const client = getServiceClient();

    // ── 1. Resolve Stripe customer ID (mode-aware) ────────────────────────────
    //
    // Live mode  → subscriptions.stripe_customer_id
    // Test mode  → tenant_wallets.stripe_test_customer_id
    //
    // The two IDs are kept separate so test and live Stripe environments never
    // mix. If neither field is set for this tenant, we return an empty list.

    const isTestMode = getStripeMode() === "test";

    let customerId: string | null = null;

    if (isTestMode) {
      const { data: walletRow } = await client
        .from("tenant_wallets")
        .select("stripe_test_customer_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      customerId =
        (walletRow as { stripe_test_customer_id?: string | null } | null)
          ?.stripe_test_customer_id ?? null;
    } else {
      const { data: subRow } = await client
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      customerId =
        (subRow as { stripe_customer_id?: string | null } | null)
          ?.stripe_customer_id ?? null;
    }

    // Fallback: also check subscriptions.stripe_customer_id regardless of mode.
    // This covers the case where the admin manually set the customer ID there,
    // or the subscription was confirmed via the redirect flow in test mode.
    if (!customerId) {
      const { data: subFallback } = await client
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      customerId =
        (subFallback as { stripe_customer_id?: string | null } | null)
          ?.stripe_customer_id ?? null;
    }

    if (!customerId) {
      console.warn(
        `[billing/actions] getStripeInvoicesAction: no Stripe customer ID found ` +
        `for tenantId=${tenantId} mode=${isTestMode ? "test" : "live"}.`,
      );
      return {
        ok: false,
        error: `No Stripe customer ID found for this tenant in ${isTestMode ? "test" : "live"} mode. ` +
          `Set ${isTestMode ? "tenant_wallets.stripe_test_customer_id" : "subscriptions.stripe_customer_id"} in Supabase.`,
        customerId: null,
      };
    }

    // ── 2. Resolve Stripe secret key ──────────────────────────────────────────
    let stripeSecretKey: string | undefined =
      process.env["STRIPE_TEST_SECRET_KEY"] ?? process.env["STRIPE_SECRET_KEY"];

    if (!stripeSecretKey) {
      try {
        const settings = await getPlatformStripeSettings();
        if (settings.ok) stripeSecretKey = settings.data.secretKey?.trim();
      } catch { /* non-fatal */ }
    }

    if (!stripeSecretKey) {
      return {
        ok: false,
        error: `Stripe secret key not configured. Set ${isTestMode ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY"} in your environment.`,
        customerId,
      };
    }

    // Sanity-check: test-mode customer IDs start with "cus_" and test keys with "sk_test_"
    if (isTestMode && stripeSecretKey.startsWith("sk_live_")) {
      return {
        ok: false,
        error: "Stripe mode mismatch: app is in test mode but STRIPE_TEST_SECRET_KEY is a live key (sk_live_…). Use a sk_test_… key.",
        customerId,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    // ── 3. Fetch both sources — let errors bubble so callers can see them ─────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invoiceList: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let paymentIntentList: any;

    try {
      invoiceList = await stripe.invoices.list({
        customer: customerId,
        limit:    50,
        expand:   ["data.lines"],
      });
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.error("[billing/actions] invoices.list failed", { customerId, msg });
      return { ok: false, error: `Stripe invoices.list failed: ${msg}`, customerId };
    }

    try {
      paymentIntentList = await stripe.paymentIntents.list({
        customer: customerId,
        limit:    50,
      });
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.error("[billing/actions] paymentIntents.list failed", { customerId, msg });
      return { ok: false, error: `Stripe paymentIntents.list failed: ${msg}`, customerId };
    }

    // ── 4. Map invoices ───────────────────────────────────────────────────────
    // Collect the set of PaymentIntent IDs that are already covered by an invoice
    // so we can exclude them from the PaymentIntent list below.
    const invoicedPaymentIntentIds = new Set<string>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoiceRows: StripeInvoiceRow[] = (invoiceList.data ?? []).map((inv: any) => {
      if (inv.payment_intent) {
        const piId = typeof inv.payment_intent === "string"
          ? inv.payment_intent
          : (inv.payment_intent as { id?: string } | null)?.id;
        if (piId) invoicedPaymentIntentIds.add(piId);
      }

      const desc: string | null =
        (inv.description as string | null) ??
        (inv.lines?.data?.[0]?.description as string | null) ??
        null;

      return {
        id:          String(inv.id),
        number:      inv.number             != null ? String(inv.number)              : null,
        status:      inv.status             != null ? String(inv.status)              : null,
        source:      "invoice" as const,
        amountPaid:  Number(inv.amount_paid ?? 0),
        amountDue:   Number(inv.amount_due  ?? 0),
        currency:    String(inv.currency    ?? "eur"),
        description: desc,
        periodStart: inv.period_start != null
          ? new Date(Number(inv.period_start) * 1000).toISOString() : null,
        periodEnd:   inv.period_end   != null
          ? new Date(Number(inv.period_end)   * 1000).toISOString() : null,
        createdAt:   new Date(Number(inv.created) * 1000).toISOString(),
        hostedUrl:   inv.hosted_invoice_url != null ? String(inv.hosted_invoice_url) : null,
        pdfUrl:      inv.invoice_pdf        != null ? String(inv.invoice_pdf)        : null,
      };
    });

    // ── 5. Map PaymentIntents (exclude those already covered by an invoice) ────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentRows: StripeInvoiceRow[] = (paymentIntentList.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((pi: any) => !invoicedPaymentIntentIds.has(String(pi.id)))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((pi: any) => {
        // Resolve a human-readable description from metadata or charges
        const metaDesc  = (pi.metadata?.description as string | null) ?? null;
        const planId    = (pi.metadata?.plan_id    as string | null) ?? null;
        const desc      = metaDesc ?? (planId ? `Plan change → ${planId}` : "One-off payment");

        const amount    = Number(pi.amount ?? 0);
        const received  = Number(pi.amount_received ?? 0);
        const currency  = String(pi.currency ?? "eur");

        // Map Stripe PaymentIntent status to a display-friendly value
        const statusMap: Record<string, string> = {
          succeeded:              "paid",
          requires_payment_method:"failed",
          canceled:               "void",
          processing:             "open",
        };
        const piStatus  = String(pi.status ?? "unknown");
        const status    = statusMap[piStatus] ?? piStatus;

        return {
          id:          String(pi.id),
          number:      null,
          status,
          source:      "payment" as const,
          amountPaid:  status === "paid" ? received || amount : 0,
          amountDue:   amount,
          currency,
          description: desc,
          periodStart: null,
          periodEnd:   null,
          createdAt:   new Date(Number(pi.created) * 1000).toISOString(),
          hostedUrl:   null,
          pdfUrl:      null,
        };
      });

    // ── 6. Merge and sort newest first ────────────────────────────────────────
    const allRows = [...invoiceRows, ...paymentRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { ok: true, invoices: allRows, customerId };

  } catch (err) {
    console.error("[billing/actions] getStripeInvoicesAction failed", err);
    return { ok: false, error: (err as Error).message, customerId: null };
  }
}
