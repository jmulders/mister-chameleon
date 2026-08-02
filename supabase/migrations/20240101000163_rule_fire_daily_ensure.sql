-- Migration 163 — rule_fire_daily ensure + drop legacy append table/overload
--
-- Migration 162 originally shipped an append-only `rule_fire_events` table and
-- was recorded as applied on existing environments BEFORE it was reworked into
-- the daily-counter design. A recorded migration never re-runs, so those
-- environments would otherwise stay on the old schema forever. This migration
-- brings every environment to the same end state — the daily counter, its
-- atomic 4-arg increment function, and no legacy append table or 2-arg overload.
--
-- Fully idempotent: safe on a fresh install (where 162 already created the daily
-- objects) and on an environment still on the append-log version.

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

-- Drop the original 2-arg overload so increment_rule_fire('a','b') can never be
-- ambiguous against the 4-arg version (whose p_count/p_day have defaults).
DROP FUNCTION IF EXISTS public.increment_rule_fire(text, text);

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
