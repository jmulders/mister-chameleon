-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0030 — Harden behavior_scoring_rules.key column
--
-- Problem:  In some environments the `key` column was created (or altered) as
--           NOT NULL, causing inserts and updates that omit `key` to fail with:
--             "null value in column 'key' of relation 'behavior_scoring_rules'
--              violates not-null constraint"
--
-- Changes:
--   1. Ensure the `key` column exists and is nullable.  If it does not exist
--      yet (migration 0029 was skipped) the column is added as NULL.
--      If it already exists as NOT NULL the constraint is dropped.
--   2. Back-fill any NULL values by slugifying the `name` column so that
--      existing rows are not left with a null key after the constraint change.
--
-- Safe to re-run:  all statements use IF (NOT) EXISTS / idempotent patterns.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Add `key` if it does not exist at all (migration 0029 may not have run)
ALTER TABLE behavior_scoring_rules
  ADD COLUMN IF NOT EXISTS key text NULL;

-- 1b. Drop NOT NULL constraint if present — makes key explicitly nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name  = 'behavior_scoring_rules'
      AND column_name = 'key'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE behavior_scoring_rules ALTER COLUMN key DROP NOT NULL;
  END IF;
END $$;

-- 2. Back-fill NULL keys from name (slug-safe: lower-case, non-alnum → "_")
--    Rows with an empty string are also treated as missing.
--    Wrapped in a DO block: if `name` doesn't exist yet (migration 029's rename
--    was rolled back due to a later error in the same run), fall back to `label`.
DO $$
BEGIN
  UPDATE behavior_scoring_rules
  SET key = lower(
              regexp_replace(
                coalesce(nullif(trim(name), ''), 'rule'),
                '[^a-z0-9]+',
                '_',
                'gi'
              )
            )
  WHERE key IS NULL OR key = '';
EXCEPTION WHEN undefined_column THEN
  BEGIN
    UPDATE behavior_scoring_rules
    SET key = lower(
                regexp_replace(
                  coalesce(nullif(trim(label), ''), 'rule'),
                  '[^a-z0-9]+',
                  '_',
                  'gi'
                )
              )
    WHERE key IS NULL OR key = '';
  EXCEPTION WHEN undefined_column OR unique_violation THEN NULL;
  END;
END $$;

-- 3. Refresh column comment
COMMENT ON COLUMN behavior_scoring_rules.key
  IS 'Optional machine-readable slug, unique per tenant.  NULL is allowed — the '
     'admin UI auto-generates one from name when left blank.';
