-- Migration 168: Snippet consent source (migrate existing tenants to "always")
--
-- Host-CMP consent alignment introduces snippet.consentSource on TenantSettings:
--   "auto"   -> deny by default when the host sends no consent signal (new tenants)
--   "always" -> grant by default (hosts that gate loading behind their own banner)
--
-- Code treats an ABSENT consentSource as "auto" (deny-by-default). To avoid
-- existing snippet tenants suddenly losing enrichment/personalization/analytics
-- when no host signal is present, migrate every tenant that already has the
-- snippet enabled to an explicit "always". New tenants (created after this
-- migration) keep the unset -> "auto" privacy-first default.
--
-- Data-only, idempotent: only rows with snippet.enabled = true and no existing
-- consentSource are touched. Safe to re-run.

UPDATE tenant_settings
SET settings = jsonb_set(
  settings,
  '{snippet,consentSource}',
  '"always"'::jsonb,
  true
)
WHERE (settings -> 'snippet' ->> 'enabled') = 'true'
  AND (settings -> 'snippet' ->> 'consentSource') IS NULL;
