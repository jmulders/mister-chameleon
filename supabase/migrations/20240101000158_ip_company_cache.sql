-- Migration 158 — ip_company_cache
--
-- A platform-wide IP→company lookup cache, keyed by IP address. Every server-side
-- Leadinfo identify call (both the ads path and the CMS enrichment chain) writes
-- its result here and reads it back first, so a paid Leadinfo lookup runs at most
-- once per IP per freshness window — shared across ALL tenants (we use one
-- platform Leadinfo key). This is our own firmographic database: we stop paying
-- Leadinfo for IPs we already know.
--
-- Freshness is enforced in application code (lib/../ip-company-cache-ttl.ts):
--   matched rows   → fresh for 30 days
--   no-match rows  → fresh for 7 days
-- A stale row is simply re-queried and overwritten (upsert on the ip PK).
--
-- `raw` stores the full Leadinfo response payload so we retain everything Leadinfo
-- could resolve, even fields we don't map into columns yet.
--
-- Service-role only: RLS is enabled with no policies (matches ad_company_cache).

CREATE TABLE IF NOT EXISTS public.ip_company_cache (
  ip               text PRIMARY KEY,
  matched          boolean     NOT NULL DEFAULT false,
  company_name     text,
  company_domain   text,
  company_industry text,
  company_size     text,
  country_code     text,
  region           text,
  city             text,
  raw              jsonb,
  refreshed_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Prune helper: find stale rows quickly (optional housekeeping).
CREATE INDEX IF NOT EXISTS ip_company_cache_refreshed_at_idx
  ON public.ip_company_cache (refreshed_at);

ALTER TABLE public.ip_company_cache ENABLE ROW LEVEL SECURITY;
-- No policies → only the service-role key (getDb) can read/write.
