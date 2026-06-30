-- migration 141 — visitor_profiles.converted_at (personalization performance)
--
-- Timestamp of the visitor's first conversion (currently: a form submission),
-- linked by visitor_key (= mc_session_id). Powers the personalization performance
-- report — conversion rate of personalized vs baseline visitors and per segment.
-- See docs/lead-base-design.md.

ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS visitor_profiles_converted_idx ON visitor_profiles (tenant_id) WHERE converted_at IS NOT NULL;
