-- PRODUCTION SQL — cbs_area_stats.urbanity_proxy comment correction (migration 177)
--
-- Comment-only; no schema change. Apply manually against prod
-- (project kdhfpvjeriszteqhpgll) and record in public._migrations.
-- Idempotent: safe to re-run.

comment on column public.cbs_area_stats.urbanity_proxy is
  'CBS urbanity class (MateVanStedelijkheid): 1 zeer sterk stedelijk .. 5 niet stedelijk. Density-derived fallback when the official class is suppressed.';

insert into public._migrations (filename)
  values ('20240101000177_cbs_area_stats_comment.sql')
  on conflict do nothing;
