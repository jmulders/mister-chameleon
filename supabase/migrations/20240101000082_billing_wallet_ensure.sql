-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 082 — Billing Wallet Ensure
--
-- Nuclear safety-net: guarantees the complete billing infrastructure exists
-- regardless of which earlier migrations applied successfully.
--
-- ─── Why this exists ─────────────────────────────────────────────────────────
--
--   Migration 070 (behavioral_tables_schema_repair) was the chain blocker:
--   it failed because behavior_scoring_rules.name was NOT NULL with no DEFAULT
--   and the seed INSERT omitted it.  That blocked migrations 071–081 from ever
--   running, meaning debit_wallet(TEXT, NUMERIC) was never created (migration 076)
--   and the billing schema ensure (migration 080) never ran.
--
--   Migration 070 was repaired (DROP COLUMN name/base_score + correct seed INSERT).
--   This migration is a belt-and-suspenders layer:
--
--     A. billing_request_debug_events.tenant_id → TEXT (was UUID, breaks inserts)
--     B. usage_events — add any columns still missing after 039/051/068/080
--     C. wallet_ledger — add wallet_id (informational FK placeholder), ensure
--        category + simulated + decimal columns exist
--     D. tenant_wallets — ensure NUMERIC balance column exists
--     E. Backfill decimal columns from integer columns (idempotent)
--     F. debit_wallet(TEXT, NUMERIC) — DROP old INTEGER overload + CREATE OR REPLACE
--     G. credit_wallet(TEXT, INTEGER, ...) — CREATE OR REPLACE (decimal-aware)
--     H. Reload PostgREST schema cache
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
--   Every statement is safe to re-run:
--     DO $$ IF NOT EXISTS …, ADD COLUMN IF NOT EXISTS, DROP FUNCTION IF EXISTS,
--     CREATE OR REPLACE FUNCTION, CREATE UNIQUE INDEX IF NOT EXISTS,
--     guarded UPDATE (WHERE column IS NULL).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── A. billing_request_debug_events — ensure tenant_id is TEXT ──────────────
--
-- saveRequestDebugEvent() inserts text tenant slugs (e.g. "mister-chameleon").
-- If the column is UUID the insert fails silently with 22P02.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'billing_request_debug_events'
      AND column_name  = 'tenant_id'
      AND data_type    = 'uuid'
  ) THEN
    ALTER TABLE billing_request_debug_events
      ALTER COLUMN tenant_id TYPE TEXT USING tenant_id::TEXT;
    RAISE NOTICE 'billing_request_debug_events.tenant_id converted UUID → TEXT.';
  END IF;
END $$;


-- ─── B. usage_events — ensure all runtime-required columns exist ──────────────
--
-- Columns added by various migrations (039, 051, 068, 080).  Guard every one
-- so this migration is safe regardless of which subset already applied.

-- Core columns (migration 039)
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS quantity            INTEGER        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS credits_cost        INTEGER        NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success             BOOLEAN        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_code          TEXT,
  ADD COLUMN IF NOT EXISTS session_id          TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key     TEXT,
  ADD COLUMN IF NOT EXISTS metadata            JSONB          NOT NULL DEFAULT '{}';

-- Category / feature / cost columns (migration 051)
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS category            TEXT,
  ADD COLUMN IF NOT EXISTS feature_key         TEXT,
  ADD COLUMN IF NOT EXISTS internal_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS simulated           BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cache_hit           BOOLEAN        NOT NULL DEFAULT FALSE;

-- Decimal billing columns (migration 068)
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS billable            BOOLEAN        NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price               NUMERIC(12, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_used        NUMERIC(12, 6) NOT NULL DEFAULT 0;

-- request_id — correlation column (not written by trackUsageEvent yet but
-- listed in the canonical schema for future use)
ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS request_id          TEXT;

-- idempotency_key unique index (sparse — only non-null rows indexed)
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_key_idx
  ON usage_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Backfill credits_used / price from credits_cost for rows written before migration 068.
-- Guard: credits_cost may be absent on a DB that never ran migration 039.
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


-- ─── C. wallet_ledger — ensure all columns exist ──────────────────────────────

-- category and simulated — added by migration 051
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_ledger'
      AND column_name = 'category'
  ) THEN
    ALTER TABLE wallet_ledger ADD COLUMN category TEXT;
    RAISE NOTICE 'wallet_ledger.category added.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_ledger'
      AND column_name = 'simulated'
  ) THEN
    ALTER TABLE wallet_ledger ADD COLUMN simulated BOOLEAN NOT NULL DEFAULT FALSE;
    RAISE NOTICE 'wallet_ledger.simulated added.';
  END IF;
END $$;

-- Decimal amount / balance_after — added by migration 065/076
ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS amount        NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12, 4);

-- wallet_id — nullable reference to tenant_wallets (informational; not a FK
-- because wallet_ledger predates this column and existing rows have no value).
ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS wallet_id     TEXT;

-- Backfill decimal columns for existing rows (safe WHERE guard)
UPDATE public.wallet_ledger
SET
  amount        = amount_cents::NUMERIC,
  balance_after = balance_after_cents::NUMERIC
WHERE amount IS NULL OR balance_after IS NULL;


-- ─── D. tenant_wallets — ensure NUMERIC balance column exists ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_wallets'
      AND column_name = 'balance'
  ) THEN
    ALTER TABLE tenant_wallets ADD COLUMN balance NUMERIC(14, 4);
    RAISE NOTICE 'tenant_wallets.balance added.';
  END IF;
END $$;

-- Backfill balance for existing rows
UPDATE public.tenant_wallets
SET balance = balance_cents::NUMERIC
WHERE balance IS NULL;


-- ─── E. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS wallet_ledger_category_created
  ON wallet_ledger (tenant_id, category, created_at DESC)
  WHERE category IS NOT NULL;


-- ─── F. debit_wallet(TEXT, NUMERIC) — the canonical NUMERIC-credit RPC ────────
--
-- Exact signature consumed by billing/wallet.ts:
--   client.rpc("debit_wallet", {
--     p_tenant_id, p_credit_cost, p_reference_type, p_reference_id, p_note, p_category
--   })
--
-- Drops the old INTEGER overload (migration 059) to eliminate PostgREST ambiguity.
-- CREATE OR REPLACE is safe if the NUMERIC version already exists (migration 076/080).

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
  -- Prefer the NUMERIC balance column; fall back to balance_cents if the decimal
  -- column has not been backfilled yet (transition safety for old rows).

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


-- ─── G. credit_wallet(TEXT, INTEGER, ...) — decimal-aware rewrite ─────────────
--
-- Extends credit_wallet to also write the decimal amount / balance_after columns
-- so all ledger entries have consistent decimal data.
--
-- IMPORTANT: The migration 059 version returns INTEGER; this version returns
-- NUMERIC.  CREATE OR REPLACE cannot change the return type (42P13), so we
-- DROP the old signature first.

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
    p_amount_cents::NUMERIC,
    p_amount_cents,
    v_balance_after,
    ROUND(v_balance_after)::INTEGER,
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
  'Atomically credit tenant wallet (upsert) and append a decimal-aware ledger entry. '
  'Reactivates suspended wallets. Returns new balance in decimal credits. '
  'SECURITY DEFINER — service role required.';

GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;


-- ─── H. Reload PostgREST schema cache ────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
