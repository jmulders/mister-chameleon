-- migration 067: enrichment_tracker_schema_ensure
--
-- SUPERSEDED by migration 068 (usage_events_canonical).
--
-- This migration originally attempted to add columns to enrichment_usage,
-- which does not exist in the live database.  All enrichment tracking has
-- been consolidated into usage_events (see migration 068).
--
-- This file is intentionally a no-op to avoid breaking the migration history.
SELECT 1;
