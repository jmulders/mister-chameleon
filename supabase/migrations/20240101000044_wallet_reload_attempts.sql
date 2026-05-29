-- ============================================================================
-- Migration 44: Wallet Reload Attempts
--
-- Adds a `wallet_reload_attempts` table that tracks every auto-reload event
-- from trigger to completion.  This table is the source of truth for:
--
--   • Deduplication — at most ONE active (pending/processing) attempt per wallet
--     enforced by a partial unique index at the DB level.
--   • Audit — full history: when triggered, which Stripe intent, final outcome.
--   • Webhook idempotency — webhook looks up attempt by payment_intent_id
--     and marks it succeeded/failed; double-delivery cannot double-credit.
--
-- New objects:
--   reload_attempt_status (enum)
--   wallet_reload_attempts (table)
--   process_wallet_reload_success (RPC) — atomically marks attempt succeeded
--                                          AND credits wallet in one transaction
--
-- All statements are idempotent — safe to re-run on an existing DB.
-- No DROP statements — never destroys existing data.
-- ============================================================================

-- ── Enum: reload_attempt_status ───────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.reload_attempt_status AS ENUM (
    'pending',           -- attempt row created; Stripe PaymentIntent not yet created
    'processing',        -- Stripe PaymentIntent created; awaiting confirmation
    'succeeded',         -- payment confirmed; wallet credited
    'failed',            -- payment failed definitively; wallet NOT credited
    'action_required',   -- 3DS / SCA authentication required from the tenant
    'cancelled'          -- abandoned (e.g. monthly cap hit after intent created)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table: wallet_reload_attempts ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wallet_reload_attempts (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant / wallet link
  tenant_id                 text        NOT NULL
                                        REFERENCES public.tenant_settings(tenant_id)
                                        ON DELETE CASCADE,

  -- Balance at the time the reload was triggered
  trigger_balance_cents     integer     NOT NULL,

  -- Amount that was (or should be) reloaded
  reload_amount_cents       integer     NOT NULL CHECK (reload_amount_cents > 0),

  -- Lifecycle state
  status                    public.reload_attempt_status NOT NULL DEFAULT 'pending',

  -- Stable key used as the Stripe PaymentIntent idempotency key.
  -- Format: "wr:{attempt_id}" — avoids collision with other idempotency namespaces.
  idempotency_key           text        NOT NULL UNIQUE,

  -- Set once the Stripe PaymentIntent has been created.
  stripe_payment_intent_id  text,

  -- Human-readable error set when status = failed | action_required | cancelled.
  failure_reason            text,

  -- Timestamps
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- CRITICAL: at most one active (pending OR processing) attempt per wallet.
--   If a second reload trigger fires while one is already in-flight, the DB
--   rejects the INSERT with a unique-constraint violation (code 23P01).
--   Application code catches this and silently exits.
CREATE UNIQUE INDEX IF NOT EXISTS wallet_reload_attempts_one_active_per_wallet_idx
  ON public.wallet_reload_attempts (tenant_id)
  WHERE status IN ('pending', 'processing');

-- Webhook lookup by Stripe PaymentIntent ID (for succeeded / failed events).
CREATE UNIQUE INDEX IF NOT EXISTS wallet_reload_attempts_payment_intent_id_idx
  ON public.wallet_reload_attempts (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Chronological list per tenant (for admin UI).
CREATE INDEX IF NOT EXISTS wallet_reload_attempts_tenant_created_idx
  ON public.wallet_reload_attempts (tenant_id, created_at DESC);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reload_attempt_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reload_attempt_updated_at ON public.wallet_reload_attempts;
CREATE TRIGGER reload_attempt_updated_at
  BEFORE UPDATE ON public.wallet_reload_attempts
  FOR EACH ROW EXECUTE FUNCTION public.reload_attempt_set_updated_at();

-- ── RPC: process_wallet_reload_success ────────────────────────────────────────
--
-- Called by the webhook handler when payment_intent.succeeded is received.
-- In a SINGLE TRANSACTION:
--   1. Marks the reload attempt as 'succeeded' (only if currently pending/processing).
--   2. Credits the wallet (upserts tenant_wallets row).
--   3. Appends a wallet_ledger entry.
--   4. Reactivates a suspended wallet.
--
-- Returns the new wallet balance_cents, or -1 if the attempt was already
-- processed (idempotency: webhook delivered more than once).
--
-- This RPC is the ONLY place that credits the wallet for an auto-reload.
-- Calling the credit_wallet RPC directly from application code for auto-reload
-- is intentionally bypassed to ensure atomicity with the status update.

CREATE OR REPLACE FUNCTION public.process_wallet_reload_success(
  p_attempt_id             uuid,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempt  public.wallet_reload_attempts%ROWTYPE;
  v_balance  integer;
BEGIN
  -- ── 1. Lock + update attempt (idempotency gate) ──────────────────────────
  --
  -- Only transitions from pending/processing → succeeded.
  -- If the row is already succeeded/failed/cancelled this UPDATE matches no
  -- rows and we return -1 (already processed).

  UPDATE public.wallet_reload_attempts
  SET
    status                    = 'succeeded',
    stripe_payment_intent_id  = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    updated_at                = now()
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
    amount_cents,
    balance_after_cents,
    reference_type,
    reference_id,
    note
  ) VALUES (
    v_attempt.tenant_id,
    'top_up_auto_reload',
    v_attempt.reload_amount_cents,
    v_balance,
    'wallet_reload_attempt',
    v_attempt.id::text,
    format('Auto-reload: €%s (intent: %s)',
           to_char(v_attempt.reload_amount_cents / 100.0, 'FM999999990.00'),
           COALESCE(p_stripe_payment_intent_id, 'unknown'))
  );

  RETURN v_balance;
END;
$$;

-- ── RPC: process_wallet_reload_failure ────────────────────────────────────────
--
-- Called by the webhook handler when payment_intent.payment_failed or
-- payment_intent.requires_action is received.
--
-- Marks the attempt failed/action_required so a new attempt can be created
-- (clearing the one-active-per-wallet partial unique index).
-- Does NOT credit or debit the wallet.
--
-- Returns true if the attempt was updated, false if already in a terminal state.

CREATE OR REPLACE FUNCTION public.process_wallet_reload_failure(
  p_attempt_id             uuid,
  p_new_status             public.reload_attempt_status,
  p_failure_reason         text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated boolean;
BEGIN
  UPDATE public.wallet_reload_attempts
  SET
    status                    = p_new_status,
    failure_reason            = p_failure_reason,
    stripe_payment_intent_id  = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
    updated_at                = now()
  WHERE
    id     = p_attempt_id
    AND status IN ('pending', 'processing');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
--
-- Service-role only.  All reads and writes go through server-side code.

ALTER TABLE public.wallet_reload_attempts ENABLE ROW LEVEL SECURITY;
