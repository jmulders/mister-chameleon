-- migration 135 — visitor_profiles.firmographics_at
--
-- Timestamp of when the firmographic (company) fields were last written. Lets the
-- enrichment pipeline reuse stable company data for a recognised visitor — and
-- skip the company-identification stages — until the data is older than the
-- tenant's configured freshness window (default 30 days). Volatile enrichment
-- (current geo, weather) still runs every visit. See docs/lead-base-design.md.

ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS firmographics_at TIMESTAMPTZ;
