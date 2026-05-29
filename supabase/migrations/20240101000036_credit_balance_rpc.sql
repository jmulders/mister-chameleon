-- ─────────────────────────────────────────────────────────────────────────────
-- Credit Balance RPC Functions
--
-- Atomic increment/decrement for credit_balance using Postgres advisory locking.
-- These functions are called from billing-store.ts via supabase.rpc().
--
-- Design:
--   • Both functions lock the row for the duration of the transaction.
--   • increment_credit_balance: upserts credit_balance, returns new total.
--   • decrement_credit_balance: raises exception if balance would go negative
--     (return value is the error signal — caller catches by message pattern).
--   • Both functions return the new balance as an integer.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Increment (credit purchase / admin grant) ─────────────────────────────────

CREATE OR REPLACE FUNCTION increment_credit_balance(
  p_tenant_id  uuid,
  p_amount     integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be positive, got %', p_amount;
  END IF;

  INSERT INTO credit_balance (tenant_id, balance, updated_at)
  VALUES (p_tenant_id, p_amount, now())
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    balance    = credit_balance.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ── Decrement (credit deduction) ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION decrement_credit_balance(
  p_tenant_id  uuid,
  p_amount     integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance integer;
  v_new_balance     integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be positive, got %', p_amount;
  END IF;

  -- Lock the row for the duration of this transaction
  SELECT balance INTO v_current_balance
  FROM credit_balance
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No balance row — tenant has 0 credits
    RAISE EXCEPTION 'insufficient_credits: tenant % has no credit balance', p_tenant_id;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits: tenant % has % credits, needs %',
      p_tenant_id, v_current_balance, p_amount;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE credit_balance
  SET balance = v_new_balance, updated_at = now()
  WHERE tenant_id = p_tenant_id;

  RETURN v_new_balance;
END;
$$;
