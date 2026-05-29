-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0031: Add client-generated event_id to visitor_journey_events
--
-- Adds a stable UUID that the client generates *before* sending the event,
-- so the same event can be deduplicated across:
--   1. The optimistic local store (window.__journey)
--   2. The persisted DB event log (visitor_journey_events)
--
-- Backward-compatible: existing rows receive a random UUID via DEFAULT.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add event_id column.
-- DEFAULT gen_random_uuid() back-fills every existing row atomically;
-- new rows without an explicit event_id also get one automatically.
ALTER TABLE visitor_journey_events
  ADD COLUMN IF NOT EXISTS event_id UUID NOT NULL DEFAULT gen_random_uuid();

-- Unique index — guarantees that a client-generated UUID is never stored twice.
-- Uses a conditional block so the migration is idempotent on re-runs.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'visitor_journey_events'
      AND indexname  = 'visitor_journey_events_event_id_key'
  ) THEN
    CREATE UNIQUE INDEX visitor_journey_events_event_id_key
      ON visitor_journey_events (event_id);
  END IF;
END $$;

-- Supporting composite index for merge-dedup lookups:
--   SELECT event_id FROM visitor_journey_events
--   WHERE tenant_id = $1 AND session_id = $2
-- Used by /api/journey/state to return event_ids so the client can mark
-- local events as synced.
CREATE INDEX IF NOT EXISTS visitor_journey_events_tenant_session_event_id_idx
  ON visitor_journey_events (tenant_id, session_id, event_id);
