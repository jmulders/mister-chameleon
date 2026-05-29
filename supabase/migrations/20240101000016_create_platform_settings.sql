-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create platform_settings table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Stores platform-wide integration secrets and provider configuration as JSONB.
-- Replaces the need for environment variables to hold secrets that operators
-- may need to update at runtime without a redeployment.
--
-- ─── Design ───────────────────────────────────────────────────────────────────
--
--   The table uses a `key` column (text PK) so that each integration section
--   (sanity, maxmind, ai, vercel) is stored as an independent row.  This makes
--   partial updates safe — saving Sanity credentials never touches the Vercel
--   row, and adding new integrations requires no schema change.
--
--   For the current implementation, the application reads and writes rows with
--   well-known keys:
--
--     'sanity'   — Sanity CMS: projectId, dataset, writeToken
--     'maxmind'  — MaxMind: accountId, licenseKey  (future)
--     'ai'       — AI providers: anthropicKey, openaiKey  (future)
--     'vercel'   — Vercel Domains API: apiToken, teamId  (future)
--
-- ─── Security ─────────────────────────────────────────────────────────────────
--
--   Row Level Security is enabled.  Only the service-role key may read or write
--   this table — the anon key used by the browser client has no access.
--
--   Application code must NEVER return `value` column contents to the client.
--   Boolean presence flags (e.g. `hasSanityWriteToken`) are surfaced instead.
--
-- ─── Column reference ─────────────────────────────────────────────────────────
--
--   key        — integration name / section key; PK
--   value      — full settings blob serialised as JSONB (may include secrets)
--   updated_at — last write timestamp; maintained by the application layer
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key        text        NOT NULL,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT platform_settings_pkey PRIMARY KEY (key)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Only the service-role key may read or write this table.

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.platform_settings           IS 'Stores platform-wide integration secrets and provider config as JSONB. One row per integration section (sanity, maxmind, ai, vercel). Contents must never be returned to the browser client.';
COMMENT ON COLUMN public.platform_settings.key       IS 'Integration section name, e.g. "sanity" | "maxmind" | "ai" | "vercel".';
COMMENT ON COLUMN public.platform_settings.value     IS 'Full settings blob serialised as JSONB. May contain API keys and secrets. NEVER serialise to the client — surface boolean flags only.';
COMMENT ON COLUMN public.platform_settings.updated_at IS 'Last write timestamp, set server-side on every upsert.';

-- No seed rows — the application falls back to empty / unconfigured state when
-- a row is absent, and the UI shows the appropriate "not configured" indicator.
