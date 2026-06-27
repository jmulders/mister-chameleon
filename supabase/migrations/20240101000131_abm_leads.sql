-- migration 131 — abm_leads
--
-- Account-Based Marketing personalized URLs (PURLs). Each row maps an opaque
-- identifier (and an optional vanity path) to a known lead profile + a redirect
-- target. The edge middleware matches the identifier, stamps the lead into a
-- signed `mc_lead` cookie and 307-redirects to target_path; the Node-side
-- AbmLeadEnricher then injects the lead profile into the DecisionContext for
-- deterministic, account-based personalization.
--
-- Accessed via the service-role client (getDb) — no RLS, same as the other
-- platform tables. See docs/abm-personalized-urls.md.

CREATE TABLE IF NOT EXISTS abm_leads (
  id            UUID         NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     TEXT         NOT NULL,
  identifier    TEXT         NOT NULL,                       -- opaque token (primary handle)
  vanity_path   TEXT,                                        -- optional natural alias, e.g. "/aanbodvoorjasper"
  target_path   TEXT         NOT NULL DEFAULT '/',           -- redirect destination
  profile       JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- { firstName, name, company, role, industry, companySize, linkedinUrl, ... }
  segment_hint  TEXT,                                        -- optional audience-segment key to force
  status        TEXT         NOT NULL DEFAULT 'active',      -- active | paused | expired
  expires_at    TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ,
  visit_count   INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, identifier)
);

-- Redirect-path lookups: by opaque identifier and by vanity alias, per tenant.
CREATE INDEX IF NOT EXISTS abm_leads_tenant_identifier_idx ON abm_leads (tenant_id, identifier);
CREATE INDEX IF NOT EXISTS abm_leads_tenant_vanity_idx     ON abm_leads (tenant_id, vanity_path);

-- Service-role only: RLS on, no policies (same pattern as statamic_drafts). The
-- service-role client (getDb) bypasses RLS; anon/authenticated have no access.
ALTER TABLE abm_leads ENABLE ROW LEVEL SECURITY;
