-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0029 — Align behavior_scoring_rules schema
--
-- Problem:  Migration 0028 created behavior_scoring_rules with `label` and
--           `score` columns.  The application code was written against
--           `name` (not `label`) and `base_score` (not `score`), producing
--           "column not found in schema cache" errors on every save.
--
-- Changes:
--   1. Rename `label`  → `name`       (human-readable rule display name)
--   2. Rename `score`  → `base_score` (intent points before decay is applied)
--   3. Add   `key`              text NULL          (machine-readable tenant-scoped key)
--   4. Add   `description`     text NULL          (longer admin-UI description)
--   5. Add   `page_category`   text NULL          (optional page-category filter)
--   6. Add   `is_active`       boolean NOT NULL DEFAULT true
--   7. Add   `priority`        integer NOT NULL DEFAULT 100  (lower = evaluated first)
--
-- Seed data:  Updates the demo-tenant rows in-place (matched by tenant+event
--             combination) to populate the new `key` field with stable slugs.
--
-- Safe to re-run:  all statements use IF EXISTS / IF NOT EXISTS / DO NOTHING.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Rename columns (safe: RENAME is transactional in Postgres)
--
-- Guard: only rename label→name when label exists AND name does not yet exist.
-- This handles the case where the table was created with `name` directly (e.g.
-- if migration 028 was updated in place after the initial apply), leaving both
-- columns present on some DB instances.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'behavior_scoring_rules'
      AND column_name  = 'label'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'behavior_scoring_rules'
      AND column_name  = 'name'
  ) THEN
    ALTER TABLE behavior_scoring_rules RENAME COLUMN label TO name;
  END IF;
END $$;

-- Guard: only rename score→base_score when score exists AND base_score does not.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'behavior_scoring_rules'
      AND column_name  = 'score'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'behavior_scoring_rules'
      AND column_name  = 'base_score'
  ) THEN
    ALTER TABLE behavior_scoring_rules RENAME COLUMN score TO base_score;
  END IF;
END $$;

-- 2. Add new columns (idempotent: ADD COLUMN IF NOT EXISTS)
ALTER TABLE behavior_scoring_rules
  ADD COLUMN IF NOT EXISTS key           text        NULL,
  ADD COLUMN IF NOT EXISTS description   text        NULL,
  ADD COLUMN IF NOT EXISTS page_category text        NULL,
  ADD COLUMN IF NOT EXISTS is_active     boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS priority      integer     NOT NULL DEFAULT 100;

-- 3. Refresh column comments (replaces old `score` / `label` comments)
--    Wrapped in DO blocks so they survive even if a column doesn't exist yet.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='name') THEN
    COMMENT ON COLUMN behavior_scoring_rules.name
      IS 'Human-readable display name shown in the admin UI.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='key') THEN
    COMMENT ON COLUMN behavior_scoring_rules.key
      IS 'Optional machine-readable key, unique per tenant. Used for programmatic references.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='description') THEN
    COMMENT ON COLUMN behavior_scoring_rules.description
      IS 'Optional longer description shown as a tooltip or helper text in admin UI.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='base_score') THEN
    COMMENT ON COLUMN behavior_scoring_rules.base_score
      IS 'Base intent score added by this event (before decay multiplier is applied).';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='page_category') THEN
    COMMENT ON COLUMN behavior_scoring_rules.page_category
      IS 'Optional filter: rule only fires when the event page_category matches this value.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='is_active') THEN
    COMMENT ON COLUMN behavior_scoring_rules.is_active
      IS 'When false the rule is skipped during scoring even if it would otherwise match.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='behavior_scoring_rules' AND column_name='priority') THEN
    COMMENT ON COLUMN behavior_scoring_rules.priority
      IS 'Evaluation order hint for the admin UI; lower numbers appear first (default 100).';
  END IF;
END $$;

-- 4. Add index on priority for ordered admin queries
--    The index uses `name` (post-rename) or `label` (pre-rename) depending on
--    which column exists, so it survives both the old and new schema.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'behavior_scoring_rules'
      AND indexname  = 'idx_scoring_rules_tenant_priority'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'behavior_scoring_rules'
        AND column_name  = 'name'
    ) THEN
      CREATE INDEX idx_scoring_rules_tenant_priority
        ON behavior_scoring_rules(tenant_id, priority, name);
    ELSE
      CREATE INDEX idx_scoring_rules_tenant_priority
        ON behavior_scoring_rules(tenant_id, priority);
    END IF;
  END IF;
END $$;

-- 5. Back-fill `key` for the demo-tenant seed rows
-- Wrapped in DO blocks to silently skip if a UNIQUE constraint already
-- prevents the update (e.g. duplicate rows from a previous migration run).
DO $$
BEGIN
  UPDATE behavior_scoring_rules
  SET key = 'pricing_page_view', priority = 10
  WHERE tenant_id = 'mister-chameleon'
    AND event_type = 'page_view'
    AND event_value = '/pricing'
    AND key IS NULL;
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

DO $$
BEGIN
  UPDATE behavior_scoring_rules
  SET key = 'case_study_page_view', priority = 20
  WHERE tenant_id = 'mister-chameleon'
    AND event_type = 'page_view'
    AND event_value = '/cases'
    AND key IS NULL;
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

DO $$
BEGIN
  UPDATE behavior_scoring_rules
  SET key = 'form_interaction_started', priority = 30
  WHERE tenant_id = 'mister-chameleon'
    AND event_type = 'form_start'
    AND event_value IS NULL
    AND key IS NULL;
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

DO $$
BEGIN
  UPDATE behavior_scoring_rules
  SET key = 'form_submitted', priority = 40
  WHERE tenant_id = 'mister-chameleon'
    AND event_type = 'form_submit'
    AND event_value IS NULL
    AND key IS NULL;
EXCEPTION WHEN unique_violation THEN NULL;
END $$;
