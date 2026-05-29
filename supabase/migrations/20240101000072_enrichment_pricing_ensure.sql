-- migration 072 — enrichment_pricing schema ensure
--
-- Belt-and-suspenders migration that guarantees enrichment_pricing has the
-- canonical fractional-EUR schema regardless of whether migration 065
-- (billing_plans_defaults) committed cleanly.
--
-- ─── Why this exists ─────────────────────────────────────────────────────────
--
--   Migration 043 (wallet_system) created enrichment_pricing with the OLD schema:
--     enrichment_type TEXT PRIMARY KEY
--     unit_price_cents INTEGER NOT NULL DEFAULT 3
--     ...
--
--   Migration 065 was supposed to DROP the old table and CREATE a new one with
--   fractional-EUR columns (unit_price NUMERIC, credit_cost NUMERIC, id UUID PK).
--   If migration 065 failed mid-transaction, enrichment_pricing still has the old
--   schema.  The admin seed action then tries to upsert unit_price/credit_cost
--   columns that don't exist → "Seed failed" error.
--
--   This migration detects the old schema and replaces it, then seeds canonical
--   data.  Safe to run whether enrichment_pricing is:
--     a) absent               → CREATE fresh
--     b) old schema (043)     → DROP + CREATE new schema
--     c) new schema (065)     → CREATE TABLE IF NOT EXISTS is a no-op; seeds
--                                use ON CONFLICT DO NOTHING
--
-- ─── Canonical schema ─────────────────────────────────────────────────────────
--
--   id              UUID PK
--   enrichment_type TEXT UNIQUE NOT NULL
--   label           TEXT NOT NULL
--   category        TEXT NOT NULL DEFAULT 'recognition'
--   unit_price      NUMERIC(12,6)  — EUR per call (e.g. 0.030000 = €0.03)
--   credit_cost     NUMERIC(12,3)  — credits deducted per call (e.g. 3.000)
--   internal_cost   NUMERIC(12,6)  — actual provider cost in EUR (nullable)
--   billing_unit    TEXT NOT NULL DEFAULT 'per_call'
--   description     TEXT
--   billable        BOOLEAN NOT NULL DEFAULT true
--   active          BOOLEAN NOT NULL DEFAULT true
--   created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
--   updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

-- ── Drop old schema if present ────────────────────────────────────────────────
--
-- The old schema (migration 043) uses unit_price_cents (INTEGER) as the
-- column name.  Detect this before creating/ensuring the table so that
-- CREATE TABLE IF NOT EXISTS (step below) doesn't silently leave the old schema.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'enrichment_pricing'
      AND column_name  = 'unit_price_cents'
  ) THEN
    -- Old schema confirmed — drop safely (no FK references to this table)
    DROP TABLE IF EXISTS enrichment_pricing CASCADE;
  END IF;
END $$;

-- ── Create new schema ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrichment_pricing (
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
  'Replaces the legacy credit_pricing / enrichment_pricing (043 schema) tables.';

COMMENT ON COLUMN enrichment_pricing.unit_price IS
  'EUR charged per successful live API call (e.g. 0.030000 = €0.03).';

COMMENT ON COLUMN enrichment_pricing.credit_cost IS
  'Credits deducted per successful call. Supports fractions like 0.250 or 3.000.';

COMMENT ON COLUMN enrichment_pricing.internal_cost IS
  'Actual provider cost per call in EUR for margin analysis. NULL when unknown.';

-- ── Seed canonical enrichment types ──────────────────────────────────────────
--
-- ON CONFLICT (enrichment_type) DO NOTHING — idempotent; will not overwrite
-- any admin changes made to existing rows via the pricing editor.

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
   'HubSpot / Salesforce CRM contact and company lookup', true, true),
  -- Brainpower — AI generation (future)
  ('hero_generation',      'Hero Generation',      'brainpower', 0.100000, 10.000, 0.080000, 'per_call',
   'AI-generated hero section content (headline, sub-headline, CTA)', true, true),
  ('block_generation',     'Block Generation',     'brainpower', 0.080000, 8.000,  0.060000, 'per_call',
   'AI-generated page block content (proof, features, FAQs)', true, true),
  ('blueprint_generation', 'Blueprint Generation', 'brainpower', 0.150000, 15.000, 0.120000, 'per_call',
   'AI-generated full page blueprint from a single URL', true, true)
ON CONFLICT (enrichment_type) DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS enrichment_pricing_active
  ON enrichment_pricing (active, category);

CREATE INDEX IF NOT EXISTS enrichment_pricing_type
  ON enrichment_pricing (enrichment_type);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE enrichment_pricing ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
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
