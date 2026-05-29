-- migration 070: behavioral_tables_schema_repair
--
-- The behavioral scoring tables (decay_profiles, behavior_scoring_rules, etc.)
-- were created before migration 028 was applied, so the live schema may be
-- missing columns added in that migration.  Migration 028 now silently skips
-- failing COMMENT ON COLUMN and INSERT statements; this migration adds the
-- missing columns and re-seeds the required data.
--
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT DO UPDATE).

-- ── decay_profiles ────────────────────────────────────────────────────────────

-- Ensure id exists FIRST — the slug/name backfills below cast id to text.
-- On tables created before migration 028, the id column may be absent entirely.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'decay_profiles'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE decay_profiles ADD COLUMN id uuid DEFAULT gen_random_uuid();
  END IF;
END $$;

-- decay_profiles are platform-level (global); they define decay curves shared
-- across all tenants and must be seedable without a tenant_id.
-- If the live table was created with tenant_id NOT NULL, drop that constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'decay_profiles'
      AND column_name = 'tenant_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE decay_profiles ALTER COLUMN tenant_id DROP NOT NULL;
  END IF;
END $$;

-- ── Handle legacy "name" column ───────────────────────────────────────────────
--
-- Early versions of decay_profiles were created with a NOT NULL "name" column.
-- The canonical schema uses "label" instead.  The steps below:
--
--   1. Add "label" as nullable so existing rows are not immediately rejected.
--   2. If "name" exists, backfill label ← name for any row where label is NULL
--      (preserves any label values already written).
--   3. Drop "name" — it is a legacy duplicate; "label" is the sole display field.
--
-- All steps are guarded so re-running on a table that already has the clean
-- schema (label, no name) is a no-op.

-- Step 1: add label as nullable (backfill comes next; NOT NULL enforced later).
ALTER TABLE public.decay_profiles
  ADD COLUMN IF NOT EXISTS label text;

-- Step 2: if "name" exists, rescue its data into "label" before dropping it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'decay_profiles'
      AND column_name = 'name'
  ) THEN
    -- Backfill label from name for rows that have no label yet.
    UPDATE public.decay_profiles
    SET label = name
    WHERE label IS NULL AND name IS NOT NULL;

    -- Drop the legacy column.
    ALTER TABLE public.decay_profiles DROP COLUMN name;
  END IF;
END $$;

-- Step 3: fall back to empty string for any remaining NULL labels (e.g. rows
-- where both name and label were NULL — shouldn't exist in practice but be safe).
UPDATE public.decay_profiles
SET label = ''
WHERE label IS NULL;

-- Now the column can safely carry NOT NULL.
DO $$
BEGIN
  ALTER TABLE public.decay_profiles ALTER COLUMN label SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Add remaining required columns ────────────────────────────────────────────
--
-- key and slug are added nullable here so the backfill UPDATEs below can run
-- before any NOT NULL constraint is tightened.
-- numeric(6,3) gives one extra leading digit of headroom vs the original (5,3).

ALTER TABLE public.decay_profiles
  ADD COLUMN IF NOT EXISTS key        text,
  ADD COLUMN IF NOT EXISTS slug       text,
  ADD COLUMN IF NOT EXISTS day_1      numeric(6,3) DEFAULT 1.000,
  ADD COLUMN IF NOT EXISTS day_7      numeric(6,3) DEFAULT 0.700,
  ADD COLUMN IF NOT EXISTS day_30     numeric(6,3) DEFAULT 0.300,
  ADD COLUMN IF NOT EXISTS day_90     numeric(6,3) DEFAULT 0.100,
  ADD COLUMN IF NOT EXISTS created_at timestamptz  NOT NULL DEFAULT now();

-- ── Back-fill slug ─────────────────────────────────────────────────────────────
--
-- Priority: existing slug → key → id::text (stable unique placeholder).
-- WHERE slug IS NULL ensures existing slugs are never overwritten.
UPDATE public.decay_profiles
SET slug = COALESCE(slug, key, id::text)
WHERE slug IS NULL;

-- ── Back-fill key ──────────────────────────────────────────────────────────────
--
-- key mirrors slug on all canonical rows.
UPDATE public.decay_profiles
SET key = COALESCE(key, slug)
WHERE key IS NULL;

-- ── Enforce NOT NULL on slug and key (safe after backfill) ────────────────────
DO $$
BEGIN
  ALTER TABLE public.decay_profiles ALTER COLUMN slug SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.decay_profiles ALTER COLUMN key SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── Unique index on slug (ON CONFLICT target for the seed INSERT below) ────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_decay_profiles_slug
  ON public.decay_profiles (slug);

-- Keep the legacy index name alive in case an earlier migration already created
-- it — IF NOT EXISTS makes this a no-op when the index is already present.
CREATE UNIQUE INDEX IF NOT EXISTS decay_profiles_slug_key
  ON public.decay_profiles (slug);

-- ── Primary key ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'decay_profiles'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public.decay_profiles ADD PRIMARY KEY (id);
  END IF;
END $$;

-- ── behavior_scoring_rules ────────────────────────────────────────────────────
--
-- Migration 029 renamed the original columns:
--   score → base_score    (integer)
--   label → name          (text)
--
-- The canonical runtime now uses score (numeric(10,3)) and label.  The steps
-- below add the canonical columns and backfill them from the legacy columns
-- so both old and new DB states converge.

ALTER TABLE behavior_scoring_rules
  ADD COLUMN IF NOT EXISTS tenant_id     text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_type    text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_value   text,
  ADD COLUMN IF NOT EXISTS decay_profile text        NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();

-- Add score as nullable first; NOT NULL enforced after backfill.
ALTER TABLE behavior_scoring_rules
  ADD COLUMN IF NOT EXISTS score numeric(10,3);

-- Backfill score from base_score if the legacy column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'behavior_scoring_rules'
      AND column_name = 'base_score'
  ) THEN
    UPDATE behavior_scoring_rules
    SET score = base_score
    WHERE score IS NULL AND base_score IS NOT NULL;
  END IF;
END $$;

-- Default any remaining NULLs to 0 then enforce NOT NULL.
UPDATE behavior_scoring_rules SET score = 0 WHERE score IS NULL;
DO $$
BEGIN
  ALTER TABLE behavior_scoring_rules ALTER COLUMN score SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add label as nullable first; NOT NULL enforced after backfill.
ALTER TABLE behavior_scoring_rules
  ADD COLUMN IF NOT EXISTS label text;

-- Backfill label from name if the legacy column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'behavior_scoring_rules'
      AND column_name = 'name'
  ) THEN
    UPDATE behavior_scoring_rules
    SET label = name
    WHERE label IS NULL AND name IS NOT NULL;
  END IF;
END $$;

-- Default any remaining NULLs to '' then enforce NOT NULL.
UPDATE behavior_scoring_rules SET label = '' WHERE label IS NULL;
DO $$
BEGIN
  ALTER TABLE behavior_scoring_rules ALTER COLUMN label SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop the legacy "name" column now that label is populated.
-- The column has a NOT NULL constraint with no DEFAULT, so any INSERT that
-- omits it will fail — dropping it is the only safe resolution.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'behavior_scoring_rules'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE public.behavior_scoring_rules DROP COLUMN name;
  END IF;
END $$;

-- Drop the legacy "base_score" column now that score is populated.
-- base_score has a DEFAULT 0 so it won't block INSERTs, but dropping it
-- keeps the schema clean and avoids confusion with the new score column.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'behavior_scoring_rules'
      AND column_name = 'base_score'
  ) THEN
    ALTER TABLE public.behavior_scoring_rules DROP COLUMN base_score;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scoring_rules_tenant
  ON behavior_scoring_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_tenant_type
  ON behavior_scoring_rules(tenant_id, event_type);

-- ── behavior_sequence_patterns ────────────────────────────────────────────────

ALTER TABLE behavior_sequence_patterns
  ADD COLUMN IF NOT EXISTS tenant_id       text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS slug            text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS label           text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sequence        jsonb       NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS max_gap_minutes integer     NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS score           integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sequence_patterns_tenant
  ON behavior_sequence_patterns(tenant_id);

-- ── visitor_journey_events ────────────────────────────────────────────────────

ALTER TABLE visitor_journey_events
  ADD COLUMN IF NOT EXISTS tenant_id     text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS session_id    uuid,
  ADD COLUMN IF NOT EXISTS occurred_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS event_type    text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_value   text,
  ADD COLUMN IF NOT EXISTS page_path     text,
  ADD COLUMN IF NOT EXISTS page_category text,
  ADD COLUMN IF NOT EXISTS page_keywords text[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source        text,
  ADD COLUMN IF NOT EXISTS medium        text,
  ADD COLUMN IF NOT EXISTS campaign      text,
  ADD COLUMN IF NOT EXISTS metadata      jsonb       NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_journey_events_tenant_session
  ON visitor_journey_events(tenant_id, session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_events_tenant_type
  ON visitor_journey_events(tenant_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_events_session
  ON visitor_journey_events(session_id, occurred_at DESC);

-- ── visitor_behavior_state ────────────────────────────────────────────────────

ALTER TABLE visitor_behavior_state
  ADD COLUMN IF NOT EXISTS tenant_id              text        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS session_id             uuid,
  ADD COLUMN IF NOT EXISTS first_seen_at          timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at           timestamptz,
  ADD COLUMN IF NOT EXISTS page_view_count        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cta_click_count        integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_start_count       integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_submit_count      integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count         integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_visited_about      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_visited_pricing    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_visited_cases      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_visited_contact    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_clicked_cta        boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_submitted_form     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_categories      text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS viewed_keywords        text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recency_score          integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_score       integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intent_score           integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sequence_score         integer     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS funnel_stage           text        NOT NULL DEFAULT 'awareness',
  ADD COLUMN IF NOT EXISTS funnel_stage_confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS matched_sequences      text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at             timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_behavior_state_tenant_session
  ON visitor_behavior_state(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_behavior_state_funnel
  ON visitor_behavior_state(tenant_id, funnel_stage);
CREATE INDEX IF NOT EXISTS idx_behavior_state_intent_score
  ON visitor_behavior_state(tenant_id, intent_score DESC);

-- ── Re-seed decay profiles ────────────────────────────────────────────────────
--
-- Canonical columns only: key, slug, label, day_*.
-- "name" is gone; tenant_id is intentionally absent (global/platform profiles).
-- ON CONFLICT (slug) DO UPDATE is idempotent — safe to re-run; overwrites stale
-- values left by any partial previous run.

INSERT INTO public.decay_profiles (key, slug, label, day_1, day_7, day_30, day_90)
VALUES
  ('standard', 'standard', 'Standard',   1.000, 0.700, 0.300, 0.100),
  ('fast',     'fast',     'Fast decay', 1.000, 0.400, 0.100, 0.000),
  ('slow',     'slow',     'Slow decay', 1.000, 0.900, 0.600, 0.300)
ON CONFLICT (slug) DO UPDATE
SET
  key   = excluded.key,
  label = excluded.label,
  day_1 = excluded.day_1,
  day_7 = excluded.day_7,
  day_30 = excluded.day_30,
  day_90 = excluded.day_90;

-- Re-seed scoring rules for the demo tenant (no-op if already present).
-- Uses the canonical column names: score (numeric) and label.
INSERT INTO behavior_scoring_rules (tenant_id, event_type, event_value, score, decay_profile, label)
VALUES
  ('mister-chameleon', 'page_view',   '/pricing', 40.000, 'standard', 'Pricing page view'),
  ('mister-chameleon', 'page_view',   '/cases',   20.000, 'standard', 'Case study page view'),
  ('mister-chameleon', 'form_start',  NULL,       25.000, 'fast',     'Form interaction started'),
  ('mister-chameleon', 'form_submit', NULL,       80.000, 'slow',     'Form submitted')
ON CONFLICT DO NOTHING;
