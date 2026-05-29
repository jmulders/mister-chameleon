-- ─────────────────────────────────────────────────────────────────────────────
-- Enrichment Tracking — Migration 41
--
-- Extends the billing system with comprehensive enrichment usage tracking:
--
--   1. Adds missing usage_event_type enum values for all billable providers
--   2. Adds cache_hit column to usage_events for distinguishing live API calls
--      from provider-cache hits (cache hits cost 0 credits)
--
-- ─── Why this migration exists ────────────────────────────────────────────────
--
--   Migration 40 created the usage_events table and usage_event_type enum with
--   only the initial event types (leadinfo_lookup, ip_enrich, weather_enrich,
--   intent_enrich, crm_lookup).  As the enrichment pipeline adds more providers
--   (Reverse Geocode, GA4 History, OpenKvK / Clearbit company lookup), we need
--   corresponding enum values.
--
--   The cache_hit column is critical for transparent billing: when an enricher
--   serves its result from an in-process ProviderCache (no external API call),
--   no credits are deducted and cache_hit=true records why credits_cost=0.
--
-- ─── Enum extension ───────────────────────────────────────────────────────────
--
--   ALTER TYPE ... ADD VALUE IF NOT EXISTS is safe to re-run (idempotent).
--   Values, once added to a Postgres enum, cannot be removed — that is fine:
--   the TypeScript UsageEventType union is the single source of truth for which
--   values are actively used.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend usage_event_type enum ──────────────────────────────────────────

ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'reverse_geocode';
ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'ga4_history';
ALTER TYPE public.usage_event_type ADD VALUE IF NOT EXISTS 'company_lookup';

-- ── 2. Add cache_hit column to usage_events ───────────────────────────────────
--
-- true  → result served from an in-process ProviderCache; no external API call.
--         credits_cost will be 0; the event is tracked for analytics only.
-- false → live external API call was made (default).
--
-- Backfill: all prior rows had no cache tracking, so we assume false (live call).

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.usage_events.cache_hit IS
  'True when the enrichment result was served from ProviderCache (no external API call). credits_cost will be 0 for cache hits.';

-- ── 3. Add missing index for cache analytics ──────────────────────────────────

CREATE INDEX IF NOT EXISTS usage_events_tenant_cache_idx
  ON public.usage_events (tenant_id, cache_hit, created_at DESC);

-- ── 4. Update the summary view to include cache_hit aggregation ───────────────
--
-- DROP first: CREATE OR REPLACE VIEW cannot add columns between existing ones
-- or rename them (PostgreSQL 42P16).  The view holds no data so dropping is safe.

DROP VIEW IF EXISTS public.usage_events_summary;

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

-- ── 5. Ensure subscriptions table exists (guard for migration 40 not yet applied)
--
-- Migration 40 should already exist, but if something went wrong this provides
-- a minimal fallback so the billing page doesn't throw 42P01 on subscriptions.
-- The IF NOT EXISTS clauses are fully idempotent.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text        NOT NULL,
  stripe_customer_id      text,
  stripe_subscription_id  text        UNIQUE,
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

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_tenant_id_uidx
  ON public.subscriptions (tenant_id);

CREATE TABLE IF NOT EXISTS public.credit_balance (
  tenant_id   text        PRIMARY KEY,
  balance     integer     NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                    uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text                    NOT NULL,
  type                  public.credit_tx_type   NOT NULL,
  amount                integer                 NOT NULL,
  balance_after         integer                 NOT NULL,
  stripe_event_id       text        UNIQUE,
  stripe_payment_intent text,
  bundle_id             text,
  feature               text,
  description           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_txn_tenant_time_idx
  ON public.credit_transactions (tenant_id, created_at DESC);

ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
