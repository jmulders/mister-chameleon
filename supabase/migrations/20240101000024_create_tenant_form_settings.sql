-- ── tenant_form_settings ──────────────────────────────────────────────────────
--
-- Stores tenant-level configuration for form submissions.
-- One row per tenant, keyed by tenant_id.
--
-- Each row holds a JSONB `settings` column that maps to TenantFormSettings in
-- tenant/types.ts.  Defaults are applied in application code (not the DB) so
-- the JSON schema can evolve without migrations.
--
-- Consumed by:
--   forms/load-tenant-form-settings.ts  — server-only loader (cached per request)
--   app/admin/tenants/[tenantId]/forms/actions.ts  — read/write server actions
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_form_settings (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id  text        NOT NULL,
  settings   jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_form_settings_pkey         PRIMARY KEY (id),
  CONSTRAINT tenant_form_settings_tenant_id_key UNIQUE (tenant_id)
);

-- Index for fast tenant_id lookups.
CREATE INDEX IF NOT EXISTS tenant_form_settings_tenant_id_idx
  ON public.tenant_form_settings (tenant_id);

-- Enable Row Level Security (mirrors the pattern used by other tenant tables).
ALTER TABLE public.tenant_form_settings ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS.
-- Application reads/writes use the service role key (server-only routes).
