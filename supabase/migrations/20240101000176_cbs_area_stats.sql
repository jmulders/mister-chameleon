-- First-party LOCATION reference data: CBS StatLine per-neighbourhood (buurt)
-- statistics, keyed by CBS buurtcode (WijkenEnBuurten, e.g. "BU03630000").
--
-- Cross-tenant, platform-wide reference table populated by the CBS ingestion job
-- from CBS StatLine "Kerncijfers wijken en buurten" (dataset 85984NED, or a later
-- yearly edition; configurable). The location enricher reverse-geocodes the
-- visitor's lat/lng to a buurtcode (PDOK) and joins this table to add
-- neighbourhood firmographics (income band, business share, a density-derived
-- urbanity proxy) to the rule context.
--
-- Only aggregated neighbourhood-level figures are stored (no personal data). CBS
-- suppresses small-count cells; suppressed values are stored as NULL, never 0.

create table if not exists public.cbs_area_stats (
  area_code          text        primary key,   -- CBS buurtcode, e.g. "BU03630000"
  -- Income
  avg_income         numeric(12,3),              -- GemiddeldInkomenPerInwoner in euros (CBS "x 1 000 euro" unit applied)
  low_income_pct     numeric(6,3),               -- % persons in the lowest-income group (k_40…)
  high_income_pct    numeric(6,3),               -- % persons in the highest-income group (k_20…)
  income_band        text,                        -- derived: "low" | "mid" | "high"
  -- Business activity
  business_total     integer,                     -- BedrijfsvestigingenTotaal
  -- Density (urbanity proxy — density-derived, NOT the official CBS stedelijkheidsklasse)
  population_density integer,                      -- Bevolkingsdichtheid (inhabitants/km2)
  urbanity_proxy     smallint,                     -- 1 (most dense) .. 5 (least dense), derived from density
  inhabitants        integer,                      -- AantalInwoners (business-share denominator)
  business_share     numeric(6,4),                -- business_total / inhabitants (0..1), derived
  source_year        smallint    not null,
  source_dataset     text,                         -- CBS dataset id used, e.g. "85984NED"
  raw                jsonb,                         -- full CBS row for audit / mapping fixes
  refreshed_at       timestamptz not null default now()
);

comment on table public.cbs_area_stats is
  'Cross-tenant CBS StatLine buurt (neighbourhood) statistics feeding the first-party location enricher. Aggregated open data only; suppressed cells are NULL.';
comment on column public.cbs_area_stats.urbanity_proxy is
  'Density-derived urbanity band (1 most dense .. 5 least dense). NOT the official CBS stedelijkheidsklasse.';

-- RLS on, service-role only (no policies) — mirrors ip_company_cache.
alter table public.cbs_area_stats enable row level security;
