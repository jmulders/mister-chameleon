-- PRODUCTION SQL — CBS buurt statistics table (migration 176)
--
-- Apply manually against prod (project kdhfpvjeriszteqhpgll) and record in
-- public._migrations under filename '20240101000176_cbs_area_stats.sql'.
-- Idempotent: safe to re-run.

create table if not exists public.cbs_area_stats (
  area_code          text        primary key,
  avg_income         numeric(12,3),
  low_income_pct     numeric(6,3),
  high_income_pct    numeric(6,3),
  income_band        text,
  business_total     integer,
  population_density integer,
  urbanity_proxy     smallint,
  inhabitants        integer,
  business_share     numeric(6,4),
  source_year        smallint    not null,
  source_dataset     text,
  raw                jsonb,
  refreshed_at       timestamptz not null default now()
);

comment on table public.cbs_area_stats is
  'Cross-tenant CBS StatLine buurt (neighbourhood) statistics feeding the first-party location enricher. Aggregated open data only; suppressed cells are NULL.';
comment on column public.cbs_area_stats.urbanity_proxy is
  'Density-derived urbanity band (1 most dense .. 5 least dense). NOT the official CBS stedelijkheidsklasse.';

alter table public.cbs_area_stats enable row level security;

-- Ledger:
-- insert into public._migrations (filename) values ('20240101000176_cbs_area_stats.sql')
--   on conflict (filename) do nothing;
