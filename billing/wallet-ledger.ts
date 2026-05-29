/**
 * billing/wallet-ledger.ts
 *
 * Wallet ledger query helpers.
 *
 * The ledger itself is written atomically by the debit_wallet / credit_wallet
 * RPCs inside the DB transaction.  This module provides read-side helpers for
 * surfacing the ledger in the admin dashboard.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended for writes).
 *   Do NOT import in client components.
 *
 * ─── Read path ────────────────────────────────────────────────────────────────
 *
 *   getWalletLedger() uses the `get_wallet_ledger` Postgres RPC (migration 057)
 *   as the canonical read path.  The RPC is SECURITY DEFINER and handles missing
 *   tables / columns gracefully.
 *
 *   On PGRST202 (function not found — migration 057 not applied) the function
 *   automatically falls back to a direct wallet_ledger table query so pre-
 *   migration deployments keep working without any code change.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WalletLedgerEntry } from "./types";
import { isSchemaMissingCode } from "./usage";

export type { WalletLedgerEntry };

// ── Read: ledger history ──────────────────────────────────────────────────────

/**
 * Fetch wallet ledger entries for a tenant, most recent first.
 *
 * Uses the `get_wallet_ledger` RPC (migration 057) — a SECURITY DEFINER
 * function that aggregates and returns wallet_ledger rows server-side.
 * Falls back to a direct table query when the RPC is not yet available
 * (pre-migration-057 deployments).
 *
 * @param client   Supabase service-role client.
 * @param tenantId Tenant to query.
 * @param limit    Maximum rows to return (default 50).
 * @param offset   Rows to skip before reading (default 0).
 */
export async function getWalletLedger(
  client:   SupabaseClient,
  tenantId: string,
  limit     = 50,
  offset    = 0,
): Promise<WalletLedgerEntry[]> {
  const { data, error } = await client.rpc("get_wallet_ledger", {
    p_tenant_id: tenantId,
    p_limit:     limit,
    p_offset:    offset,
  });

  if (error) {
    // PGRST202 = function not found (migration 057 not applied yet).
    // 42P01    = wallet_ledger table missing (migration 043 not applied).
    // Both are pre-migration gaps — fall back to direct query.
    if (
      error.code === "PGRST202"  ||
      error.code === "42P01"     ||
      String(error.message).includes("PGRST202")
    ) {
      console.warn(
        `[billing/wallet-ledger] getWalletLedger: RPC unavailable — using fallback tenantId=${tenantId}`,
      );
      return _getWalletLedgerFallback(client, tenantId, limit);
    }

    // Schema cache stale, type mismatch, etc. — degrade gracefully.
    if (isSchemaMissingCode(error.code)) {
      console.warn("[billing/wallet-ledger] getWalletLedger: schema issue", {
        code: error.code, message: error.message, tenantId,
      });
      return [];
    }

    throw new Error(
      `[billing/wallet-ledger] getWalletLedger RPC failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  // get_wallet_ledger returns SETOF — PostgREST wraps in array.
  return (data ?? []) as WalletLedgerEntry[];
}

/**
 * Fallback: direct wallet_ledger table query.
 * Used automatically when the get_wallet_ledger RPC is not yet available
 * (migration 057 not applied).  Kept private — callers always go through
 * getWalletLedger() which selects the right path.
 */
async function _getWalletLedgerFallback(
  client:   SupabaseClient,
  tenantId: string,
  limit:    number,
): Promise<WalletLedgerEntry[]> {
  const { data, error } = await client
    .from("wallet_ledger")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") {
      console.warn("[billing/wallet-ledger] _getWalletLedgerFallback: schema missing", {
        code: error.code, message: error.message,
      });
      return [];
    }
    throw new Error(
      `[billing/wallet-ledger] _getWalletLedgerFallback failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  return (data ?? []) as WalletLedgerEntry[];
}

// ── Read: spend totals ────────────────────────────────────────────────────────

/**
 * Get the total amount spent from the wallet in a time window.
 * Returns absolute cents spent (positive integer).
 *
 * Note: for current-period and current-month spend totals, prefer the
 * `get_wallet_state` RPC (migration 055) which returns these as pre-computed
 * fields in a single round-trip.  This function is kept for ad-hoc windows.
 */
export async function getWalletSpend(
  client:    SupabaseClient,
  tenantId:  string,
  from:      string,
  to?:       string,
): Promise<number> {
  // Select both amount (NUMERIC, added migration 076) and amount_cents (legacy INTEGER).
  // amount is the authoritative column for sub-credit pricing; amount_cents rounds to
  // zero for costs < 0.5 credits (e.g. 0.01 credits → ROUND(0.01) = 0).
  let query = client
    .from("wallet_ledger")
    .select("amount, amount_cents")
    .eq("tenant_id", tenantId)
    .eq("entry_type", "enrichment_debit")
    .gte("created_at", from);

  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return 0;
    throw new Error(
      `[billing/wallet-ledger] getWalletSpend failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  // Prefer amount (NUMERIC) when available; fall back to amount_cents (legacy INTEGER).
  // Debits are stored as negative values — sum and take absolute value.
  return Math.abs(
    ((data ?? []) as { amount: number | null; amount_cents: number }[]).reduce(
      (sum, row) => sum + (row.amount ?? row.amount_cents ?? 0),
      0,
    ),
  );
}
