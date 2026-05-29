-- Migration 092: Split wallet credits into subscription vs purchased pools
--
-- PROBLEM
--   The current tenant_wallets table has a single balance_cents (INTEGER) column
--   that mixes subscription-included credits with pay-as-you-go purchased credits.
--   This makes it impossible to:
--     • Reset subscription credits monthly without touching purchased credits.
--     • Show users which credits expire and which roll over indefinitely.
--
-- SOLUTION
--   Add two sub-columns to tenant_wallets:
--     subscription_credits  — included credits from the active plan; RESET each period.
--     purchased_credits     — top-up / bundle credits; NEVER reset; roll over forever.
--
--   The existing balance_cents column becomes the SUM of both pools and is kept in
--   sync by all wallet RPCs (debit_wallet, credit_wallet, reset_subscription_credits).
--   All existing code that reads balance_cents continues to work unchanged.
--
-- DEDUCTION ORDER
--   subscription_credits are consumed first; purchased_credits are the safety net.
--   This maximises value for the tenant (use the expiring pool first).
--
-- DATA MIGRATION
--   All existing balances are assumed to be "purchased" credits — we cannot
--   retrospectively classify them, and treating them as non-expiring is the
--   safer default.

-- ── 1. Add columns ─────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_wallets
  ADD COLUMN IF NOT EXISTS subscription_credits INTEGER NOT NULL DEFAULT 0
    CHECK (subscription_credits >= 0),
  ADD COLUMN IF NOT EXISTS purchased_credits INTEGER NOT NULL DEFAULT 0
    CHECK (purchased_credits >= 0);

-- ── 2. Migrate existing balances → all to purchased_credits ───────────────────

UPDATE public.tenant_wallets
SET purchased_credits = balance_cents
WHERE purchased_credits = 0
  AND balance_cents > 0;

-- ── 3. Replace debit_wallet RPC ───────────────────────────────────────────────
--
--   New behaviour: consume subscription_credits first, then purchased_credits.
--   balance_cents is decremented as before (it is the sum of both pools).

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_tenant_id    TEXT,
  p_amount_cents INTEGER,
  p_reference    TEXT DEFAULT NULL,
  p_note         TEXT DEFAULT NULL
)
RETURNS TABLE (
  success             BOOLEAN,
  balance_after_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_after       INTEGER;
  v_sub_credits         INTEGER;
  v_pur_credits         INTEGER;
  v_sub_debit           INTEGER;
  v_pur_debit           INTEGER;
BEGIN
  -- Lock the wallet row for the duration of this transaction.
  SELECT balance_cents, subscription_credits, purchased_credits
    INTO v_balance_after, v_sub_credits, v_pur_credits
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id
     AND status    = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0;
    RETURN;
  END IF;

  IF v_balance_after < p_amount_cents THEN
    RETURN QUERY SELECT FALSE, v_balance_after;
    RETURN;
  END IF;

  -- Consume subscription_credits first, then purchased_credits.
  v_sub_debit := LEAST(v_sub_credits, p_amount_cents);
  v_pur_debit := p_amount_cents - v_sub_debit;

  UPDATE public.tenant_wallets
     SET balance_cents        = balance_cents        - p_amount_cents,
         subscription_credits = subscription_credits - v_sub_debit,
         purchased_credits    = purchased_credits    - v_pur_debit,
         updated_at           = now()
   WHERE tenant_id = p_tenant_id
  RETURNING balance_cents INTO v_balance_after;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, created_at
  ) VALUES (
    p_tenant_id, 'debit', -p_amount_cents, v_balance_after,
    p_reference, p_note, now()
  );

  RETURN QUERY SELECT TRUE, v_balance_after;
END;
$$;

-- ── 4. Replace credit_wallet RPC ──────────────────────────────────────────────
--
--   New parameter: p_credit_type ('subscription' | 'purchased').
--   Adds to the correct sub-column and keeps balance_cents in sync.
--
-- Drop all overloads so we can change the return type without errors.
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id    TEXT,
  p_amount_cents INTEGER,
  p_reference    TEXT    DEFAULT NULL,
  p_note         TEXT    DEFAULT NULL,
  p_entry_type   TEXT    DEFAULT 'top_up_manual',
  p_credit_type  TEXT    DEFAULT 'purchased'   -- 'subscription' | 'purchased'
)
RETURNS TABLE (
  success             BOOLEAN,
  balance_after_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_after INTEGER;
BEGIN
  INSERT INTO public.tenant_wallets (
    tenant_id, balance_cents, subscription_credits, purchased_credits,
    status, currency, updated_at
  )
  VALUES (
    p_tenant_id,
    p_amount_cents,
    CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
    CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
    'active', 'EUR', now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents        = public.tenant_wallets.balance_cents + p_amount_cents,
        subscription_credits = public.tenant_wallets.subscription_credits
          + CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
        purchased_credits    = public.tenant_wallets.purchased_credits
          + CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
        -- Re-activate suspended wallets when credits are added.
        status               = CASE
                                 WHEN public.tenant_wallets.status = 'suspended'
                                 THEN 'active'::public.wallet_status
                                 ELSE public.tenant_wallets.status
                               END,
        updated_at           = now()
  RETURNING balance_cents INTO v_balance_after;

  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, created_at
  ) VALUES (
    p_tenant_id, p_entry_type::public.wallet_entry_type, p_amount_cents,
    v_balance_after, p_reference, p_note, now()
  );

  RETURN QUERY SELECT TRUE, v_balance_after;
END;
$$;

-- ── 5. New RPC: reset_subscription_credits ────────────────────────────────────
--
--   Called by the invoice.paid webhook handler each billing period.
--   RESETS subscription_credits to the new period allocation (does NOT add).
--   purchased_credits are NEVER touched.
--   balance_cents is adjusted by the net delta.

CREATE OR REPLACE FUNCTION public.reset_subscription_credits(
  p_tenant_id   TEXT,
  p_new_amount  INTEGER,   -- plan.includedCredits for the new period
  p_reference   TEXT    DEFAULT NULL,
  p_note        TEXT    DEFAULT NULL
)
RETURNS TABLE (
  success             BOOLEAN,
  balance_after_cents INTEGER,
  old_subscription    INTEGER,
  new_subscription    INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_sub     INTEGER;
  v_delta       INTEGER;
  v_bal_after   INTEGER;
BEGIN
  SELECT subscription_credits INTO v_old_sub
    FROM public.tenant_wallets
   WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Wallet not yet initialised — create it with the new allocation.
    INSERT INTO public.tenant_wallets (
      tenant_id, balance_cents, subscription_credits, purchased_credits,
      status, currency, updated_at
    ) VALUES (
      p_tenant_id, p_new_amount, p_new_amount, 0, 'active', 'EUR', now()
    )
    RETURNING balance_cents INTO v_bal_after;

    RETURN QUERY SELECT TRUE, v_bal_after, 0, p_new_amount;
    RETURN;
  END IF;

  -- Delta = new allocation minus whatever subscription credits remained unused.
  v_delta := p_new_amount - v_old_sub;

  UPDATE public.tenant_wallets
     SET subscription_credits = p_new_amount,
         balance_cents        = GREATEST(0, balance_cents + v_delta),
         updated_at           = now()
   WHERE tenant_id = p_tenant_id
  RETURNING balance_cents INTO v_bal_after;

  -- Log the period reset as a ledger entry (type = 'grant' is the closest match).
  INSERT INTO public.wallet_ledger (
    tenant_id, entry_type, amount_cents, balance_after_cents,
    reference_type, note, created_at
  ) VALUES (
    p_tenant_id,
    'grant'::public.wallet_entry_type,
    v_delta,          -- can be negative when the new plan has fewer credits
    v_bal_after,
    p_reference,
    p_note,
    now()
  );

  RETURN QUERY SELECT TRUE, v_bal_after, v_old_sub, p_new_amount;
END;
$$;

-- ── 6. Grant EXECUTE to authenticated and service_role ────────────────────────

GRANT EXECUTE ON FUNCTION public.debit_wallet(TEXT, INTEGER, TEXT, TEXT)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_subscription_credits(TEXT, INTEGER, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON COLUMN public.tenant_wallets.subscription_credits IS
  'Credits included by the active subscription plan. Reset to plan.includedCredits each billing period. Consumed before purchased_credits.';
COMMENT ON COLUMN public.tenant_wallets.purchased_credits IS
  'Credits purchased via top-up bundles. Never reset — roll over indefinitely.';
