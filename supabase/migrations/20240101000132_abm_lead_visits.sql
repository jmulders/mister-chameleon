-- migration 132 — abm_lead_visits + abm_settings + abm_leads.last_seen_at
--
-- Closes the ABM loop: when a known lead arrives via /go/{token}, we record the
-- visit (which page, when) so sales can see a per-lead activity timeline in the
-- admin, and optionally fan the event out to a per-tenant outbound webhook
-- (HubSpot workflow / Slack / Zapier / custom endpoint).
--
-- Accessed via the service-role client (getDb) — RLS on, no policies, same
-- pattern as abm_leads. See docs/abm-personalized-urls.md.

-- Per-lead visit log (one row per /go arrival).
CREATE TABLE IF NOT EXISTS abm_lead_visits (
  id          UUID         NOT NULL DEFAULT gen_random_uuid(),
  lead_id     UUID         NOT NULL REFERENCES abm_leads (id) ON DELETE CASCADE,
  tenant_id   TEXT         NOT NULL,
  path        TEXT         NOT NULL DEFAULT '/',   -- page the lead landed on
  visited_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Recent-visits-per-lead lookups (newest first).
CREATE INDEX IF NOT EXISTS abm_lead_visits_lead_idx   ON abm_lead_visits (lead_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS abm_lead_visits_tenant_idx ON abm_lead_visits (tenant_id, visited_at DESC);

ALTER TABLE abm_lead_visits ENABLE ROW LEVEL SECURITY;

-- Denormalized "last seen" so the leads list can show recency without a join.
ALTER TABLE abm_leads ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Per-tenant ABM settings — currently just the optional outbound webhook URL.
CREATE TABLE IF NOT EXISTS abm_settings (
  tenant_id    TEXT         NOT NULL,
  webhook_url  TEXT,                                 -- optional; fired on each lead visit
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id)
);

ALTER TABLE abm_settings ENABLE ROW LEVEL SECURITY;
