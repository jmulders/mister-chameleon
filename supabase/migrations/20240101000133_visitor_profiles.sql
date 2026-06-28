-- migration 133 — visitor_profiles (Lead Base, phase 1)
--
-- One pseudonymous-first profile per visitor, per tenant — the persisted output
-- of the behaviour-scoring engine, audience-segment evaluation and the enrichment
-- chain (it does NOT recompute them). Powers real-time personalization + a
-- lightweight in-app Lead Base overview. It is NOT the long-term PII
-- system-of-record (named/qualified leads belong in the CRM, via the webhook).
--
-- GDPR: writes are gated through the existing mc_consent model. Behavioural data
-- requires `personalization` consent; firmographic data requires `enrichment`
-- consent; raw IP is never stored (only derived fields + a hashed visitor_key).
-- Pseudonymous profiles carry a retention TTL (expires_at, default 90 days).
--
-- Accessed via the service-role client (getDb) — RLS on, no policies, same
-- pattern as abm_leads. See docs/lead-base-design.md.

CREATE TABLE IF NOT EXISTS visitor_profiles (
  id                UUID         NOT NULL DEFAULT gen_random_uuid(),
  tenant_id         TEXT         NOT NULL,
  -- The first-party visitor id: the `mc_session_id` cookie value (a random UUID).
  -- This is the SAME id the GA4 History enricher uses as its visitor dimension,
  -- so GA4 data and this profile join on one key — no separate "lead id" needed.
  -- Pseudonymous (random UUID, not the raw IP); ~30-day cookie lifetime.
  visitor_key       TEXT         NOT NULL,

  -- Identity ladder + lifecycle.
  identity_level    TEXT         NOT NULL DEFAULT 'anonymous', -- anonymous|recognised|known|customer
  status            TEXT         NOT NULL DEFAULT 'visitor',   -- visitor|engaged|mql|sql|customer|churned

  -- Behavioural summary (pseudonymous — gated on `personalization`).
  first_seen_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  visit_count       INTEGER      NOT NULL DEFAULT 0,
  intent_score      INTEGER,
  funnel_stage      TEXT,
  segment_ids       TEXT[],
  interests         JSONB        NOT NULL DEFAULT '{}'::jsonb,

  -- Firmographic snapshot (L1+; company = not personal data — gated on `enrichment`).
  company_name      TEXT,
  company_domain    TEXT,
  company_size      TEXT,
  company_industry  TEXT,
  geo_country       TEXT,   -- coarse only (country/region) — never precise/raw IP
  geo_region        TEXT,

  -- Identity link (L2+; personal — consent / own-list basis only).
  abm_lead_id       UUID         REFERENCES abm_leads (id) ON DELETE SET NULL,
  consent_state     TEXT         NOT NULL DEFAULT 'none', -- none|essential|granted
  pii               JSONB,       -- name/email/etc. — ONLY when permitted by the gate

  -- Retention.
  expires_at        TIMESTAMPTZ,

  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, visitor_key)
);

-- Admin list/filter (newest activity first) + lookups.
CREATE INDEX IF NOT EXISTS visitor_profiles_tenant_seen_idx   ON visitor_profiles (tenant_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS visitor_profiles_tenant_level_idx  ON visitor_profiles (tenant_id, identity_level);
CREATE INDEX IF NOT EXISTS visitor_profiles_tenant_status_idx ON visitor_profiles (tenant_id, status);
CREATE INDEX IF NOT EXISTS visitor_profiles_company_idx       ON visitor_profiles (tenant_id, company_domain);
-- Retention purge scan.
CREATE INDEX IF NOT EXISTS visitor_profiles_expiry_idx        ON visitor_profiles (expires_at);

ALTER TABLE visitor_profiles ENABLE ROW LEVEL SECURITY;
