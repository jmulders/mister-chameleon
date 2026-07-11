-- migration 146 — ad-platform conversion feedback (offline conversions / CAPI)
--
-- The counterpart to the retargeting audience sync: when a lead converts, send a
-- server-side conversion event back to the ad platforms so their bidding
-- optimizes toward real leads, not just clicks.
--   • Google  — Data Manager API events:ingest → a Google Ads UPLOAD_CLICKS
--               conversion action (enhanced conversions for leads, hashed email)
--   • Meta    — Conversions API  /{pixel}/events
--   • LinkedIn— Conversions API  /rest/conversionEvents
--
-- Credentials are reused from ad_sync_settings (google OAuth, meta.accessToken,
-- linkedin.accessToken). This column holds only the conversion *targets* + toggles.
-- Identifiers are SHA-256 hashed before sending (same hash as the audience sync).

-- Per-tenant conversion config:
--   { enabled, eventName, defaultValue, currency,
--     google:   { conversionActionId },
--     meta:     { pixelId },
--     linkedin: { conversionId } }
ALTER TABLE ad_sync_settings ADD COLUMN IF NOT EXISTS conversions JSONB;

-- Audit log: one row per conversion event sent to one platform.
CREATE TABLE IF NOT EXISTS ad_conversion_events (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   TEXT        NOT NULL,
  platform    TEXT        NOT NULL,                 -- google | meta | linkedin
  status      TEXT        NOT NULL,                 -- ok | error | skipped
  event_name  TEXT,
  trigger     TEXT        NOT NULL DEFAULT 'conversion',  -- conversion | qualification
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ad_conversion_events_tenant_created_idx
  ON ad_conversion_events (tenant_id, created_at DESC);

ALTER TABLE ad_conversion_events ENABLE ROW LEVEL SECURITY;
