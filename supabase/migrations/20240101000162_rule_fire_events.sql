-- Migration 162 — rule_fire_daily (per-rule, per-day fire counter)
--
-- Diagnostics for "does each rule actually fire, and how often". An append-only
-- log (one row per fire) would be a hot-path write producing tens of millions of
-- rows/month at scale — the opposite of the read we just took OFF the hot path.
-- A per-rule-per-day counter answers the same question for a fraction of the
-- storage: at most (#rules × #days) rows per tenant.
--
-- The increment is a single atomic upsert (via increment_rule_fire) so concurrent
-- fires can't lose counts. Writes are fire-and-forget from the decide path.
-- Purged with retention like the other logs.
--
-- Supersedes the earlier append-only rule_fire_events table (dropped here).
--
-- Service-role only: RLS enabled, no policies.

DROP TABLE IF EXISTS public.rule_fire_events;

CREATE TABLE IF NOT EXISTS public.rule_fire_daily (
  tenant_id text    NOT NULL,
  rule_id   text    NOT NULL,
  day       date    NOT NULL DEFAULT current_date,
  count     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, rule_id, day)
);

CREATE INDEX IF NOT EXISTS rule_fire_daily_tenant_day_idx
  ON public.rule_fire_daily (tenant_id, day);

ALTER TABLE public.rule_fire_daily ENABLE ROW LEVEL SECURITY;

-- Atomic "add N to the counter for this (tenant, rule, day)". The recorder
-- buffers fires in memory and flushes once per minute, so this is called at most
-- once per rule per minute (per instance) with the batched count — no per-fire
-- write and no hot-row lock contention on the decide path. p_count/p_day default
-- to a single fire today for backward compatibility.
CREATE OR REPLACE FUNCTION public.increment_rule_fire(
  p_tenant_id text,
  p_rule_id   text,
  p_count     integer DEFAULT 1,
  p_day       date    DEFAULT current_date
)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.rule_fire_daily (tenant_id, rule_id, day, count)
  VALUES (p_tenant_id, p_rule_id, p_day, p_count)
  ON CONFLICT (tenant_id, rule_id, day)
  DO UPDATE SET count = public.rule_fire_daily.count + EXCLUDED.count;
$$;
