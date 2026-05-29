-- ============================================================================
-- Migration 050: Billing Schema Audit & Type-Mismatch Repair
--
-- Purpose
-- ───────
-- Migration 35 created credit_balance, credit_transactions, and subscriptions
-- with tenant_id UUID (referencing a now-removed `tenants` table).  Migration
-- 40 was intended to drop and recreate them with tenant_id TEXT, but if that
-- migration failed (e.g. because of the old `tenants` reference in migration 35
-- causing a dependency error during the DROP, or a Postgres version mismatch),
-- the old UUID tables may still be present.
--
-- When TypeScript code passes a slug string (e.g. "acme") to a UUID column,
-- Postgres returns error code 22P02 ("invalid input syntax for type uuid").
-- The billing page shows this as an "unexpected database error" — misleading.
--
-- This migration:
--   1. Inspects the actual column type of tenant_id in each affected table.
--   2. If any table still carries UUID tenant_id, drops and recreates it
--      correctly as TEXT (data loss is acceptable — these tables would have
--      zero rows because no query could write to them with a TEXT slug anyway).
--   3. Patches any remaining missing columns (belt-and-suspenders over 049).
--   4. Re-ensures enums, indexes, triggers, and RLS are in place.
--   5. Is fully idempotent — safe to run on any database in any migration state.
--
-- Error codes this migration resolves at query time
-- ─────────────────────────────────────────────────
--   22P02  invalid input syntax for type uuid  (text slug passed to UUID column)
--   42P01  relation does not exist             (table missing)
--   42703  column does not exist               (column missing / partial migration)
--   PGRST200  schema cache stale              (PostgREST needs schema reload)
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — Enums (idempotent)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE public.credit_tx_type AS ENUM (
    'purchase', 'deduction', 'grant', 'refund', 'expiry'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.usage_event_type AS ENUM (
    'leadinfo_lookup', 'ip_enrich', 'weather_enrich', 'intent_enrich',
    'crm_lookup', 'reverse_geocode', 'ga4_history', 'company_lookup'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend the enum with newer values if migration 41/47 added them partially.
DO $$ BEGIN ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'reverse_geocode'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'ga4_history';     EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'company_lookup';  EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_status AS ENUM ('active', 'suspended', 'frozen');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_entry_type AS ENUM (
    'top_up_manual', 'top_up_auto_reload', 'top_up_refund',
    'enrichment_debit', 'manual_adjustment', 'failed_reload'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_top_up';       EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_debit';         EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_auto_reload';   EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.wallet_entry_type ADD VALUE IF NOT EXISTS 'sim_failed_reload'; EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reload_attempt_status AS ENUM (
    'pending', 'processing', 'succeeded', 'failed', 'action_required', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_test_mode AS ENUM ('live', 'test_simulated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — Detect and repair UUID tenant_id type mismatches
--
-- Each block inspects information_schema.columns for the actual data_type.
-- If it is 'uuid', the table is dropped (zero recoverable data exists in it
-- because every TEXT-slug write would have failed with 22P02) and recreated
-- correctly with TEXT tenant_id.
-- ════════════════════════════════════════════════════════════════════════════

-- ── credit_balance ────────────────────────────────────────────────────────────

DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_balance' AND column_name = 'tenant_id';

  IF v_type = 'uuid' THEN
    RAISE NOTICE 'credit_balance: tenant_id is UUID — dropping and recreating with TEXT';
    DROP TABLE IF EXISTS public.credit_balance CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_balance (
  tenant_id   text        PRIMARY KEY,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── credit_transactions ───────────────────────────────────────────────────────

DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'credit_transactions' AND column_name = 'tenant_id';

  IF v_type = 'uuid' THEN
    RAISE NOTICE 'credit_transactions: tenant_id is UUID — dropping and recreating with TEXT';
    DROP TABLE IF EXISTS public.credit_transactions CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                    uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text                   NOT NULL,
  type                  public.credit_tx_type  NOT NULL,
  amount                integer                NOT NULL,
  balance_after         integer                NOT NULL,
  stripe_event_id       text,
  stripe_payment_intent text,
  bundle_id             text,
  feature               text,
  description           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX       IF NOT EXISTS credit_txn_tenant_time_idx  ON public.credit_transactions (tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_stripe_event_uidx ON public.credit_transactions (stripe_event_id) WHERE stripe_event_id IS NOT NULL;

-- ── subscriptions ─────────────────────────────────────────────────────────────

DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'tenant_id';

  IF v_type = 'uuid' THEN
    RAISE NOTICE 'subscriptions: tenant_id is UUID — dropping and recreating with TEXT';
    DROP TABLE IF EXISTS public.subscriptions CASCADE;
  END IF;
END $$;

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
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx  ON public.subscriptions (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_sub_uidx ON public.subscriptions (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX       IF NOT EXISTS subscriptions_stripe_customer_idx ON public.subscriptions (stripe_customer_id)      WHERE stripe_customer_id IS NOT NULL;

-- ── usage_events ──────────────────────────────────────────────────────────────
--
-- Migration 39 created usage_events with UUID tenant_id referencing tenants(id)
-- which doesn't exist — so migration 39 always failed and usage_events may not
-- exist at all.  Migration 40 dropped (no-op) and recreated with TEXT.
-- This block handles both: missing table and UUID-type table.

DO $$
DECLARE v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'usage_events' AND column_name = 'tenant_id';

  IF v_type = 'uuid' THEN
    RAISE NOTICE 'usage_events: tenant_id is UUID — dropping and recreating with TEXT';
    DROP TABLE IF EXISTS public.usage_events CASCADE;
  END IF;
END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_uidx     ON public.usage_events (idempotency_key)                  WHERE idempotency_key IS NOT NULL;
CREATE INDEX       IF NOT EXISTS usage_events_tenant_time_idx        ON public.usage_events (tenant_id, created_at DESC);
CREATE INDEX       IF NOT EXISTS usage_events_tenant_type_time_idx   ON public.usage_events (tenant_id, event_type, created_at DESC);


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — Patch missing columns on tables that exist but may be incomplete
--
-- All of these are idempotent via EXCEPTION WHEN duplicate_column THEN NULL.
-- ════════════════════════════════════════════════════════════════════════════

-- ── usage_events missing columns ──────────────────────────────────────────────

DO $$ BEGIN ALTER TABLE public.usage_events ADD COLUMN cache_hit boolean NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.usage_events ADD COLUMN session_id text;       EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.usage_events ADD COLUMN idempotency_key text;  EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.usage_events ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- ── subscriptions missing columns ─────────────────────────────────────────────

DO $$ BEGIN ALTER TABLE public.subscriptions ADD COLUMN stripe_price_id text;    EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.subscriptions ADD COLUMN trial_end timestamptz;   EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.subscriptions ADD COLUMN stripe_customer_id text; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- ── credit_transactions missing columns ───────────────────────────────────────

DO $$ BEGIN ALTER TABLE public.credit_transactions ADD COLUMN stripe_payment_intent text; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.credit_transactions ADD COLUMN bundle_id text;             EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.credit_transactions ADD COLUMN feature text;               EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.credit_transactions ADD COLUMN description text;           EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- ── tenant_wallets missing columns ────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public.tenant_wallets ADD COLUMN test_mode public.wallet_test_mode NOT NULL DEFAULT 'live';
EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL;
END $$;
DO $$ BEGIN ALTER TABLE public.tenant_wallets ADD COLUMN stripe_test_customer_id       text DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.tenant_wallets ADD COLUMN stripe_test_payment_method_id text DEFAULT NULL; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- ── enrichment_usage missing columns ─────────────────────────────────────────

DO $$ BEGIN ALTER TABLE public.enrichment_usage ADD COLUMN wallet_blocked   boolean NOT NULL DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.enrichment_usage ADD COLUMN billable          boolean NOT NULL DEFAULT true;  EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.enrichment_usage ADD COLUMN idempotency_key   text UNIQUE; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.enrichment_usage ADD COLUMN error_code         text;       EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.enrichment_usage ADD COLUMN request_id         text;       EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.enrichment_usage ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; WHEN undefined_table THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — Ensure wallet_webhook_events exists (from migration 047)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.wallet_webhook_events (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  text         NOT NULL,
  event_type       text         NOT NULL,
  livemode         boolean      NOT NULL DEFAULT true,
  tenant_id        text,
  handled          boolean      NOT NULL DEFAULT false,
  action           text,
  error            text,
  received_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_webhook_events_stripe_event_uidx ON public.wallet_webhook_events (stripe_event_id);
CREATE INDEX       IF NOT EXISTS wallet_webhook_events_tenant_received_idx ON public.wallet_webhook_events (tenant_id, received_at DESC) WHERE tenant_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — Updated-at trigger for subscriptions and credit_balance
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS subscriptions_updated_at  ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS credit_balance_updated_at ON public.credit_balance;
CREATE TRIGGER credit_balance_updated_at
  BEFORE UPDATE ON public.credit_balance
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — Recreate increment/decrement RPCs (idempotent via OR REPLACE)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.increment_credit_balance(
  p_tenant_id text,
  p_amount    integer
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_new integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_credit_balance: p_amount must be positive (got %)', p_amount;
  END IF;
  INSERT INTO public.credit_balance (tenant_id, balance)
  VALUES (p_tenant_id, p_amount)
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance = credit_balance.balance + EXCLUDED.balance, updated_at = now()
  RETURNING balance INTO v_new;
  RETURN v_new;
END; $$;

CREATE OR REPLACE FUNCTION public.decrement_credit_balance(
  p_tenant_id text,
  p_amount    integer
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_current integer; v_new integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'decrement_credit_balance: p_amount must be positive (got %)', p_amount;
  END IF;
  SELECT balance INTO v_current FROM public.credit_balance
  WHERE tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_credits: no balance row for tenant %', p_tenant_id;
  END IF;
  v_new := v_current - p_amount;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient_credits: balance % < requested %', v_current, p_amount;
  END IF;
  UPDATE public.credit_balance SET balance = v_new, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  RETURN v_new;
END; $$;


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 7 — Summary views
-- ════════════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 8 — RLS (idempotent — ALTER TABLE IF EXISTS never errors)
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_balance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.credit_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.usage_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenant_wallets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_ledger          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enrichment_usage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enrichment_pricing     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_reload_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallet_webhook_events  ENABLE ROW LEVEL SECURITY;

-- Migration 050 complete: billing schema audit — repairs UUID-vs-text type mismatches and patches all missing columns.
