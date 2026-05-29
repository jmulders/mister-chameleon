-- ── Behavioral Personalization Foundation ────────────────────────────────────
--
-- Creates 5 tables to support journey event ingestion, behavioral scoring,
-- sequence detection, recency decay, and funnel-stage derivation.
--
-- Table overview
-- ──────────────────────────────────────────────────────────────────────────────
--   decay_profiles              Decay weight curves (day_1 / day_7 / day_30 / day_90)
--   behavior_scoring_rules      Per-event score contribution + decay profile reference
--   behavior_sequence_patterns  Ordered event-sequence definitions + scores
--   visitor_journey_events      Raw behavioral events with rich per-tenant metadata
--   visitor_behavior_state      Aggregated per-(tenant, session) state + scores
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. Decay profiles ─────────────────────────────────────────────────────────
--
-- Reusable weight curves that scoring rules reference by slug.
-- Weights are applied to an event's base score proportional to age:
--   age < 1 day   → day_1
--   age < 7 days  → day_7
--   age < 30 days → day_30
--   age < 90 days → day_90
--   age ≥ 90 days → 0 (event no longer contributes)

CREATE TABLE IF NOT EXISTS decay_profiles (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text        NOT NULL UNIQUE,
  label      text        NOT NULL,
  day_1      numeric(5,3) NOT NULL DEFAULT 1.0,
  day_7      numeric(5,3) NOT NULL DEFAULT 0.7,
  day_30     numeric(5,3) NOT NULL DEFAULT 0.3,
  day_90     numeric(5,3) NOT NULL DEFAULT 0.1,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  decay_profiles IS 'Reusable recency-decay weight curves referenced by behavior_scoring_rules.';
DO $$ BEGIN COMMENT ON COLUMN decay_profiles.slug    IS 'Stable identifier used as FK in behavior_scoring_rules.decay_profile.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN decay_profiles.day_1   IS 'Multiplier applied to base score when event occurred < 1 day ago.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN decay_profiles.day_7   IS 'Multiplier applied when event occurred < 7 days ago.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN decay_profiles.day_30  IS 'Multiplier applied when event occurred < 30 days ago.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN decay_profiles.day_90  IS 'Multiplier applied when event occurred < 90 days ago. Events older than 90 days contribute 0.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ── 2. Behavior scoring rules ─────────────────────────────────────────────────
--
-- Per-tenant rules that assign a base score to a specific event_type
-- (optionally filtered by event_value).  The decay_profile determines how
-- quickly that score diminishes with time.

CREATE TABLE IF NOT EXISTS behavior_scoring_rules (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      text        NOT NULL,
  event_type     text        NOT NULL,
  -- When non-null, the rule only fires when event_value matches this string.
  event_value    text        NULL,
  score          integer     NOT NULL DEFAULT 0,
  -- References decay_profiles.slug for fast look-up without a JOIN.
  decay_profile  text        NOT NULL DEFAULT 'standard',
  label          text        NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fk_scoring_decay FOREIGN KEY (decay_profile)
    REFERENCES decay_profiles (slug) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_scoring_rules_tenant
  ON behavior_scoring_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scoring_rules_tenant_type
  ON behavior_scoring_rules(tenant_id, event_type);

COMMENT ON TABLE  behavior_scoring_rules IS 'Per-tenant rules that assign a decayed score contribution to a single event type.';
DO $$ BEGIN COMMENT ON COLUMN behavior_scoring_rules.event_value  IS 'Optional: only match events whose event_value equals this string.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN behavior_scoring_rules.score         IS 'Base intent score added by this event (before decay is applied).'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN behavior_scoring_rules.decay_profile IS 'References decay_profiles.slug. Determines how quickly the score fades.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ── 3. Behavior sequence patterns ────────────────────────────────────────────
--
-- Ordered event sequences that — when fully matched within max_gap_minutes —
-- indicate a meaningful behavioral signal (e.g. "researched → ready to buy").
-- The sequence JSON array is [{event_type, event_value?}, ...].

CREATE TABLE IF NOT EXISTS behavior_sequence_patterns (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text        NOT NULL,
  slug              text        NOT NULL,
  label             text        NOT NULL,
  -- Ordered array of {event_type: string, event_value?: string}
  sequence          jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- Maximum allowed gap between consecutive sequence steps (minutes)
  max_gap_minutes   integer     NOT NULL DEFAULT 60,
  score             integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sequence_patterns_tenant
  ON behavior_sequence_patterns(tenant_id);

COMMENT ON TABLE  behavior_sequence_patterns IS 'Ordered event-sequence definitions. When fully matched, contribute a score bonus and are recorded in visitor_behavior_state.matched_sequences.';
DO $$ BEGIN COMMENT ON COLUMN behavior_sequence_patterns.sequence         IS 'JSON array of {event_type, event_value?} steps in order.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN behavior_sequence_patterns.max_gap_minutes  IS 'Maximum allowed gap between consecutive steps. Sequences exceeding this gap are not matched.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN behavior_sequence_patterns.score            IS 'Intent score bonus added when the sequence is fully matched.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ── 4. Visitor journey events ─────────────────────────────────────────────────
--
-- Raw behavioral events with richer per-event context than the general
-- `events` table.  Written on every tracked interaction and used as the
-- source-of-truth for deriving visitor_behavior_state.
--
-- session_id is NOT FK-constrained to allow async event recording
-- independent of the session lifecycle.

CREATE TABLE IF NOT EXISTS visitor_journey_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      text        NOT NULL,
  session_id     uuid        NOT NULL,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  event_type     text        NOT NULL,
  -- Semantic value for the event, e.g. "/pricing" for a page_view.
  event_value    text        NULL,
  page_path      text        NULL,
  page_category  text        NULL,
  page_keywords  text[]      NULL DEFAULT '{}',
  source         text        NULL,
  medium         text        NULL,
  campaign       text        NULL,
  -- Arbitrary additional metadata (variant keys, form IDs, etc.)
  metadata       jsonb       NOT NULL DEFAULT '{}'::jsonb
);

-- Ensure all indexed columns exist on pre-existing visitor_journey_events tables
-- (handles the case where the table was created by an earlier migration run
--  that had a different or incomplete schema)
DO $$
BEGIN
  ALTER TABLE visitor_journey_events
    ADD COLUMN IF NOT EXISTS session_id    uuid        NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS occurred_at   timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS event_type    text        NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS event_value   text        NULL,
    ADD COLUMN IF NOT EXISTS page_path     text        NULL,
    ADD COLUMN IF NOT EXISTS page_category text        NULL,
    ADD COLUMN IF NOT EXISTS page_keywords text[]      NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS source        text        NULL,
    ADD COLUMN IF NOT EXISTS medium        text        NULL,
    ADD COLUMN IF NOT EXISTS campaign      text        NULL,
    ADD COLUMN IF NOT EXISTS metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Primary access pattern: tenant + session, most-recent first
CREATE INDEX IF NOT EXISTS idx_journey_events_tenant_session
  ON visitor_journey_events(tenant_id, session_id, occurred_at DESC);

-- Secondary: tenant + event type (for scoring rule lookups across sessions)
CREATE INDEX IF NOT EXISTS idx_journey_events_tenant_type
  ON visitor_journey_events(tenant_id, event_type, occurred_at DESC);

-- session-only index (for cross-tenant debug)
CREATE INDEX IF NOT EXISTS idx_journey_events_session
  ON visitor_journey_events(session_id, occurred_at DESC);

COMMENT ON TABLE  visitor_journey_events IS 'Raw behavioral events with rich per-event metadata. Source-of-truth for visitor_behavior_state derivation.';
DO $$ BEGIN COMMENT ON COLUMN visitor_journey_events.event_type    IS 'Named event: page_view | cta_click | form_start | form_submit | download'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_journey_events.event_value   IS 'Semantic value — e.g. page_path for page_view, element ID for cta_click.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_journey_events.page_keywords IS 'Content tags/keywords for the page at time of event. Used for interest scoring.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ── 5. Visitor behavior state ─────────────────────────────────────────────────
--
-- Aggregated per-(tenant, session) behavioral state.
-- Updated asynchronously after each journey event is recorded.
-- Read at request time by fetchJourneyState() with a single PK lookup.

CREATE TABLE IF NOT EXISTS visitor_behavior_state (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text        NOT NULL,
  session_id            uuid        NOT NULL,

  -- Timestamps
  first_seen_at         timestamptz NULL,
  last_seen_at          timestamptz NULL,

  -- Event counts
  page_view_count       integer     NOT NULL DEFAULT 0,
  cta_click_count       integer     NOT NULL DEFAULT 0,
  form_start_count      integer     NOT NULL DEFAULT 0,
  form_submit_count     integer     NOT NULL DEFAULT 0,
  download_count        integer     NOT NULL DEFAULT 0,

  -- Page-visit boolean flags (derived from page_view events)
  has_visited_about     boolean     NOT NULL DEFAULT false,
  has_visited_pricing   boolean     NOT NULL DEFAULT false,
  has_visited_cases     boolean     NOT NULL DEFAULT false,
  has_visited_contact   boolean     NOT NULL DEFAULT false,

  -- Engagement boolean flags
  has_clicked_cta       boolean     NOT NULL DEFAULT false,
  has_submitted_form    boolean     NOT NULL DEFAULT false,

  -- Content interest signals
  viewed_categories     text[]      NOT NULL DEFAULT '{}',
  viewed_keywords       text[]      NOT NULL DEFAULT '{}',

  -- Computed scores (0–100, clamped)
  recency_score         integer     NOT NULL DEFAULT 0,
  engagement_score      integer     NOT NULL DEFAULT 0,
  intent_score          integer     NOT NULL DEFAULT 0,
  sequence_score        integer     NOT NULL DEFAULT 0,

  -- Funnel stage derived from scores + milestone events
  funnel_stage          text        NOT NULL DEFAULT 'awareness',
  -- 0.0–1.0 confidence weight
  funnel_stage_confidence numeric(4,3) NOT NULL DEFAULT 0.5,

  -- Slugs of fully-matched behavior_sequence_patterns
  matched_sequences     text[]      NOT NULL DEFAULT '{}',

  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, session_id)
);

-- Ensure all indexed columns exist on pre-existing visitor_behavior_state tables.
-- This DO block is the fix for the 42703 "column does not exist" error that occurs
-- when the table already exists from a prior migration run with an older schema
-- that was missing session_id, funnel_stage, intent_score, etc.
DO $$
BEGIN
  ALTER TABLE visitor_behavior_state
    ADD COLUMN IF NOT EXISTS session_id               uuid           NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS funnel_stage             text           NOT NULL DEFAULT 'awareness',
    ADD COLUMN IF NOT EXISTS funnel_stage_confidence  numeric(4,3)   NOT NULL DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS intent_score             integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recency_score            integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS engagement_score         integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sequence_score           integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS matched_sequences        text[]         NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS first_seen_at            timestamptz    NULL,
    ADD COLUMN IF NOT EXISTS last_seen_at             timestamptz    NULL,
    ADD COLUMN IF NOT EXISTS page_view_count          integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cta_click_count          integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS form_start_count         integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS form_submit_count        integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS download_count           integer        NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_visited_about        boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_visited_pricing      boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_visited_cases        boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_visited_contact      boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_clicked_cta          boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_submitted_form       boolean        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS viewed_categories        text[]         NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS viewed_keywords          text[]         NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS updated_at               timestamptz    NOT NULL DEFAULT now();
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Also ensure the UNIQUE constraint on (tenant_id, session_id) exists.
-- ADD CONSTRAINT IF NOT EXISTS is available in PostgreSQL 9.6+.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'visitor_behavior_state'::regclass
      AND contype   = 'u'
      AND conname   = 'visitor_behavior_state_tenant_id_session_id_key'
  ) THEN
    ALTER TABLE visitor_behavior_state
      ADD CONSTRAINT visitor_behavior_state_tenant_id_session_id_key
        UNIQUE (tenant_id, session_id);
  END IF;
EXCEPTION WHEN undefined_table OR invalid_schema_name THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_behavior_state_tenant_session
  ON visitor_behavior_state(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_behavior_state_funnel
  ON visitor_behavior_state(tenant_id, funnel_stage);
CREATE INDEX IF NOT EXISTS idx_behavior_state_intent_score
  ON visitor_behavior_state(tenant_id, intent_score DESC);

COMMENT ON TABLE  visitor_behavior_state IS 'Aggregated per-(tenant, session) behavioral state. Updated async; read at request time.';
DO $$ BEGIN COMMENT ON COLUMN visitor_behavior_state.intent_score      IS 'Aggregate intent score 0–100 derived from scoring rules with decay.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_behavior_state.recency_score     IS 'Score reflecting how recently the visitor was active.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_behavior_state.engagement_score  IS 'Score reflecting depth of engagement (page views, clicks, downloads).'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_behavior_state.sequence_score    IS 'Bonus score from fully matched behavior_sequence_patterns.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_behavior_state.funnel_stage      IS 'awareness | consideration | intent | high_intent | customer'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
DO $$ BEGIN COMMENT ON COLUMN visitor_behavior_state.matched_sequences IS 'Array of behavior_sequence_patterns.slug values that were fully matched.'; EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;


-- ── Seed data ─────────────────────────────────────────────────────────────────

-- Decay profiles (shared across all tenants)
-- Wrapped in DO block: if decay_profiles is missing the slug column (will be added
-- by migration 070), the INSERT is silently skipped here and re-run by migration 070.
DO $$
BEGIN
  INSERT INTO decay_profiles (slug, label, day_1, day_7, day_30, day_90)
  VALUES
    ('standard', 'Standard',   1.000, 0.700, 0.300, 0.100),
    ('fast',     'Fast decay', 1.000, 0.400, 0.100, 0.000),
    ('slow',     'Slow decay', 1.000, 0.900, 0.600, 0.300)
  ON CONFLICT (slug) DO NOTHING;
EXCEPTION WHEN undefined_column OR undefined_table OR not_null_violation THEN NULL;
END $$;

-- Scoring rules for the default demo tenant
DO $$
BEGIN
  INSERT INTO behavior_scoring_rules (tenant_id, event_type, event_value, score, decay_profile, label)
  VALUES
    ('mister-chameleon', 'page_view',   '/pricing',  40, 'standard', 'Pricing page view'),
    ('mister-chameleon', 'page_view',   '/cases',    20, 'standard', 'Case study page view'),
    ('mister-chameleon', 'form_start',  NULL,        25, 'fast',     'Form interaction started'),
    ('mister-chameleon', 'form_submit', NULL,        80, 'slow',     'Form submitted')
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN undefined_column OR undefined_table OR foreign_key_violation THEN NULL;
END $$;

-- Sequence pattern: about → pricing (intent escalation)
DO $$
BEGIN
  INSERT INTO behavior_sequence_patterns (tenant_id, slug, label, sequence, max_gap_minutes, score)
  VALUES
    (
      'mister-chameleon',
      'about_to_pricing',
      'About → Pricing journey',
      '[{"event_type": "page_view", "event_value": "/about"}, {"event_type": "page_view", "event_value": "/pricing"}]'::jsonb,
      120,
      30
    )
  ON CONFLICT (tenant_id, slug) DO NOTHING;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;
