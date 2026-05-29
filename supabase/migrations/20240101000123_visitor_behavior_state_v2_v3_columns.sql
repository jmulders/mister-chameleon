-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0123 — visitor_behavior_state: Journey Engine v2/v3 columns
--
-- Problem:
--   The Journey Engine v2 and v3 scoring fields written by deriveBehaviorState()
--   and upserted by updateBehaviorState() were never formally added to the
--   schema via a migration.  They existed in the live DB only because they were
--   added out-of-band (schema drift).
--
--   When the upsert payload includes a column that doesn't exist in the DB,
--   PostgREST returns an error that is caught and logged only at debug level,
--   causing the entire behavior state write to silently fail.  The Journey
--   Intelligence panel then shows "No journey data" forever.
--
-- Fix:
--   Add all missing v2/v3/sequence-v2 columns with safe defaults.
--   All statements use ADD COLUMN IF NOT EXISTS — safe to re-run on DBs that
--   already have the columns from out-of-band migrations.
--
-- Columns added:
--   Journey Engine v2
--     short_term_intent_score   — intent from events < 24h old (0–100)
--     long_term_affinity_score  — sustained intent from events 7d+ old (0–100)
--     intent_freshness          — ratio short-term/total intent (0–1)
--     sequence_matched_at       — ISO timestamp of most recent sequence match
--     repeat_session_bonus      — return-visitor bonus (0–1)
--
--   Journey Engine v3 (anti-noise)
--     friction_score            — confusion/repetition score (0–100)
--     signal_diversity_score    — breadth of distinct signal types fired (0–1)
--     unique_signal_count       — count of distinct high-value signal types (0–10)
--     burst_penalty             — rapid-fire navigation penalty (0–0.5)
--     deduplicated_event_count  — near-duplicate events downweighted
--
-- Note: sequence_confidence_contribution was added in migration 0034.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Journey Engine v2 ─────────────────────────────────────────────────────────

ALTER TABLE public.visitor_behavior_state
  ADD COLUMN IF NOT EXISTS short_term_intent_score  numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS long_term_affinity_score numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intent_freshness         numeric(6,5) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sequence_matched_at      timestamptz           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_session_bonus     numeric(5,4) NOT NULL DEFAULT 0;

-- ── Journey Engine v3 (anti-noise) ───────────────────────────────────────────

ALTER TABLE public.visitor_behavior_state
  ADD COLUMN IF NOT EXISTS friction_score           numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signal_diversity_score   numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_signal_count      integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS burst_penalty            numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduplicated_event_count integer      NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.visitor_behavior_state.short_term_intent_score IS
  'Intent contribution from events in the last 24 hours (0–100). High = active in-session research.';
COMMENT ON COLUMN public.visitor_behavior_state.long_term_affinity_score IS
  'Sustained intent score from events older than 7 days (0–100). High = informed returning visitor.';
COMMENT ON COLUMN public.visitor_behavior_state.intent_freshness IS
  'short_term_intent / (intent_score + 1). Near 1.0 = all intent is from today.';
COMMENT ON COLUMN public.visitor_behavior_state.sequence_matched_at IS
  'Timestamp of most recent completed sequence match. NULL when no sequences matched.';
COMMENT ON COLUMN public.visitor_behavior_state.repeat_session_bonus IS
  'Return-visitor bonus 0–1, based on event timestamps spanning multiple calendar days.';
COMMENT ON COLUMN public.visitor_behavior_state.friction_score IS
  'Repetitive/bursty/shallow behavior score 0–100. High values reduce intent confidence.';
COMMENT ON COLUMN public.visitor_behavior_state.signal_diversity_score IS
  'Fraction of distinct high-value signal types fired (0–1).';
COMMENT ON COLUMN public.visitor_behavior_state.unique_signal_count IS
  'Count of distinct high-value signal types that have fired (0–10).';
COMMENT ON COLUMN public.visitor_behavior_state.burst_penalty IS
  'Applied when many same-type events occur in a short window (0–0.5).';
COMMENT ON COLUMN public.visitor_behavior_state.deduplicated_event_count IS
  'Events downweighted as near-duplicates (same type+path within 30s).';
