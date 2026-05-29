-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 077: Site initialization tables
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Creates three tables that back the initializeSite() system:
--
--   tenant_sites       — one row per tenant; records the chosen blueprint,
--                        theme, and site-type key after first-time setup.
--                        status: draft | active | archived
--
--   tenant_site_setup  — intake form data captured during the setup wizard,
--                        plus a setup_status flag so the admin UI can show
--                        completion state.
--                        setup_status: pending | in_progress | completed | failed
--
--   site_navigation    — DB-backed navigation items written by initializeSite()
--                        from the blueprint's page list.  Used as the fallback
--                        nav source when the CMS has not yet published
--                        site settings (i.e. Sanity mainNavigation is empty).
--
-- ─── Relationship to existing tables ─────────────────────────────────────────
--
--   pages              (migration 011) — content pages, keyed by (tenant_id, slug).
--                      initializeSite() upserts rows here from blueprint pages.
--
--   tenant_settings    — stores design.theme; initializeSite() writes themeKey
--                        here (in addition to tenant_sites.theme_key) so the
--                        runtime theme cascade activates immediately.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   All CREATE TABLE / CREATE INDEX statements use IF NOT EXISTS.
--   Repeated migrations are safe.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A: tenant_sites ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_sites (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      text        NOT NULL,

  -- Blueprint/industry key, e.g. "b2b_saas", "careers", "ecommerce".
  site_type_key  text        NOT NULL DEFAULT '',

  -- Active theme preset key, e.g. "corporate-blue".  Mirrors
  -- tenant_settings.settings.design.theme at initialization time.
  theme_key      text,

  -- Blueprint key used to generate this site, e.g. "b2b_saas".
  -- May differ from site_type_key when a custom blueprint is applied.
  blueprint_key  text,

  -- Lifecycle status.
  --   draft    — initialization in progress or incomplete.
  --   active   — site is live and fully initialized.
  --   archived — site has been superseded or decommissioned.
  status         text        NOT NULL DEFAULT 'draft',

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_sites_pkey           PRIMARY KEY (id),
  -- One site record per tenant.
  CONSTRAINT tenant_sites_tenant_id_uq   UNIQUE (tenant_id)
);

-- Backfill any columns missing on a pre-existing tenant_sites table.
ALTER TABLE public.tenant_sites
  ADD COLUMN IF NOT EXISTS site_type_key  text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS theme_key      text,
  ADD COLUMN IF NOT EXISTS blueprint_key  text,
  ADD COLUMN IF NOT EXISTS status         text        NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  COMMENT ON TABLE  public.tenant_sites              IS 'One row per tenant site — records the blueprint, theme, and status after initializeSite() runs.';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_sites.site_type_key IS 'Industry/blueprint key chosen during the setup wizard, e.g. "b2b_saas".';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_sites.theme_key     IS 'Theme preset key active at initialization time.  Kept in sync with tenant_settings.design.theme.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_sites.blueprint_key IS 'Blueprint key applied during initializeSite().  May equal site_type_key or refer to a custom blueprint.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_sites.status        IS 'draft | active | archived.  Set to "active" once initialization completes successfully.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_sites_tenant_id
  ON public.tenant_sites (tenant_id);

ALTER TABLE public.tenant_sites ENABLE ROW LEVEL SECURITY;

-- ── B: tenant_site_setup ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_site_setup (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id          text        NOT NULL,

  -- Setup lifecycle flag.
  --   pending      — wizard not yet started.
  --   in_progress  — wizard started but not submitted.
  --   completed    — initializeSite() ran successfully.
  --   failed       — initializeSite() ran but ended with a fatal error.
  setup_status       text        NOT NULL DEFAULT 'pending',

  -- Timestamp of the last successful initializeSite() run.
  initialized_at     timestamptz,

  -- ── Intake fields (from the setup wizard form) ───────────────────────────
  company_name       text,
  description        text,
  target_audience    text,
  tone_of_voice      text,
  primary_cta_label  text,

  -- Optional: URL of an existing site to analyze for inspiration.
  reference_url      text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_site_setup_pkey         PRIMARY KEY (id),
  -- One setup row per tenant.
  CONSTRAINT tenant_site_setup_tenant_id_uq UNIQUE (tenant_id)
);

-- Backfill any columns missing on a pre-existing tenant_site_setup table.
ALTER TABLE public.tenant_site_setup
  ADD COLUMN IF NOT EXISTS setup_status       text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS initialized_at     timestamptz,
  ADD COLUMN IF NOT EXISTS company_name       text,
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS target_audience    text,
  ADD COLUMN IF NOT EXISTS tone_of_voice      text,
  ADD COLUMN IF NOT EXISTS primary_cta_label  text,
  ADD COLUMN IF NOT EXISTS reference_url      text,
  ADD COLUMN IF NOT EXISTS created_at         timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at         timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  COMMENT ON TABLE  public.tenant_site_setup IS 'Intake data and setup status for the site initialization wizard.  One row per tenant.';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.setup_status      IS 'pending | in_progress | completed | failed.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.initialized_at    IS 'Timestamp of the most recent successful initializeSite() run.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.company_name      IS 'Operator-supplied company name; used as the seed for hero / CTA content generation.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.description       IS 'One-paragraph description of what the company does.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.target_audience   IS 'Describes the ideal visitor / customer segment.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.tone_of_voice     IS 'Writing style guide, e.g. "professional", "friendly", "technical".';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.primary_cta_label IS 'Label for the primary call-to-action button, e.g. "Book a demo".';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.tenant_site_setup.reference_url     IS 'Optional existing website URL analyzed for branding inspiration.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_site_setup_tenant_id
  ON public.tenant_site_setup (tenant_id);

ALTER TABLE public.tenant_site_setup ENABLE ROW LEVEL SECURITY;

-- ── C: site_navigation ────────────────────────────────────────────────────────
--
-- DB-backed navigation items written by initializeSite() from the blueprint's
-- page list.  The Header component reads these as a fallback when the CMS
-- (Sanity) has not yet published mainNavigation entries.
--
-- Structure supports two levels:
--   Top-level items:  parent_id IS NULL
--   Child items:      parent_id references the parent row's id

CREATE TABLE IF NOT EXISTS public.site_navigation (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    text        NOT NULL,

  -- Display label for the nav link, e.g. "Pricing".
  label        text        NOT NULL,

  -- Resolved href — root-relative for internal pages ("/pricing"),
  -- full URL for external links.
  href         text        NOT NULL,

  -- Sort order within the same level (parent_id group).
  order_index  integer     NOT NULL DEFAULT 0,

  -- NULL for top-level items; references parent row for nested items.
  parent_id    uuid        REFERENCES public.site_navigation(id)
               ON DELETE CASCADE,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT site_navigation_pkey PRIMARY KEY (id)
);

-- Backfill any columns missing on a pre-existing site_navigation table.
ALTER TABLE public.site_navigation
  ADD COLUMN IF NOT EXISTS label        text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS href         text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_index  integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  COMMENT ON TABLE  public.site_navigation IS 'DB-backed nav items written by initializeSite() from the blueprint page list.  Header falls back here when CMS nav is empty.';
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.site_navigation.label       IS 'Display text for the nav link.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.site_navigation.href        IS 'Root-relative path for internal pages ("/pricing") or full URL for external links.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.site_navigation.order_index IS 'Sort order within the same level; lower = rendered first.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$
BEGIN
  COMMENT ON COLUMN public.site_navigation.parent_id   IS 'NULL for top-level items; UUID of the parent row for nested/dropdown items.';
EXCEPTION WHEN undefined_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_site_navigation_tenant_id
  ON public.site_navigation (tenant_id);

CREATE INDEX IF NOT EXISTS idx_site_navigation_tenant_order
  ON public.site_navigation (tenant_id, order_index)
  WHERE parent_id IS NULL;

ALTER TABLE public.site_navigation ENABLE ROW LEVEL SECURITY;

-- ── D: Notify PostgREST to reload schema ─────────────────────────────────────

NOTIFY pgrst, 'reload schema';
