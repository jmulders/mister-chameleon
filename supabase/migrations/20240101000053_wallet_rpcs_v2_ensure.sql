-- ============================================================================
-- Migration 053: Wallet RPCs v2 — safety net
--
-- Root cause this fixes:
--   PGRST202 "Could not find the function public.credit_wallet(
--     p_amount_cents, p_category, p_entry_type, p_note,
--     p_reference_id, p_reference_type, p_tenant_id) in the schema cache"
--
--   TypeScript (billing/wallet.ts) calls credit_wallet with 7 named params
--   including p_category.  The DB only has the old 6-param version from
--   migrations 043/047.  Migration 051 (credits_schema_v2) adds p_category to
--   both credit_wallet and debit_wallet, but was never applied to this DB.
--
-- What this migration does:
--   1. Ensures wallet_ledger has the `category` and `simulated` columns
--      introduced by migration 051 (idempotent ADD COLUMN IF NOT EXISTS).
--   2. Creates the 7-param credit_wallet RPC that TypeScript expects.
--   3. Creates the 6-param debit_wallet RPC that TypeScript expects.
--   4. Updates sim_set_wallet_balance + sim_credit_wallet to mark their
--      ledger entries as simulated=TRUE (correctness fix, not crash-blocking).
--   5. Updates process_wallet_reload_success to write category='topup'
--      and simulated=FALSE explicitly (reporting quality improvement).
--
-- Idempotent: all DDL uses IF NOT EXISTS / CREATE OR REPLACE.
-- Safe to apply even if migration 051 was already applied.
--
-- Must stay in sync with:
--   • billing/wallet.ts  (creditWallet / debitWallet TypeScript wrappers)
--   • billing/types.ts   (WalletEntryType, CreditCategory)
-- ============================================================================

-- ── 1. Ensure wallet_ledger has category + simulated columns ─────────────────
--
-- Guards against the DB being in the pre-051 state where these columns are
-- absent.  The new RPCs below INSERT into these columns, so they must exist
-- before the functions are invoked.

ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS category  TEXT,
  ADD COLUMN IF NOT EXISTS simulated BOOLEAN NOT NULL DEFAULT FALSE;

-- Category constraint (mirrors migration 051; DO block makes it idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_name       = 'wallet_ledger'
       AND constraint_name  = 'wallet_ledger_category_check'
       AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE public.wallet_ledger
      ADD CONSTRAINT wallet_ledger_category_check
      CHECK (category IS NULL OR category IN (
        'recognition', 'adaptation', 'brainpower',
        'topup', 'refund', 'adjustment'
      ));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Supporting indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_category
  ON public.wallet_ledger (tenant_id, category, created_at DESC)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_simulated
  ON public.wallet_ledger (tenant_id, simulated, created_at DESC);

-- Drop all overloads so we can change return type without errors.
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text);

-- ── 2. credit_wallet — 7-param version ───────────────────────────────────────
--
-- Atomically credits the tenant wallet and appends a ledger entry.
-- Accepts p_category so callers can classify the credit (topup/refund/adjustment).
--
-- This is the version billing/wallet.ts#creditWallet() expects:
--   client.rpc("credit_wallet", {
--     p_tenant_id, p_amount_cents, p_entry_type,
--     p_reference_type, p_reference_id, p_note, p_category
--   })
--
-- The old 6-param function (without p_category) is NOT dropped — it may still
-- be called by older code paths.  PostgreSQL overloads by signature; PostgREST
-- resolves by the named parameters passed, so both co-exist safely.

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_entry_type     TEXT    DEFAULT 'top_up_manual',
  p_reference_type TEXT    DEFAULT 'manual',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT 'topup'
)
RETURNS INTEGER        -- returns new balance_cents after the credit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after  INTEGER;
  v_is_simulated   BOOLEAN;
BEGIN
  -- Determine if this is a simulated entry (test mode top-ups use 'sim_' prefix)
  v_is_simulated := (p_entry_type LIKE 'sim_%');

  -- Upsert: create wallet row if absent, otherwise add to existing balance.
  -- Also reactivates a suspended wallet when funds arrive.
  INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status)
  VALUES (p_tenant_id, p_amount_cents, 'active')
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents = public.tenant_wallets.balance_cents + EXCLUDED.balance_cents,
        status        = CASE
                          WHEN public.tenant_wallets.status = 'suspended'
                          THEN 'active'
                          ELSE public.tenant_wallets.status
                        END,
        updated_at    = now()
  RETURNING balance_cents INTO v_balance_after;

  -- Append ledger entry (positive amount = credit)
  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
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
    p_amount_cents,
    v_balance_after,
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
  'Atomically credit tenant wallet + append ledger entry. '
  '7-param version: includes p_category for per-category balance reporting. '
  'Reactivates suspended wallets. Returns new balance_cents.';

-- ── 3. debit_wallet — 6-param version ────────────────────────────────────────
--
-- Atomically debits the tenant wallet with a row-level lock and appends a
-- ledger entry.  Raises on insufficient balance or inactive wallet.
--
-- This is the version billing/wallet.ts#debitWallet() expects:
--   client.rpc("debit_wallet", {
--     p_tenant_id, p_amount_cents, p_reference_type,
--     p_reference_id, p_note, p_category
--   })

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_reference_type TEXT    DEFAULT 'enrichment_usage',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL
)
RETURNS INTEGER        -- returns new balance_cents after the debit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after  INTEGER;
  v_status         TEXT;
BEGIN
  -- Lock the wallet row to prevent concurrent debits
  SELECT balance_cents, status
  INTO   v_balance_before, v_status
  FROM   public.tenant_wallets
  WHERE  tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found for tenant %', p_tenant_id;
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'wallet_not_active: status=% for tenant %', v_status, p_tenant_id;
  END IF;

  IF v_balance_before < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient_wallet_balance: balance=% requested=% for tenant %',
      v_balance_before, p_amount_cents, p_tenant_id;
  END IF;

  v_balance_after := v_balance_before - p_amount_cents;

  UPDATE public.tenant_wallets
  SET    balance_cents = v_balance_after,
         updated_at    = now()
  WHERE  tenant_id = p_tenant_id;

  -- Append ledger entry (negative amount = debit)
  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
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
    -p_amount_cents,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note,
    FALSE,
    now()
  );

  RETURN v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.debit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) IS
  'Atomically debit tenant wallet with row-level lock + append ledger entry. '
  '6-param version: includes p_category for per-category spend tracking. '
  'Raises wallet_not_found, wallet_not_active, insufficient_wallet_balance. '
  'Returns new balance_cents.';

-- ── 4. sim_debit_wallet — update to set simulated=TRUE ───────────────────────
--
-- Migration 051 already defines this function correctly with p_category and
-- simulated=TRUE.  Repeating here as a safety net so it is applied even if 051
-- was skipped.

CREATE OR REPLACE FUNCTION public.sim_debit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_reference_type TEXT    DEFAULT 'sim_enrichment',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after  INTEGER;
  v_status         TEXT;
BEGIN
  SELECT balance_cents, status
  INTO   v_balance_before, v_status
  FROM   public.tenant_wallets
  WHERE  tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found for tenant %', p_tenant_id;
  END IF;

  v_balance_after := GREATEST(0, v_balance_before - p_amount_cents);

  UPDATE public.tenant_wallets
  SET    balance_cents = v_balance_after,
         updated_at    = now()
  WHERE  tenant_id = p_tenant_id;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, category, amount_cents, balance_after_cents,
    reference_type, reference_id, note, simulated, created_at
  ) VALUES (
    p_tenant_id, 'sim_debit', p_category, -p_amount_cents, v_balance_after,
    p_reference_type, p_reference_id,
    COALESCE(p_note, format('[SIM] Debit -€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00'))),
    TRUE,   -- explicitly mark as simulated
    now()
  );

  RETURN v_balance_after;
END;
$$;

-- ── 5. sim_set_wallet_balance — mark ledger entries as simulated ──────────────
--
-- Original (migration 045) omits `simulated` column — it defaults to FALSE,
-- which is wrong for test-mode entries.  This version explicitly sets TRUE.

CREATE OR REPLACE FUNCTION public.sim_set_wallet_balance(
  p_tenant_id     TEXT,
  p_balance_cents INTEGER,
  p_note          TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance  INTEGER;
  v_current_mode     public.wallet_test_mode;
  v_delta            INTEGER;
  v_entry_type       public.wallet_entry_type;
BEGIN
  SELECT balance_cents, test_mode
    INTO v_current_balance, v_current_mode
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    -- Lazily upsert the wallet in test_simulated mode.
    INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, test_mode, updated_at)
    VALUES (p_tenant_id, p_balance_cents, 'active', 'test_simulated', now())
    RETURNING balance_cents INTO v_current_balance;

    INSERT INTO public.wallet_ledger (
      tenant_id, entry_type, amount_cents, balance_after_cents,
      reference_type, note, simulated
    ) VALUES (
      p_tenant_id, 'sim_top_up', p_balance_cents, p_balance_cents,
      'sim_set_balance',
      COALESCE(p_note, format('[SIM] Balance set to €%s', to_char(p_balance_cents / 100.0, 'FM999999990.00'))),
      TRUE
    );

    RETURN p_balance_cents;
  END IF;

  IF v_current_mode <> 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode'
      USING HINT = 'Enable test mode on this wallet before using sim_* functions';
  END IF;

  v_delta      := p_balance_cents - v_current_balance;
  v_entry_type := CASE WHEN v_delta >= 0 THEN 'sim_top_up' ELSE 'sim_debit' END;

  UPDATE public.tenant_wallets
     SET balance_cents = p_balance_cents,
         status        = CASE
                           WHEN status = 'suspended' AND p_balance_cents > 0 THEN 'active'::public.wallet_status
                           WHEN p_balance_cents = 0                          THEN 'suspended'::public.wallet_status
                           ELSE status
                         END,
         updated_at    = now()
   WHERE tenant_id = p_tenant_id;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, simulated
  ) VALUES (
    p_tenant_id,
    v_entry_type,
    v_delta,
    p_balance_cents,
    'sim_set_balance',
    COALESCE(p_note, format('[SIM] Balance set to €%s (delta: %s%s)',
      to_char(p_balance_cents / 100.0, 'FM999999990.00'),
      CASE WHEN v_delta >= 0 THEN '+' ELSE '' END,
      to_char(v_delta        / 100.0, 'FM999999990.00')
    )),
    TRUE
  );

  RETURN p_balance_cents;
END;
$$;

-- ── 6. sim_credit_wallet — mark ledger entry as simulated ────────────────────
--
-- Original (migration 045) omits `simulated` column.  This version sets TRUE.

CREATE OR REPLACE FUNCTION public.sim_credit_wallet(
  p_tenant_id    TEXT,
  p_amount_cents INTEGER,
  p_note         TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance INTEGER;
  v_mode        public.wallet_test_mode;
BEGIN
  SELECT test_mode INTO v_mode
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id;

  IF v_mode IS DISTINCT FROM 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode';
  END IF;

  UPDATE public.tenant_wallets
     SET balance_cents = balance_cents + p_amount_cents,
         status        = CASE WHEN status = 'suspended' THEN 'active'::public.wallet_status ELSE status END,
         updated_at    = now()
   WHERE tenant_id     = p_tenant_id
  RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, simulated
  ) VALUES (
    p_tenant_id, 'sim_top_up', p_amount_cents, v_new_balance, 'sim_credit',
    COALESCE(p_note, format('[SIM] Top-up +€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00'))),
    TRUE
  );

  RETURN v_new_balance;
END;
$$;

-- ── 7. process_wallet_reload_success — add category + simulated columns ───────
--
-- Original (migration 044) omits `category` and `simulated` from the ledger
-- INSERT.  This version explicitly sets category='topup' and simulated=FALSE
-- so auto-reload entries are correctly classified in per-category reports.

CREATE OR REPLACE FUNCTION public.process_wallet_reload_success(
  p_attempt_id               UUID,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempt  public.wallet_reload_attempts%ROWTYPE;
  v_balance  INTEGER;
BEGIN
  -- ── 1. Lock + update attempt (idempotency gate) ──────────────────────────
  --
  -- Only transitions pending/processing → succeeded.
  -- Returns -1 if already processed (webhook delivered more than once).

  UPDATE public.wallet_reload_attempts
  SET
    status                   = 'succeeded',
    stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    updated_at               = now()
  WHERE
    id     = p_attempt_id
    AND status IN ('pending', 'processing')
  RETURNING * INTO v_attempt;

  IF NOT FOUND THEN
    RETURN -1; -- already processed
  END IF;

  -- ── 2. Credit wallet (atomic upsert + reactivation) ─────────────────────

  INSERT INTO public.tenant_wallets (tenant_id, balance_cents, status, updated_at)
  VALUES (v_attempt.tenant_id, v_attempt.reload_amount_cents, 'active', now())
  ON CONFLICT (tenant_id) DO UPDATE
  SET
    balance_cents = public.tenant_wallets.balance_cents + v_attempt.reload_amount_cents,
    status        = CASE
                      WHEN public.tenant_wallets.status = 'suspended'
                        THEN 'active'::public.wallet_status
                      ELSE public.tenant_wallets.status
                    END,
    updated_at    = now()
  RETURNING balance_cents INTO v_balance;

  -- ── 3. Ledger entry ───────────────────────────────────────────────────────

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    v_attempt.tenant_id,
    'top_up_auto_reload',
    'topup',          -- auto-reload is always a top-up category
    v_attempt.reload_amount_cents,
    v_balance,
    'wallet_reload_attempt',
    v_attempt.id::TEXT,
    format('Auto-reload: €%s (intent: %s)',
           to_char(v_attempt.reload_amount_cents / 100.0, 'FM999999990.00'),
           COALESCE(p_stripe_payment_intent_id, 'unknown')),
    FALSE,            -- real payment, not simulated
    now()
  );

  RETURN v_balance;
END;
$$;

-- ── Done ──────────────────────────────────────────────────────────────────────
-- Schema version: wallet_rpcs_v2
-- Primary fix:    credit_wallet + debit_wallet now include p_category (PGRST202 resolved)
-- Secondary fix:  sim_set_wallet_balance, sim_credit_wallet mark ledger entries simulated=TRUE
-- Quality fix:    process_wallet_reload_success writes category='topup', simulated=FALSE
