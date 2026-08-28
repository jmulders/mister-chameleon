-- Evolve ip_company_cache from a short-lived cache into a durable, cross-tenant
-- first-party company DB.
--
-- What changes:
--   • confidence       — match confidence (0.000–1.000), so downstream stages can
--                        gate on it (skip paid providers only above a threshold).
--   • last_verified_at — timestamp of the last PAID verification (Leadinfo/OpenKvK).
--                        Distinct from refreshed_at (any write); drives the
--                        serve-stale-while-revalidate cadence.
--   • verify_count     — number of paid verifications; observability + decay input.
--   • source           — which provider last verified the row ('leadinfo' | 'openkvk'
--                        | 'manual').
--
-- Keying is unchanged: cross-tenant, one row per ip_hash (a one-way HMAC of the IP;
-- the raw IP is never stored). No tenant_id — a paid identify runs at most once per
-- IP per freshness window and is reused by every tenant.

alter table public.ip_company_cache
  add column if not exists confidence       numeric(4,3),
  add column if not exists last_verified_at timestamptz,
  add column if not exists verify_count     integer not null default 0,
  add column if not exists source           text;

-- Backfill existing rows: treat the last refresh as the last verification, and
-- seed confidence at the historical Leadinfo default (0.75) for matched rows.
update public.ip_company_cache
   set last_verified_at = coalesce(last_verified_at, refreshed_at),
       confidence       = coalesce(confidence, case when matched then 0.75 else null end),
       verify_count     = case when verify_count = 0 and matched then 1 else verify_count end
 where last_verified_at is null
    or (confidence is null and matched);

-- Staleness scans (serve-stale-while-revalidate + the retention sweep) order by
-- last_verified_at; index it so those stay fast as the table grows durably.
create index if not exists ip_company_cache_last_verified_idx
  on public.ip_company_cache (last_verified_at);
