-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create experiments and experiment_assignments tables
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds a lightweight A/B testing layer that sits on top of the existing
-- rules-based decision system.  When an experiment is active it intercepts
-- the plan produced by the rules engine and overrides one content slot
-- (hero | proof | cta) for a deterministically bucketed fraction of sessions.
--
-- ─── Table: experiments ───────────────────────────────────────────────────────
--
--   id               — stable text identifier, used in hashing, e.g.
--                      "hero_cta_q1_2025" — must be unique and never reused
--   name             — human-readable label for the dashboard
--   slot             — which page section is being tested: hero | proof | cta
--   variants         — ordered array of variant keys to test, e.g.
--                      '{hero_google_problem,hero_direct_brand}'
--                      bucket 0 → variants[1], bucket 1 → variants[2], …
--   status           — lifecycle state: active | paused | ended
--   traffic_fraction — proportion of sessions enrolled in this experiment
--                      1.0 = all sessions; 0.5 = half; stored as float8
--   created_at       — row creation timestamp
--   ended_at         — null while active; set when status changes to "ended"
--
-- ─── Table: experiment_assignments ───────────────────────────────────────────
--
--   id              — UUID PK
--   session_id      — FK → sessions.id
--   experiment_id   — FK → experiments.id (the text slug)
--   bucket          — 0-based index into experiments.variants
--   variant_key     — resolved variant key (denormalised for query convenience)
--   created_at      — assignment timestamp
--
--   UNIQUE (session_id, experiment_id) — one assignment per session per test;
--   re-requests always produce the same bucket via deterministic hashing so
--   duplicate inserts are handled with ON CONFLICT DO NOTHING.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- ── experiments ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.experiments (
  id               text             NOT NULL,
  name             text             NOT NULL,
  slot             text             NOT NULL
    CONSTRAINT experiments_slot_check CHECK (slot IN ('hero', 'proof', 'cta')),
  variants         text[]           NOT NULL
    CONSTRAINT experiments_variants_nonempty CHECK (array_length(variants, 1) >= 2),
  status           text             NOT NULL DEFAULT 'active'
    CONSTRAINT experiments_status_check CHECK (status IN ('active', 'paused', 'ended')),
  traffic_fraction double precision NOT NULL DEFAULT 1.0
    CONSTRAINT experiments_fraction_range CHECK (traffic_fraction > 0 AND traffic_fraction <= 1),
  created_at       timestamptz      NOT NULL DEFAULT now(),
  ended_at         timestamptz,

  CONSTRAINT experiments_pkey PRIMARY KEY (id)
);

-- Quickly find active experiments (the only ones queried at request time)
CREATE INDEX IF NOT EXISTS idx_experiments_status
  ON public.experiments (status)
  WHERE status = 'active';

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
-- Service-role key only; no anon/authenticated policies.

COMMENT ON TABLE  public.experiments                  IS 'Defines controlled A/B experiments layered on top of the rules decision engine.';
COMMENT ON COLUMN public.experiments.id               IS 'Stable, URL-safe text slug. Used in the bucket hash — never reuse an id.';
COMMENT ON COLUMN public.experiments.name             IS 'Human-readable experiment name shown in the dashboard.';
COMMENT ON COLUMN public.experiments.slot             IS 'Page section this experiment controls: hero | proof | cta.';
COMMENT ON COLUMN public.experiments.variants         IS 'Ordered variant keys to test. Index 0 = bucket 0, index 1 = bucket 1, etc.';
COMMENT ON COLUMN public.experiments.status           IS 'Lifecycle: active (running) | paused (traffic blocked) | ended (archived).';
COMMENT ON COLUMN public.experiments.traffic_fraction IS 'Fraction of sessions enrolled (0 < f ≤ 1). 1.0 = everyone.';
COMMENT ON COLUMN public.experiments.created_at       IS 'Row creation timestamp.';
COMMENT ON COLUMN public.experiments.ended_at         IS 'Set when status transitions to ended.';

-- ── experiment_assignments ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.experiment_assignments (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL,
  experiment_id text        NOT NULL,
  bucket        integer     NOT NULL,
  variant_key   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT experiment_assignments_pkey
    PRIMARY KEY (id),

  CONSTRAINT experiment_assignments_session_fk
    FOREIGN KEY (session_id) REFERENCES public.sessions (id) ON DELETE CASCADE,

  CONSTRAINT experiment_assignments_experiment_fk
    FOREIGN KEY (experiment_id) REFERENCES public.experiments (id),

  -- One assignment per session per experiment — deterministic hash guarantees
  -- idempotency so ON CONFLICT DO NOTHING is safe at the write site.
  CONSTRAINT experiment_assignments_session_experiment_unique
    UNIQUE (session_id, experiment_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_session_id
  ON public.experiment_assignments (session_id);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_experiment_id
  ON public.experiment_assignments (experiment_id);

ALTER TABLE public.experiment_assignments ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  public.experiment_assignments               IS 'Records which experiment bucket each session was assigned to.';
COMMENT ON COLUMN public.experiment_assignments.id            IS 'UUID primary key.';
COMMENT ON COLUMN public.experiment_assignments.session_id    IS 'FK → sessions.id. Cascades on delete.';
COMMENT ON COLUMN public.experiment_assignments.experiment_id IS 'FK → experiments.id (text slug).';
COMMENT ON COLUMN public.experiment_assignments.bucket        IS '0-based bucket index matching experiments.variants position.';
COMMENT ON COLUMN public.experiment_assignments.variant_key   IS 'Resolved variant key (denormalised from experiments.variants[bucket+1]).';
COMMENT ON COLUMN public.experiment_assignments.created_at    IS 'First assignment timestamp for this session × experiment pair.';

-- ── Seed: example experiment (commented out — apply manually when ready) ──────
--
-- INSERT INTO public.experiments (id, name, slot, variants, status, traffic_fraction)
-- VALUES (
--   'hero_problem_vs_brand_2025_q2',
--   'Hero: Problem-aware vs Brand copy (Google traffic)',
--   'hero',
--   ARRAY['hero_google_problem', 'hero_direct_brand'],
--   'active',
--   1.0
-- );
