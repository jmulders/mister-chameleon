-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create tenant_form_overrides
--
-- Stores per-form configuration overrides for a tenant.
--
-- ─── Purpose ──────────────────────────────────────────────────────────────────
--
--   Fills the gap between the platform-level form definition (code) and the
--   tenant-level form settings (tenant_form_settings).  Allows fine-grained
--   per-form control: enable/disable notify, confirm, or store independently
--   for each registered form key, and optionally override recipients and
--   email subject/sender for that specific form.
--
-- ─── Resolution order ────────────────────────────────────────────────────────
--
--   form-level override (this table, when override_enabled = true)
--     → tenant default (tenant_form_settings)
--     → platform default
--     → env var fallback
--     → system hardcoded default
--
-- ─── Schema ───────────────────────────────────────────────────────────────────
--
--   id         uuid PK
--   tenant_id  text NOT NULL  — stable tenant slug (e.g. "mister-chameleon")
--   form_key   text NOT NULL  — registered form key (e.g. "contact", "application")
--   overrides  jsonb NOT NULL — serialised TenantFormOverrideSettings
--   updated_at timestamptz    — set automatically by the trigger below
--
-- ─── overrides JSONB shape ────────────────────────────────────────────────────
--
--   {
--     "overrideEnabled":   boolean,   // master toggle
--     "notifyEnabled":     boolean,   // override notifyBackoffice
--     "confirmEnabled":    boolean,   // override sendConfirmation
--     "storeEnabled":      boolean,   // override storeSubmissions
--     "customRecipients":  string[],  // replace tenant-level recipients
--     "customSubject":     string,    // override backoffice email subject
--     "customSenderName":  string     // override From display name
--   }
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_form_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text        NOT NULL,
  form_key    text        NOT NULL,
  overrides   jsonb       NOT NULL DEFAULT '{}',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one row per (tenant, form) pair.
CREATE UNIQUE INDEX IF NOT EXISTS tenant_form_overrides_tenant_form_key
  ON public.tenant_form_overrides (tenant_id, form_key);

-- Auto-update updated_at on row changes.
CREATE OR REPLACE FUNCTION public.set_tenant_form_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_form_overrides_updated_at
  ON public.tenant_form_overrides;

CREATE TRIGGER trg_tenant_form_overrides_updated_at
  BEFORE UPDATE ON public.tenant_form_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_form_overrides_updated_at();
