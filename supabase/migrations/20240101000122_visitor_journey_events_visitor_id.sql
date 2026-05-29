-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0122 — visitor_journey_events: visitor_id column (nullable)
--
-- Problem:
--   The live database has a `visitor_id uuid NOT NULL` column on
--   visitor_journey_events that was added outside the migration system
--   (schema drift).  The application code never sets visitor_id in the
--   INSERT row — when available it only stores it inside the `metadata`
--   JSONB — so every insert fails with:
--
--     null value in column "visitor_id" of relation "visitor_journey_events"
--     violates not-null constraint
--
--   Journey events are silently discarded, causing complete data loss for
--   visitor behaviour tracking and A/B experiment assignments.
--
-- Fix (two steps):
--   1. Ensure the column exists as nullable.  If it already exists as
--      NOT NULL, drop the constraint.  If it doesn't exist yet, add it as
--      nullable so the insert code can omit it without error.
--   2. After this migration, record-event.ts also writes visitor_id
--      directly into the row when the caller provides one, so the column
--      is populated whenever the visitor UUID is known.
--
-- Safe to re-run: all statements are guarded by IF EXISTS / IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add the column as nullable if it does not already exist.
ALTER TABLE public.visitor_journey_events
  ADD COLUMN IF NOT EXISTS visitor_id uuid NULL;

-- Step 2: If the column exists but carries a NOT NULL constraint, drop it.
--   (When the column was just added above this is a no-op because the
--   newly-added column is already nullable.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'visitor_journey_events'
      AND  column_name  = 'visitor_id'
      AND  is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.visitor_journey_events
      ALTER COLUMN visitor_id DROP NOT NULL;
    RAISE NOTICE 'visitor_journey_events.visitor_id: NOT NULL constraint dropped';
  ELSE
    RAISE NOTICE 'visitor_journey_events.visitor_id: already nullable — skipped';
  END IF;
END $$;

-- Step 3: Index for cross-session visitor lookups.
--   Partial index (WHERE visitor_id IS NOT NULL) keeps the index small —
--   most rows recorded by server-side events will have a NULL visitor_id.
CREATE INDEX IF NOT EXISTS idx_journey_events_visitor_id
  ON public.visitor_journey_events (visitor_id, tenant_id, occurred_at DESC)
  WHERE visitor_id IS NOT NULL;

COMMENT ON COLUMN public.visitor_journey_events.visitor_id IS
  'Stable visitor UUID from the mc_visitor_id localStorage key. '
  'Identifies the same physical visitor across multiple browser sessions. '
  'NULL for server-side events and old clients that do not send a visitor UUID.';
