-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fix tenant_settings id column
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Background
-- ──────────
-- The original migration (000009) defined tenant_settings with three columns:
--   tenant_id (PK), settings (jsonb), updated_at.
-- No `id` column was defined.
--
-- In some environments the Supabase dashboard added an `id` column to the
-- table after it was created (the dashboard appends `id` to tables it
-- manages).  Depending on how it was added, the column may be:
--
--   (a) uuid NOT NULL, no DEFAULT  — dashboard-generated; can't store slugs
--   (b) text NOT NULL, no DEFAULT  — manually added to mirror tenant_id
--   (c) absent entirely            — fresh env; only ran the original migration
--
-- The application now always writes `id = tenantId` (the text slug, e.g.
-- "mister-chameleon") in every INSERT/UPSERT.  This migration ensures the
-- column exists as `text NOT NULL` and backfills any existing NULL values from
-- `tenant_id` so the write path never hits a NOT NULL constraint violation.
--
-- Cases handled
-- ─────────────
--   (a) id exists as uuid  → DROP and re-add as text; backfill from tenant_id
--   (b) id exists as text  → backfill any NULL rows; ensure NOT NULL
--   (c) id does not exist  → ADD COLUMN text NOT NULL (backfill not needed;
--                             the seed row from 000009 gets id via this ALTER)
--
-- This migration is idempotent — re-running it is safe in all cases.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  col_type text;
BEGIN

  -- ── Determine current state of the id column ────────────────────────────────
  SELECT data_type
  INTO   col_type
  FROM   information_schema.columns
  WHERE  table_schema = 'public'
    AND  table_name   = 'tenant_settings'
    AND  column_name  = 'id';

  -- ── Case (a): id exists as uuid ─────────────────────────────────────────────
  -- The Supabase dashboard uses uuid for auto-generated id columns.
  -- A uuid column cannot store text slugs like "mister-chameleon", so we
  -- drop it and re-add it as text.  The column is NOT the primary key
  -- (tenant_id is), so dropping it does not break any FK relationships.
  IF col_type = 'uuid' THEN
    ALTER TABLE public.tenant_settings DROP COLUMN id;
    ALTER TABLE public.tenant_settings ADD COLUMN id text;
    UPDATE public.tenant_settings SET id = tenant_id WHERE id IS NULL;
    ALTER TABLE public.tenant_settings ALTER COLUMN id SET NOT NULL;
    RAISE NOTICE 'tenant_settings.id: replaced uuid column with text NOT NULL, backfilled from tenant_id';

  -- ── Case (b): id exists as text ─────────────────────────────────────────────
  -- Column is the correct type.  Backfill any NULL values that may have been
  -- written before the application started providing the id explicitly, then
  -- ensure the NOT NULL constraint is present.
  ELSIF col_type = 'text' THEN
    UPDATE public.tenant_settings SET id = tenant_id WHERE id IS NULL OR id = '';
    -- Only add NOT NULL if it isn't already there (ALTER is idempotent on PG).
    BEGIN
      ALTER TABLE public.tenant_settings ALTER COLUMN id SET NOT NULL;
    EXCEPTION WHEN others THEN
      -- Constraint may already exist; ignore.
      NULL;
    END;
    RAISE NOTICE 'tenant_settings.id: text column verified, any NULL values backfilled from tenant_id';

  -- ── Case (c): id does not exist ─────────────────────────────────────────────
  -- Fresh environment: column was never created.  Add it as text NOT NULL with
  -- a DEFAULT so the seed row from 000009 (which pre-dates this column) gets a
  -- value without requiring an explicit backfill step.
  ELSE
    ALTER TABLE public.tenant_settings
      ADD COLUMN id text NOT NULL DEFAULT '';
    -- Backfill the empty-string default with the real tenant slug.
    UPDATE public.tenant_settings SET id = tenant_id WHERE id = '';
    -- Remove the DEFAULT now that existing rows are populated; new rows
    -- will always be inserted by the application with an explicit id value.
    ALTER TABLE public.tenant_settings ALTER COLUMN id DROP DEFAULT;
    RAISE NOTICE 'tenant_settings.id: column added as text NOT NULL, backfilled from tenant_id';
  END IF;

END $$;
