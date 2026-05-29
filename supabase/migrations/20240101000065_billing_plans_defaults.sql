-- migration 065 — canonical billing schema (fractional) — defensive rewrite
--
-- Creates / ensures billing tables with NUMERIC precision so that:
--   • Prices like €0.001 per call are representable (NUMERIC(12,6))
--   • Credit counts like 0.25 credits are representable (NUMERIC(12,3))
--   • Wallet balances like €22.50 are representable (NUMERIC(14,4))
--
-- Tables created / ensured here:
--   billing_plans       — admin-editable subscription plan catalog
--   billing_defaults    — single-row platform-wide billing config
--   enrichment_pricing  — canonical per-call enrichment pricing (replaces credit_pricing)
--
-- Wallet tables (tenant_wallets, wallet_ledger, usage_events) already exist from
-- migration 043 / 051.  This migration adds fractional columns alongside the
-- legacy *_cents INT columns so that sub-cent amounts can be stored without
-- breaking the existing debit_wallet RPC.
--
-- All tables: service-role only via RLS.
--
-- ── DEFENSIVE REWRITE (2025-04) ───────────────────────────────────────────────
--
-- Original migration used DROP TABLE + bare CREATE TABLE which caused the
-- entire transaction to roll back if any later ALTER TABLE statement failed
-- (e.g. when tenant_wallets / wallet_ledger / usage_events didn't yet exist).
-- Since billing_defaults is defined mid-migration, a rollback meant the table
-- was never committed — producing the "Migration 065 not yet applied" warning.
--
-- Rewrite strategy:
--   • billing_plans / billing_defaults → CREATE TABLE IF NOT EXISTS (idempotent)
--   • enrichment_pricing → still DROP + CREATE (replaces the old 043 schema
--     that has a different column set; DROP CASCADE is safe — no FK dependents)
--   • ALTER TABLE blocks → wrapped in DO $$ … $$ with table-existence guards
--   • UPDATE backfills  → wrapped in DO $$ … $$ with column-existence guards

-- ── billing_plans ─────────────────────────────────────────────────────────────
--
-- Admin-editable subscription plan catalog.
-- Prices stored in euros (NOT cents) with 6-decimal precision.
-- Example: starter = 149.000000 EUR/month.
--
-- Using CREATE TABLE IF NOT EXISTS (no DROP) because:
--   • No prior migration defines billing_plans.
--   • If this migration previously failed and is being re-applied, DROP would
--     wipe any data written between the first attempt and this retry.

CREATE TABLE IF NOT EXISTS billing_plans (
  plan_id                   TEXT              PRIMARY KEY,
  label                     TEXT              NOT NULL,
  monthly_price             NUMERIC(12, 6)    NOT NULL DEFAULT 0
                                              CHECK (monthly_price >= 0),
  yearly_price              NUMERIC(12, 6)    NOT NULL DEFAULT 0
                                              CHECK (yearly_price >= 0),
  annual_monthly_price      NUMERIC(12, 6)    NOT NULL DEFAULT 0
                                              CHECK (annual_monthly_price >= 0),
  included_credits          NUMERIC(12, 3)    NOT NULL DEFAULT 0
                                              CHECK (included_credits >= 0),
  overage_price_per_credit  NUMERIC(12, 6)    NOT NULL DEFAULT 0.030000
                                              CHECK (overage_price_per_credit >= 0),
  features                  JSONB             NOT NULL DEFAULT '{}',
  limits                    JSONB             NOT NULL DEFAULT '{}',
  stripe_monthly_price_id   TEXT,
  stripe_yearly_price_id    TEXT,
  active                    BOOLEAN           NOT NULL DEFAULT true,
  sort_order                INT               NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- Add any columns that may be absent if the table was created by an older
-- version of this migration (fully idempotent).
DO $$
BEGIN
  -- yearly_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'yearly_price'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN yearly_price NUMERIC(12, 6) NOT NULL DEFAULT 0
      CHECK (yearly_price >= 0);
  END IF;

  -- annual_monthly_price
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'annual_monthly_price'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN annual_monthly_price NUMERIC(12, 6) NOT NULL DEFAULT 0
      CHECK (annual_monthly_price >= 0);
  END IF;

  -- included_credits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'included_credits'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN included_credits NUMERIC(12, 3) NOT NULL DEFAULT 0
      CHECK (included_credits >= 0);
  END IF;

  -- overage_price_per_credit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'overage_price_per_credit'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN overage_price_per_credit NUMERIC(12, 6) NOT NULL DEFAULT 0.030000
      CHECK (overage_price_per_credit >= 0);
  END IF;

  -- features
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'features'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN features JSONB NOT NULL DEFAULT '{}';
  END IF;

  -- limits
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'limits'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN limits JSONB NOT NULL DEFAULT '{}';
  END IF;

  -- stripe_monthly_price_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'stripe_monthly_price_id'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN stripe_monthly_price_id TEXT;
  END IF;

  -- stripe_yearly_price_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'stripe_yearly_price_id'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN stripe_yearly_price_id TEXT;
  END IF;

  -- active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'active'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
  END IF;

  -- sort_order
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE billing_plans ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

COMMENT ON TABLE billing_plans IS
  'Admin-editable subscription plan catalog. '
  'All prices in EUR (not cents). '
  'Changes to monthly_price / stripe_*_price_id require matching Stripe dashboard updates.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'monthly_price'
  ) THEN
    COMMENT ON COLUMN billing_plans.monthly_price IS
      'Monthly subscription price in EUR (e.g. 149.000000 = €149.00).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_plans'
      AND column_name = 'overage_price_per_credit'
  ) THEN
    COMMENT ON COLUMN billing_plans.overage_price_per_credit IS
      'EUR charged per credit consumed beyond included_credits (e.g. 0.030000 = €0.03/credit).';
  END IF;
END $$;

-- Seed: starter / growth / pro
INSERT INTO billing_plans (
  plan_id, label, monthly_price, yearly_price, annual_monthly_price,
  included_credits, overage_price_per_credit,
  features, limits, active, sort_order
) VALUES
  (
    'starter', 'Starter',
    149.000000, 1488.000000, 124.000000,
    500.000, 0.030000,
    '{"adaptiveHomepage":true,"campaignLandingPages":false,"abExperiments":false,"analyticsDashboard":false,"aiDecisioning":false,"enrichmentProvider":true,"prioritySupport":false,"customIntegrations":false}',
    '{"maxRules":20,"maxPages":5,"maxExperiments":0}',
    true, 1
  ),
  (
    'growth', 'Growth',
    349.000000, 3348.000000, 279.000000,
    2000.000, 0.020000,
    '{"adaptiveHomepage":true,"campaignLandingPages":true,"abExperiments":true,"analyticsDashboard":true,"aiDecisioning":false,"enrichmentProvider":true,"prioritySupport":false,"customIntegrations":false}',
    '{"maxRules":100,"maxPages":25,"maxExperiments":5}',
    true, 2
  ),
  (
    'pro', 'Pro',
    749.000000, 7188.000000, 599.000000,
    10000.000, 0.010000,
    '{"adaptiveHomepage":true,"campaignLandingPages":true,"abExperiments":true,"analyticsDashboard":true,"aiDecisioning":true,"enrichmentProvider":true,"prioritySupport":true,"customIntegrations":true}',
    '{"maxRules":500,"maxPages":100,"maxExperiments":20}',
    true, 3
  )
ON CONFLICT (plan_id) DO NOTHING;

-- ── billing_defaults ──────────────────────────────────────────────────────────
--
-- Single-row platform-wide billing config, identified by key = 'default'.
-- All threshold/amount fields stored in EUR with 3-decimal precision.
-- Example: low_balance_threshold = 3.000 means "notify when balance drops below €3.00".
--
-- ─── id vs key ────────────────────────────────────────────────────────────────
--
--   id  — UUID primary key, auto-generated by gen_random_uuid().
--          NEVER set id to a string literal such as 'default'.
--   key — text column, stable human anchor for the singleton row.
--          Use key = 'default' in all queries and upserts.
--
-- This split exists because some deployments had billing_defaults created with
-- id UUID (not TEXT), causing "invalid input syntax for type uuid: 'default'"
-- when migration 065 tried to insert id = 'default'.  Using a separate `key`
-- column makes the seed INSERT type-safe regardless of the id column's type.
--
-- Using CREATE TABLE IF NOT EXISTS (no DROP) — the table may already exist
-- from a previous partial migration run.  All columns that might be absent on
-- a pre-existing table are added individually via ADD COLUMN IF NOT EXISTS
-- so that COMMENT ON COLUMN and the seed INSERT never reference a missing column.

CREATE TABLE IF NOT EXISTS billing_defaults (
  id                        UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  key                       TEXT              NOT NULL DEFAULT 'default',
  currency                  TEXT              NOT NULL DEFAULT 'eur',
  low_balance_threshold     NUMERIC(12, 3)    NOT NULL DEFAULT 3.000
                                              CHECK (low_balance_threshold >= 0),
  auto_reload_trigger       NUMERIC(12, 3)    NOT NULL DEFAULT 2.000
                                              CHECK (auto_reload_trigger >= 0),
  auto_reload_amount        NUMERIC(12, 3)    NOT NULL DEFAULT 22.000
                                              CHECK (auto_reload_amount >= 0),
  monthly_auto_reload_cap   NUMERIC(12, 3)
                                              CHECK (monthly_auto_reload_cap IS NULL OR monthly_auto_reload_cap >= 0),
  created_at                TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- When billing_defaults was previously created with id UUID but without a
-- DEFAULT, ensure gen_random_uuid() is set so that INSERT without an explicit
-- id value works correctly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE billing_defaults ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Add any columns that may be absent on a pre-existing billing_defaults table.
-- This covers every column defined above so that COMMENT ON COLUMN and the
-- seed INSERT below are always safe regardless of when the table was created.
DO $$
BEGIN
  -- key — stable string anchor for the singleton row (added in this migration)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'key'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN key TEXT NOT NULL DEFAULT 'default';
  END IF;

  -- currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'currency'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN currency TEXT NOT NULL DEFAULT 'eur';
  END IF;

  -- low_balance_threshold
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'low_balance_threshold'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN low_balance_threshold NUMERIC(12, 3) NOT NULL DEFAULT 3.000
      CHECK (low_balance_threshold >= 0);
  END IF;

  -- auto_reload_trigger
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'auto_reload_trigger'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN auto_reload_trigger NUMERIC(12, 3) NOT NULL DEFAULT 2.000
      CHECK (auto_reload_trigger >= 0);
  END IF;

  -- auto_reload_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'auto_reload_amount'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN auto_reload_amount NUMERIC(12, 3) NOT NULL DEFAULT 22.000
      CHECK (auto_reload_amount >= 0);
  END IF;

  -- monthly_auto_reload_cap (nullable — no NOT NULL constraint)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'monthly_auto_reload_cap'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN monthly_auto_reload_cap NUMERIC(12, 3)
      CHECK (monthly_auto_reload_cap IS NULL OR monthly_auto_reload_cap >= 0);
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE billing_defaults ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Unique index on key so that ON CONFLICT (key) works in the seed INSERT below.
-- Safe to run even if the index already exists (IF NOT EXISTS).
CREATE UNIQUE INDEX IF NOT EXISTS billing_defaults_key_uniq
  ON billing_defaults (key);

COMMENT ON TABLE billing_defaults IS
  'Platform-wide billing defaults. Single row, key = ''default''. '
  'id is a UUID generated automatically — never set to a string literal. '
  'All values in EUR (not cents). '
  'New tenant wallets inherit these values at creation time.';

-- COMMENT ON COLUMN is wrapped in existence checks so that a pre-existing
-- billing_defaults table that is missing a column does not cause 42703.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'low_balance_threshold'
  ) THEN
    COMMENT ON COLUMN billing_defaults.low_balance_threshold IS
      'Wallet balance below which a low-balance notification fires (EUR).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'auto_reload_trigger'
  ) THEN
    COMMENT ON COLUMN billing_defaults.auto_reload_trigger IS
      'Wallet balance that triggers automatic top-up (EUR).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'auto_reload_amount'
  ) THEN
    COMMENT ON COLUMN billing_defaults.auto_reload_amount IS
      'Default amount loaded per auto-reload event (EUR).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'billing_defaults'
      AND column_name = 'monthly_auto_reload_cap'
  ) THEN
    COMMENT ON COLUMN billing_defaults.monthly_auto_reload_cap IS
      'Max total auto-reload spend per tenant per month (EUR). NULL = unlimited.';
  END IF;
END $$;

-- Seed the singleton row keyed on `key`, not `id`.
-- id is auto-generated as UUID; key is the stable string anchor.
-- ON CONFLICT (key) requires the unique index created above.
INSERT INTO billing_defaults (key, currency, low_balance_threshold, auto_reload_trigger, auto_reload_amount)
VALUES ('default', 'eur', 3.000, 2.000, 22.000)
ON CONFLICT (key) DO NOTHING;

-- ── enrichment_pricing ────────────────────────────────────────────────────────
--
-- Canonical per-enrichment-type pricing table.
-- Replaces the old `credit_pricing` table (which stored prices in INT cents).
--
-- unit_price    — EUR charged per successful live API call (e.g. 0.030000 = €0.03)
-- credit_cost   — credits deducted per call (e.g. 3.000 or fractional 0.250)
-- internal_cost — actual provider cost in EUR for margin analysis (nullable)
--
-- The enrichment tracker (billing/enrichment-tracker.ts) reads unit_price from
-- this table.
--
-- NOTE: DROP is required because migration 043 already created enrichment_pricing
-- with the old schema (enrichment_type TEXT PRIMARY KEY, unit_price_cents INTEGER).
-- Without the DROP, CREATE TABLE IF NOT EXISTS silently does nothing and all
-- reads of unit_price return undefined → NaN → null → 23502 errors.
-- No FK relationships point at enrichment_pricing (confirmed), so CASCADE is safe.

DROP TABLE IF EXISTS enrichment_pricing CASCADE;

CREATE TABLE enrichment_pricing (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  enrichment_type TEXT              NOT NULL UNIQUE,
  label           TEXT              NOT NULL,
  category        TEXT              NOT NULL DEFAULT 'recognition',
  unit_price      NUMERIC(12, 6)    NOT NULL DEFAULT 0
                                    CHECK (unit_price >= 0),
  credit_cost     NUMERIC(12, 3)    NOT NULL DEFAULT 0
                                    CHECK (credit_cost >= 0),
  internal_cost   NUMERIC(12, 6)
                                    CHECK (internal_cost IS NULL OR internal_cost >= 0),
  billing_unit    TEXT              NOT NULL DEFAULT 'per_call',
  description     TEXT,
  billable        BOOLEAN           NOT NULL DEFAULT true,
  active          BOOLEAN           NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);

COMMENT ON TABLE enrichment_pricing IS
  'Per-enrichment-type pricing. Authoritative source for the enrichment tracker. '
  'unit_price and internal_cost are in EUR (not cents). '
  'Replaces the legacy credit_pricing table.';

COMMENT ON COLUMN enrichment_pricing.unit_price IS
  'EUR charged per successful live API call (e.g. 0.030000 = €0.03, 0.001000 = €0.001).';

COMMENT ON COLUMN enrichment_pricing.credit_cost IS
  'Credits deducted per successful call. Supports fractions like 0.250 or 3.000.';

COMMENT ON COLUMN enrichment_pricing.internal_cost IS
  'Actual provider cost per call in EUR for margin analysis. NULL when unknown.';

-- Migrate data from credit_pricing if it exists (legacy → new table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credit_pricing'
  ) THEN
    INSERT INTO enrichment_pricing (
      enrichment_type, label, category,
      unit_price, credit_cost, internal_cost,
      billing_unit, description, billable, active
    )
    SELECT
      feature_key,
      INITCAP(REPLACE(feature_key, '_', ' ')),
      category::TEXT,
      ROUND(customer_price_cents::NUMERIC / 100.0, 6),
      ROUND(customer_price_cents::NUMERIC / 100.0, 3),
      CASE
        WHEN internal_cost_cents IS NOT NULL
        THEN ROUND(internal_cost_cents::NUMERIC / 100.0, 6)
        ELSE NULL
      END,
      COALESCE(billing_unit::TEXT, 'per_call'),
      description,
      true,
      COALESCE(active, true)
    FROM credit_pricing
    ON CONFLICT (enrichment_type) DO NOTHING;
  END IF;
END $$;

-- Seed canonical enrichment types (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO enrichment_pricing (
  enrichment_type, label, category,
  unit_price, credit_cost, internal_cost,
  billing_unit, description, billable, active
) VALUES
  -- Recognition (3 credits / call = €0.03)
  ('ip_enrich',        'IP Enrichment',        'recognition', 0.030000, 3.000, 0.010000, 'per_call',
   'IPinfo Lite — network ASN, org name, geo coordinates, domain', true, true),
  ('reverse_geocode',  'Reverse Geocode',       'recognition', 0.030000, 3.000, 0.010000, 'per_call',
   'Latitude / longitude → structured address (LocationIQ / BigDataCloud)', true, true),
  ('company_lookup',   'Company Lookup',        'recognition', 0.030000, 3.000, 0.020000, 'per_call',
   'Reverse-IP firmographics — company name, size, industry (OpenKvK / Clearbit)', true, true),
  ('leadinfo_lookup',  'Leadinfo Lookup',       'recognition', 0.030000, 3.000, 0.030000, 'per_call',
   'B2B company identification via Leadinfo client-side identify flow', true, true),
  -- Adaptation (3 credits / call)
  ('intent_enrich',    'Intent Enrichment',     'adaptation',  0.030000, 3.000, 0.010000, 'per_call',
   'Intent signals and behavioural data enrichment', true, true),
  ('weather_enrich',   'Weather Enrichment',    'adaptation',  0.030000, 3.000, 0.005000, 'per_call',
   'Real-time weather data for visitor location context', true, true),
  -- Brainpower (higher cost — external quota-constrained APIs)
  ('ga4_history',      'GA4 History',           'brainpower',  0.060000, 6.000, 0.020000, 'per_call',
   'Google Analytics 4 visitor history lookup', true, true),
  ('crm_lookup',       'CRM Lookup',            'brainpower',  0.060000, 6.000, 0.030000, 'per_call',
   'HubSpot / Salesforce CRM contact and company lookup', true, true)
ON CONFLICT (enrichment_type) DO NOTHING;

-- ── Fractional columns on wallet tables ───────────────────────────────────────
--
-- Add NUMERIC shadow columns alongside the existing INT *_cents columns.
-- The original integer columns remain so the debit_wallet RPC continues working.
--
-- All three blocks are wrapped in DO $$ … $$ so that a missing table (possible
-- when applying 065 after 066–070 have already run on a partially-migrated DB)
-- does not abort the transaction and roll back billing_defaults.

-- tenant_wallets: add balance (EUR) alongside balance_cents (INT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_wallets'
  ) THEN
    ALTER TABLE tenant_wallets
      ADD COLUMN IF NOT EXISTS balance NUMERIC(14, 4);

    -- Back-fill balance from balance_cents for existing rows
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_wallets'
        AND column_name = 'balance_cents'
    ) THEN
      UPDATE tenant_wallets
      SET balance = ROUND(balance_cents::NUMERIC / 100.0, 4)
      WHERE balance IS NULL;
    END IF;
  END IF;
END $$;

-- wallet_ledger: add amount (EUR) alongside amount_cents (INT)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_ledger'
  ) THEN
    ALTER TABLE wallet_ledger
      ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 4);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'wallet_ledger'
        AND column_name = 'amount_cents'
    ) THEN
      UPDATE wallet_ledger
      SET amount = ROUND(amount_cents::NUMERIC / 100.0, 4)
      WHERE amount IS NULL;
    END IF;
  END IF;
END $$;

-- usage_events: add price (EUR) and credits_used (fractional) columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usage_events'
  ) THEN
    ALTER TABLE usage_events
      ADD COLUMN IF NOT EXISTS price        NUMERIC(12, 6),
      ADD COLUMN IF NOT EXISTS credits_used NUMERIC(12, 3);

    -- Back-fill from credits_cost only when that column exists and price is null
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'usage_events'
        AND column_name = 'credits_cost'
    ) THEN
      UPDATE usage_events
      SET
        price        = ROUND(credits_cost::NUMERIC / 100.0, 6),
        credits_used = ROUND(credits_cost::NUMERIC / 100.0, 3)
      WHERE price IS NULL;
    END IF;
  END IF;
END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS billing_plans_active_sort
  ON billing_plans (active, sort_order);

CREATE INDEX IF NOT EXISTS enrichment_pricing_active
  ON enrichment_pricing (active, category);

CREATE INDEX IF NOT EXISTS enrichment_pricing_type
  ON enrichment_pricing (enrichment_type);

-- ── Row-level security (service role only) ────────────────────────────────────

ALTER TABLE billing_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_defaults   ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_pricing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_plans'
      AND policyname = 'service_role_all_billing_plans'
  ) THEN
    CREATE POLICY "service_role_all_billing_plans"
      ON billing_plans FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'billing_defaults'
      AND policyname = 'service_role_all_billing_defaults'
  ) THEN
    CREATE POLICY "service_role_all_billing_defaults"
      ON billing_defaults FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'enrichment_pricing'
      AND policyname = 'service_role_all_enrichment_pricing'
  ) THEN
    CREATE POLICY "service_role_all_enrichment_pricing"
      ON enrichment_pricing FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
