-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add tenant_id to plan_experiments
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The original plan_experiments table had no tenant_id column, which meant:
--   • listAllPlanExperiments() returned experiments from ALL tenants
--   • getActivePlanExperimentsForRule() could match experiments from other tenants
--     when two tenants happened to use the same rule_id slug
--   • The admin page for any tenant showed every tenant's experiments
--
-- This migration adds tenant_id (NOT NULL with empty-string default for
-- forward-compatibility) and creates the supporting index.
--
-- Backfill: existing rows get tenant_id = '' which effectively scopes them to
-- a "no tenant" bucket that matches nothing in the rule query — safe because
-- they would have been invisible to the rule engine anyway (no tenant_id filter
-- existed before this migration).
--
-- The application layer now always writes a non-empty tenant_id on insert and
-- always filters by tenant_id on reads.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plan_experiments
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';

-- Back-fill is intentionally left as '' (empty string) so that any experiments
-- created before this migration do not incorrectly match any live tenant.
-- Administrators should delete or re-create those experiments after migration.

-- Index to speed up the hot-path query (rule match per tenant).
CREATE INDEX IF NOT EXISTS idx_plan_experiments_tenant_rule_status
  ON public.plan_experiments (tenant_id, rule_id, status)
  WHERE status = 'active';

-- General-purpose admin list index (used by listAllPlanExperiments).
CREATE INDEX IF NOT EXISTS idx_plan_experiments_tenant_id
  ON public.plan_experiments (tenant_id);

COMMENT ON COLUMN public.plan_experiments.tenant_id IS
  'Tenant that owns this experiment. Matches tenantConfig.tenantId. '
  'Used to isolate experiments across tenants and scope hot-path DB queries.';
