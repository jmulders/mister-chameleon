-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0034: Sequence Engine v2 — production-grade pattern model
--
-- Adds columns to:
--   • behavior_sequence_patterns  — richer pattern definition fields
--   • visitor_behavior_state      — sequence_confidence_contribution
--
-- All columns are nullable (backward-compatible).
-- Existing rows are unaffected until updateBehaviorState() re-runs for each
-- session and back-fills sequence_confidence_contribution.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── behavior_sequence_patterns extensions ─────────────────────────────────────
--
-- key                    — machine-readable unique key within a tenant
-- name                   — human-readable display name (alias for label; label kept)
-- description            — longer description for admin UI
-- confidence_contribution — per-pattern contribution to sequenceConfidence (0–1)
-- cross_session          — allow matching across sessions (requires visitor_id)
-- is_active              — when false, pattern is skipped during detection
-- priority               — evaluation order (lower = earlier; default 100)

ALTER TABLE behavior_sequence_patterns
  ADD COLUMN IF NOT EXISTS key                    TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS name                   TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description            TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confidence_contribution NUMERIC(5,4) DEFAULT NULL
    CHECK (confidence_contribution IS NULL OR (confidence_contribution >= 0 AND confidence_contribution <= 1)),
  ADD COLUMN IF NOT EXISTS cross_session          BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active              BOOLEAN      DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS priority               INTEGER      DEFAULT 100;

-- Unique key per tenant (matches behavior of scoring rules).
CREATE UNIQUE INDEX IF NOT EXISTS behavior_sequence_patterns_tenant_key_idx
  ON behavior_sequence_patterns (tenant_id, key)
  WHERE key IS NOT NULL;

-- ── behavior_sequence_patterns: step schema extension ─────────────────────────
--
-- The `sequence` JSONB column now supports steps with optional matchers:
--   { event_type, event_value?, page_path?, page_category? }
--
-- No SQL schema change required — JSONB is schema-flexible.
-- The application layer (detect-sequences.ts) handles the new fields.

COMMENT ON COLUMN behavior_sequence_patterns.sequence IS
  'Ordered step definitions. Each step: { event_type, event_value?, page_path?, page_category? }. '
  'All matchers beyond event_type are optional wildcards.';

-- ── visitor_behavior_state extension ─────────────────────────────────────────
--
-- sequence_confidence_contribution — sum of confidence_contribution from matched
--   patterns. Used by computeSequenceConfidence() when patterns define custom weights.
--   NULL = no custom contributions; uses flat per-sequence formula instead.

ALTER TABLE visitor_behavior_state
  ADD COLUMN IF NOT EXISTS sequence_confidence_contribution NUMERIC(7,4) DEFAULT NULL
    CHECK (
      sequence_confidence_contribution IS NULL OR
      (sequence_confidence_contribution >= 0 AND sequence_confidence_contribution <= 1)
    );

-- Confirm migration applied
DO $$ BEGIN
  RAISE NOTICE 'Migration 0034 (sequence_engine_v2) applied successfully.';
END $$;
