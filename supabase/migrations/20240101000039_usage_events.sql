-- ─────────────────────────────────────────────────────────────────────────────
-- Usage Events
--
-- Granular log of every billable enrichment action.
--
-- ─── Why a separate table from credit_transactions? ───────────────────────────
--
--   credit_transactions is a financial ledger — it records credit balance
--   changes (positive or negative) and is the source of truth for billing.
--
--   usage_events is an activity log — it records what enrichment was called,
--   what it returned, and any session/visitor metadata.  It exists to:
--
--     • Validate that every enrichment call is accounted for (billing audit).
--     • Enable per-feature usage breakdowns in the admin dashboard.
--     • Support rate-limiting and fraud detection at the application layer.
--     • Allow querying "which tenants use leadinfo most?" across the platform.
--
--   One credit_transaction row is created per credit movement.
--   One usage_event row is created per enrichment API call (success or fail).
--
-- ─── Idempotency ─────────────────────────────────────────────────────────────
--
--   idempotency_key (text UNIQUE) prevents double-recording when the calling
--   API route is retried.  Callers should set the key before calling the
--   enrichment API and reuse it on retry.
--
--   Recommended key format: {event_type}:{tenant_id}:{session_id}
--
-- ─── Credit cost ─────────────────────────────────────────────────────────────
--
--   credits_cost mirrors the credit_transactions.amount for the matching
--   deduction (0 when the call is free/cached, 1 for a standard enrichment).
--   This allows usage aggregation without joining credit_transactions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Event type enum ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE usage_event_type AS ENUM (
    'leadinfo_lookup',
    'ip_enrich',
    'weather_enrich',
    'intent_enrich',
    'crm_lookup'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_events (
  id               uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid             NOT NULL,  -- FK removed: no tenants table; migration 050 repairs type to TEXT

  -- What happened
  event_type       usage_event_type NOT NULL,
  quantity         integer          NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Billing cost (mirrors the matching credit_transactions deduction)
  credits_cost     integer          NOT NULL DEFAULT 1 CHECK (credits_cost >= 0),

  -- Outcome
  success          boolean          NOT NULL DEFAULT true,
  error_code       text,                           -- machine-readable, e.g. "rate_limited"

  -- Visitor context
  session_id       text,                           -- visitor session for correlation
  idempotency_key  text             UNIQUE,        -- prevents double-recording on retry

  -- Event-specific structured metadata
  -- leadinfo_lookup: { companyName, companyDomain, companyCountry, matched }
  -- ip_enrich:       { ip, country, region, city }
  -- weather_enrich:  { location, condition }
  -- intent_enrich:   { score, signals }
  -- crm_lookup:      { contactId, email (hashed) }
  metadata         jsonb            NOT NULL DEFAULT '{}',

  created_at       timestamptz      NOT NULL DEFAULT now()
);

-- ── Add missing columns when table pre-existed without them ──────────────────
--
-- CREATE TABLE IF NOT EXISTS above is a no-op when the table already exists.
-- These ADD COLUMN IF NOT EXISTS statements bring the schema up to date
-- regardless of which version the table was originally created with.

ALTER TABLE usage_events
  ADD COLUMN IF NOT EXISTS quantity         integer     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS credits_cost     integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success          boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS error_code       text,
  ADD COLUMN IF NOT EXISTS session_id       text,
  ADD COLUMN IF NOT EXISTS metadata         jsonb       NOT NULL DEFAULT '{}';

-- Re-apply the CHECK constraints if they are missing.
-- Wrapped in DO blocks so re-running is safe.
DO $$ BEGIN
  ALTER TABLE usage_events ADD CONSTRAINT usage_events_quantity_check CHECK (quantity > 0);
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE usage_events ADD CONSTRAINT usage_events_credits_cost_check CHECK (credits_cost >= 0);
EXCEPTION WHEN duplicate_object OR undefined_column THEN NULL; END $$;

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Primary query pattern: tenant billing period summary
CREATE INDEX IF NOT EXISTS usage_events_tenant_time_idx
  ON usage_events (tenant_id, created_at DESC);

-- Per-feature breakdown query
CREATE INDEX IF NOT EXISTS usage_events_tenant_type_time_idx
  ON usage_events (tenant_id, event_type, created_at DESC);

-- Idempotency lookup (sparse — only rows with a key).
-- Guard: idempotency_key may not exist on the pre-existing table yet;
-- migration 080 adds it via ADD COLUMN IF NOT EXISTS.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'usage_events'
      AND column_name  = 'idempotency_key'
  ) THEN
    CREATE INDEX IF NOT EXISTS usage_events_idempotency_idx
      ON usage_events (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  END IF;
END $$;

-- Platform-wide analytics (e.g. "which tenants use leadinfo most?")
CREATE INDEX IF NOT EXISTS usage_events_type_time_idx
  ON usage_events (event_type, created_at DESC);

-- ── Row-level security ────────────────────────────────────────────────────────
-- Service-role only; tenants never query this table directly.

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- ── Helper view: usage summary by tenant + period ─────────────────────────────
-- Materialised periodically or queried directly by the admin dashboard.

-- DROP before replace: CREATE OR REPLACE VIEW cannot remove columns from
-- an existing view; dropping first avoids "cannot drop columns from view".
DROP VIEW IF EXISTS usage_events_summary;
CREATE VIEW usage_events_summary AS
SELECT
  tenant_id,
  event_type,
  date_trunc('day', created_at) AS event_date,
  count(*)                       AS call_count,
  count(*) FILTER (WHERE success) AS success_count,
  count(*) FILTER (WHERE NOT success) AS failure_count,
  sum(credits_cost)              AS total_credits
FROM usage_events
GROUP BY tenant_id, event_type, date_trunc('day', created_at);
