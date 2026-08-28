-- PRODUCTION SQL — ip_company_cache durable first-party company DB (migration 175)
--
-- Apply manually against prod (project kdhfpvjeriszteqhpgll) and record in
-- public._migrations under filename '20240101000175_ip_company_cache_durable.sql'.
-- Idempotent: safe to re-run.

alter table public.ip_company_cache
  add column if not exists confidence       numeric(4,3),
  add column if not exists last_verified_at timestamptz,
  add column if not exists verify_count     integer not null default 0,
  add column if not exists source           text;

update public.ip_company_cache
   set last_verified_at = coalesce(last_verified_at, refreshed_at),
       confidence       = coalesce(confidence, case when matched then 0.75 else null end),
       verify_count     = case when verify_count = 0 and matched then 1 else verify_count end
 where last_verified_at is null
    or (confidence is null and matched);

create index if not exists ip_company_cache_last_verified_idx
  on public.ip_company_cache (last_verified_at);

-- Ledger:
-- insert into public._migrations (filename) values ('20240101000175_ip_company_cache_durable.sql')
--   on conflict (filename) do nothing;
