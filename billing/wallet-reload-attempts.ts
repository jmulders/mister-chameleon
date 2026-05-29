/**
 * billing/wallet-reload-attempts.ts
 *
 * CRUD helpers for the wallet_reload_attempts table.
 *
 * ─── Safety model ─────────────────────────────────────────────────────────────
 *
 *   The table has a DB-level partial unique index:
 *     UNIQUE (tenant_id) WHERE status IN ('pending', 'processing')
 *
 *   This guarantees at most ONE in-flight attempt per wallet, even under
 *   concurrent requests.  createReloadAttempt() will return null when a
 *   duplicate is rejected (code 23P01 / 23505) — callers should exit quietly.
 *
 * ─── Webhook helpers ──────────────────────────────────────────────────────────
 *
 *   findByPaymentIntent()  — look up an attempt by stripe_payment_intent_id.
 *   Both process_wallet_reload_success and process_wallet_reload_failure are
 *   Postgres RPCs (migration 44) that act as atomic state transitions.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WalletReloadAttempt, ReloadAttemptStatus } from "./types";
import { isSchemaMissingCode } from "./usage";

export type { WalletReloadAttempt, ReloadAttemptStatus };

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Insert a new reload attempt row with status='pending'.
 *
 * Returns null if the insert is rejected because an active attempt already
 * exists for this tenant (DB partial unique index, code 23P01/23505) — caller
 * should exit quietly; this is the intended deduplication mechanism.
 *
 * @param idempotencyKey  Must be globally unique — use `wr:${crypto.randomUUID()}`.
 */
export async function createReloadAttempt(
  client:              SupabaseClient,
  tenantId:            string,
  triggerBalanceCents: number,
  reloadAmountCents:   number,
  idempotencyKey:      string,
): Promise<WalletReloadAttempt | null> {
  const { data, error } = await client
    .from("wallet_reload_attempts")
    .insert({
      tenant_id:             tenantId,
      trigger_balance_cents: triggerBalanceCents,
      reload_amount_cents:   reloadAmountCents,
      idempotency_key:       idempotencyKey,
      status:                "pending",
    })
    .select()
    .single();

  if (error) {
    // 23P01 = exclusion violation (partial unique index).
    // 23505 = unique violation (fallback for older Postgres).
    if (error.code === "23P01" || error.code === "23505") {
      console.info("[billing/wallet-reload-attempts] active attempt already exists — skipping", {
        tenantId,
      });
      return null;
    }
    throw new Error(
      `[billing/wallet-reload-attempts] createReloadAttempt failed: ${error.message} (code: ${error.code})`,
    );
  }

  return data as WalletReloadAttempt;
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Return the currently active (pending or processing) reload attempt for a
 * wallet, or null if none exists.
 */
export async function getActiveReloadAttempt(
  client:   SupabaseClient,
  tenantId: string,
): Promise<WalletReloadAttempt | null> {
  const { data, error } = await client
    .from("wallet_reload_attempts")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingCode(error.code)) return null;
    throw new Error(
      `[billing/wallet-reload-attempts] getActiveReloadAttempt failed: ${error.message} (code: ${error.code})`,
    );
  }

  return data as WalletReloadAttempt | null;
}

/**
 * Look up a reload attempt by Stripe PaymentIntent ID.
 * Used by the webhook handler to correlate payment events.
 */
export async function findByPaymentIntent(
  client:                  SupabaseClient,
  stripePaymentIntentId:   string,
): Promise<WalletReloadAttempt | null> {
  const { data, error } = await client
    .from("wallet_reload_attempts")
    .select("*")
    .eq("stripe_payment_intent_id", stripePaymentIntentId)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingCode(error.code)) return null;
    throw new Error(
      `[billing/wallet-reload-attempts] findByPaymentIntent failed: ${error.message} (code: ${error.code})`,
    );
  }

  return data as WalletReloadAttempt | null;
}

/**
 * Fetch recent reload attempts for a tenant (for the admin UI).
 */
export async function getRecentReloadAttempts(
  client:   SupabaseClient,
  tenantId: string,
  limit     = 10,
): Promise<WalletReloadAttempt[]> {
  const { data, error } = await client
    .from("wallet_reload_attempts")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isSchemaMissingCode(error.code)) {
      console.warn("[billing/wallet-reload-attempts] getRecentReloadAttempts: schema missing or type mismatch", {
        code: error.code, tenantId,
      });
      return [];
    }
    throw new Error(
      `[billing/wallet-reload-attempts] getRecentReloadAttempts failed: ${error.message} (code: ${error.code})`,
    );
  }

  return (data ?? []) as WalletReloadAttempt[];
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Attach the Stripe PaymentIntent ID to an attempt and advance it to
 * 'processing' status.  Called immediately after the PaymentIntent is created.
 */
export async function markAttemptProcessing(
  client:                SupabaseClient,
  attemptId:             string,
  stripePaymentIntentId: string,
): Promise<void> {
  const { error } = await client
    .from("wallet_reload_attempts")
    .update({
      status:                   "processing",
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .eq("id", attemptId)
    .eq("status", "pending"); // only advance from pending

  if (error) {
    throw new Error(
      `[billing/wallet-reload-attempts] markAttemptProcessing failed: ${error.message} (code: ${error.code})`,
    );
  }
}

/**
 * Mark an attempt as cancelled (e.g. because the monthly cap was discovered
 * after the attempt row was created but before the PaymentIntent was charged).
 */
export async function cancelAttempt(
  client:        SupabaseClient,
  attemptId:     string,
  failureReason: string,
): Promise<void> {
  const { error } = await client
    .from("wallet_reload_attempts")
    .update({
      status:         "cancelled",
      failure_reason: failureReason,
    })
    .eq("id", attemptId)
    .in("status", ["pending", "processing"]);

  if (error) {
    throw new Error(
      `[billing/wallet-reload-attempts] cancelAttempt failed: ${error.message} (code: ${error.code})`,
    );
  }
}

// ── Atomic state transitions (DB RPCs) ────────────────────────────────────────
//
// These are thin wrappers around the Postgres RPCs defined in migration 44.
// Both the attempt status update AND the wallet credit/no-op happen atomically
// in a single DB transaction, preventing partial-write inconsistency.

/**
 * Atomically mark an attempt as succeeded AND credit the wallet.
 * Idempotent: returns -1 if the attempt was already in a terminal state.
 *
 * Delegates to the `process_wallet_reload_success` Postgres RPC (migration 44).
 *
 * @returns New wallet balance_cents, or -1 if already processed.
 */
export async function atomicSuccessAndCredit(
  client:                SupabaseClient,
  attemptId:             string,
  stripePaymentIntentId?: string,
): Promise<number> {
  const { data, error } = await client.rpc("process_wallet_reload_success", {
    p_attempt_id:               attemptId,
    p_stripe_payment_intent_id: stripePaymentIntentId ?? null,
  });

  if (error) {
    throw new Error(
      `[billing/wallet-reload-attempts] atomicSuccessAndCredit RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  return typeof data === "number" ? data : -1;
}

/**
 * Atomically mark an attempt as failed or action_required.
 * Idempotent: no-op if the attempt is already in a terminal state.
 *
 * Delegates to the `process_wallet_reload_failure` Postgres RPC (migration 44).
 *
 * @returns true if the attempt was updated, false if already terminal.
 */
export async function atomicFailure(
  client:                SupabaseClient,
  attemptId:             string,
  newStatus:             "failed" | "action_required" | "cancelled",
  failureReason?:        string,
  stripePaymentIntentId?: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("process_wallet_reload_failure", {
    p_attempt_id:               attemptId,
    p_new_status:               newStatus,
    p_failure_reason:           failureReason ?? null,
    p_stripe_payment_intent_id: stripePaymentIntentId ?? null,
  });

  if (error) {
    throw new Error(
      `[billing/wallet-reload-attempts] atomicFailure RPC failed: ${error.message} (code: ${error.code})`,
    );
  }

  return data === true;
}
