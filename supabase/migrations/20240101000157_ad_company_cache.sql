-- ============================================================================
-- ad_company_cache — per-visitor/day IP→company resolution for ad targeting
-- ============================================================================
--
-- Firmographic ad targeting resolves the visitor's company (via Leadinfo) at
-- serve time. To avoid re-calling the paid provider on every pageview, the
-- day's resolution is cached here, keyed by (ad_tenant_id, session_id,
-- resolved_date). A row is written even on a no-match (matched = false) so we
-- don't retry a miss all day. The billable firmographic fee is recorded
-- separately in ad_profiling_charges (kind = 'firmographic').
--
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.ad_company_cache (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_tenant_id     text NOT NULL,
  session_id       text NOT NULL,
  resolved_date    date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc'))::date,
  matched          boolean NOT NULL DEFAULT false,
  company_name     text,
  company_industry text,
  company_size     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_tenant_id, session_id, resolved_date)
);

-- RLS on, no policies — all access via the service-role client (bypasses RLS).
ALTER TABLE public.ad_company_cache ENABLE ROW LEVEL SECURITY;
