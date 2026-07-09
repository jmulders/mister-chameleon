-- migration 144 — ad-sync audience membership snapshot
--
-- Tracks which leads we have pushed into each platform audience, keyed by the
-- SHA-256 hash of their email (the same value we send — no raw PII stored). On
-- each run the sync engine diffs the current segment against this snapshot:
--   additions → add ops,  removals → remove ops.
-- This is what makes the daily sync a true *reconcile* (like HubSpot's list
-- sync): a lead that drops below the threshold, changes status, or is erased is
-- removed from the audience rather than lingering.
--
-- Also records a `members_removed` count on ad_sync_runs. Service-role only
-- (RLS on, no policies). See docs/lead-base-design.md.

CREATE TABLE IF NOT EXISTS ad_sync_audience_members (
  tenant_id  TEXT        NOT NULL,
  platform   TEXT        NOT NULL,                   -- google | meta | linkedin
  email_hash TEXT        NOT NULL,                   -- SHA-256 of normalized email
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, platform, email_hash)
);

CREATE INDEX IF NOT EXISTS ad_sync_audience_members_tenant_platform_idx
  ON ad_sync_audience_members (tenant_id, platform);

ALTER TABLE ad_sync_audience_members ENABLE ROW LEVEL SECURITY;

-- Count of members removed in a run (additions already live in members_sent).
ALTER TABLE ad_sync_runs ADD COLUMN IF NOT EXISTS members_removed INTEGER NOT NULL DEFAULT 0;
