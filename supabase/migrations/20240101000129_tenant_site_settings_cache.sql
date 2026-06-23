-- migration 129 — tenant_site_settings_cache
--
-- Persists the last-known-good RESOLVED site settings (header / footer / nav /
-- logo / locales) per tenant + locale. The public chrome reads this as a
-- durable fallback when the in-memory + Next Data Cache are cold AND the CMS is
-- transiently slow/unreachable — so the nav/logo never degrade to the Statamic
-- starter defaults (the recurring "navigation flip-flop").
--
-- Written on every COMPLETE fetch; read only on the degraded path. Survives cold
-- serverless starts, cache-key bumps, and CMS restarts.

CREATE TABLE IF NOT EXISTS tenant_site_settings_cache (
  tenant_id  TEXT        NOT NULL,
  locale     TEXT        NOT NULL,
  settings   JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, locale)
);
