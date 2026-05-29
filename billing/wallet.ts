/**
 * billing/wallet.ts
 *
 * Core wallet operations — server-side DB operations for the tenant wallet.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended for writes).
 *   Do NOT import in client components.
 *
 * ─── Model ────────────────────────────────────────────────────────────────────
 *
 *   tenant_wallets  — one row per tenant; current balance + config (denormalized).
 *   wallet_ledger   — append-only audit trail of every balance movement.
 *
 *   Canonical unit: NUMERIC credits (1 credit = €0.01).
 *   Integer cents columns (balance_cents, amount_cents, etc.) are kept as legacy
 *   aliases, written in parallel by all RPCs.  Migration 076 adds the NUMERIC
 *   columns and upgrades the debit_wallet RPC to accept p_credit_cost NUMERIC.
 *
 * ─── Atomic operations ───────────────────────────────────────────────────────
 *
 *   debitWallet()  — uses the `debit_wallet` Postgres RPC (migration 076) for
 *                    atomic UPDATE + ledger INSERT in a single transaction.
 *                    Accepts creditCost NUMERIC (decimal credits).
 *                    Raises if balance is insufficient or wallet is not active.
 *
 *   creditWallet() — uses the `credit_wallet` RPC for an atomic UPSERT +
 *                    ledger INSERT.  Also reactivates a 'suspended' wallet.
 *
 * ─── Status lifecycle ─────────────────────────────────────────────────────────
 *
 *   active    → (debit brings to 0) → suspended
 *   suspended → (credit added)      → active     (handled inside credit_wallet RPC)
 *   frozen    → (admin action only) → active
 *
 * ─── Notifications ────────────────────────────────────────────────────────────
 *
 *   debitWallet() fires-and-forgets notifications when:
 *     • Balance drops below low_balance_threshold_cents → notifyLowBalance
 *     • Balance reaches 0 → notifyEmptyWallet + status set to 'suspended'
 *
 *   Auto-reload triggering is handled separately in billing/auto-reload.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TenantWallet,
  WalletState,
  WalletDebitResult,
  WalletEntryType,
} from "./types";
import type { CreditCategory, FallbackMode } from "./credits";
import { serializeError } from "./errors";

// Re-export types for consumers that import from here
export type { TenantWallet, WalletState, WalletDebitResult };

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Fetch the wallet row for a tenant.
 * Returns null if no wallet exists yet (tenant has not been initialized).
 */
export async function getWallet(
  client:   SupabaseClient,
  tenantId: string,
): Promise<TenantWallet | null> {
  const { data, error } = await client
    .from("tenant_wallets")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    // 42P01 = table missing; 42703 = column missing (schema mismatch).
    // Both mean the wallet migration has not been fully applied — treat as "no wallet".
    if (error.code === "42P01" || error.code === "42703") {
      console.warn("[billing/wallet] getWallet: tenant_wallets schema missing", {
        code: error.code, message: error.message,
      });
      return null;
    }
    throw new Error(
      `[billing/wallet] getWallet failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  return data as TenantWallet | null;
}

/**
 * Ensure a wallet row exists for a tenant, creating one with safe defaults
 * if it doesn't yet exist.  Returns the wallet row (existing or newly created).
 *
 * This is the canonical entrypoint for wallet initialization.  Call it before
 * any UPDATE on tenant_wallets so admin saves (cap, auto-reload, notifications)
 * are never silently swallowed by a missing row.
 *
 * Delegates to the `ensure_wallet` Postgres RPC which uses
 * INSERT … ON CONFLICT DO NOTHING for atomic, race-safe initialization.
 *
 * Defaults when a new row is created (column-level DB defaults):
 *   balance_cents                 = 0
 *   status                        = 'active'
 *   monthly_credit_cap_cents       = 0      (unlimited)
 *   fallback_mode                 = 'smart_lite'
 *   auto_reload_enabled           = false
 *   low_balance_threshold_cents    = 0
 *   notify_email / notify_sms     = false
 */
export async function ensureWallet(
  client:   SupabaseClient,
  tenantId: string,
): Promise<TenantWallet> {
  const { data, error } = await client.rpc("ensure_wallet", {
    p_tenant_id: tenantId,
  });

  if (error) {
    // PGRST202 = function not found (migration 054 not applied yet).
    // Fall back to the application-level SELECT → INSERT path so pre-migration
    // deployments keep working.
    if (
      error.code === "PGRST202" ||
      error.code === "42P01"    ||
      String(error.message).includes("PGRST202")
    ) {
      console.warn(
        `[billing/wallet] ensureWallet: RPC not found (migration 054 not applied?) — using fallback path tenantId=${tenantId}`,
      );
      return _ensureWalletFallback(client, tenantId);
    }
    throw new Error(
      `[billing/wallet] ensureWallet RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  // ensure_wallet returns SETOF tenant_wallets — PostgREST gives us an array.
  const rows = data as TenantWallet[] | null;
  const row  = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    // Should not happen — the RPC always returns the row.
    throw new Error(
      `[billing/wallet] ensureWallet returned no row for tenant "${tenantId}" — check migration 054`,
    );
  }
  return row;
}

/**
 * Application-level fallback for ensureWallet() used when the ensure_wallet
 * RPC is not yet available (migration 054 not applied).
 *
 * @internal  Not exported — callers use ensureWallet() only.
 */
async function _ensureWalletFallback(
  client:   SupabaseClient,
  tenantId: string,
): Promise<TenantWallet> {
  const existing = await getWallet(client, tenantId);
  if (existing) return existing;

  const { data, error } = await client
    .from("tenant_wallets")
    .insert({ tenant_id: tenantId })
    .select()
    .single();

  if (error) {
    // Race: another request created the row between our read and write.
    if (error.code === "23505") {
      const row = await getWallet(client, tenantId);
      if (row) return row;
    }
    throw new Error(
      `[billing/wallet] _ensureWalletFallback failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  return data as TenantWallet;
}

// ── Read: wallet state (single RPC — replaces 4 separate queries) ────────────

/**
 * Fetch the full wallet state for a tenant in a single round-trip.
 *
 * Calls the `get_wallet_state` Postgres RPC (migration 055) which atomically:
 *   1. Initialises the wallet row if it doesn't exist (INSERT ON CONFLICT DO NOTHING).
 *   2. Returns all tenant_wallets columns.
 *   3. Appends pre-computed spend summaries (today / this-month / period) and
 *      convenience flags (is_low_balance, has_payment_method).
 *   4. Joins the billing period dates from the subscriptions table.
 *
 * This single call replaces the combination of:
 *   • ensureWallet()         — lazy init + read
 *   • getCreditBalance()     — redundant once walletState.balance_cents is available
 *   • getWalletSpend(today)  — now walletState.spend_today_cents
 *   • getWalletSpend(month)  — now walletState.spend_this_month_cents
 *
 * Returns null when:
 *   • The RPC is not yet available (migration 055 not applied) — the page
 *     falls back gracefully to null/default values.
 *   • An unexpected DB error occurs — logged; caller handles null.
 *
 * The return type (WalletState) extends TenantWallet, so it can be passed
 * directly to any component that accepts `wallet: TenantWallet | null`.
 */
export async function getWalletState(
  client:   SupabaseClient,
  tenantId: string,
): Promise<WalletState | null> {
  const { data, error } = await client.rpc("get_wallet_state", {
    p_tenant_id: tenantId,
  });

  if (error) {
    // PGRST202 / 42P01 = RPC or table not found (migration not applied yet).
    // Return null so the caller can degrade gracefully (page shows defaults).
    if (
      error.code === "PGRST202" ||
      error.code === "42P01"    ||
      String(error.message).includes("PGRST202")
    ) {
      console.warn(
        `[billing/wallet] getWalletState: RPC unavailable (migration 055 not applied?) — returning null tenantId=${tenantId}`,
      );
      return null;
    }

    // 42702 = "column reference is ambiguous" — the live get_wallet_state function
    // contains an unqualified `tenant_id` reference that clashes with the RETURNS TABLE
    // OUT parameter of the same name.  Migration 060 fixes the RPC by replacing the
    // inline INSERT with PERFORM public.ensure_wallet(p_tenant_id).
    //
    // Until the migration is applied, fall back to a direct tenant_wallets SELECT so
    // the billing page remains functional.  Spend fields (period_spend_cents etc.) are
    // zeroed in the fallback — accurate balance and status are always shown.
    if (
      error.code === "42702" ||
      String(error.message).includes("42702") ||
      String(error.message).includes("ambiguous")
    ) {
      console.warn(
        `[billing/wallet] getWalletState: 42702 ambiguous column ref — applying fallback (run: supabase db push to fix permanently, migration 060) tenantId=${tenantId}`,
      );
      return _getWalletStateFallback(client, tenantId);
    }

    // 42804 = "structure of query does not match function result type".
    // Caused by ensure_wallet (migration 054) having a stale cached plan after
    // migration 083 widened the tenant_wallets schema — the RETURNS SETOF /
    // SELECT * mismatch.  Migration 085 fixes this permanently.  Until it is
    // applied, fall back to a direct SELECT so the billing page remains
    // functional.
    if (
      error.code === "42804" ||
      String(error.message).includes("42804") ||
      String(error.message).includes("structure of query does not match")
    ) {
      console.warn(
        `[billing/wallet] getWalletState: 42804 return-type mismatch — applying fallback (run: supabase db push to fix permanently, migration 085) tenantId=${tenantId}`,
      );
      return _getWalletStateFallback(client, tenantId);
    }

    // 23505 = "duplicate key value violates unique constraint".
    // Caused when the live tenant_wallets table has a separate UNIQUE constraint
    // on tenant_id (e.g. "uq_tenant_wallets_tenant_id") in addition to — or
    // instead of — the primary key ("tenant_wallets_pkey").  The RPC's
    // INSERT … ON CONFLICT ON CONSTRAINT tenant_wallets_pkey targets the PK by
    // name, so conflicts on the other constraint are not caught, causing a 23505
    // to bubble up.  Migration 091 fixes the RPC permanently by switching to
    // ON CONFLICT (tenant_id) DO NOTHING (column-based, constraint-name-agnostic).
    // Until the migration is applied, fall back gracefully.
    if (
      error.code === "23505" ||
      String(error.message).includes("23505") ||
      String(error.message).includes("duplicate key value")
    ) {
      console.warn(
        `[billing/wallet] getWalletState: 23505 duplicate key (uq_tenant_wallets_tenant_id?) — applying fallback (run: supabase db push to fix permanently, migration 091) tenantId=${tenantId}`,
      );
      return _getWalletStateFallback(client, tenantId);
    }

    throw new Error(
      `[billing/wallet] getWalletState RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  // get_wallet_state returns SETOF — PostgREST wraps the result in an array.
  const rows = data as WalletState[] | null;
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

/**
 * Fallback for getWalletState() used when the live get_wallet_state RPC has a
 * type mismatch or column error (pre-migration-083/085/086 live DB).
 *
 * Computes spend directly from wallet_ledger.amount (NUMERIC, migration 076)
 * so sub-credit debits (e.g. amount=-0.0100) are included.  Summing
 * amount_cents would give 0 for these rows because ROUND(0.01)=0.
 *
 * This fallback is correct even before migration 086 is applied.
 *
 * @internal  Not exported — use getWalletState() exclusively.
 */
async function _getWalletStateFallback(
  client:   SupabaseClient,
  tenantId: string,
): Promise<WalletState | null> {
  const wallet = await getWallet(client, tenantId);
  if (!wallet) return null;

  // ── Compute spend summaries directly from wallet_ledger.amount ────────────
  //
  // Use amount (NUMERIC, migration 076) instead of amount_cents (INTEGER).
  // For sub-credit debits (credit_cost < 0.5), ROUND(credit_cost)=0 so
  // amount_cents=0 for every debit and summing it always returns 0.
  //
  // Fetch debits (amount < 0) for the three windows.
  const now        = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let spendToday     = 0;
  let spendThisMonth = 0;

  try {
    const { data: ledgerRows } = await client
      .from("wallet_ledger")
      .select("amount, amount_cents, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", monthStart.toISOString());

    for (const row of (ledgerRows ?? []) as { amount: number | null; amount_cents: number; created_at: string }[]) {
      // Prefer amount (NUMERIC); fall back to amount_cents (INTEGER).
      const amt = row.amount ?? row.amount_cents ?? 0;
      if (amt >= 0) continue;            // only debits (negative amounts)
      const absAmt = Math.abs(amt);
      spendThisMonth += absAmt;
      if (row.created_at >= todayStart.toISOString()) {
        spendToday += absAmt;
      }
    }
  } catch {
    // Ledger query failed — leave spend at 0 (safe; never crashes the page).
  }

  return {
    ...wallet,
    // Computed flags (derived locally — no RPC needed)
    is_low_balance:         wallet.low_balance_threshold_cents > 0
                              && wallet.balance_cents < wallet.low_balance_threshold_cents,
    has_payment_method:     wallet.stripe_payment_method_id !== null,
    // Spend computed from wallet_ledger.amount (NUMERIC) — correct for sub-credit prices
    spend_today_cents:      spendToday,
    spend_this_month_cents: spendThisMonth,
    period_spend_cents:     spendThisMonth,   // period = current month when no subscription
    period_start:           monthStart.toISOString() as unknown as null,
    period_end:             null,
  };
}

// ── Write: debit ──────────────────────────────────────────────────────────────

/**
 * Atomically deduct `creditCost` from a tenant's wallet.
 *
 * Uses the `debit_wallet` Postgres RPC (migration 076) — the UPDATE and the
 * ledger INSERT happen in a single DB transaction so there are no partial debits.
 *
 * @param creditCost  Decimal credits to deduct. 1 credit = €0.01.
 *                    Supports sub-cent precision (e.g. 0.25 for €0.0025).
 *
 * Returns { success: false } when:
 *   • Balance is insufficient (balance < creditCost)
 *   • Wallet status is not 'active'
 *   • Wallet does not exist for this tenant
 *
 * After a successful debit:
 *   • If balance reaches 0 the wallet status is set to 'suspended' (separate call).
 *   • If balance drops below low_balance_threshold_cents a low-balance notification
 *     is fired (fire-and-forget, never blocks the debit).
 */
export async function debitWallet(
  client:        SupabaseClient,
  tenantId:      string,
  creditCost:    number,
  referenceType: string          = "enrichment_usage",
  referenceId?:  string,
  note?:         string,
  category?:     CreditCategory,
): Promise<WalletDebitResult> {
  if (creditCost <= 0) {
    throw new Error(`[billing/wallet] debitWallet: creditCost must be positive (got ${creditCost})`);
  }

  const { data, error } = await client.rpc("debit_wallet", {
    p_tenant_id:      tenantId,
    p_credit_cost:    creditCost,
    p_reference_type: referenceType,
    p_reference_id:   referenceId ?? null,
    p_note:           note ?? null,
    p_category:       category ?? null,
  });

  if (error) {
    const msg = error.message ?? "";

    // insufficient_wallet_balance — balance too low to cover this debit.
    if (msg.includes("insufficient_wallet_balance")) {
      const wallet = await getWallet(client, tenantId);
      return {
        success:      false,
        balanceAfter: wallet?.balance ?? wallet?.balance_cents ?? 0,
        error:        "insufficient_balance",
      };
    }

    // wallet_not_found — tenant has no wallet row yet.
    if (msg.includes("wallet_not_found")) {
      return {
        success:      false,
        balanceAfter: 0,
        error:        "wallet_not_found",
      };
    }

    // wallet_not_active — wallet exists but status is not 'active'.
    if (msg.includes("wallet_not_active")) {
      const wallet = await getWallet(client, tenantId);
      return {
        success:      false,
        balanceAfter: wallet?.balance ?? wallet?.balance_cents ?? 0,
        error:        "wallet_not_active",
      };
    }

    throw new Error(
      `[billing/wallet] debitWallet RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  // debit_wallet RPC returns NUMERIC — the new decimal balance in credits.
  const balanceAfter = typeof data === "number" ? data : 0;

  // ── Post-debit side-effects (fire-and-forget) ─────────────────────────────
  //
  // Suspend the wallet and fire notifications when balance reaches zero.
  // Notification thresholds are checked against the wallet's config.
  void (async () => {
    try {
      if (balanceAfter <= 0) {
        // Suspend the wallet — billable enrichments will be blocked.
        await client
          .from("tenant_wallets")
          .update({ status: "suspended" })
          .eq("tenant_id", tenantId);

        const { notifyEmptyWallet } = await import("./notifications");
        await notifyEmptyWallet(client, tenantId);
      } else {
        // Check low-balance threshold.
        // balanceAfter is decimal credits; low_balance_threshold_cents is in the
        // same unit (1 credit = 1 cent) so the comparison is directly valid.
        const wallet = await getWallet(client, tenantId);
        if (wallet && balanceAfter < wallet.low_balance_threshold_cents) {
          const { notifyLowBalance } = await import("./notifications");
          await notifyLowBalance(client, tenantId, balanceAfter);
        }

        // Trigger auto-reload if needed.
        if (wallet) {
          const { checkAndTriggerAutoReload } = await import("./auto-reload");
          await checkAndTriggerAutoReload(client, wallet, balanceAfter);
        }
      }
    } catch (err) {
      console.error("[billing/wallet] post-debit side-effect error", {
        tenantId,
        ...serializeError(err),
      });
    }
  })();

  return { success: true, balanceAfter };
}

// ── Write: credit ─────────────────────────────────────────────────────────────

/**
 * Atomically add `amountCents` to a tenant's wallet.
 *
 * Uses the `credit_wallet` Postgres RPC which upserts the wallet row (lazy
 * init) and appends a ledger entry atomically.  Also reactivates a 'suspended'
 * wallet when funds are added.
 *
 * @returns New balance in cents after the credit.
 */
export async function creditWallet(
  client:        SupabaseClient,
  tenantId:      string,
  amountCents:   number,
  entryType:     WalletEntryType = "top_up_manual",
  referenceType: string  = "manual",
  referenceId?:  string,
  note?:         string,
  category:      "topup" | "refund" | "adjustment" = "topup",
): Promise<number> {
  if (amountCents <= 0) {
    throw new Error(`[billing/wallet] creditWallet: amountCents must be positive (got ${amountCents})`);
  }

  const { data, error } = await client.rpc("credit_wallet", {
    p_tenant_id:      tenantId,
    p_amount_cents:   amountCents,
    p_entry_type:     entryType,
    p_reference_type: referenceType,
    p_reference_id:   referenceId ?? null,
    p_note:           note ?? null,
    p_category:       category,
  });

  if (error) {
    // ── 22P02: RPC p_amount_cents is still INTEGER (pre-migration-095) ──────────
    //
    // The credit_wallet RPC was defined with p_amount_cents INTEGER in migration
    // 094.  Decimal amounts (e.g. 0.4) cause Postgres to raise
    // "invalid input syntax for type integer".
    //
    // Fall back to direct table writes so decimal admin adjustments work
    // immediately.  Migration 095 upgrades the RPC to NUMERIC, at which point
    // this branch is never reached.
    if (error.code === "22P02") {
      console.warn(
        `[billing/wallet] creditWallet: 22P02 INTEGER cast error for decimal amount ${amountCents} — ` +
        `using direct-write fallback (run supabase db push to apply migration 095 and fix permanently)`,
      );
      return _creditWalletDirectFallback(
        client, tenantId, amountCents, entryType, referenceType, referenceId, note, category,
      );
    }

    throw new Error(
      `[billing/wallet] creditWallet RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  return typeof data === "number" ? data : amountCents;
}

/**
 * Direct-write fallback for creditWallet when the credit_wallet RPC still has
 * p_amount_cents INTEGER and rejects decimal values (22P02).
 *
 * Not atomic (two round-trips), but acceptable for super-admin manual
 * adjustments where race conditions are not a practical concern.
 *
 * @internal
 */
async function _creditWalletDirectFallback(
  client:        SupabaseClient,
  tenantId:      string,
  amount:        number,
  entryType:     WalletEntryType,
  referenceType: string,
  referenceId?:  string,
  note?:         string,
  category?:     string,
): Promise<number> {
  // 1. Read current balance
  const { data: walletRow } = await client
    .from("tenant_wallets")
    .select("balance, balance_cents, status")
    .eq("tenant_id", tenantId)
    .maybeSingle() as { data: { balance: number | null; balance_cents: number; status: string } | null };

  const currentBalance = typeof walletRow?.balance === "number"
    ? walletRow.balance
    : (walletRow?.balance_cents ?? 0);
  const newBalance = currentBalance + amount;

  // 2. Upsert wallet row — update balance and reactivate if suspended
  const { error: upsertErr } = await client
    .from("tenant_wallets")
    .upsert(
      {
        tenant_id:     tenantId,
        balance:       newBalance,
        balance_cents: Math.round(newBalance),
        status:        walletRow?.status === "suspended" ? "active" : (walletRow?.status ?? "active"),
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "tenant_id", ignoreDuplicates: false },
    );

  if (upsertErr) {
    throw new Error(
      `[billing/wallet] _creditWalletDirectFallback: wallet upsert failed for tenant "${tenantId}": ${upsertErr.message}`,
    );
  }

  // 3. Insert ledger row — write both NUMERIC and legacy integer columns
  const { error: ledgerErr } = await client
    .from("wallet_ledger")
    .insert({
      tenant_id:           tenantId,
      entry_type:          entryType,
      amount:              amount,
      amount_cents:        Math.round(amount),
      balance_after:       newBalance,
      balance_after_cents: Math.round(newBalance),
      reference_type:      referenceType,
      reference_id:        referenceId ?? null,
      note:                note ?? null,
      category:            category ?? null,
    });

  if (ledgerErr) {
    throw new Error(
      `[billing/wallet] _creditWalletDirectFallback: ledger insert failed for tenant "${tenantId}": ${ledgerErr.message}`,
    );
  }

  return newBalance;
}

// ── Write: status ─────────────────────────────────────────────────────────────

/**
 * Update the wallet status for a tenant.
 * Use 'active' to unfreeze, 'frozen' to admin-lock, 'suspended' is set
 * automatically when balance reaches zero.
 */
export async function updateWalletStatus(
  client:   SupabaseClient,
  tenantId: string,
  status:   TenantWallet["status"],
): Promise<void> {
  const { error } = await client
    .from("tenant_wallets")
    .update({ status })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `[billing/wallet] updateWalletStatus failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }
}

// ── Write: auto-reload settings ───────────────────────────────────────────────

/**
 * Update wallet auto-reload configuration for a tenant.
 * Pass only the fields you want to change; others are left untouched.
 */
export async function updateWalletAutoReload(
  client:   SupabaseClient,
  tenantId: string,
  settings: {
    auto_reload_enabled?:             boolean;
    auto_reload_trigger_cents?:       number;
    auto_reload_amount_cents?:        number;
    auto_reload_monthly_limit_cents?: number;
    stripe_payment_method_id?:        string | null;
  },
): Promise<void> {
  const { error } = await client
    .from("tenant_wallets")
    .update(settings)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `[billing/wallet] updateWalletAutoReload failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }
}

// ── Write: notification settings ──────────────────────────────────────────────

// ── Write: monthly credit cap + fallback mode ─────────────────────────────────

/**
 * Set the monthly credit spending cap and fallback mode for a tenant.
 *
 * @param monthlyCreditCapCents  Max credits per calendar month. 0 = unlimited.
 * @param fallbackMode           Mode to engage when the cap is reached.
 *   full_adaptive — all enrichments enabled (effectively disables the cap)
 *   smart_lite    — recognition only; Adaptation + Brainpower disabled
 *   default       — static content only; zero enrichment cost
 */
export async function updateWalletCap(
  client:                 SupabaseClient,
  tenantId:               string,
  monthlyCreditCapCents:  number,
  fallbackMode:           FallbackMode = "smart_lite",
): Promise<void> {
  const { error } = await client
    .from("tenant_wallets")
    .update({
      monthly_credit_cap_cents: Math.max(0, Math.round(monthlyCreditCapCents)),
      fallback_mode:            fallbackMode,
    })
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `[billing/wallet] updateWalletCap failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }
}

/**
 * Update notification preferences for a tenant wallet.
 */
export async function updateWalletNotifications(
  client:   SupabaseClient,
  tenantId: string,
  prefs: {
    notify_email?:      boolean;
    notify_sms?:        boolean;
    notification_email?: string | null;
    notification_phone?: string | null;
    low_balance_threshold_cents?: number;
  },
): Promise<void> {
  const { error } = await client
    .from("tenant_wallets")
    .update(prefs)
    .eq("tenant_id", tenantId);

  if (error) {
    throw new Error(
      `[billing/wallet] updateWalletNotifications failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }
}
