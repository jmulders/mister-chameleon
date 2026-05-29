-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 087 — get_wallet_ledger: add amount / balance_after NUMERIC columns
--
-- ─── Root cause ──────────────────────────────────────────────────────────────
--
--   Migration 057 defined get_wallet_ledger to return only the legacy INTEGER
--   columns:
--
--     amount_cents        INTEGER  (positive = credit, negative = debit)
--     balance_after_cents INTEGER
--
--   Migration 076 added NUMERIC companions to wallet_ledger:
--
--     amount        NUMERIC(12,4) — exact decimal credits (e.g. -0.0100)
--     balance_after NUMERIC(12,4) — exact balance after the entry
--
--   debit_wallet (migration 076) writes:
--
--     amount        = -p_credit_cost              -- NUMERIC, e.g. -0.0100
--     amount_cents  = ROUND(-p_credit_cost)::INTEGER  -- e.g. ROUND(-0.01) = 0
--
--   For sub-credit prices (credit_cost < 0.5), ROUND(credit_cost) = 0.
--   Therefore amount_cents = 0 for every sub-credit debit row.
--
--   Because get_wallet_ledger never selected amount / balance_after, the
--   BillingDashboard fell back to amount_cents = 0 and showed "0 cr" in the
--   History tab for every enrichment debit — even though the wallet balance
--   was being decremented correctly.
--
-- ─── Fix ─────────────────────────────────────────────────────────────────────
--
--   Extend the RETURNS TABLE and the inner SELECT to include:
--
--     amount        NUMERIC  — exact decimal credits (NULL for pre-076 rows)
--     balance_after NUMERIC  — exact balance after entry (NULL for pre-076 rows)
--
--   The TypeScript WalletLedgerEntry interface already declares both as optional
--   number fields (added when migration 076 was implemented).  The dashboard
--   already uses `entry.amount ?? entry.amount_cents` so no UI change is needed.
--
-- ─── Backward compatibility ───────────────────────────────────────────────────
--
--   Pre-076 ledger rows have amount = NULL and balance_after = NULL — these are
--   returned as-is.  The dashboard falls back to amount_cents for those rows.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   DROP FUNCTION IF EXISTS … CASCADE + full recreate.  Safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- ── NUMERIC columns (migration 076) — exact sub-credit precision ────────────
  amount              NUMERIC,
  balance_after       NUMERIC,
  -- ── Legacy INTEGER columns — kept for backward compat ───────────────────────
  amount_cents        INTEGER,
  balance_after_cents INTEGER,
  -- ── Other columns ───────────────────────────────────────────────────────────
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
  -- Dynamic SQL so that missing columns (pre-migration-051/076 deployments)
  -- raise at runtime and are caught by the EXCEPTION block rather than at
  -- parse/plan time.  This preserves the original graceful-degradation behaviour.
  RETURN QUERY EXECUTE
    $sql$
      SELECT
        l.id::UUID,
        l.tenant_id::TEXT,
        l.entry_type::TEXT,
        l.category::TEXT,
        -- NUMERIC columns (migration 076) — NULL for rows written before that migration.
        l.amount::NUMERIC,
        l.balance_after::NUMERIC,
        -- Legacy INTEGER columns.
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
  -- 42703 = category / simulated / amount / balance_after column missing.
  -- With dynamic SQL these surface as runtime errors catchable here.
  WHEN undefined_column THEN RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_ledger(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.get_wallet_ledger(TEXT, INTEGER, INTEGER) IS
  'Returns wallet ledger rows for a tenant, most recent first. '
  'Includes both NUMERIC (amount, balance_after — migration 076) and legacy '
  'INTEGER (_cents) columns so the dashboard can prefer decimal precision for '
  'sub-credit entries (e.g. 0.01 credits → amount=-0.0100, amount_cents=0). '
  'SECURITY DEFINER — service role required.';

NOTIFY pgrst, 'reload schema';
