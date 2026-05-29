-- ─────────────────────────────────────────────────────────────────────────────
-- Billing Tables v2
--
-- Replaces any prior billing table attempt (migration 35) which incorrectly
-- referenced `tenants(id)` (uuid FK).  The platform stores tenants in the
-- `tenant_settings` table with a TEXT primary key (the tenant slug).
--
-- All billing tables use TEXT `tenant_id` to match that convention.
-- No foreign-key constraint is imposed on `tenant_settings(tenant_id)` to
-- avoid cross-schema coupling and allow billing records to outlive config
-- changes in dev; application code validates tenant existence before writes.
--
-- ─── Tables ──────────────────────────────────────────────────────────────────
--
--   subscriptions        — one row per tenant: Stripe subscription state
--   credit_balance       — one row per tenant: current enrichment-credit total
--   credit_transactions  — append-only ledger of every credit change
--
-- ─── Design principles ───────────────────────────────────────────────────────
--
--   • Stripe is source of truth for payment/subscription state.
--   • Local DB is source of truth for access gating + credit balance.
--   • Webhook events are idempotent: stripe_event_id prevents re-processing.
--   • credit_balance is a fast-read cache; credit_transactions is the ledger.
--   • RLS enabled, all access via service-role client only.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Clean up any broken prior attempt ────────────────────────────────────────
-- Migration 35 created these tables with an incorrect UUID FK on tenant_id.
-- Drop them if present so this migration creates them correctly.
-- CASCADE ensures dependent objects (indexes, triggers) are removed first.

DROP TABLE IF EXISTS public.credit_transactions CASCADE;
DROP TABLE IF EXISTS public.credit_balance      CASCADE;
DROP TABLE IF EXISTS public.subscriptions       CASCADE;

-- ── credit_tx_type enum ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.credit_tx_type AS ENUM (
    'purchase',   -- credits bought via Stripe Checkout
    'deduction',  -- credits consumed by an enrichment call
    'grant',      -- monthly included-credit reset, admin grant, or trial credit
    'refund',     -- credits returned on cancellation / error
    'expiry'      -- reserved: credit expiry at billing cycle rollover
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── subscriptions ─────────────────────────────────────────────────────────────
--
-- One row per tenant. Synced from Stripe via webhooks.
-- Plan and status are authoritative for platform feature gating.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text        NOT NULL,

  -- ── Stripe identifiers ────────────────────────────────────────────────────
  stripe_customer_id      text,
  stripe_subscription_id  text        UNIQUE,
  stripe_price_id         text,

  -- ── Plan state (drives feature gating) ───────────────────────────────────
  plan          text  NOT NULL DEFAULT 'starter'
                CHECK (plan IN ('starter', 'growth', 'pro')),
  status        text  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
  billing_cycle text  NOT NULL DEFAULT 'monthly'
                CHECK (billing_cycle IN ('monthly', 'annual')),

  -- ── Billing period (synced from Stripe webhook) ───────────────────────────
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  cancel_at_period_end    boolean     NOT NULL DEFAULT false,
  canceled_at             timestamptz,

  -- ── Metadata ──────────────────────────────────────────────────────────────
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per tenant
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx
  ON public.subscriptions (tenant_id);

-- Fast webhook routing: customer ID → tenant
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Fast webhook routing: subscription ID → tenant
CREATE INDEX IF NOT EXISTS subscriptions_stripe_sub_idx
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON TABLE  public.subscriptions IS 'One row per tenant. Stripe subscription state, synced via webhooks.';
COMMENT ON COLUMN public.subscriptions.tenant_id IS 'Tenant slug (matches tenant_settings.tenant_id). Text, not UUID.';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe Customer ID (cus_…). Null until first checkout completed.';
COMMENT ON COLUMN public.subscriptions.stripe_price_id IS 'Active Stripe Price ID for the current plan/cycle.';

-- ── credit_balance ────────────────────────────────────────────────────────────
--
-- Denormalized current balance — optimised for fast reads on every API call.
-- Updated atomically via the decrement_credit_balance / increment_credit_balance RPCs.

CREATE TABLE IF NOT EXISTS public.credit_balance (
  tenant_id   text        PRIMARY KEY,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.credit_balance IS 'Denormalized credit balance per tenant. Source: credit_transactions ledger (via RPC).';
COMMENT ON COLUMN public.credit_balance.balance IS 'Current enrichment credit balance. Never negative (enforced by RPC).';

-- ── credit_transactions ───────────────────────────────────────────────────────
--
-- Append-only financial ledger — every balance change produces one row.
-- stripe_event_id enforces idempotency: duplicate webhook deliveries are ignored.

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text                    NOT NULL,

  type                  public.credit_tx_type   NOT NULL,
  amount                integer                 NOT NULL,         -- positive = added, negative = deducted
  balance_after         integer                 NOT NULL,         -- snapshot for audit trail

  -- ── Source tracking ───────────────────────────────────────────────────────
  stripe_event_id       text        UNIQUE,    -- idempotency key (Stripe event ID)
  stripe_payment_intent text,
  bundle_id             text,                  -- credit bundle purchased (e.g. "credits_1000")
  feature               text,                  -- which platform feature triggered the deduction
  description           text,

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Fast ledger reads (per tenant, newest first)
CREATE INDEX IF NOT EXISTS credit_txn_tenant_time_idx
  ON public.credit_transactions (tenant_id, created_at DESC);

-- Fast idempotency lookup (partial — null stripe_event_id is not indexed)
CREATE INDEX IF NOT EXISTS credit_txn_stripe_event_idx
  ON public.credit_transactions (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

COMMENT ON TABLE  public.credit_transactions IS 'Append-only enrichment credit ledger. One row per balance change.';
COMMENT ON COLUMN public.credit_transactions.stripe_event_id IS 'Stripe event ID used for idempotency. UNIQUE prevents double-processing.';

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS credit_balance_updated_at ON public.credit_balance;
CREATE TRIGGER credit_balance_updated_at
  BEFORE UPDATE ON public.credit_balance
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

-- ── RPC: increment_credit_balance ─────────────────────────────────────────────
--
-- Atomically insert or increment the credit_balance row for a tenant.
-- Returns the new balance.

CREATE OR REPLACE FUNCTION public.increment_credit_balance(
  p_tenant_id text,
  p_amount    integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  INSERT INTO public.credit_balance (tenant_id, balance)
  VALUES (p_tenant_id, p_amount)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    balance    = credit_balance.balance + EXCLUDED.balance,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ── RPC: decrement_credit_balance ─────────────────────────────────────────────
--
-- Atomically deduct credits from a tenant's balance.
-- Raises 'insufficient_credits' if balance would go negative.
-- Returns the new balance.

CREATE OR REPLACE FUNCTION public.decrement_credit_balance(
  p_tenant_id text,
  p_amount    integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_current integer;
  v_new     integer;
BEGIN
  -- Lock the row for the duration of this transaction
  SELECT balance INTO v_current
  FROM public.credit_balance
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits: no balance row for tenant %', p_tenant_id;
  END IF;

  v_new := v_current - p_amount;

  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient_credits: balance % < requested %', v_current, p_amount;
  END IF;

  UPDATE public.credit_balance
  SET balance = v_new, updated_at = now()
  WHERE tenant_id = p_tenant_id;

  RETURN v_new;
END;
$$;

-- ── Row-level security (billing tables) ─────────────────────────────────────
-- All access via service-role client — no tenant-facing policies.

ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- usage_events — fix from migration 39
--
-- Migration 39 created usage_events with:
--   tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
-- The `tenants` table does not exist (tenant config lives in `tenant_settings`),
-- so migration 39 FAILED and usage_events was never created.
--
-- We drop (in case a partial creation happened) and recreate with TEXT tenant_id.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.usage_events CASCADE;

-- usage_event_type enum (created by migration 39; safe to re-run due to guard)
DO $$ BEGIN
  CREATE TYPE public.usage_event_type AS ENUM (
    'leadinfo_lookup',
    'ip_enrich',
    'weather_enrich',
    'intent_enrich',
    'crm_lookup'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop the summary view that referenced the old table (if it exists)
DROP VIEW IF EXISTS public.usage_events_summary;

CREATE TABLE IF NOT EXISTS public.usage_events (
  id               uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text                       NOT NULL,   -- TEXT slug, not UUID

  event_type       public.usage_event_type    NOT NULL,
  quantity         integer                    NOT NULL DEFAULT 1  CHECK (quantity > 0),
  credits_cost     integer                    NOT NULL DEFAULT 0  CHECK (credits_cost >= 0),

  success          boolean                    NOT NULL DEFAULT true,
  error_code       text,                      -- machine-readable, e.g. "rate_limited"

  session_id       text,
  idempotency_key  text                       UNIQUE,

  -- Event-specific metadata (companyName, IP, weather conditions, etc.)
  metadata         jsonb                      NOT NULL DEFAULT '{}',

  created_at       timestamptz                NOT NULL DEFAULT now()
);

-- Per-tenant billing period summary (primary dashboard query)
CREATE INDEX IF NOT EXISTS usage_events_tenant_time_idx
  ON public.usage_events (tenant_id, created_at DESC);

-- Per-feature breakdown
CREATE INDEX IF NOT EXISTS usage_events_tenant_type_time_idx
  ON public.usage_events (tenant_id, event_type, created_at DESC);

-- Idempotency lookup (sparse)
CREATE INDEX IF NOT EXISTS usage_events_idempotency_idx
  ON public.usage_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Platform-wide analytics
CREATE INDEX IF NOT EXISTS usage_events_type_time_idx
  ON public.usage_events (event_type, created_at DESC);

COMMENT ON TABLE  public.usage_events IS 'Granular enrichment activity log. One row per enrichment API call (success or failure).';
COMMENT ON COLUMN public.usage_events.tenant_id IS 'Tenant slug (TEXT). Matches tenant_settings.tenant_id.';
COMMENT ON COLUMN public.usage_events.credits_cost IS '0 for failed/cached calls; 1 for a standard enrichment hit.';
COMMENT ON COLUMN public.usage_events.idempotency_key IS 'Format: {event_type}:{tenant_id}:{session_id}. Prevents double-recording on retry.';

-- Recreate the summary view against the corrected table
CREATE OR REPLACE VIEW public.usage_events_summary AS
SELECT
  tenant_id,
  event_type,
  date_trunc('day', created_at)             AS event_date,
  count(*)                                   AS call_count,
  count(*) FILTER (WHERE success)            AS success_count,
  count(*) FILTER (WHERE NOT success)        AS failure_count,
  sum(credits_cost)                          AS total_credits
FROM public.usage_events
GROUP BY tenant_id, event_type, date_trunc('day', created_at);

-- RLS — service-role only
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
