-- D5 Fase 0 — widen cbs_area_stats with energy / solar / WOZ / dominant-sector
-- columns from CBS 85984NED (dataset already loaded; only the mapping widens).
-- Additive + idempotent. Units verified live via the dataset's DataProperties:
--   gas m³, electricity kWh, solar %, WOZ "x 1 000 euro" (stored ×1000 as euro),
--   sector = the SBI group with the most establishments, stored as a slug.
--
-- Existing rows keep NULL until the next cbs:backfill (idempotent upsert fills them).

alter table public.cbs_area_stats
  add column if not exists location_avg_gas_usage            numeric,
  add column if not exists location_avg_electricity_usage    numeric,
  add column if not exists location_solar_pct                numeric,
  add column if not exists location_avg_woz_value            numeric,
  add column if not exists location_dominant_business_sector text;

comment on column public.cbs_area_stats.location_avg_gas_usage            is 'CBS 85984NED GemiddeldAardgasverbruik_55 — avg gas use per home (m³/year). NULL when CBS-suppressed.';
comment on column public.cbs_area_stats.location_avg_electricity_usage    is 'CBS 85984NED GemiddeldeElektriciteitslevering_53 — avg electricity per home (kWh/year). NULL when suppressed.';
comment on column public.cbs_area_stats.location_solar_pct                is 'CBS 85984NED WoningenMetZonnestroom_59 — share of homes with solar power (%). NULL when suppressed.';
comment on column public.cbs_area_stats.location_avg_woz_value            is 'CBS 85984NED GemiddeldeWOZWaardeVanWoningen_39 — avg WOZ value (euro, ×1000 from "x 1 000 euro"). NULL when suppressed.';
comment on column public.cbs_area_stats.location_dominant_business_sector is 'Dominant SBI sector (_96.._103) by establishment count, as a slug. NULL when all suppressed.';
