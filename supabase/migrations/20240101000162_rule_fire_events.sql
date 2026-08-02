-- Migration 162 — rule_fire_events (per-rule fire log for diagnostics)
--
-- One row per rule match on the decide path (append-only). Aggregating by
-- rule_id gives "how often did each rule actually fire" — the complement to the
-- score-distribution panel: does the input discriminate, AND do the rules do
-- anything. Writes are fire-and-forget from the decide path; a missing table
-- (pre-migration) is handled fail-open by the recorder, so nothing breaks.
--
-- Purged with retention like the other event logs (see purge job). Pseudonymous:
-- no visitor identifier is stored here, only the tenant + rule + timestamp.
--
-- Service-role only: RLS enabled, no policies.

CREATE TABLE IF NOT EXISTS public.rule_fire_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  rule_id     text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Aggregation is "count by rule within a window", so index on tenant+time and
-- tenant+rule.
CREATE INDEX IF NOT EXISTS rule_fire_events_tenant_time_idx
  ON public.rule_fire_events (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS rule_fire_events_tenant_rule_idx
  ON public.rule_fire_events (tenant_id, rule_id);

ALTER TABLE public.rule_fire_events ENABLE ROW LEVEL SECURITY;
