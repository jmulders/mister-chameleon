-- ─────────────────────────────────────────────────────────────────────────────
-- Billing: Ensure Complete Schema (Migration 42)
--
-- Purpose
-- ───────
-- Guarantees all billing tables, columns, indexes, RPCs, and views exist in
-- a fully idempotent way.  Safe to run regardless of which prior migrations
-- (35, 36, 39, 40, 41) have or have not been applied.
--
-- Unlike migration 40 (which used DROP TABLE to clean up broken prior tables),
-- this migration NEVER drops anything.  It only creates objects that are
-- missing.  Running it twice on a healthy database is a no-op.
--
-- When to run
-- ───────────
-- • First deploy: applies the full billing schema from scratch.
-- • After a partial migration failure: fills in whatever is missing.
-- • As a CI health check: safe to include in test setup scripts.
--
-- Tables created / ensured
-- ────────────────────────
--   subscriptions        — one row per tenant: Stripe subscription state
--   credit_balance       — one row per tenant: current enrichment-credit total
--   credit_transactions  — append-only ledger of every credit change
--   usage_events         — per-call enrichment activity log
--
-- Views ensured
-- ─────────────
--   usage_events_summary — daily per-tenant per-type aggregation
--
-- RPCs ensured
-- ────────────
--   increment_credit_balance(text, integer) → integer
--   decrement_credit_balance(text, integer) → integer
--
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — Enums
-- ═══════════════════════════════════════════════════════════════════════════════

-- credit_tx_type ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.credit_tx_type AS ENUM (
    'purchase',
    'deduction',
    'grant',
    'refund',
    'expiry'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- usage_event_type ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.usage_event_type AS ENUM (
    'leadinfo_lookup',
    'ip_enrich',
    'weather_enrich',
    'intent_enrich',
    'crm_lookup',
    'reverse_geocode',
    'ga4_history',
    'company_lookup'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add any enum values that may be missing (safe on Postgres 12+) ──────────────
-- These are no-ops if the value already exists.

DO $$ BEGIN
  ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'reverse_geocode';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'ga4_history';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'company_lookup';
EXCEPTION WHEN others THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Core billing tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── subscriptions ─────────────────────────────────────────────────────────────
--
-- One row per tenant.  Synced from Stripe via webhooks.
-- Plan and status are authoritative for platform feature gating.
-- tenant_id is a TEXT slug matching tenant_settings.tenant_id — NOT a UUID FK.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text        NOT NULL,

  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,

  plan          text  NOT NULL DEFAULT 'starter'
                CHECK (plan IN ('starter', 'growth', 'pro')),
  status        text  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
  billing_cycle text  NOT NULL DEFAULT 'monthly'
                CHECK (billing_cycle IN ('monthly', 'annual')),

  current_period_start    timestamptz,
  current_period_end      timestamptz,
  trial_end               timestamptz,
  cancel_at_period_end    boolean     NOT NULL DEFAULT false,
  canceled_at             timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.subscriptions IS
  'One row per tenant. Stripe subscription state, synced via webhooks.';
COMMENT ON COLUMN public.subscriptions.tenant_id IS
  'Tenant slug (matches tenant_settings.tenant_id). TEXT, not UUID.';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS
  'Stripe Customer ID (cus_…). Null until first checkout completed.';

-- Indexes (all IF NOT EXISTS so re-runs are safe)
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx
  ON public.subscriptions (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_uidx
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ── credit_balance ────────────────────────────────────────────────────────────
--
-- Denormalized current balance — fast read on every enrichment call.
-- Updated atomically via RPC functions below.

CREATE TABLE IF NOT EXISTS public.credit_balance (
  tenant_id   text        PRIMARY KEY,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.credit_balance IS
  'Denormalized credit balance per tenant. Source: credit_transactions ledger (via RPC).';
COMMENT ON COLUMN public.credit_balance.balance IS
  'Current enrichment credit balance. Never negative (enforced by RPC).';

-- ── credit_transactions ───────────────────────────────────────────────────────
--
-- Append-only financial ledger.  Every balance change (purchase, deduction,
-- grant, refund, expiry) produces one row.

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text                    NOT NULL,

  type                  public.credit_tx_type   NOT NULL,
  amount                integer                 NOT NULL,       -- positive = added, negative = deducted
  balance_after         integer                 NOT NULL,       -- snapshot for audit trail

  stripe_event_id       text,                                   -- idempotency key (Stripe event ID)
  stripe_payment_intent text,
  bundle_id             text,                                   -- credit bundle ID, e.g. "credits_1000"
  feature               text,                                   -- which feature triggered the deduction
  description           text,

  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Per-tenant ledger (most recent first)
CREATE INDEX IF NOT EXISTS credit_txn_tenant_time_idx
  ON public.credit_transactions (tenant_id, created_at DESC);

-- Idempotency: unique on non-null stripe_event_id
CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_stripe_event_uidx
  ON public.credit_transactions (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

COMMENT ON TABLE  public.credit_transactions IS
  'Append-only enrichment credit ledger. One row per balance change.';
COMMENT ON COLUMN public.credit_transactions.stripe_event_id IS
  'Stripe event ID used for idempotency. UNIQUE prevents double-processing.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — usage_events
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.usage_events (
  id               uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text                       NOT NULL,

  event_type       public.usage_event_type    NOT NULL,
  quantity         integer                    NOT NULL DEFAULT 1  CHECK (quantity > 0),
  credits_cost     integer                    NOT NULL DEFAULT 0  CHECK (credits_cost >= 0),

  success          boolean                    NOT NULL DEFAULT true,
  cache_hit        boolean                    NOT NULL DEFAULT false,
  error_code       text,

  session_id       text,
  idempotency_key  text,

  metadata         jsonb                      NOT NULL DEFAULT '{}',

  created_at       timestamptz                NOT NULL DEFAULT now()
);

-- Idempotency: unique on non-null idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_uidx
  ON public.usage_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS usage_events_tenant_time_idx
  ON public.usage_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_tenant_type_time_idx
  ON public.usage_events (tenant_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS usage_events_tenant_cache_idx
  ON public.usage_events (tenant_id, cache_hit, created_at DESC);

COMMENT ON TABLE  public.usage_events IS
  'Granular enrichment activity log. One row per enrichment API call (success or failure).';
COMMENT ON COLUMN public.usage_events.tenant_id IS
  'Tenant slug (TEXT). Matches tenant_settings.tenant_id.';
COMMENT ON COLUMN public.usage_events.cache_hit IS
  'True when result was served from in-process ProviderCache. credits_cost = 0 for cache hits.';
COMMENT ON COLUMN public.usage_events.idempotency_key IS
  'Format: {event_type}:{tenant_id}:{session_id}. Prevents double-recording on retry.';

-- ── Add cache_hit column if usage_events already exists without it ─────────────
--
-- Handles the case where migration 40 ran (creating usage_events without
-- cache_hit) but migration 41 did not.

DO $$ BEGIN
  ALTER TABLE public.usage_events ADD COLUMN cache_hit boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — Triggers (updated_at)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Drop-and-recreate is safe for triggers (they have no data)
DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS credit_balance_updated_at ON public.credit_balance;
CREATE TRIGGER credit_balance_updated_at
  BEFORE UPDATE ON public.credit_balance
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — RPC functions
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── increment_credit_balance ──────────────────────────────────────────────────
--
-- Atomically insert or increment the credit_balance row for a tenant.
-- Uses UPSERT so the first call creates the row and subsequent calls add to it.
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
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_credit_balance: p_amount must be positive (got %)', p_amount;
  END IF;

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

-- ── decrement_credit_balance ──────────────────────────────────────────────────
--
-- Atomically deduct credits.  Raises 'insufficient_credits' if the balance
-- would go negative.  Uses FOR UPDATE to prevent race conditions.
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
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_credit_balance: p_amount must be positive (got %)', p_amount;
  END IF;

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


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — Summary view
-- ═══════════════════════════════════════════════════════════════════════════════

-- Recreate with full aggregation including cache_hit.
-- CREATE OR REPLACE is always safe for views.

CREATE OR REPLACE VIEW public.usage_events_summary AS
SELECT
  tenant_id,
  event_type,
  date_trunc('day', created_at)             AS event_date,
  count(*)                                   AS call_count,
  count(*) FILTER (WHERE success)            AS success_count,
  count(*) FILTER (WHERE NOT success)        AS failure_count,
  count(*) FILTER (WHERE cache_hit)          AS cache_hit_count,
  count(*) FILTER (WHERE NOT cache_hit)      AS fresh_call_count,
  sum(credits_cost)                          AS total_credits
FROM public.usage_events
GROUP BY tenant_id, event_type, date_trunc('day', created_at);

COMMENT ON VIEW public.usage_events_summary IS
  'Daily per-tenant per-event-type usage aggregation. Derived from usage_events.';


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7 — Row-level security
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- All billing tables are service-role only — no tenant-facing RLS policies.
-- The ENABLE statements are idempotent (safe to run if already enabled).

ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events        ENABLE ROW LEVEL SECURITY;
