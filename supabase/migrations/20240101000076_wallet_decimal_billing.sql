-- migration 076 — wallet ledger decimal columns + debit_wallet NUMERIC upgrade
--
-- ─── Why this exists ──────────────────────────────────────────────────────────
--
--   Runtime enrichment debits were silently failing.  The root cause chain:
--
--   1. The debit_wallet RPC (migration 059) inserts into wallet_ledger using the
--      `category` and `simulated` columns added by migration 051.
--
--   2. If migration 029 failed (which it did — now fixed) the DB migration chain
--      halted there.  Migrations 051–075 were never applied.  wallet_ledger does
--      NOT have `category` or `simulated` columns.
--
--   3. debit_wallet fires → PostgreSQL 42703 "column does not exist" → TypeScript
--      enrichment-tracker catches the exception but the isSchemaGap check only
--      looks for PGRST202 / 42P01, NOT 42703.  The debit is marked as
--      `debit_rpc_error` and swallowed.
--
--   4. usage_events is written with cost=0 (debit failed), wallet balance is
--      never decremented, and no wallet_ledger row is created.
--
-- ─── What this migration does ─────────────────────────────────────────────────
--
--   A. Ensure wallet_ledger has `category` and `simulated` columns.
--   B. Add decimal amount / balance_after NUMERIC columns to wallet_ledger
--      alongside existing amount_cents / balance_after_cents integers.
--   C. Ensure tenant_wallets.balance NUMERIC(14,4) exists (added by 065 but
--      may be NULL if 065 ran against an existing table).
--   D. Backfill decimal columns from existing integer rows.
--   E. Drop the old debit_wallet(TEXT,INTEGER,...) RPC and create a new one
--      that accepts p_credit_cost NUMERIC, writes both decimal and integer
--      columns atomically, and returns NUMERIC (the new decimal balance).
--   F. Update credit_wallet to also write decimal amount / balance_after columns.
--   G. NOTIFY pgrst, 'reload schema' — refreshes PostgREST schema cache.
--
-- ─── Schema decision ──────────────────────────────────────────────────────────
--
--   Canonical model: NUMERIC credits (1 credit = €0.01)
--
--     wallet_ledger.amount        NUMERIC(12,4) — credits moved (+= credit, -= debit)
--     wallet_ledger.balance_after NUMERIC(12,4) — wallet balance in credits after move
--     tenant_wallets.balance      NUMERIC(14,4) — current balance in credits
--
--   Legacy aliases kept for backward compat (still written by all RPCs):
--     wallet_ledger.amount_cents         INTEGER
--     wallet_ledger.balance_after_cents  INTEGER
--     tenant_wallets.balance_cents       INTEGER
--
--   Unit: 1 credit = €0.01.  Sub-cent pricing: 0.25 credits = €0.0025.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   ADD COLUMN IF NOT EXISTS, DROP FUNCTION IF EXISTS, CREATE OR REPLACE — all
--   safe to re-run multiple times.

-- ─── A. Ensure wallet_ledger.category and .simulated ─────────────────────────
--
-- These were added by migration 051.  If 051 was never applied they are absent,
-- causing the debit_wallet RPC to fail with 42703 on every enrichment call.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'wallet_ledger'
      AND column_name  = 'category'
  ) THEN
    ALTER TABLE wallet_ledger ADD COLUMN category TEXT;
    RAISE NOTICE 'wallet_ledger.category added.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'wallet_ledger'
      AND column_name  = 'simulated'
  ) THEN
    ALTER TABLE wallet_ledger ADD COLUMN simulated BOOLEAN NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'wallet_ledger.simulated added.';
  END IF;
END $$;

-- ─── B. Add decimal amount / balance_after to wallet_ledger ──────────────────

ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS amount        NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12, 4);

COMMENT ON COLUMN wallet_ledger.amount IS
  'Credits moved by this entry. Negative for debits, positive for credits. '
  'Decimal precision supports sub-credit amounts (e.g. -0.2500). '
  'Parallel to amount_cents (legacy integer) — both are kept in sync.';

COMMENT ON COLUMN wallet_ledger.balance_after IS
  'Wallet balance in credits after this entry was applied. '
  'Parallel to balance_after_cents (legacy integer).';

-- ─── C. Ensure tenant_wallets.balance NUMERIC ─────────────────────────────────
--
-- Migration 065 added this column as nullable.  Backfill it here so it is
-- always in sync with balance_cents.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'tenant_wallets'
      AND column_name  = 'balance'
  ) THEN
    ALTER TABLE tenant_wallets ADD COLUMN balance NUMERIC(14, 4);
    RAISE NOTICE 'tenant_wallets.balance column added.';
  END IF;
END $$;

COMMENT ON COLUMN tenant_wallets.balance IS
  'Current wallet balance in credits (NUMERIC). 1 credit = €0.01. '
  'Supports fractional credits (e.g. 97.2500). '
  'Kept in sync with balance_cents (legacy integer) by all wallet RPCs.';

-- ─── D. Backfill decimal columns from existing integer rows ──────────────────

-- wallet_ledger: populate amount / balance_after for all existing rows.
UPDATE public.wallet_ledger
SET
  amount        = amount_cents::NUMERIC,
  balance_after = balance_after_cents::NUMERIC
WHERE amount IS NULL OR balance_after IS NULL;

-- tenant_wallets: populate balance for all existing rows.
UPDATE public.tenant_wallets
SET balance = balance_cents::NUMERIC
WHERE balance IS NULL;

-- ─── E. Rewrite debit_wallet RPC ─────────────────────────────────────────────
--
-- The old signature uses p_amount_cents INTEGER.  The new signature uses
-- p_credit_cost NUMERIC to support fractional credits (e.g. 0.2500).
--
-- PostgreSQL overloads functions by parameter type, so the old INTEGER version
-- and the new NUMERIC version would coexist.  We explicitly drop the old one
-- first so there is no ambiguity and no accidental fallback.

DROP FUNCTION IF EXISTS public.debit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_tenant_id      TEXT,
  p_credit_cost    NUMERIC,                      -- credits to deduct (e.g. 3.0000 or 0.2500)
  p_reference_type TEXT    DEFAULT 'enrichment_usage',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL
)
RETURNS NUMERIC            -- new balance (decimal credits) after the debit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before NUMERIC;
  v_balance_after  NUMERIC;
  v_status         TEXT;
BEGIN
  -- ── Lock wallet row ──────────────────────────────────────────────────────────
  --
  -- Prefer the NUMERIC balance column; fall back to balance_cents if balance
  -- has not been backfilled yet (transition safety).

  SELECT COALESCE(tw.balance, tw.balance_cents::NUMERIC),
         tw.status::TEXT
  INTO   v_balance_before,
         v_status
  FROM   public.tenant_wallets tw
  WHERE  tw.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found for tenant %', p_tenant_id;
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'wallet_not_active: status=% for tenant %', v_status, p_tenant_id;
  END IF;

  IF v_balance_before < p_credit_cost THEN
    RAISE EXCEPTION
      'insufficient_wallet_balance: balance=% requested=% for tenant %',
      v_balance_before, p_credit_cost, p_tenant_id;
  END IF;

  v_balance_after := v_balance_before - p_credit_cost;

  -- ── Deduct from wallet (both decimal and integer columns) ────────────────────

  UPDATE public.tenant_wallets AS tw
  SET    balance       = v_balance_after,
         balance_cents = ROUND(v_balance_after)::INTEGER,
         updated_at    = now()
  WHERE  tw.tenant_id = p_tenant_id;

  -- ── Ledger entry — negative amount for debits ────────────────────────────────

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount,
    amount_cents,
    balance_after,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    p_tenant_id,
    'enrichment_debit',
    p_category,
    -p_credit_cost,                          -- decimal credits (negative)
    -ROUND(p_credit_cost)::INTEGER,          -- legacy cents (negative)
    v_balance_after,                         -- decimal credits
    ROUND(v_balance_after)::INTEGER,         -- legacy cents
    p_reference_type,
    p_reference_id,
    p_note,
    FALSE,                                   -- enrichment debits are never simulated here
    now()
  );

  RETURN v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.debit_wallet(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) IS
  'Atomically debit tenant wallet with row-level lock, update decimal balance, '
  'and append a wallet_ledger row. '
  'Parameters: p_tenant_id, p_credit_cost (NUMERIC credits), p_reference_type, '
  'p_reference_id, p_note, p_category. '
  'Raises: wallet_not_found | wallet_not_active | insufficient_wallet_balance. '
  'Returns new balance in decimal credits. SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.debit_wallet(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- ─── F. Update credit_wallet to write decimal columns ────────────────────────
--
-- The credit_wallet signature stays as INTEGER (top-ups are always round amounts).
-- We extend it to also write amount and balance_after NUMERIC columns so that
-- all ledger entries have consistent decimal data regardless of whether the
-- entry came from a debit or a credit.
--
-- IMPORTANT: PostgreSQL does not allow CREATE OR REPLACE to change a function's
-- return type (42P13).  The migration 059 version returns INTEGER; this version
-- returns NUMERIC.  We must DROP the old signature first.

DROP FUNCTION IF EXISTS public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_entry_type     TEXT    DEFAULT 'top_up_manual',
  p_reference_type TEXT    DEFAULT 'manual',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT 'topup'
)
RETURNS NUMERIC            -- new balance (decimal credits) after the credit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after NUMERIC;
  v_is_simulated  BOOLEAN;
BEGIN
  v_is_simulated := (p_entry_type LIKE 'sim_%');

  -- ── Upsert wallet row ────────────────────────────────────────────────────────
  --
  -- Updates both decimal (balance) and legacy integer (balance_cents) columns.

  INSERT INTO public.tenant_wallets AS tw (
    tenant_id, balance_cents, balance, status, updated_at
  )
  VALUES (
    p_tenant_id,
    p_amount_cents,
    p_amount_cents::NUMERIC,
    'active',
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents = tw.balance_cents + EXCLUDED.balance_cents,
        balance       = COALESCE(tw.balance, tw.balance_cents::NUMERIC) + p_amount_cents::NUMERIC,
        status        = CASE
                          WHEN tw.status = 'suspended' THEN 'active'
                          ELSE tw.status
                        END,
        updated_at    = now()
  RETURNING COALESCE(tw.balance, tw.balance_cents::NUMERIC)
  INTO v_balance_after;

  -- ── Ledger entry ─────────────────────────────────────────────────────────────

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount,
    amount_cents,
    balance_after,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    p_tenant_id,
    p_entry_type,
    p_category,
    p_amount_cents::NUMERIC,    -- decimal credits (positive for credit)
    p_amount_cents,             -- legacy integer
    v_balance_after,            -- decimal
    ROUND(v_balance_after)::INTEGER,  -- legacy integer
    p_reference_type,
    p_reference_id,
    p_note,
    v_is_simulated,
    now()
  );

  RETURN v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Atomically credit tenant wallet (upsert) and append a ledger entry. '
  'Writes both decimal (amount, balance_after) and legacy integer (_cents) columns. '
  'Reactivates suspended wallets. Returns new balance in decimal credits. '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- ─── G. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS wallet_ledger_category_created
  ON wallet_ledger (tenant_id, category, created_at DESC)
  WHERE category IS NOT NULL;

-- ─── H. Reload PostgREST schema cache ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
