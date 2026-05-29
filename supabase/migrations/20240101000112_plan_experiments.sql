-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create plan_experiments and plan_experiment_assignments tables
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Replaces the single-slot A/B experiment system with a plan-based experiment
-- system where an entire ExperiencePlan (all slots together) is tested against
-- a challenger plan.
--
-- Design philosophy:
--   The old system overrode individual slots (hero | proof | cta) in isolation,
--   which produced potentially incoherent combinations and made it impossible
--   to test a complete psychological journey.
--
--   The new system ties each experiment to a specific rule.  When the rule
--   matches a visitor, the experiment kicks in:
--     bucket 0 → control   (the rule's own plan — no override)
--     bucket 1 → challenger (challenger_plan merged onto the control plan)
--
--   This enables macro-optimisation: testing coherent hero+proof+CTA narratives
--   against each other, rather than testing individual atoms.
--
-- ─── Table: plan_experiments ──────────────────────────────────────────────────
--
--   id               — stable text slug, used in the bucket hash.
--                      Never reuse an id once an experiment has run.
--   name             — human-readable label for the dashboard
--   rule_id          — soft reference to the matched rule's ID (from rules_config).
--                      The experiment only fires when this rule matched the visitor.
--                      Not a foreign key — rules live in JSON config, not a table.
--   challenger_plan  — JSONB with one or more of:
--                        heroKey, proofKey, ctaKey, featureKey, conversionKey
--                      Only the keys present override the control plan.
--                      bucket 0 (control) receives the rule's unmodified plan.
--                      bucket 1 (challenger) receives this merged override.
--   status           — lifecycle: draft | active | paused | ended
--   traffic_fraction — fraction of matching sessions enrolled: 0 < f ≤ 1.0
--   created_at       — row creation timestamp
--   ended_at         — null while active; set when status changes to "ended"
--
-- ─── Table: plan_experiment_assignments ──────────────────────────────────────
--
--   id              — UUID PK
--   session_id      — FK → sessions.id
--   experiment_id   — FK → plan_experiments.id
--   bucket          — 0 = control, 1 = challenger
--   created_at      — assignment timestamp
--
--   UNIQUE (session_id, experiment_id) — deterministic hash guarantees the same
--   bucket on every request; ON CONFLICT DO NOTHING is safe.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── plan_experiments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_experiments (
  id               text             NOT NULL,
  name             text             NOT NULL,
  rule_id          text             NOT NULL,
  challenger_plan  jsonb            NOT NULL DEFAULT '{}',
  status           text             NOT NULL DEFAULT 'draft'
    CONSTRAINT plan_experiments_status_check
      CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  traffic_fraction double precision NOT NULL DEFAULT 1.0
    CONSTRAINT plan_experiments_fraction_range
      CHECK (traffic_fraction > 0 AND traffic_fraction <= 1),
  created_at       timestamptz      NOT NULL DEFAULT now(),
  ended_at         timestamptz,

  CONSTRAINT plan_experiments_pkey PRIMARY KEY (id)
);

-- Index for the hot-path query: fetch active experiments for a given rule.
CREATE INDEX IF NOT EXISTS idx_plan_experiments_rule_status
  ON public.plan_experiments (rule_id, status)
  WHERE status = 'active';

-- General status index for dashboard list queries.
CREATE INDEX IF NOT EXISTS idx_plan_experiments_status
  ON public.plan_experiments (status);

ALTER TABLE public.plan_experiments ENABLE ROW LEVEL SECURITY;
-- Service-role key only; no anon/authenticated policies.

COMMENT ON TABLE  public.plan_experiments                  IS 'Defines plan-based A/B experiments. Each experiment targets one rule and tests a complete challenger plan against the rule''s control plan.';
COMMENT ON COLUMN public.plan_experiments.id               IS 'Stable text slug used in the bucket hash. Never reuse after an experiment has run.';
COMMENT ON COLUMN public.plan_experiments.name             IS 'Human-readable experiment name shown in the dashboard.';
COMMENT ON COLUMN public.plan_experiments.rule_id          IS 'Soft reference to the rule ID that must match before this experiment is evaluated. Not a FK — rules live in JSON config.';
COMMENT ON COLUMN public.plan_experiments.challenger_plan  IS 'JSONB with slot overrides for bucket 1. Keys: heroKey, proofKey, ctaKey, featureKey, conversionKey. Missing keys inherit from the control plan.';
COMMENT ON COLUMN public.plan_experiments.status           IS 'Lifecycle: draft (not yet running) | active (evaluating) | paused (traffic blocked) | ended (archived).';
COMMENT ON COLUMN public.plan_experiments.traffic_fraction IS 'Fraction of sessions enrolled among those where the rule matched. 1.0 = every matching session.';
COMMENT ON COLUMN public.plan_experiments.created_at       IS 'Row creation timestamp.';
COMMENT ON COLUMN public.plan_experiments.ended_at         IS 'Set when status transitions to ended.';

-- ── plan_experiment_assignments ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_experiment_assignments (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL,
  experiment_id text        NOT NULL,
  bucket        integer     NOT NULL
    CONSTRAINT plan_experiment_assignments_bucket_check
      CHECK (bucket IN (0, 1)),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plan_experiment_assignments_pkey
    PRIMARY KEY (id),

  CONSTRAINT plan_experiment_assignments_session_fk
    FOREIGN KEY (session_id) REFERENCES public.sessions (id) ON DELETE CASCADE,

  CONSTRAINT plan_experiment_assignments_experiment_fk
    FOREIGN KEY (experiment_id) REFERENCES public.plan_experiments (id) ON DELETE CASCADE,

  -- One assignment per session per experiment — idempotent by design.
  CONSTRAINT plan_experiment_assignments_session_experiment_unique
    UNIQUE (session_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_experiment_assignments_session_id
  ON public.plan_experiment_assignments (session_id);

CREATE INDEX IF NOT EXISTS idx_plan_experiment_assignments_experiment_id
  ON public.plan_experiment_assignments (experiment_id);

ALTER TABLE public.plan_experiment_assignments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.plan_experiment_assignments               IS 'Records which plan experiment bucket (0=control, 1=challenger) each session received.';
COMMENT ON COLUMN public.plan_experiment_assignments.id            IS 'UUID primary key.';
COMMENT ON COLUMN public.plan_experiment_assignments.session_id    IS 'FK → sessions.id. Cascades on delete.';
COMMENT ON COLUMN public.plan_experiment_assignments.experiment_id IS 'FK → plan_experiments.id. Cascades on delete.';
COMMENT ON COLUMN public.plan_experiment_assignments.bucket        IS '0 = control (rule plan unmodified), 1 = challenger (challenger_plan applied).';
COMMENT ON COLUMN public.plan_experiment_assignments.created_at    IS 'First assignment timestamp for this session × experiment pair.';
