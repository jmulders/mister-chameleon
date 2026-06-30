-- migration 139 — visitor_events (per-profile activity timeline)
--
-- Lightweight page-visit log keyed on visitor_key (= mc_session_id), so the Lead
-- Base can show "what did this lead look at": path, referrer, UTM. Pseudonymous
-- (no PII, no raw IP). Written post-response; purged with the retention cron.
-- See docs/lead-base-design.md.

CREATE TABLE IF NOT EXISTS visitor_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    TEXT NOT NULL,
  visitor_key  TEXT NOT NULL,
  path         TEXT,
  referrer     TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visitor_events_lookup_idx ON visitor_events (tenant_id, visitor_key, occurred_at DESC);
ALTER TABLE visitor_events ENABLE ROW LEVEL SECURITY;
