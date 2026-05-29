-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 095: upgrade credit_wallet to accept NUMERIC amounts
--
-- Problem
-- ───────
-- The credit_wallet RPC (last re-created in migration 094) declares
-- p_amount_cents as INTEGER.  Passing a decimal value (e.g. 0.4 credits for
-- a fractional balance adjustment) causes Postgres to raise:
--
--   invalid input syntax for type integer: "0.4"   (code: 22P02)
--
-- debit_wallet was already upgraded to NUMERIC in migration 076, but
-- credit_wallet was left behind.
--
-- Fix
-- ───
-- 1. Drop the INTEGER overload.
-- 2. Recreate with p_amount_cents NUMERIC — the same name is kept so all
--    existing callers (creditWallet in wallet.ts, addCredits in usage.ts,
--    legacy fallback in usage.ts) continue to work without any TS changes.
-- 3. Write BOTH the legacy integer columns (balance_cents, amount_cents,
--    balance_after_cents) AND the NUMERIC columns (balance, amount,
--    balance_after) that migration 076 introduced.  Migration 094 only wrote
--    the integer columns, leaving the NUMERIC columns stale.
-- 4. NOTIFY pgrst so the schema cache is refreshed immediately.
--
-- Idempotency
-- ───────────
-- DROP FUNCTION IF EXISTS + CREATE OR REPLACE — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop the INTEGER overload ──────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.credit_wallet(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT);

-- ── 2. Recreate with NUMERIC ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_tenant_id    TEXT,
  p_amount_cents NUMERIC,                         -- was INTEGER; now NUMERIC
  p_reference    TEXT    DEFAULT NULL,
  p_note         TEXT    DEFAULT NULL,
  p_entry_type   TEXT    DEFAULT 'top_up_manual',
  p_credit_type  TEXT    DEFAULT 'purchased'
)
RETURNS TABLE (
  success             BOOLEAN,
  balance_after_cents NUMERIC                     -- was INTEGER; now NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after NUMERIC;
BEGIN
  -- ── Upsert wallet row ──────────────────────────────────────────────────────
  --
  -- Write both NUMERIC columns (balance, subscription_credits,
  -- purchased_credits) and the legacy INTEGER column (balance_cents) so old
  -- code reading balance_cents still gets a value close to the true balance.

  INSERT INTO public.tenant_wallets (
    tenant_id,
    balance_cents,
    balance,
    subscription_credits,
    purchased_credits,
    status,
    currency,
    updated_at
  )
  VALUES (
    p_tenant_id,
    ROUND(p_amount_cents)::INTEGER,
    p_amount_cents,
    CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
    CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
    'active',
    'EUR',
    now()
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents        = public.tenant_wallets.balance_cents
                                 + ROUND(p_amount_cents)::INTEGER,
        balance              = COALESCE(public.tenant_wallets.balance, 0)
                                 + p_amount_cents,
        subscription_credits = COALESCE(public.tenant_wallets.subscription_credits, 0)
          + CASE WHEN p_credit_type = 'subscription' THEN p_amount_cents ELSE 0 END,
        purchased_credits    = COALESCE(public.tenant_wallets.purchased_credits, 0)
          + CASE WHEN p_credit_type = 'purchased'    THEN p_amount_cents ELSE 0 END,
        status               = CASE
                                 WHEN public.tenant_wallets.status = 'suspended'
                                 THEN 'active'::public.wallet_status
                                 ELSE public.tenant_wallets.status
                               END,
        updated_at           = now()
  RETURNING COALESCE(balance, balance_cents::NUMERIC) INTO v_balance_after;

  -- ── Append ledger row ──────────────────────────────────────────────────────
  --
  -- Write both NUMERIC columns (amount, balance_after) introduced by
  -- migration 076 and the legacy INTEGER columns (amount_cents,
  -- balance_after_cents) for backward compatibility.

  INSERT INTO public.wallet_ledger (
    tenant_id,
    entry_type,
    amount_cents,
    amount,
    balance_after_cents,
    balance_after,
    reference_type,
    note,
    created_at
  ) VALUES (
    p_tenant_id,
    p_entry_type::public.wallet_entry_type,
    ROUND(p_amount_cents)::INTEGER,
    p_amount_cents,
    ROUND(v_balance_after)::INTEGER,
    v_balance_after,
    p_reference,
    p_note,
    now()
  );

  RETURN QUERY SELECT TRUE, v_balance_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_wallet(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

-- ── 3. Refresh PostgREST schema cache ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
