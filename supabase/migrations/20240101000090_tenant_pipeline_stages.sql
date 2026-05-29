-- =============================================================================
--  Migration 090 — Tenant Enrichment Pipeline Stage Configuration
-- =============================================================================
--
--  Stores per-tenant ordering and activation state for each enrichment pipeline
--  stage.  When a row is present, the admin has explicitly configured that
--  stage; when absent, the pipeline falls back to the hardcoded default order
--  defined in buildCompanyCrmChain().
--
--  ── Columns ──────────────────────────────────────────────────────────────────
--
--    tenant_id  — FK to public.tenants.id (CASCADE on delete)
--    stage_key  — One of the keys in PIPELINE_STAGE_REGISTRY
--                 (maxmind | ipinfo | ga4 | reverse-geo | weather |
--                  openkvk | leadinfo | hubspot | seasonal)
--    position   — Sort order within the stage's wave group (1-indexed).
--                 Lower position = runs earlier (within the wave).
--                 Wave assignment itself is fixed by dependency constraints.
--    enabled    — When false, the stage is omitted from the pipeline entirely
--                 (credentials are irrelevant — the stage never runs).
--    updated_at — Last write timestamp; used for conflict resolution.
--
--  ── Constraints ──────────────────────────────────────────────────────────────
--
--    PRIMARY KEY (tenant_id, stage_key) — one config row per stage per tenant.
--    CHECK (position >= 1)             — positions are 1-indexed.
--
--  ── RLS ──────────────────────────────────────────────────────────────────────
--
--    This table is only read/written by server-side admin routes using the
--    service-role client.  RLS is enabled but all policies deny public access.
--
-- =============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_pipeline_stages (
  tenant_id   text        NOT NULL,
  stage_key   text        NOT NULL,
  position    integer     NOT NULL DEFAULT 1,
  enabled     boolean     NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_pipeline_stages_pkey
    PRIMARY KEY (tenant_id, stage_key),

  CONSTRAINT tenant_pipeline_stages_position_positive
    CHECK (position >= 1)
);

COMMENT ON TABLE public.tenant_pipeline_stages IS
  'Per-tenant enrichment pipeline stage configuration: ordering and activation state.';

COMMENT ON COLUMN public.tenant_pipeline_stages.stage_key IS
  'Stage key from PIPELINE_STAGE_REGISTRY — e.g. "maxmind", "ipinfo", "ga4".';
COMMENT ON COLUMN public.tenant_pipeline_stages.position IS
  'Sort position within the stage wave group (1-indexed). Lower = runs first.';
COMMENT ON COLUMN public.tenant_pipeline_stages.enabled IS
  'When false the stage is excluded from the pipeline regardless of credentials.';

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Fast retrieval of all stages for a tenant, pre-sorted by position.
CREATE INDEX IF NOT EXISTS tenant_pipeline_stages_tenant_position_idx
  ON public.tenant_pipeline_stages (tenant_id, position);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all admin routes use the service role client.
-- Public access is fully denied (no public policies).

-- ── Updated-at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_tenant_pipeline_stages_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_tenant_pipeline_stages
  ON public.tenant_pipeline_stages;

CREATE TRIGGER set_updated_at_tenant_pipeline_stages
  BEFORE UPDATE ON public.tenant_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_pipeline_stages_updated_at();
