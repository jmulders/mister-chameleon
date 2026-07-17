-- migration 150 — form_submissions.tenant_id (multi-tenant scoping)
--
-- ─── Waarom dit bestand van 095 naar 150 is hernummerd ───────────────────────
--
-- Dit bestand heette 20240101000095_form_submissions_tenant_retention.sql en
-- deelde dat nummer met 20240101000095_credit_wallet_numeric.sql. Twee bestanden,
-- één versie. De Supabase-CLI indexeert op versienummer, dus van die twee zag hij
-- er maar één — deze was onzichtbaar en zou nooit uit zichzelf toegepast zijn.
--
-- Dat het toch goed staat in productie is geluk: de kolom is ooit met losse SQL
-- aangemaakt. Op een verse database zou hij ontbroken hebben, en dan valt
-- form_submissions terug op één hoop zonder tenant-scheiding.
--
-- Alles hieronder is IF NOT EXISTS, dus op productie is dit een no-op; het enige
-- effect is dat de migratie eindelijk in de ledger komt te staan.

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS tenant_id text NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_id
  ON form_submissions (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_tenant_created
  ON form_submissions (tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;
