/**
 * Migration 057 — get_wallet_ledger RPC
 *
 * Adds public.get_wallet_ledger(p_tenant_id TEXT, p_limit INTEGER, p_offset INTEGER)
 *
 * Replaces the direct `SELECT * FROM wallet_ledger WHERE tenant_id = $1 ...`
 * pattern used in billing/wallet-ledger.ts with a single stable server-side
 * read path that:
 *   • Is SECURITY DEFINER — caller doesn't need direct SELECT on wallet_ledger.
 *   • Handles a missing wallet_ledger table gracefully (returns empty set instead
 *     of raising 42P01 / PGRST202 to the caller).
 *   • Handles a missing category / simulated column gracefully (migration 051
 *     not applied) — uses dynamic SQL so undefined_column is caught at runtime.
 *   • Casts the wallet_entry_type enum to TEXT so PostgREST serialises it
 *     cleanly without schema-cache drift.
 *
 * ─── Return shape ─────────────────────────────────────────────────────────────
 *
 *   One row per ledger entry in descending created_at order (most recent first).
 *   All columns match WalletLedgerEntry in billing/types.ts:
 *
 *     id                  — UUID
 *     tenant_id           — TEXT
 *     entry_type          — TEXT (cast from wallet_entry_type enum)
 *     category            — TEXT | NULL
 *     amount_cents        — INTEGER (positive = credit, negative = debit)
 *     balance_after_cents — INTEGER
 *     reference_type      — TEXT | NULL
 *     reference_id        — TEXT | NULL
 *     note                — TEXT | NULL
 *     simulated           — BOOLEAN (false when column is absent)
 *     created_at          — TIMESTAMPTZ
 *
 * ─── Pagination ───────────────────────────────────────────────────────────────
 *
 *   p_limit  — maximum rows to return (default 50)
 *   p_offset — rows to skip before reading (default 0)
 *
 *   Typical billing-page call: limit=30, offset=0 (most recent 30 entries).
 *
 * ─── Empty ledger ─────────────────────────────────────────────────────────────
 *
 *   When no ledger rows exist for the tenant the function returns zero rows
 *   (empty result set), not an error.  Callers must render an empty-state UI.
 *
 * ─── Missing table ────────────────────────────────────────────────────────────
 *
 *   When wallet_ledger doesn't exist (migration 043 not applied), the EXCEPTION
 *   handler catches undefined_table and returns an empty set rather than raising
 *   PGRST202 / 42P01 to the caller.
 *
 * ─── Missing columns (category / simulated) ───────────────────────────────────
 *
 *   category and simulated were added in migration 051.  This function uses
 *   EXECUTE (dynamic SQL) so an undefined_column error is caught at runtime
 *   and returns an empty set rather than crashing.  The TypeScript fallback
 *   path in billing/wallet-ledger.ts handles pre-migration-051 reads.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   SECURITY DEFINER — runs with the function owner's privileges.
 *   search_path pinned to `public` to prevent search-path injection.
 */

-- ── get_wallet_ledger ─────────────────────────────────────────────────────────

-- Drop any existing version regardless of return type/OUT parameters.
-- CREATE OR REPLACE FUNCTION cannot change OUT parameters (Postgres 42P13),
-- so we drop first. CASCADE covers dependent objects referencing this signature.
DROP FUNCTION IF EXISTS public.get_wallet_ledger(TEXT, INTEGER, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.get_wallet_ledger(
  p_tenant_id  TEXT,
  p_limit      INTEGER DEFAULT 50,
  p_offset     INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  tenant_id           TEXT,
  entry_type          TEXT,
  category            TEXT,
  amount_cents        INTEGER,
  balance_after_cents INTEGER,
  reference_type      TEXT,
  reference_id        TEXT,
  note                TEXT,
  simulated           BOOLEAN,
  created_at          TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use dynamic SQL so missing columns (pre-migration-051) raise at runtime
  -- and can be caught by the EXCEPTION block rather than at parse/plan time.
  RETURN QUERY EXECUTE
    $sql$
      SELECT
        l.id::UUID,
        l.tenant_id::TEXT,
        l.entry_type::TEXT,
        l.category::TEXT,
        l.amount_cents::INTEGER,
        l.balance_after_cents::INTEGER,
        l.reference_type::TEXT,
        l.reference_id::TEXT,
        l.note::TEXT,
        COALESCE(l.simulated, FALSE)::BOOLEAN,
        l.created_at::TIMESTAMPTZ
      FROM public.wallet_ledger l
      WHERE l.tenant_id = $1
      ORDER BY l.created_at DESC
      LIMIT  $2
      OFFSET $3
    $sql$
    USING p_tenant_id, p_limit, p_offset;

EXCEPTION
  -- 42P01 = wallet_ledger table missing (migration 043 not applied).
  WHEN undefined_table  THEN RETURN;
  -- 42703 = category or simulated column missing (migration 051 not applied).
  -- With dynamic SQL these surface as runtime errors that can be caught here.
  WHEN undefined_column THEN RETURN;
END;
$$;

-- Allow the service role to call this function.
GRANT EXECUTE ON FUNCTION public.get_wallet_ledger(TEXT, INTEGER, INTEGER) TO service_role;
