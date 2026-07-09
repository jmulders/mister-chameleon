-- migration 143 — ad-platform audience sync (retargeting)
--
-- Lets a tenant push their Lead Base segment (by lead level / status / intent)
-- into ad-platform retargeting audiences:
--   • Google Ads   — Customer Match user list (offline user data job)
--   • Meta         — Custom Audience (users add, hashed identifiers)
--   • LinkedIn     — Matched Audience / DMP Segment (users add)
--
-- This replicates HubSpot's "ads audience sync" without a Marketing Hub tier.
-- Personal identifiers (email/phone) are SHA-256 hashed in-process before they
-- ever leave the server; only hashes go to the ad platforms. Members are drawn
-- from first-party lead data (abm_leads.profile email) joined with the lead's
-- level (visitor_profiles). A daily cron reconciles the full audience.
--
-- Secrets are stored per-tenant in the same service-role-only fashion as
-- abm_settings (RLS on, no policies; only getDb() reaches these rows). See
-- docs/lead-base-design.md.

-- ── Per-tenant config + credentials ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_sync_settings (
  tenant_id   TEXT        NOT NULL,
  enabled     BOOLEAN     NOT NULL DEFAULT false,          -- master on/off for the daily push
  -- Segment definition: which leads land in the audience.
  --   { minIdentityLevel, status, minIntent, minScore, segmentKey, requireConsent }
  segment     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Per-platform credential + target-audience blobs (null = platform not configured).
  --   google:   { developerToken, loginCustomerId, customerId, clientId, clientSecret, refreshToken, userListId }
  --   meta:     { accessToken, adAccountId, audienceId }
  --   linkedin: { accessToken, adAccountId, dmpSegmentId }
  google      JSONB,
  meta        JSONB,
  linkedin    JSONB,
  last_run_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id)
);

ALTER TABLE ad_sync_settings ENABLE ROW LEVEL SECURITY;

-- ── Run audit log (one row per platform push) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_sync_runs (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     TEXT        NOT NULL,
  platform      TEXT        NOT NULL,                       -- google | meta | linkedin
  status        TEXT        NOT NULL,                       -- ok | error | skipped
  members_total INTEGER     NOT NULL DEFAULT 0,             -- matchable members in the segment
  members_sent  INTEGER     NOT NULL DEFAULT 0,             -- members accepted by the platform
  trigger       TEXT        NOT NULL DEFAULT 'cron',        -- cron | manual
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS ad_sync_runs_tenant_created_idx
  ON ad_sync_runs (tenant_id, created_at DESC);

ALTER TABLE ad_sync_runs ENABLE ROW LEVEL SECURITY;
