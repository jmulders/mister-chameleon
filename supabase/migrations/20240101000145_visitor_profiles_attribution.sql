-- migration 145 — first-touch attribution on visitor_profiles
--
-- Persists how a visitor first arrived, so leads carry their acquisition channel
-- and the funnel/channel report can group by it. First-touch: set once on the
-- first visit, never overwritten by later sessions (enforced in the store).
--
-- utm_* + referrer_domain + first_channel are populated at capture (analytics/
-- personalization consent). gclid / fbclid are reserved for the ad-platform
-- conversion-feedback feature (offline conversions / CAPI matching). All
-- pseudonymous marketing attribution — no PII. See docs/lead-base-design.md.

ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS utm_source      TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS utm_medium      TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS utm_campaign    TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS utm_content     TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS utm_term        TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS referrer_domain TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS gclid           TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS fbclid          TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS first_channel   TEXT;

-- Report grouping: channel per tenant.
CREATE INDEX IF NOT EXISTS visitor_profiles_tenant_channel_idx
  ON visitor_profiles (tenant_id, first_channel);
