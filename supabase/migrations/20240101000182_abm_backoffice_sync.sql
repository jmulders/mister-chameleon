-- migration 182 — ABM back-office sync API (fase 1)
--
-- Lets a back-office / CRM upsert leads by its OWN record id and get the opaque
-- handle (/go/{identifier}) back, so it can build the mail links itself and keep
-- a stable mapping external_id ↔ handle across syncs.
--
--   • abm_leads.external_id   — the back-office/CRM record id (the idempotent
--     sync key, per tenant). NULL for leads created in the admin UI / CSV import.
--   • abm_leads.contact_name  — named contact (moved out of the free-form profile
--     JSON so the sync contract has explicit columns).
--   • abm_leads.contact_email — named contact email.
--   • partial UNIQUE index on (tenant_id, external_id) WHERE external_id IS NOT
--     NULL — the upsert key. Partial so the many admin/CSV leads with a NULL
--     external_id do not collide (NULLs are distinct anyway, but a partial index
--     keeps it clean and small).
--   • abm_settings.sync_api_key — the per-tenant API key for POST /api/abm/leads,
--     stored ENCRYPTED (AES-256-GCM via lib/email-crypto). Lives alongside the
--     other per-tenant ABM secrets (webhook_secret, hubspot_token). Service-role
--     only, same as the rest of abm_settings.
--
-- All additive + idempotent (IF NOT EXISTS). See docs/abm-backoffice-sync-api.md.

ALTER TABLE abm_leads ADD COLUMN IF NOT EXISTS external_id   TEXT;
ALTER TABLE abm_leads ADD COLUMN IF NOT EXISTS contact_name  TEXT;
ALTER TABLE abm_leads ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN abm_leads.external_id   IS 'Back-office/CRM record id; idempotent per-tenant sync key (POST /api/abm/leads). NULL for admin/CSV leads.';
COMMENT ON COLUMN abm_leads.contact_name  IS 'Named contact full name (back-office sync).';
COMMENT ON COLUMN abm_leads.contact_email IS 'Named contact email (back-office sync).';

-- The idempotent sync key: one lead per (tenant, external_id). Partial so the
-- NULL-external_id admin/CSV leads are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS abm_leads_tenant_external_idx
  ON abm_leads (tenant_id, external_id)
  WHERE external_id IS NOT NULL;

-- Per-tenant API key for the back-office sync endpoint, stored encrypted.
ALTER TABLE abm_settings ADD COLUMN IF NOT EXISTS sync_api_key TEXT;

COMMENT ON COLUMN abm_settings.sync_api_key IS 'Encrypted per-tenant API key for POST /api/abm/leads (AES-256-GCM via EMAIL_ENCRYPTION_KEY). NULL = sync disabled (endpoint returns 401).';
