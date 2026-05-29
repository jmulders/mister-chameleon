/**
 * billing/usage.ts
 *
 * Wallet balance and usage management — server-side DB operations.
 *
 * ─── Schema ───────────────────────────────────────────────────────────────────
 *
 *   All reads and writes target the WALLET schema (migration 43+):
 *
 *   tenant_wallets    — one row per tenant: spendable balance in euro cents
 *   wallet_ledger     — append-only audit trail of every wallet movement
 *   subscriptions     — one row per tenant: plan, status, billing period dates
 *
 *   The old credit_balance and credit_transactions tables (migration 35/40)
 *   do NOT exist in the live database.  This file no longer references them.
 *
 * ─── Units ────────────────────────────────────────────────────────────────────
 *
 *   All monetary amounts are in euro cents (integer).
 *   "getCreditBalance" returns balance_cents for backward-compat naming;
 *   callers that display a euro amount should divide by 100.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended for writes).
 *   Do NOT import in client components.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   READ functions are unconditionally fail-safe: they return 0 / [] / safe
 *   defaults on any database error.  The actual error code and message are
 *   logged as flat interpolated strings so Next.js terminal never collapses
 *   them to {}.
 *
 *   WRITE functions (deductCredits, addCredits) throw on unexpected errors
 *   because a silent failure there would corrupt the financial ledger.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreditTxType,
  CreditTransaction,
  CreditBalance,
  UsageSummary,
  DeductionResult,
  WalletEntryType,
} from "./types";

// ── Schema-safe error codes ────────────────────────────────────────────────────
//
// These indicate the table or column doesn't exist, or that the DB schema
// doesn't match the application code.  READ functions return safe defaults for
// all of these; writes throw.
//
// Accepts string | null | undefined so callers need not guard before passing
// error.code (which may be undefined for network-level errors).
//
export function isSchemaMissingCode(code: string | null | undefined): boolean {
  return (
    code === "42P01"       // relation does not exist (table missing)
    || code === "42703"    // column does not exist (partial migration, PostgreSQL)
    || code === "22P02"    // invalid input for type uuid (type mismatch)
    || code === "PGRST200" // PostgREST schema cache stale
    || code === "PGRST204" // column not found in PostgREST schema cache
    || code === "PGRST205" // table not found in schema cache
  );
}

// Re-export types for consumers that imported them from here
export type { CreditTxType, CreditTransaction, CreditBalance, UsageSummary, DeductionResult };

// ── Logging helper ─────────────────────────────────────────────────────────────
//
// Flat-string format so Next.js terminal never collapses the structured
// object to {}.  Uses warn for schema-missing codes, error for everything else.

function logDbError(
  prefix:   string,
  tenantId: string,
  code:     string | null | undefined,
  message:  string | null | undefined,
): void {
  const line =
    `${prefix} — tenantId=${tenantId} code=${code ?? "(none)"} message=${message ?? "(none)"}`;
  if (isSchemaMissingCode(code)) {
    console.warn(line);
  } else {
    console.error(line);
  }
}

// ── WalletLedgerEntry → CreditTransaction mapping ─────────────────────────────
//
// The billing dashboard renders CreditTransaction rows.  Wallet ledger entries
// map to that shape so the UI doesn't need to be changed.

function walletEntryToCreditTxType(
  entryType:   WalletEntryType,
  amountCents: number,
): CreditTxType {
  switch (entryType) {
    case "enrichment_debit":
    case "sim_debit":
      return "deduction";
    case "top_up_refund":
      return "refund";
    case "failed_reload":
    case "sim_failed_reload":
      return "refund";
    case "manual_adjustment":
      // Positive adjustment = grant, negative = corrective deduction.
      return amountCents >= 0 ? "grant" : "deduction";
    default:
      // top_up_manual | top_up_auto_reload | sim_top_up | sim_auto_reload
      return "purchase";
  }
}

function ledgerRowToCreditTransaction(row: {
  id:                  string;
  tenant_id:           string;
  entry_type:          string;
  amount_cents:        number;
  balance_after_cents: number;
  reference_type:      string | null;
  reference_id:        string | null;
  note:                string | null;
  created_at:          string;
}): CreditTransaction {
  return {
    id:            row.id,
    tenant_id:     row.tenant_id,
    type:          walletEntryToCreditTxType(
                     row.entry_type as WalletEntryType,
                     row.amount_cents,
                   ),
    amount:        row.amount_cents,
    balance_after: row.balance_after_cents,
    feature:       row.reference_type ?? null,
    description:   row.note ?? null,
    created_at:    row.created_at,
  };
}

// ── Credit balance (reads tenant_wallets) ─────────────────────────────────────

/**
 * Get the current wallet balance for a tenant in euro cents.
 *
 * Reads tenant_wallets.balance_cents.  Returns 0 when:
 *   - no wallet row exists yet (uninitialized tenant)
 *   - any database error occurs (logged; never throws)
 */
export async function getCreditBalance(
  client:   SupabaseClient,
  tenantId: string,
): Promise<number> {
  const { data, error } = await client
    .from("tenant_wallets")
    .select("balance_cents")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    logDbError(
      "[billing/usage] getCreditBalance: tenant_wallets query error — returning 0",
      tenantId,
      error.code,
      error.message,
    );
    return 0;
  }

  return (data as { balance_cents: number } | null)?.balance_cents ?? 0;
}

/**
 * Get the wallet balance row for a tenant.
 * Mapped to the CreditBalance shape for backward compatibility.
 * Returns null when no wallet row exists or on any error.  Never throws.
 */
export async function getCreditBalanceRow(
  client:   SupabaseClient,
  tenantId: string,
): Promise<CreditBalance | null> {
  const { data, error } = await client
    .from("tenant_wallets")
    .select("tenant_id, balance_cents, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    logDbError(
      "[billing/usage] getCreditBalanceRow: tenant_wallets query error — returning null",
      tenantId,
      error.code,
      error.message,
    );
    return null;
  }

  if (!data) return null;

  const row = data as { tenant_id: string; balance_cents: number; updated_at: string };
  return {
    tenant_id:  row.tenant_id,
    balance:    row.balance_cents,   // balance_cents exposed as "balance"
    updated_at: row.updated_at,
  };
}

// ── Transaction history (reads wallet_ledger) ─────────────────────────────────

/**
 * Fetch wallet ledger entries for a tenant, mapped to CreditTransaction shape.
 * Returns [] on any database error (logged).  Never throws.
 *
 * @param client    Supabase client.
 * @param tenantId  Tenant to query.
 * @param limit     Max rows to return (default 50).
 */
export async function getCreditHistory(
  client:   SupabaseClient,
  tenantId: string,
  limit     = 50,
): Promise<CreditTransaction[]> {
  const { data, error } = await client
    .from("wallet_ledger")
    .select("id, tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, reference_id, note, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logDbError(
      "[billing/usage] getCreditHistory: wallet_ledger query error — returning []",
      tenantId,
      error.code,
      error.message,
    );
    return [];
  }

  return (data ?? []).map(ledgerRowToCreditTransaction);
}

// ── Wallet debit (replaces deductCredits / decrement_credit_balance RPC) ──────

/**
 * Atomically deduct cents from a tenant's wallet.
 *
 * Delegates to the `debit_wallet` Postgres RPC, which:
 *   1. Decrements tenant_wallets.balance_cents atomically.
 *   2. Inserts a wallet_ledger row in the same transaction.
 *   3. Raises 'insufficient_wallet_balance' if balance < amount or not active.
 *
 * Returns { success: false } when the balance is insufficient — no partial
 * deductions occur.
 *
 * @param client         Service-role Supabase client recommended.
 * @param tenantId       Tenant to charge.
 * @param amount         Cents to deduct (positive integer).
 * @param feature        Human-readable label stored as reference_type in ledger.
 * @param idempotencyKey Unused (kept for API compat) — wallet RPC is atomic.
 */
export async function deductCredits(
  client:          SupabaseClient,
  tenantId:        string,
  amount:          number,
  feature:         string,
  idempotencyKey?: string,
): Promise<DeductionResult> {
  if (amount <= 0) throw new Error("[billing/usage] deductCredits: amount must be positive");

  const { data, error } = await client.rpc("debit_wallet", {
    p_tenant_id:      tenantId,
    p_amount_cents:   amount,
    p_reference_type: feature,
    p_reference_id:   idempotencyKey ?? null,   // disambiguates 6-param overload
    p_note:           null,
    p_category:       null,                     // caller can pass category if known
  });

  if (error) {
    if (
      error.message?.includes("insufficient_wallet_balance") ||
      error.message?.includes("insufficient_credits")
    ) {
      const balance = await getCreditBalance(client, tenantId);
      return { success: false, balanceAfter: balance, error: "Insufficient balance" };
    }
    throw new Error(
      `[billing/usage] deductCredits (debit_wallet) RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  const balanceAfter = typeof data === "number" ? data : 0;
  return { success: true, balanceAfter };
}

// ── Wallet credit (replaces addCredits / increment_credit_balance RPC) ────────

/**
 * Add cents to a tenant's wallet (top-up, grant, or refund).
 *
 * Delegates to the `credit_wallet` Postgres RPC, which:
 *   1. Upserts tenant_wallets.balance_cents atomically.
 *   2. Inserts a wallet_ledger row in the same transaction.
 *   3. Reactivates a suspended wallet when funds are added.
 *
 * @param client    Service-role Supabase client recommended.
 * @param tenantId  Tenant receiving the credit.
 * @param amount    Cents to add (positive integer).
 * @param type      CreditTxType — mapped to wallet entry_type.
 * @param options   Optional metadata for the ledger entry.
 * @returns         New wallet balance in cents after the credit.
 */
export async function addCredits(
  client:   SupabaseClient,
  tenantId: string,
  amount:   number,
  type:     CreditTxType,
  options?: {
    stripeEventId?: string;
    bundleId?:      string;
    description?:   string;
    /**
     * Which credit pool to fill.
     *   "subscription" — credits included by the plan; reset each billing period.
     *   "purchased"    — credits bought via top-up bundles; never reset (default).
     * Added in migration 092.  Falls back to "purchased" on older DB schemas.
     */
    creditPool?: "subscription" | "purchased";
  },
): Promise<number> {
  if (amount <= 0) throw new Error("[billing/usage] addCredits: amount must be positive");

  // Map CreditTxType → wallet_entry_type
  const entryType =
    type === "refund"  ? "top_up_refund"  :
    type === "grant"   ? "manual_adjustment" :
    /* purchase / default */ "top_up_manual";

  // "grant" type = subscription credits (plan-included); everything else = purchased.
  const creditType = options?.creditPool ?? (type === "grant" ? "subscription" : "purchased");

  const referenceValue = options?.stripeEventId ?? options?.bundleId ?? null;

  const { data, error } = await client.rpc("credit_wallet", {
    p_tenant_id:    tenantId,
    p_amount_cents: amount,
    p_entry_type:   entryType,
    p_reference:    referenceValue,
    p_note:         options?.description ?? null,
    p_credit_type:  creditType,
  });

  // ── PGRST202 fallback: PostgREST schema cache is stale ─────────────────────
  //
  // Migration 092 added a new 6-param credit_wallet (replacing the old 7-param
  // version) but used CREATE OR REPLACE with a different signature, which in
  // Postgres creates a NEW overload rather than replacing the existing one.
  // If PostgREST's cache was loaded before migration 092 it only knows the old
  // 7-param signature and returns PGRST202 for the new 6-param call.
  //
  // Fix: retry with the old parameter names so PostgREST can resolve the call
  // against its cached 7-param signature.  Credits are still added correctly;
  // the only difference is the subscription_credits split column is not updated
  // (that column was added in the same migration).  A one-time `supabase db push`
  // (migration 094) will apply NOTIFY pgrst, 'reload schema' and drop the old
  // overload — after that this fallback path is never reached.

  if (error?.code === "PGRST202") {
    console.warn(
      `[billing/usage] addCredits: PGRST202 schema-cache miss for new credit_wallet signature — ` +
      `falling back to legacy 7-param call for tenant "${tenantId}". ` +
      `Run "supabase db push" to apply migration 094 and fix permanently.`,
    );

    const { data: legacyData, error: legacyError } = await client.rpc("credit_wallet", {
      p_tenant_id:      tenantId,
      p_amount_cents:   amount,
      p_entry_type:     entryType,
      p_reference_type: "manual",
      p_reference_id:   referenceValue,
      p_note:           options?.description ?? null,
      // "subscription" was added as a valid category only in migration 092.
      // The legacy function runs against the pre-092 schema whose
      // wallet_ledger_category_check constraint does not include it.
      // Always use "topup" here — the credit split (subscription vs purchased)
      // is a migration-092 concept and doesn't apply to the legacy path.
      p_category:       "topup",
    });

    if (legacyError) {
      throw new Error(
        `[billing/usage] addCredits (credit_wallet legacy fallback) RPC failed for tenant "${tenantId}": ` +
        `${legacyError.message} (code: ${legacyError.code})`,
      );
    }

    return typeof legacyData === "number" ? legacyData : amount;
  }

  if (error) {
    throw new Error(
      `[billing/usage] addCredits (credit_wallet) RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  return typeof data === "number" ? data : amount;
}

// ── Usage summary ─────────────────────────────────────────────────────────────

/**
 * Build a wallet-based usage summary for a tenant for the current billing period.
 *
 * Data sources:
 *   subscriptions  — billing period start/end dates
 *   tenant_wallets — current balance in cents
 *   wallet_ledger  — purchased and spent amounts in the period
 *
 * All internal database errors are logged and swallowed — this function never
 * throws.  Sub-queries that fail yield 0 for their respective fields.
 *
 * @param client          Supabase client.
 * @param tenantId        Tenant to query.
 * @param includedCredits Plan's included credit threshold (in cents for wallet billing).
 */
export async function getUsageSummary(
  client:          SupabaseClient,
  tenantId:        string,
  includedCredits: number,
): Promise<UsageSummary> {
  // ── Subscription period dates ────────────────────────────────────────────────

  const { data: sub, error: subErr } = await client
    .from("subscriptions")
    .select("current_period_start, current_period_end")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (subErr) {
    logDbError(
      "[billing/usage] getUsageSummary: subscriptions query failed — period dates will be null",
      tenantId,
      subErr.code,
      subErr.message,
    );
  }

  const periodStart =
    (sub as { current_period_start?: string } | null)?.current_period_start ?? null;
  const periodEnd =
    (sub as { current_period_end?: string } | null)?.current_period_end ?? null;

  // ── Current balance from tenant_wallets ──────────────────────────────────────

  const currentBalance = await getCreditBalance(client, tenantId);

  // ── Wallet ledger aggregation for the billing period ─────────────────────────
  //
  // Positive amount_cents = funds added (top-ups/grants).
  // Negative amount_cents = funds spent (enrichment debits).
  // Skipped when periodStart is unknown (no subscription).

  let purchasedCredits = 0;
  let deductedCredits  = 0;

  if (periodStart) {
    const { data: ledger, error: ledgerErr } = await client
      .from("wallet_ledger")
      .select("amount_cents")
      .eq("tenant_id", tenantId)
      .gte("created_at", periodStart);

    if (ledgerErr) {
      logDbError(
        "[billing/usage] getUsageSummary: wallet_ledger query failed — usage totals will be 0",
        tenantId,
        ledgerErr.code,
        ledgerErr.message,
      );
      // Fall through with zero aggregates — do NOT throw.
    } else {
      for (const row of (ledger ?? []) as { amount_cents: number }[]) {
        if (row.amount_cents > 0) purchasedCredits += row.amount_cents;
        else                      deductedCredits  += Math.abs(row.amount_cents);
      }
    }
  }

  const overageCredits = Math.max(0, deductedCredits - includedCredits);
  const usedCredits    = Math.min(deductedCredits, includedCredits);

  return {
    tenantId,
    currentBalance,
    includedCredits,
    usedCredits,
    deductedCredits,   // raw ledger debits — used for reconciliation checks
    purchasedCredits,
    overageCredits,
    periodStart,
    periodEnd,
  };
}
