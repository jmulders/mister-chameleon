-- ============================================================================
-- ad_profiling_charges — behavioural-targeting profiling fee (per visitor/day)
-- ============================================================================
--
-- When an advertiser's ad is served WITH behavioural targeting, the visitor's
-- profile (journey/interest signals) is consulted. That "profiling" is billed
-- once per unique visitor per calendar day, regardless of how many impressions
-- follow. This table deduplicates the charge: a UNIQUE (ad_tenant_id,
-- session_id, charge_date) row is inserted at serve time (ON CONFLICT DO
-- NOTHING); the billing rollup then debits the advertiser wallet for unbilled
-- rows and flips `billed`.
--
-- Additive and idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS public.ad_profiling_charges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_tenant_id     text NOT NULL,
  session_id       text NOT NULL,
  charge_date      date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc'))::date,
  publisher_domain text,
  fee_cents        integer NOT NULL DEFAULT 2,
  billed           boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_tenant_id, session_id, charge_date)
);

CREATE INDEX IF NOT EXISTS idx_ad_profiling_unbilled
  ON public.ad_profiling_charges (ad_tenant_id)
  WHERE billed = false;

-- RLS on, no policies — all access is via the service-role client (bypasses RLS),
-- matching the other ad-network tables.
ALTER TABLE public.ad_profiling_charges ENABLE ROW LEVEL SECURITY;
