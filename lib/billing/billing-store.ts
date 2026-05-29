/**
 * Billing Store
 *
 * Server-side data access for the billing system.
 * All functions use the service-role Supabase client.
 *
 * ─── Schema ───────────────────────────────────────────────────────────────────
 *
 *   This file targets the WALLET schema (migration 43+):
 *
 *   subscriptions   — plan, status, Stripe IDs, billing period dates
 *   tenant_wallets  — spendable balance in euro cents (one row per tenant)
 *   wallet_ledger   — append-only audit trail of all wallet movements
 *
 *   The old credit_balance and credit_transactions tables do NOT exist in the
 *   live database and are no longer referenced here.
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   isEventAlreadyProcessed() checks wallet_ledger for a prior entry with the
 *   given stripe_event_id stored as reference_id.  This prevents duplicate
 *   webhook processing without requiring the old credit_transactions table.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Functions throw on unrecoverable DB errors so callers (API routes / webhook
 *   handlers) can catch and respond with the appropriate HTTP status.
 */

import "server-only";
import { getDb }                         from "@/data/db";
import { logger }                        from "@/lib/logger";
import type { PackageKey }               from "@/tenant/types";
import type { BillingCycle }             from "./plan-map";
import type { SupabaseClient }           from "@supabase/supabase-js";

/**
 * Returns the Supabase client typed as `any` for billing tables.
 * The generated `Database` type does not yet include the wallet tables —
 * they will be included once `supabase gen types` is re-run after migration 43+.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getBillingDb(): SupabaseClient<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getDb() as unknown as SupabaseClient<any>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubscriptionRow {
  id:                     string;
  tenant_id:              string;
  stripe_customer_id:     string;
  stripe_subscription_id: string | null;
  plan:                   PackageKey;
  status:                 string;
  billing_cycle:          BillingCycle;
  current_period_start:   string | null;
  current_period_end:     string | null;
  cancel_at_period_end:   boolean;
  canceled_at:            string | null;
  created_at:             string;
  updated_at:             string;
}

export type CreditTxType = "purchase" | "deduction" | "grant" | "refund" | "expiry";

// ── Subscription ──────────────────────────────────────────────────────────────

/**
 * Get the subscription row for a tenant.
 * Returns null if no subscription exists (tenant is on the free/default plan).
 */
export async function getSubscription(
  tenantId: string,
): Promise<SubscriptionRow | null> {
  const db = getBillingDb();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    logger.error("[billing-store] getSubscription error", { tenantId, error: error.message });
    throw new Error(`Failed to fetch subscription for tenant ${tenantId}: ${error.message}`);
  }
  return (data ?? null) as SubscriptionRow | null;
}

/**
 * Look up a subscription by Stripe customer ID.
 * Used in webhook handlers where we know the customer ID but not the tenant ID.
 */
export async function getSubscriptionByCustomerId(
  stripeCustomerId: string,
): Promise<SubscriptionRow | null> {
  const db = getBillingDb();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    logger.error("[billing-store] getSubscriptionByCustomerId error", {
      stripeCustomerId,
      error: error.message,
    });
    throw new Error(`Failed to fetch subscription by customer ${stripeCustomerId}: ${error.message}`);
  }
  return (data ?? null) as SubscriptionRow | null;
}

/**
 * Upsert a subscription row.
 * Creates the row if it doesn't exist; merges the provided fields otherwise.
 */
export async function upsertSubscription(
  tenantId:              string,
  stripeCustomerId:      string,
  fields: Partial<Omit<SubscriptionRow, "id" | "tenant_id" | "stripe_customer_id" | "created_at" | "updated_at">>,
): Promise<void> {
  const db = getBillingDb();
  const { error } = await db
    .from("subscriptions")
    .upsert(
      {
        tenant_id:          tenantId,
        stripe_customer_id: stripeCustomerId,
        ...fields,
        updated_at:         new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );

  if (error) {
    logger.error("[billing-store] upsertSubscription error", { tenantId, error: error.message });
    throw new Error(`Failed to upsert subscription for tenant ${tenantId}: ${error.message}`);
  }
}

/**
 * Update specific fields on an existing subscription row.
 * Typically called from webhook handlers after plan/status changes.
 */
export async function updateSubscriptionByCustomerId(
  stripeCustomerId: string,
  fields: Partial<Omit<SubscriptionRow, "id" | "tenant_id" | "stripe_customer_id" | "created_at">>,
): Promise<void> {
  const db = getBillingDb();
  const { error } = await db
    .from("subscriptions")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", stripeCustomerId);

  if (error) {
    logger.error("[billing-store] updateSubscriptionByCustomerId error", {
      stripeCustomerId,
      error: error.message,
    });
    throw new Error(
      `Failed to update subscription for customer ${stripeCustomerId}: ${error.message}`,
    );
  }
}

// ── Wallet balance (reads tenant_wallets) ──────────────────────────────────────

/**
 * Get the current wallet balance for a tenant in euro cents.
 * Reads tenant_wallets.balance_cents.
 * Returns 0 if no wallet row exists yet (uninitialized tenant).
 */
export async function getCreditBalance(tenantId: string): Promise<number> {
  const db = getBillingDb();
  const { data, error } = await db
    .from("tenant_wallets")
    .select("balance_cents")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    logger.error("[billing-store] getCreditBalance (tenant_wallets) error", {
      tenantId,
      code:    error.code,
      message: error.message,
    });
    throw new Error(`Failed to fetch wallet balance for tenant ${tenantId}: ${error.message}`);
  }
  return (data as { balance_cents: number } | null)?.balance_cents ?? 0;
}

// ── Idempotency check (reads wallet_ledger) ───────────────────────────────────

/**
 * Check whether a Stripe event ID has already been processed.
 *
 * Checks wallet_ledger for an entry where reference_id = stripeEventId and
 * reference_type = 'stripe_event'.  Returns true if found — caller should
 * return early without writing.
 */
export async function isEventAlreadyProcessed(stripeEventId: string): Promise<boolean> {
  const db = getBillingDb();
  const { data, error } = await db
    .from("wallet_ledger")
    .select("id")
    .eq("reference_type", "stripe_event")
    .eq("reference_id", stripeEventId)
    .maybeSingle();

  if (error) {
    logger.error("[billing-store] isEventAlreadyProcessed error", {
      stripeEventId,
      code:    error.code,
      message: error.message,
    });
    // On error, treat as not-processed to avoid silently dropping events.
    // The caller will attempt to write and may get a unique constraint error.
    return false;
  }
  return !!data;
}

// ── Credit addition (uses credit_wallet RPC) ───────────────────────────────────

/**
 * Add cents to a tenant's wallet and append a ledger entry.
 *
 * Delegates to the `credit_wallet` Postgres RPC which atomically:
 *   1. Upserts tenant_wallets.balance_cents.
 *   2. Inserts a wallet_ledger row.
 *   3. Reactivates a suspended wallet when funds are added.
 *
 * @param tenantId       Tenant receiving the funds.
 * @param amount         Euro cents to add (must be positive).
 * @param type           Credit type — mapped to wallet entry_type.
 * @param stripeEventId  Stripe event ID for idempotency (null for non-webhook grants).
 * @param options        Additional metadata for the ledger entry.
 */
export async function addCredits(
  tenantId:       string,
  amount:         number,
  type:           CreditTxType,
  stripeEventId:  string | null,
  options: {
    stripePaymentIntent?: string;
    bundleId?:            string;
    description?:         string;
  } = {},
): Promise<{ newBalance: number }> {
  if (amount <= 0) throw new Error("[billing-store] addCredits: amount must be positive");

  if (stripeEventId) {
    const isDuplicate = await isEventAlreadyProcessed(stripeEventId);
    if (isDuplicate) {
      logger.info("[billing-store] addCredits: duplicate event, skipping", { stripeEventId });
      const balance = await getCreditBalance(tenantId);
      return { newBalance: balance };
    }
  }

  // Map CreditTxType → wallet entry_type
  const entryType =
    type === "refund"  ? "top_up_refund"     :
    type === "grant"   ? "manual_adjustment" :
    /* purchase / default */ "top_up_manual";

  const db = getBillingDb();
  const { data: balanceData, error: rpcError } = await db.rpc("credit_wallet", {
    p_tenant_id:      tenantId,
    p_amount_cents:   amount,
    p_entry_type:     entryType,
    p_reference_type: stripeEventId ? "stripe_event" : (options.bundleId ? "bundle" : null),
    p_reference_id:   stripeEventId ?? options.bundleId ?? null,
    p_note:           options.description ?? null,
  });

  if (rpcError) {
    logger.error("[billing-store] addCredits: credit_wallet RPC error", {
      tenantId,
      amount,
      error: rpcError.message,
    });
    throw new Error(`Failed to credit wallet: ${rpcError.message}`);
  }

  const newBalance = (balanceData as number) ?? 0;
  logger.info("[billing-store] addCredits: success", { tenantId, amount, newBalance, type });
  return { newBalance };
}

// ── Credit deduction (uses debit_wallet RPC) ──────────────────────────────────

/**
 * Deduct cents from a tenant's wallet.
 *
 * Delegates to the `debit_wallet` Postgres RPC which atomically:
 *   1. Decrements tenant_wallets.balance_cents.
 *   2. Inserts a wallet_ledger enrichment_debit entry.
 *   3. Raises 'insufficient_wallet_balance' if balance < amount or not active.
 *
 * Returns { ok: false } when the balance is insufficient — no partial deductions.
 */
export async function deductCredits(
  tenantId:  string,
  amount:    number,
  feature:   string,
  options: {
    description?: string;
  } = {},
): Promise<{ ok: boolean; newBalance?: number; reason?: string }> {
  if (amount <= 0) throw new Error("[billing-store] deductCredits: amount must be positive");

  const db = getBillingDb();
  const { data: balanceData, error: rpcError } = await db.rpc("debit_wallet", {
    p_tenant_id:      tenantId,
    p_amount_cents:   amount,
    p_reference_type: feature,
    p_note:           options.description ?? null,
  });

  if (rpcError) {
    if (
      rpcError.message?.includes("insufficient_wallet_balance") ||
      rpcError.message?.includes("insufficient_credits")
    ) {
      return { ok: false, reason: "insufficient_credits" };
    }
    logger.error("[billing-store] deductCredits: debit_wallet RPC error", {
      tenantId,
      amount,
      error: rpcError.message,
    });
    throw new Error(`Failed to debit wallet: ${rpcError.message}`);
  }

  const newBalance = (balanceData as number) ?? 0;
  return { ok: true, newBalance };
}
