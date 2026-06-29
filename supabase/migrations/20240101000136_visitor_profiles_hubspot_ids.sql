-- migration 136 — visitor_profiles HubSpot sync state
--
-- Remembers the HubSpot Company / Contact records created for a recognised lead
-- so repeat visits reuse them (no duplicates) and can attach a "website visit"
-- note. crm_visit_logged_at gates that note to once per ~30-min session.
-- See docs/lead-base-design.md.

ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS hubspot_company_id  TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS hubspot_contact_id  TEXT;
ALTER TABLE visitor_profiles ADD COLUMN IF NOT EXISTS crm_visit_logged_at TIMESTAMPTZ;
