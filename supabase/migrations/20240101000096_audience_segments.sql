-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 096 — audience_segments
--
-- Per-tenant named visitor segments.  Each segment stores a JSONB condition
-- tree (same RuleCondition format used by the decision rules engine) that is
-- evaluated at request time against the fully-assembled DecisionContext.
--
-- Visitors that match the criteria are tagged with the segment key via the
-- `audienceSegmentIds` context variable, which rules and AI decisions can
-- then condition on.
--
-- ─── Table ────────────────────────────────────────────────────────────────────
--
--   audience_segments
--     id            UUID    — PK
--     tenant_id     TEXT    — FK to tenant_config.tenant_id
--     key           TEXT    — URL-safe slug, unique within tenant
--     label         TEXT    — human-readable name
--     description   TEXT    — optional description
--     criteria      JSONB   — RuleCondition tree (FieldCondition | GroupCondition)
--     is_active     BOOLEAN — whether the segment is evaluated at runtime
--     created_at    TIMESTAMPTZ
--     updated_at    TIMESTAMPTZ
--
-- ─── Uniqueness ───────────────────────────────────────────────────────────────
--
--   (tenant_id, key) is unique — segment keys are scoped to the tenant.
--
-- ─── Idempotency ──────────────────────────────────────────────────────────────
--
--   CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS guards.  Safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audience_segments (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id   TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  label       TEXT        NOT NULL,
  description TEXT,
  criteria    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT audience_segments_pkey
    PRIMARY KEY (id),

  CONSTRAINT audience_segments_tenant_key_uniq
    UNIQUE (tenant_id, key)
);

COMMENT ON TABLE public.audience_segments IS
  'Per-tenant named visitor segments. criteria is a RuleCondition JSON tree '
  'evaluated at request time. Matched segment keys are surfaced as the '
  'audienceSegmentIds context variable.';

COMMENT ON COLUMN public.audience_segments.key IS
  'URL-safe slug, e.g. "high-intent-enterprise". Unique within tenant. '
  'Used as the identifier in audienceSegmentIds matching.';

COMMENT ON COLUMN public.audience_segments.criteria IS
  'RuleCondition tree in the same format used by the decision rules engine: '
  '{ type:"field", field, operator, value } | '
  '{ type:"group", logic:"and"|"or", conditions:[] }';

COMMENT ON COLUMN public.audience_segments.is_active IS
  'true = segment is evaluated on every request and can match visitors. '
  'false = segment is excluded from runtime evaluation (no matches produced).';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS audience_segments_tenant_idx
  ON public.audience_segments (tenant_id);

CREATE INDEX IF NOT EXISTS audience_segments_tenant_active_idx
  ON public.audience_segments (tenant_id, is_active)
  WHERE is_active = true;

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_audience_segments_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audience_segments_updated_at ON public.audience_segments;
CREATE TRIGGER trg_audience_segments_updated_at
  BEFORE UPDATE ON public.audience_segments
  FOR EACH ROW EXECUTE FUNCTION public.set_audience_segments_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.audience_segments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audience_segments'
      AND policyname = 'service_role_all_audience_segments'
  ) THEN
    CREATE POLICY "service_role_all_audience_segments"
      ON public.audience_segments
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── Notify PostgREST ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
