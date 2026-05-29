-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: composite primary key on plan_experiments (tenant_id, id)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Problem solved:
--   After adding tenant_id in migration 000120, experiment slugs are still
--   globally unique (primary key was just `id`).  This means:
--     - An experiment named "test" created before tenant isolation blocks
--       any tenant from ever reusing that slug.
--     - Orphaned experiments (tenant_id = '') are invisible in the UI but
--       still occupy the slug namespace.
--
-- Solution:
--   1. Remove orphaned experiments and their assignments.
--   2. Drop the FK from plan_experiment_assignments to plan_experiments(id)
--      — cascade deletes are handled in the application layer instead.
--   3. Drop the old single-column primary key on id.
--   4. Add a composite primary key on (tenant_id, id).
--
-- Application layer change (in plan-experiments-repository.ts):
--   deletePlanExperiment now manually deletes assignments before deleting
--   the experiment, since the FK cascade no longer exists.
--
-- After this migration:
--   - Each tenant has its own slug namespace — "test" can exist in both
--     tenant A and tenant B without conflict.
--   - Slugs remain stable within a tenant — the same session hash is used.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Clean up orphaned assignments (for experiments with tenant_id = '')
DELETE FROM public.plan_experiment_assignments
  WHERE experiment_id IN (
    SELECT id FROM public.plan_experiments WHERE tenant_id = ''
  );

-- Step 2: Clean up orphaned experiments (tenant_id = '' from backfill default)
DELETE FROM public.plan_experiments WHERE tenant_id = '';

-- Step 3: Drop the FK from assignments → plan_experiments(id).
--   After this, cascade deletion is handled by the application.
ALTER TABLE public.plan_experiment_assignments
  DROP CONSTRAINT IF EXISTS plan_experiment_assignments_experiment_fk;

-- Step 4: Drop the old single-column primary key.
ALTER TABLE public.plan_experiments
  DROP CONSTRAINT IF EXISTS plan_experiments_pkey;

-- Step 5: Add composite primary key (tenant_id, id).
--   Slugs are now unique per-tenant, not globally.
ALTER TABLE public.plan_experiments
  ADD CONSTRAINT plan_experiments_pkey PRIMARY KEY (tenant_id, id);

-- Step 6: Keep the old hot-path index valid (rule lookups still work).
--   idx_plan_experiments_tenant_rule_status was created in migration 000120
--   and covers (tenant_id, rule_id, status) WHERE status = 'active' — no change needed.

COMMENT ON CONSTRAINT plan_experiments_pkey ON public.plan_experiments IS
  'Composite primary key: slug IDs are unique per tenant, not globally.';
