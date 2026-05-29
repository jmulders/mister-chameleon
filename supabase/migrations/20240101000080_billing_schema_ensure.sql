-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 080 — Billing Schema Ensure
--
-- Safety-net migration that guarantees the billing schema is in the state
-- required by the runtime, regardless of whether migrations 039–076 ran
-- cleanly on the live DB.
--
-- Context:
--   Migrations 029–075 failed silently on production because migration 029
--   had a syntax error that halted the whole chain.  By the time the chain
--   was repaired, the DB was missing columns and RPCs that later migrations
--   assumed were already there.  This migration adds everything idempotently
--   so a single `supabase db push` makes the live DB fully operational.
--
-- What this migration does:
--
--   A. usage_events — add missing columns (idempotent ADD COLUMN IF NOT EXISTS)
--        • idempotency_key TEXT     — from migration 039 table def
--        • category        TEXT     — from migration 051
--        • feature_key     TEXT     — from migration 051
--        • internal_cost_cents INT  — from migration 051
--        • simulated       BOOLEAN  — from migration 051
--        • cache_hit        BOOLEAN — from migration 051
--        • billable         BOOLEAN — from migration 068
--        • price            NUMERIC — from migration 068
--        • credits_used     NUMERIC — from migration 068
--
--   B. usage_events — add unique partial index on idempotency_key WHERE NOT NULL
--        (prevents double-recording on retried requests)
--
--   C. debit_wallet RPC — create or replace with exact signature expected by
--        billing/wallet.ts:
--          (p_tenant_id TEXT, p_credit_cost NUMERIC, p_reference_type TEXT,
--           p_reference_id TEXT, p_note TEXT, p_category TEXT)
--        Writes both decimal (balance, amount) and legacy integer (_cents)
--        columns atomically.  Matches migration 076 exactly.
--
--   D. Reload PostgREST schema cache.
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
--   Every statement is safe to run multiple times:
--     ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--     DROP FUNCTION IF EXISTS, CREATE OR REPLACE FUNCTION.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── A. usage_events — missing columns ───────────────────────────────────────

-- idempotency_key was in the original CREATE TABLE (migration 039) but is
-- absent when the table pre-existed with a different schema.
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS idempotency_key      TEXT;

-- Columns from migration 051
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS category             TEXT,
  ADD COLUMN IF NOT EXISTS feature_key          TEXT,
  ADD COLUMN IF NOT EXISTS internal_cost_cents  INTEGER,
  ADD COLUMN IF NOT EXISTS simulated            BOOLEAN NOT NULL DEFAULT FALSE;

-- cache_hit was added in migration 051 / 065
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS cache_hit            BOOLEAN NOT NULL DEFAULT FALSE;

-- Decimal billing columns from migration 068
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS billable             BOOLEAN        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price                NUMERIC(12, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_used         NUMERIC(12, 6) NOT NULL DEFAULT 0;

-- Back-fill credits_used and price for existing rows that were written with
-- the integer credits_cost column only.
-- Guard: if credits_cost was somehow absent (e.g. from a non-standard migration
-- path), the bare UPDATE would fail with 42703 and roll back the entire migration
-- including the debit_wallet function creation below.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_events'
      AND column_name = 'credits_cost'
  ) THEN
    UPDATE usage_events
    SET
      credits_used = credits_cost,
      price        = credits_cost::NUMERIC / 100
    WHERE credits_used = 0
      AND credits_cost > 0;
  END IF;
END $$;


-- ─── B. usage_events — idempotency_key index ─────────────────────────────────

-- Unique partial index: enforces one row per key, sparse (NULL rows not indexed).
-- The WHERE clause means only rows with a non-null key participate — so rows
-- written without a key (legacy or free-tier) are unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_key_idx
  ON usage_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ─── C. wallet_ledger — ensure category + simulated (needed by debit_wallet) ──

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

-- Decimal ledger columns (migration 076)
ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS amount        NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12, 4);

-- tenant_wallets decimal balance column (migration 065 / 076)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'tenant_wallets'
      AND column_name  = 'balance'
  ) THEN
    ALTER TABLE tenant_wallets ADD COLUMN balance NUMERIC(14, 4);
    RAISE NOTICE 'tenant_wallets.balance added.';
  END IF;
END $$;

-- Back-fill decimal columns from integer columns for existing rows
UPDATE public.wallet_ledger
SET
  amount        = amount_cents::NUMERIC,
  balance_after = balance_after_cents::NUMERIC
WHERE amount IS NULL OR balance_after IS NULL;

UPDATE public.tenant_wallets
SET balance = balance_cents::NUMERIC
WHERE balance IS NULL;


-- ─── D. debit_wallet RPC ─────────────────────────────────────────────────────
--
-- Exact signature expected by billing/wallet.ts:
--   client.rpc("debit_wallet", {
--     p_tenant_id, p_credit_cost, p_reference_type,
--     p_reference_id, p_note, p_category
--   })
--
-- Drop old INTEGER signature if it still exists to avoid overload ambiguity.

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


-- ─── E. Reload PostgREST schema cache ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
