-- ── add_tags_to_interest_profiles ─────────────────────────────────────────────
--
-- The initial `create_interest_profiles` migration may have been applied to
-- databases that were created before the `tags` column was added to the schema.
-- `CREATE TABLE IF NOT EXISTS` silently skips the statement when the table
-- already exists, leaving any missing columns absent.
--
-- This migration adds the `tags` column idempotently so that existing deployments
-- that have the table but lack the column are brought back in sync with the
-- current schema expected by:
--   interest-profiles/repository.ts  — reads and writes row.tags
--   interest-profiles/scoring.ts     — iterates tag keyword/weight pairs
--   app/admin/interest-profiles/     — displays and edits tags in the admin UI
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.interest_profiles
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]';
