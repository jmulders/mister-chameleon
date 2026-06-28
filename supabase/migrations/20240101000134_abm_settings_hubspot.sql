-- migration 134 — abm_settings.hubspot_token
--
-- Per-tenant HubSpot private-app token for the Lead Base CRM sync. When set,
-- qualified visitor profiles are upserted as HubSpot Companies (by domain) on the
-- qualification event. Free HubSpot supports a private app with the
-- `crm.objects.companies.write` scope. Stored alongside the outbound webhook in
-- abm_settings (service-role only). See docs/lead-base-design.md.

ALTER TABLE abm_settings ADD COLUMN IF NOT EXISTS hubspot_token TEXT;
