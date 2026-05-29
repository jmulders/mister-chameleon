-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0097 — Session Credits
--
-- Implements the top-up wallet for personalised session credits.
--
-- Overview:
--   Tenants on any plan receive a monthly session allowance (25K / 150K / 500K).
--   When they exceed that allowance they can purchase additional session credits
--   via the billing & wallet UI.  Purchased credits never expire — they roll over
--   until consumed.
--
-- Tables:
--   session_credit_balances   — current available balance per tenant (ledger total)
--   session_credit_ledger     — immutable audit log of every credit change
--
-- Top-up flow:
--   1. Tenant buys a bundle via Stripe checkout.
--   2. Stripe webhook fires → insert ledger row (type = 'purchase', positive amount).
--   3. Balance is recalculated as SUM(amount) over all ledger rows for the tenant.
--
-- Consumption flow:
--   1. checkSessionSoftCap fetches balance from session_credit_balances.
--   2. effectiveLimit = planLimit + balance.
--   3. When a session is served beyond the plan cap, deductSessionCredit RPC is
--      called to atomically decrement the balance and write a 'deduction' row.
--
-- Concurrency:
--   deduct_session_credit() is a FOR UPDATE SELECT on session_credit_balances,
--   making concurrent deductions serialisable and preventing negative balances.
--
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── session_credit_balances ───────────────────────────────────────────────────
--
-- One row per tenant.  balance = available credits (sessions) above the plan cap.

CREATE TABLE IF NOT EXISTS session_credit_balances (
  tenant_id   text        NOT NULL PRIMARY KEY,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  session_credit_balances IS
  'Running balance of purchased-but-unconsumed session credits per tenant.';
COMMENT ON COLUMN session_credit_balances.balance IS
  'Available sessions beyond the monthly plan cap.  Never negative.';

-- ── session_credit_ledger ─────────────────────────────────────────────────────
--
-- Immutable audit log.  Never UPDATE or DELETE rows here — only INSERT.

CREATE TABLE IF NOT EXISTS session_credit_ledger (
  id                        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                 text        NOT NULL REFERENCES session_credit_balances(tenant_id) ON DELETE CASCADE,
  -- purchase: bundle bought via Stripe (positive amount)
  -- deduction: session served beyond plan cap (negative amount)
  -- grant: admin manual credit (positive)
  -- refund: credited back after refund (positive)
  -- adjustment: admin correction (positive or negative)
  entry_type                text        NOT NULL CHECK (entry_type IN ('purchase','deduction','grant','refund','adjustment')),
  /** Sessions credited (+) or consumed (−). */
  amount                    integer     NOT NULL,
  /** Running balance after this entry (denormalised for fast lookups). */
  balance_after             integer     NOT NULL,
  /** Stripe PaymentIntent or CheckoutSession ID for purchase entries. */
  stripe_payment_intent_id  text,
  /** Which bundle was purchased (references SESSION_CREDIT_BUNDLES.id). */
  bundle_id                 text,
  /** Visitor session ID for deduction entries (for correlation). */
  session_ref               text,
  /** Human-readable note (e.g. "10,000 Session bundle purchase"). */
  note                      text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_credit_ledger_tenant
  ON session_credit_ledger(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_credit_ledger_tenant_type
  ON session_credit_ledger(tenant_id, entry_type, created_at DESC);

-- ── deduct_session_credit() ───────────────────────────────────────────────────
--
-- Atomically deducts 1 session credit from the tenant balance.
-- Returns TRUE if the deduction succeeded, FALSE if balance was already 0
-- (meaning the tenant has no purchased credits and will rely on plan limit only).
--
-- Called by the personalisation pipeline AFTER a session is served beyond the
-- plan cap.  Non-fatal: a FALSE return means serve-default for this session.

CREATE OR REPLACE FUNCTION deduct_session_credit(
  p_tenant_id  text,
  p_session_id text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Acquire row lock to prevent concurrent over-deduction.
  SELECT balance INTO v_balance
  FROM session_credit_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_balance <= 0 THEN
    RETURN false;
  END IF;

  UPDATE session_credit_balances
  SET balance    = balance - 1,
      updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO session_credit_ledger
    (tenant_id, entry_type, amount, balance_after, session_ref, note)
  VALUES
    (p_tenant_id, 'deduction', -1, v_balance - 1, p_session_id, 'Session served beyond plan cap');

  RETURN true;
END;
$$;

-- ── add_session_credits() ─────────────────────────────────────────────────────
--
-- Credits the tenant wallet after a Stripe purchase.
-- Creates the balance row if it does not yet exist (first purchase).
-- Returns the new balance.

CREATE OR REPLACE FUNCTION add_session_credits(
  p_tenant_id   text,
  p_amount      integer,
  p_bundle_id   text    DEFAULT NULL,
  p_stripe_id   text    DEFAULT NULL,
  p_note        text    DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  INSERT INTO session_credit_balances (tenant_id, balance)
  VALUES (p_tenant_id, 0)
  ON CONFLICT (tenant_id) DO NOTHING;

  UPDATE session_credit_balances
  SET balance    = balance + p_amount,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
  RETURNING balance INTO v_new_balance;

  INSERT INTO session_credit_ledger
    (tenant_id, entry_type, amount, balance_after, bundle_id, stripe_payment_intent_id, note)
  VALUES
    (p_tenant_id, 'purchase', p_amount, v_new_balance,
     p_bundle_id, p_stripe_id,
     COALESCE(p_note, 'Session credit bundle purchase'));

  RETURN v_new_balance;
END;
$$;
