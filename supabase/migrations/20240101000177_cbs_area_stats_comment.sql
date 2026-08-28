-- Comment-only migration: correct the cbs_area_stats.urbanity_proxy column
-- comment. Since #310 the column holds the OFFICIAL CBS stedelijkheidsklasse
-- (MateVanStedelijkheid), with the density-derived band only as a fallback when
-- CBS suppresses the official class. No schema change — the column is unchanged.

comment on column public.cbs_area_stats.urbanity_proxy is
  'CBS urbanity class (MateVanStedelijkheid): 1 zeer sterk stedelijk .. 5 niet stedelijk. Density-derived fallback when the official class is suppressed.';
