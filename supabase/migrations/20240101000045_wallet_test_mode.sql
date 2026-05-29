-- ============================================================================
-- Migration 45: Wallet Test Mode
--
-- Adds a test_mode column to tenant_wallets so individual wallets can be
-- placed in simulated mode for QA / staging / developer testing without
-- touching real Stripe or real financial state.
--
-- New enum values added to wallet_entry_type:
--   sim_top_up          — simulated top-up (test mode only)
--   sim_debit           — simulated debit  (test mode only)
--   sim_auto_reload     — simulated auto-reload success (test mode only)
--   sim_failed_reload   — simulated auto-reload failure (test mode only)
--
-- New column on tenant_wallets:
--   test_mode           — 'live' | 'test_simulated'
--
-- New RPC:
--   sim_set_wallet_balance   — atomically set balance to exact cents + ledger
--   sim_credit_wallet        — add simulated top-up + ledger
--   sim_debit_wallet         — remove simulated debit + ledger
--   sim_trigger_reload_success — fake a succeeded reload attempt + ledger
--   sim_trigger_reload_failure — fake a failed reload attempt
--
-- Safety:
--   All sim_* RPCs check test_mode = 'test_simulated' before executing.
--   They raise 'wallet_not_in_test_mode' if called on a live wallet.
--
-- All statements are idempotent — safe to re-run on an existing DB.
-- No DROP statements — never destroys real data.
-- ============================================================================

-- ── New wallet test mode type ─────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.wallet_test_mode AS ENUM (
    'live',             -- real money, real Stripe — production default
    'test_simulated'    -- simulated balance, no real charges
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Add test_mode column to tenant_wallets ────────────────────────────────────

ALTER TABLE public.tenant_wallets
  ADD COLUMN IF NOT EXISTS test_mode public.wallet_test_mode NOT NULL DEFAULT 'live';

-- Index so we can quickly enumerate wallets in test mode (admin tooling).
CREATE INDEX IF NOT EXISTS tenant_wallets_test_mode_idx
  ON public.tenant_wallets (test_mode)
  WHERE test_mode = 'test_simulated';

-- ── Extend wallet_entry_type with simulated variants ─────────────────────────
--
-- ALTER TYPE … ADD VALUE is transactional in Postgres 12+ but cannot be inside
-- a multi-statement transaction.  Use individual DO blocks so each value is
-- added independently and idempotently.

DO $$ BEGIN
  ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_top_up';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_debit';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_auto_reload';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_failed_reload';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RPC: sim_set_wallet_balance ───────────────────────────────────────────────
--
-- Atomically set the wallet balance to an exact value and record a sim_top_up
-- or sim_debit ledger entry to explain the change.
--
-- Raises 'wallet_not_in_test_mode' if the wallet is not in test_simulated mode.
-- Returns the new balance_cents.

CREATE OR REPLACE FUNCTION public.sim_set_wallet_balance(
  p_tenant_id     text,
  p_balance_cents integer,  -- new absolute balance (≥ 0)
  p_note          text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance  integer;
  v_current_mode     public.wallet_test_mode;
  v_delta            integer;
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
      tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note
    ) VALUES (
      p_tenant_id, 'sim_top_up', p_balance_cents, p_balance_cents,
      'sim_set_balance',
      COALESCE(p_note, format('[SIM] Balance set to €%s', to_char(p_balance_cents / 100.0, 'FM999999990.00')))
    );

    RETURN p_balance_cents;
  END IF;

  IF v_current_mode <> 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode'
      USING HINT = 'Enable test mode on this wallet before using sim_* functions';
  END IF;

  v_delta       := p_balance_cents - v_current_balance;
  v_entry_type  := CASE WHEN v_delta >= 0 THEN 'sim_top_up' ELSE 'sim_debit' END;

  UPDATE public.tenant_wallets
     SET balance_cents = p_balance_cents,
         -- Reactivate a suspended wallet when balance is restored.
         status        = CASE
                           WHEN status = 'suspended' AND p_balance_cents > 0 THEN 'active'::public.wallet_status
                           WHEN p_balance_cents = 0                          THEN 'suspended'::public.wallet_status
                           ELSE status
                         END,
         updated_at    = now()
   WHERE tenant_id = p_tenant_id;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note
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
    ))
  );

  RETURN p_balance_cents;
END;
$$;

-- ── RPC: sim_credit_wallet ────────────────────────────────────────────────────
--
-- Add a simulated top-up (sim_top_up ledger entry).
-- Raises 'wallet_not_in_test_mode' if not in test_simulated mode.
-- Returns new balance.

CREATE OR REPLACE FUNCTION public.sim_credit_wallet(
  p_tenant_id   text,
  p_amount_cents integer,
  p_note        text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance integer;
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
    tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note
  ) VALUES (
    p_tenant_id, 'sim_top_up', p_amount_cents, v_new_balance, 'sim_credit',
    COALESCE(p_note, format('[SIM] Top-up +€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00')))
  );

  RETURN v_new_balance;
END;
$$;

-- ── RPC: sim_debit_wallet ─────────────────────────────────────────────────────
--
-- Remove a simulated debit (sim_debit ledger entry).
-- Does NOT check balance — allows driving balance to 0 for testing.
-- Raises 'wallet_not_in_test_mode' if not in test_simulated mode.
-- Returns new balance (clamped to 0).

CREATE OR REPLACE FUNCTION public.sim_debit_wallet(
  p_tenant_id   text,
  p_amount_cents integer,
  p_note        text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance integer;
  v_mode        public.wallet_test_mode;
BEGIN
  SELECT test_mode INTO v_mode
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id;

  IF v_mode IS DISTINCT FROM 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode';
  END IF;

  UPDATE public.tenant_wallets
     SET balance_cents = GREATEST(0, balance_cents - p_amount_cents),
         status        = CASE
                           WHEN GREATEST(0, balance_cents - p_amount_cents) = 0 THEN 'suspended'::public.wallet_status
                           ELSE status
                         END,
         updated_at    = now()
   WHERE tenant_id = p_tenant_id
  RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note
  ) VALUES (
    p_tenant_id, 'sim_debit', -p_amount_cents, v_new_balance, 'sim_debit',
    COALESCE(p_note, format('[SIM] Debit -€%s', to_char(p_amount_cents / 100.0, 'FM999999990.00')))
  );

  RETURN v_new_balance;
END;
$$;

-- ── RPC: sim_trigger_reload_success ──────────────────────────────────────────
--
-- Simulate a successful auto-reload:
--   1. Creates a wallet_reload_attempts row with status='succeeded'.
--   2. Credits the wallet.
--   3. Appends a sim_auto_reload ledger entry.
--   4. Updates auto_reload_spent_this_month_cents.
--
-- Raises 'wallet_not_in_test_mode' if not in test_simulated mode.
-- Returns new balance.

CREATE OR REPLACE FUNCTION public.sim_trigger_reload_success(
  p_tenant_id    text,
  p_amount_cents integer DEFAULT NULL  -- uses wallet.auto_reload_amount_cents if NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet       public.tenant_wallets%ROWTYPE;
  v_amount       integer;
  v_new_balance  integer;
  v_idem_key     text;
BEGIN
  SELECT * INTO v_wallet
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;
  IF v_wallet.test_mode <> 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode';
  END IF;

  v_amount    := COALESCE(p_amount_cents, v_wallet.auto_reload_amount_cents);
  v_idem_key  := format('sim-reload:%s:%s', p_tenant_id, gen_random_uuid());

  -- Insert a succeeded reload attempt so the history is visible.
  INSERT INTO public.wallet_reload_attempts (
    tenant_id, trigger_balance_cents, reload_amount_cents,
    status, idempotency_key, failure_reason
  ) VALUES (
    p_tenant_id, v_wallet.balance_cents, v_amount,
    'succeeded', v_idem_key,
    NULL
  );

  -- Credit the wallet.
  UPDATE public.tenant_wallets
     SET balance_cents = balance_cents + v_amount,
         status        = CASE WHEN status = 'suspended' THEN 'active'::public.wallet_status ELSE status END,
         auto_reload_spent_this_month_cents = auto_reload_spent_this_month_cents + v_amount,
         updated_at    = now()
   WHERE tenant_id     = p_tenant_id
  RETURNING balance_cents INTO v_new_balance;

  -- Simulated ledger entry.
  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note
  ) VALUES (
    p_tenant_id, 'sim_auto_reload', v_amount, v_new_balance, 'sim_reload',
    format('[SIM] Auto-reload success +€%s → balance €%s',
           to_char(v_amount       / 100.0, 'FM999999990.00'),
           to_char(v_new_balance  / 100.0, 'FM999999990.00'))
  );

  RETURN v_new_balance;
END;
$$;

-- ── RPC: sim_trigger_reload_failure ──────────────────────────────────────────
--
-- Simulate a failed auto-reload (or action_required for 3DS test):
--   1. Creates a wallet_reload_attempts row with status='failed' or 'action_required'.
--   2. Appends a sim_failed_reload ledger entry.
--   3. Does NOT credit the wallet.
--
-- Raises 'wallet_not_in_test_mode' if not in test_simulated mode.

CREATE OR REPLACE FUNCTION public.sim_trigger_reload_failure(
  p_tenant_id      text,
  p_failure_reason text  DEFAULT 'Simulated payment failure',
  p_status         text  DEFAULT 'failed'   -- 'failed' | 'action_required'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet    public.tenant_wallets%ROWTYPE;
  v_idem_key  text;
BEGIN
  SELECT * INTO v_wallet
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_wallet.test_mode <> 'test_simulated' THEN
    RAISE EXCEPTION 'wallet_not_in_test_mode';
  END IF;

  v_idem_key := format('sim-reload-fail:%s:%s', p_tenant_id, gen_random_uuid());

  INSERT INTO public.wallet_reload_attempts (
    tenant_id, trigger_balance_cents, reload_amount_cents,
    status, idempotency_key, failure_reason
  ) VALUES (
    p_tenant_id, v_wallet.balance_cents, v_wallet.auto_reload_amount_cents,
    p_status::public.reload_attempt_status, v_idem_key, p_failure_reason
  );

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents, reference_type, note
  ) VALUES (
    p_tenant_id, 'sim_failed_reload', 0, v_wallet.balance_cents, 'sim_reload',
    format('[SIM] Reload %s: %s', p_status, p_failure_reason)
  );
END;
$$;

-- ── updated_at: ensure test_mode col changes bump updated_at ─────────────────
--
-- The existing wallet_updated_at trigger already fires on any UPDATE so this
-- is covered automatically.

-- ── RLS: test mode column follows existing service-role-only policy ───────────
--
-- No additional RLS changes needed — tenant_wallets already requires
-- service-role to read/write.
