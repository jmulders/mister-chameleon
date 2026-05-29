-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create tenant_settings table
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Replaces the file-based tenant/tenants.json store with a Supabase-backed
-- table.  Each row holds the full TenantSettings object for one tenant as
-- JSONB, enabling live updates without a code deploy and making the platform
-- safe for Vercel / serverless deployments where the filesystem is read-only.
--
-- ─── Column reference ────────────────────────────────────────────────────────
--
--   tenant_id    — matches TenantSettings.tenantId; text PK (e.g. "workengine")
--   settings     — full TenantSettings object serialised as JSONB
--   updated_at   — last write timestamp; maintained by the application layer
--
-- ─── Reads and writes ────────────────────────────────────────────────────────
--
--   All access is via the server-side service-role key (bypasses RLS).
--
--   Tenant lookup by domain / slug is performed in application code by
--   fetching all rows and filtering JS-side — the expected tenant count
--   (< 100) makes this efficient without requiring extracted columns.
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id  text        NOT NULL,
  settings   jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_settings_pkey PRIMARY KEY (tenant_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- GIN index for fast JSONB key lookups (e.g. slug, primaryDomain searches).
CREATE INDEX IF NOT EXISTS idx_tenant_settings_settings_gin
  ON public.tenant_settings USING gin (settings);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Only the service-role key may read or write this table.
-- No anon or authenticated policies are created intentionally.

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE  public.tenant_settings            IS 'One row per platform tenant. Stores the full TenantSettings object as JSONB. Replaces the local tenant/tenants.json file store.';
COMMENT ON COLUMN public.tenant_settings.tenant_id  IS 'Stable tenant slug (TenantSettings.tenantId), e.g. "workengine".';
COMMENT ON COLUMN public.tenant_settings.settings   IS 'Full TenantSettings object serialised as JSONB. Validated and package-enforced before write.';
COMMENT ON COLUMN public.tenant_settings.updated_at IS 'Last write timestamp, set by the application layer on every upsert.';

-- ── Seed: platform owner tenant ───────────────────────────────────────────────
--
-- Insert the Mister Chameleon platform tenant as the initial row.
-- Uses INSERT … ON CONFLICT DO NOTHING so re-running the migration is safe.
--
-- Wrapped in a DO block so it handles environments where an `id` column has
-- already been added to tenant_settings (e.g. by migration 000015 in a prior
-- push).  When `id` exists the INSERT supplies it explicitly; when it does not
-- exist the INSERT omits it.  Both branches use ON CONFLICT DO NOTHING so the
-- block is idempotent whether or not the row already exists.

DO $$
DECLARE
  _settings jsonb := '{
    "tenantId":   "mister-chameleon",
    "packageKey": "pro",
    "features": {
      "experiments": true,
      "ai":          true,
      "analytics":   true
    },
    "blocks": {
      "context": ["hero", "proof", "cta"],
      "content": ["textSection", "featureGrid", "testimonialSection", "faqSection", "ctaSection"]
    },
    "ai": {
      "mode": "disabled"
    },
    "cms": {
      "provider":  "sanity",
      "projectId": "placeholder",
      "dataset":   "production"
    },
    "design": {
      "theme": "default"
    },
    "name": "Mister Chameleon"
  }'::jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'tenant_settings'
      AND  column_name  = 'id'
  ) THEN
    -- id column present: supply it to avoid NOT NULL violation
    INSERT INTO public.tenant_settings (id, tenant_id, settings, updated_at)
    VALUES ('mister-chameleon', 'mister-chameleon', _settings, now())
    ON CONFLICT (tenant_id) DO NOTHING;
  ELSE
    -- id column absent (fresh env, pre-migration-015): omit it
    INSERT INTO public.tenant_settings (tenant_id, settings, updated_at)
    VALUES ('mister-chameleon', _settings, now())
    ON CONFLICT (tenant_id) DO NOTHING;
  END IF;
END $$;
