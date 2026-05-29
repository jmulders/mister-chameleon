-- ── Migration 109: Demo Mirror Mode ──────────────────────────────────────────
--
-- Adds two columns to demo_instances that support the new "Live Mirror Demo"
-- mode, where the prospect's actual homepage HTML is fetched, instrumented
-- with data-mc-slot annotations, and served with the MC snippet injected.
--
--   demo_mode     — "synthetic" (default, existing AI-generated content)
--                   "mirror"    (mirrored HTML from the prospect's own site)
--
--   mirrored_html — the processed HTML blob (only set when demo_mode = 'mirror')
--
-- Both columns are nullable/optional so existing rows remain valid without
-- any backfill.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE demo_instances
  ADD COLUMN IF NOT EXISTS demo_mode     VARCHAR(20) NOT NULL DEFAULT 'synthetic',
  ADD COLUMN IF NOT EXISTS mirrored_html TEXT;

-- Constrain to known modes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'demo_instances'
      AND constraint_name = 'demo_instances_demo_mode_check'
  ) THEN
    ALTER TABLE demo_instances
      ADD CONSTRAINT demo_instances_demo_mode_check
      CHECK (demo_mode IN ('synthetic', 'mirror'));
  END IF;
END $$;

-- Index on demo_mode for admin list filtering
CREATE INDEX IF NOT EXISTS demo_instances_demo_mode_idx
  ON demo_instances (demo_mode);
