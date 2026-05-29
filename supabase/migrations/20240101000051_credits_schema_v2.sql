-- ============================================================================
-- Migration 051 — Chameleon Credits Schema v2
-- ============================================================================
--
-- This migration aligns the billing schema with the Chameleon Credits model:
--
--   1. tenant_wallets    — add monthly_credit_cap_cents + fallback_mode
--   2. wallet_ledger     — add category + simulated columns
--   3. usage_events      — add category + feature_key + internal_cost_cents + simulated
--   4. credit_pricing    — new table: flexible customer vs internal pricing
--   5. usage_summary     — new VIEW: aggregation by tenant × period × category × feature
--   6. debit_wallet RPC  — updated to accept p_category (nullable, written to ledger)
--   7. credit_wallet RPC — updated to accept p_category (nullable, written to ledger)
--
-- Idempotent: safe to run on any database state.
-- ============================================================================

-- ── 1. tenant_wallets: monthly cap + fallback mode ────────────────────────────

ALTER TABLE tenant_wallets
  ADD COLUMN IF NOT EXISTS monthly_credit_cap_cents  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fallback_mode             TEXT    NOT NULL DEFAULT 'smart_lite';

-- Constraint: only known fallback modes allowed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tenant_wallets'
      AND constraint_name = 'tenant_wallets_fallback_mode_check'
      AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE tenant_wallets
      ADD CONSTRAINT tenant_wallets_fallback_mode_check
      CHECK (fallback_mode IN ('full_adaptive', 'smart_lite', 'default'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index: fast cap-exceeded checks by tenant
CREATE INDEX IF NOT EXISTS idx_tenant_wallets_monthly_cap
  ON tenant_wallets (tenant_id)
  WHERE monthly_credit_cap_cents > 0;

COMMENT ON COLUMN tenant_wallets.monthly_credit_cap_cents IS
  'Maximum credits (= euro cents) the tenant may spend per calendar month. 0 = unlimited.';
COMMENT ON COLUMN tenant_wallets.fallback_mode IS
  'Mode engaged when monthly_credit_cap_cents is reached: full_adaptive | smart_lite | default';

-- ── 2. wallet_ledger: category + simulated ────────────────────────────────────

ALTER TABLE wallet_ledger
  ADD COLUMN IF NOT EXISTS category  TEXT,
  ADD COLUMN IF NOT EXISTS simulated BOOLEAN NOT NULL DEFAULT FALSE;

-- Constraint: only known categories (NULL = top-up / admin / not categorised)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'wallet_ledger'
      AND constraint_name = 'wallet_ledger_category_check'
      AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE wallet_ledger
      ADD CONSTRAINT wallet_ledger_category_check
      CHECK (category IS NULL OR category IN (
        'recognition', 'adaptation', 'brainpower',
        'topup', 'refund', 'adjustment'
      ));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for category-based spend queries
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_category
  ON wallet_ledger (tenant_id, category, created_at DESC)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_simulated
  ON wallet_ledger (tenant_id, simulated, created_at DESC);

COMMENT ON COLUMN wallet_ledger.category IS
  'Credit category for this ledger entry: recognition | adaptation | brainpower | topup | refund | adjustment | NULL';
COMMENT ON COLUMN wallet_ledger.simulated IS
  'TRUE for entries created in test_simulated wallet mode — excluded from real spend totals.';

-- ── 3. usage_events: category + feature_key + internal_cost_cents + simulated ─

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS category           TEXT,
  ADD COLUMN IF NOT EXISTS feature_key        TEXT,
  ADD COLUMN IF NOT EXISTS internal_cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS simulated          BOOLEAN NOT NULL DEFAULT FALSE;

-- Constraint: only known credit categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'usage_events'
      AND constraint_name = 'usage_events_category_check'
      AND constraint_schema = current_schema()
  ) THEN
    ALTER TABLE usage_events
      ADD CONSTRAINT usage_events_category_check
      CHECK (category IS NULL OR category IN ('recognition', 'adaptation', 'brainpower'));
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for category + feature breakdowns
CREATE INDEX IF NOT EXISTS idx_usage_events_category
  ON usage_events (tenant_id, category, created_at DESC)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_feature_key
  ON usage_events (tenant_id, feature_key, created_at DESC)
  WHERE feature_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_simulated
  ON usage_events (tenant_id, simulated, created_at DESC);

-- Period + category index for usage_summary aggregation.
-- date_trunc('month', timestamptz) is STABLE (not IMMUTABLE) so it cannot
-- appear in an index expression.  A plain (tenant_id, created_at, category)
-- index is equally effective: the query planner uses it for the monthly range
-- scan and the GROUP BY date_trunc(…) aggregation runs on the filtered rows.
CREATE INDEX IF NOT EXISTS idx_usage_events_period_category
  ON usage_events (tenant_id, created_at, category)
  WHERE simulated = FALSE;

COMMENT ON COLUMN usage_events.category IS
  'Chameleon Credits category: recognition | adaptation | brainpower';
COMMENT ON COLUMN usage_events.feature_key IS
  'Feature or integration identifier, e.g. ip_enrich, hero_generation. Matches credit_pricing.feature_key.';
COMMENT ON COLUMN usage_events.internal_cost_cents IS
  'Actual provider cost in euro cents — may differ from customer-facing credits_cost.';
COMMENT ON COLUMN usage_events.simulated IS
  'TRUE when recorded in test_simulated wallet mode — excluded from real usage summaries.';

-- ── 4. credit_pricing table ────────────────────────────────────────────────────
--
-- Flexible pricing table that tracks both what customers see (customer_price_cents)
-- and what the platform actually pays providers (internal_cost_cents).
--
-- customer_price_cents = Chameleon Credits charged to the tenant (1 credit = 1 cent)
-- internal_cost_cents  = actual provider API cost (optional; used for margin tracking)
--
-- This is the authoritative pricing source.
-- enrichment_pricing is kept for backward compat with older code paths.

CREATE TABLE IF NOT EXISTS credit_pricing (
  id                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  feature_key          TEXT         NOT NULL,
  category             TEXT         NOT NULL,
  customer_price_cents INTEGER      NOT NULL DEFAULT 3,
  internal_cost_cents  INTEGER,
  billing_unit         TEXT         NOT NULL DEFAULT 'per_call',
  description          TEXT,
  active               BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT credit_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT credit_pricing_feature_key_unique UNIQUE (feature_key),
  CONSTRAINT credit_pricing_category_check
    CHECK (category IN ('recognition', 'adaptation', 'brainpower')),
  CONSTRAINT credit_pricing_billing_unit_check
    CHECK (billing_unit IN ('per_call', 'per_token', 'per_kb', 'per_request')),
  CONSTRAINT credit_pricing_customer_price_positive
    CHECK (customer_price_cents >= 0)
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION _billing_set_credit_pricing_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_pricing_updated_at ON credit_pricing;
CREATE TRIGGER trg_credit_pricing_updated_at
  BEFORE UPDATE ON credit_pricing
  FOR EACH ROW EXECUTE FUNCTION _billing_set_credit_pricing_updated_at();

-- RLS
ALTER TABLE credit_pricing ENABLE ROW LEVEL SECURITY;

-- Index for active pricing lookups
CREATE INDEX IF NOT EXISTS idx_credit_pricing_active
  ON credit_pricing (feature_key) WHERE active = TRUE;

COMMENT ON TABLE credit_pricing IS
  'Per-feature pricing: customer_price_cents (what tenants are charged) vs internal_cost_cents (actual provider cost). 1 credit = 1 euro cent.';

-- Seed initial pricing rows
-- ON CONFLICT updates to keep prices in sync when migration is re-run
INSERT INTO credit_pricing (feature_key, category, customer_price_cents, internal_cost_cents, billing_unit, description)
VALUES
  -- ── Recognition (3 credits per live call) ──
  ('ip_enrich',
   'recognition', 3, 1, 'per_call',
   'IPinfo Lite — network ASN, org name, geo coordinates, and domain'),

  ('reverse_geocode',
   'recognition', 3, 1, 'per_call',
   'Latitude / longitude → structured address (LocationIQ / BigDataCloud)'),

  ('company_lookup',
   'recognition', 3, 2, 'per_call',
   'Reverse-IP firmographics — company name, size, industry (OpenKvK / Clearbit)'),

  ('leadinfo_lookup',
   'recognition', 3, 3, 'per_call',
   'B2B company identification via Leadinfo client-side identify flow'),

  -- ── Adaptation (3 credits per live call) ──
  ('intent_enrich',
   'adaptation', 3, 1, 'per_call',
   'Behavioural intent and session engagement signals'),

  ('weather_enrich',
   'adaptation', 3, 1, 'per_call',
   'Open-Meteo current weather conditions and short forecast'),

  -- ── Brainpower (6 credits per live call — quota-constrained external APIs) ──
  ('ga4_history',
   'brainpower', 6, 4, 'per_call',
   'Google Analytics 4 visitor session history and channel attribution'),

  ('crm_lookup',
   'brainpower', 6, 5, 'per_call',
   'HubSpot CRM contact and company record matching'),

  -- ── Brainpower — AI generation (future use) ──
  ('hero_generation',
   'brainpower', 10, 8, 'per_call',
   'AI-generated hero section content (headline, sub-headline, CTA)'),

  ('block_generation',
   'brainpower', 8, 6, 'per_call',
   'AI-generated page block content (proof, features, FAQs)'),

  ('blueprint_generation',
   'brainpower', 15, 12, 'per_call',
   'AI-generated full page blueprint from a single URL')

ON CONFLICT (feature_key) DO UPDATE
  SET category             = EXCLUDED.category,
      customer_price_cents = EXCLUDED.customer_price_cents,
      internal_cost_cents  = EXCLUDED.internal_cost_cents,
      billing_unit         = EXCLUDED.billing_unit,
      description          = EXCLUDED.description,
      updated_at           = now();

-- ── 5. usage_summary VIEW ─────────────────────────────────────────────────────
--
-- Read-optimised view of usage_events aggregated by:
--   tenant × billing month × category × feature
--
-- Excludes simulated (test mode) rows.
-- Use MATERIALIZED VIEW in a future migration if query becomes slow on large tables.
--
-- Guard: if a non-view object named usage_summary exists (e.g. a table created
-- by a partial previous run or a manual SQL editor session), DROP it first so
-- that CREATE OR REPLACE VIEW does not hit error 42809 "is not a view".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname  = 'usage_summary'
      AND c.relkind NOT IN ('v')   -- 'v' = ordinary view
  ) THEN
    EXECUTE 'DROP TABLE IF EXISTS usage_summary CASCADE';
    EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS usage_summary CASCADE';
  END IF;
END $$;

CREATE OR REPLACE VIEW usage_summary AS
SELECT
  tenant_id,
  to_char(date_trunc('month', created_at), 'YYYY-MM')          AS period_key,
  COALESCE(category, 'unknown')                                 AS category,
  COALESCE(feature_key, event_type::TEXT)                      AS feature_key,
  COUNT(*)::INTEGER                                             AS total_calls,
  SUM(CASE WHEN credits_cost > 0 AND NOT cache_hit THEN 1 ELSE 0 END)::INTEGER
                                                                AS billable_calls,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::INTEGER          AS cache_hit_calls,
  SUM(CASE WHEN success THEN COALESCE(credits_cost, 0) ELSE 0 END)::INTEGER
                                                                AS total_cost_cents,
  SUM(CASE WHEN success AND internal_cost_cents IS NOT NULL THEN internal_cost_cents ELSE 0 END)::INTEGER
                                                                AS internal_cost_cents_sum
FROM usage_events
WHERE simulated = FALSE
GROUP BY
  tenant_id,
  to_char(date_trunc('month', created_at), 'YYYY-MM'),
  COALESCE(category, 'unknown'),
  COALESCE(feature_key, event_type::TEXT);

COMMENT ON VIEW usage_summary IS
  'Aggregated credit usage per tenant × billing month × category × feature. Excludes test/simulated rows.';

-- Grant read to authenticated and service_role
GRANT SELECT ON usage_summary TO authenticated;
GRANT SELECT ON usage_summary TO service_role;

-- ── 6. debit_wallet RPC — add p_category parameter ────────────────────────────
--
-- Extends the existing debit_wallet function to accept an optional credit category.
-- The category is written to wallet_ledger for per-category spend queries.
-- Backward compatible: existing callers that omit p_category get NULL in the ledger.

CREATE OR REPLACE FUNCTION debit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_reference_type TEXT    DEFAULT 'enrichment_usage',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL
)
RETURNS INTEGER        -- returns new balance_cents after the debit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after  INTEGER;
  v_status         TEXT;
BEGIN
  -- Lock the wallet row to prevent concurrent debits (advisory at row level)
  SELECT balance_cents, status
  INTO   v_balance_before, v_status
  FROM   tenant_wallets
  WHERE  tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found for tenant %', p_tenant_id;
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'wallet_not_active: status=% for tenant %', v_status, p_tenant_id;
  END IF;

  IF v_balance_before < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient_wallet_balance: balance=% requested=% for tenant %',
      v_balance_before, p_amount_cents, p_tenant_id;
  END IF;

  v_balance_after := v_balance_before - p_amount_cents;

  -- Atomically update balance
  UPDATE tenant_wallets
  SET    balance_cents = v_balance_after,
         updated_at    = now()
  WHERE  tenant_id = p_tenant_id;

  -- Append ledger entry (negative amount = debit)
  INSERT INTO wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    p_tenant_id,
    'enrichment_debit',
    p_category,
    -p_amount_cents,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note,
    FALSE,
    now()
  );

  RETURN v_balance_after;
END;
$$;

-- ── 7. credit_wallet RPC — add p_category parameter ──────────────────────────
--
-- Extends the existing credit_wallet function to accept an optional category.
-- Top-ups use category='topup'; refunds use 'refund'; admin adjustments use 'adjustment'.
-- Also reactivates a suspended wallet when funds are added.
--
-- Drop all overloads first so we can change the return type without errors.
-- (CREATE OR REPLACE cannot change return type — requires DROP + CREATE.)
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.credit_wallet(text, integer, text, text, text, text);

CREATE OR REPLACE FUNCTION credit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_entry_type     TEXT    DEFAULT 'top_up_manual',
  p_reference_type TEXT    DEFAULT 'manual',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT 'topup'
)
RETURNS INTEGER        -- returns new balance_cents after the credit
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_after  INTEGER;
  v_is_simulated   BOOLEAN;
BEGIN
  -- Determine if this is a simulated entry
  v_is_simulated := (p_entry_type LIKE 'sim_%');

  -- Upsert: create wallet row if absent, otherwise add to balance.
  -- Also reactivate a suspended wallet when funds arrive.
  INSERT INTO tenant_wallets (tenant_id, balance_cents, status)
  VALUES (p_tenant_id, p_amount_cents, 'active')
  ON CONFLICT (tenant_id) DO UPDATE
    SET balance_cents = tenant_wallets.balance_cents + EXCLUDED.balance_cents,
        status        = CASE
                          WHEN tenant_wallets.status = 'suspended'
                          THEN 'active'
                          ELSE tenant_wallets.status
                        END,
        updated_at    = now()
  RETURNING balance_cents INTO v_balance_after;

  -- Append ledger entry (positive amount = credit)
  INSERT INTO wallet_ledger (
    tenant_id,
    entry_type,
    category,
    amount_cents,
    balance_after_cents,
    reference_type,
    reference_id,
    note,
    simulated,
    created_at
  ) VALUES (
    p_tenant_id,
    p_entry_type,
    p_category,
    p_amount_cents,
    v_balance_after,
    p_reference_type,
    p_reference_id,
    p_note,
    v_is_simulated,
    now()
  );

  RETURN v_balance_after;
END;
$$;

-- ── 8. sim_debit_wallet RPC — add p_category parameter ───────────────────────
--
-- Simulated debit (test_simulated mode only). Sets simulated=TRUE in ledger.

CREATE OR REPLACE FUNCTION sim_debit_wallet(
  p_tenant_id      TEXT,
  p_amount_cents   INTEGER,
  p_reference_type TEXT    DEFAULT 'sim_enrichment',
  p_reference_id   TEXT    DEFAULT NULL,
  p_note           TEXT    DEFAULT NULL,
  p_category       TEXT    DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_before INTEGER;
  v_balance_after  INTEGER;
  v_status         TEXT;
BEGIN
  SELECT balance_cents, status
  INTO   v_balance_before, v_status
  FROM   tenant_wallets
  WHERE  tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_not_found for tenant %', p_tenant_id;
  END IF;

  v_balance_after := GREATEST(0, v_balance_before - p_amount_cents);

  UPDATE tenant_wallets
  SET    balance_cents = v_balance_after,
         updated_at    = now()
  WHERE  tenant_id = p_tenant_id;

  INSERT INTO wallet_ledger (
    tenant_id, entry_type, category, amount_cents, balance_after_cents,
    reference_type, reference_id, note, simulated, created_at
  ) VALUES (
    p_tenant_id, 'sim_debit', p_category, -p_amount_cents, v_balance_after,
    p_reference_type, p_reference_id,
    COALESCE(p_note, '[SIM] simulated debit'), TRUE, now()
  );

  RETURN v_balance_after;
END;
$$;

-- ── Done ──────────────────────────────────────────────────────────────────────
-- Schema version: credits_v2
-- Applied: monthly cap, fallback mode, category ledger, credit_pricing, usage_summary view
-- RPC updates: debit_wallet, credit_wallet, sim_debit_wallet all carry p_category
