-- migration 183 — pc6_energy_stats (netbeheerder kleinverbruik energy per PC6)
--
-- Fase 2 van de location-enrichment-bronnen (docs/design/location-enrichment-sources.md):
-- per-PC6 energieverbruik + zonne-adoptie uit de open data van de netbeheerders
-- (Liander / Stedin / Enexis eerst; overige 5 later). Bulk-ingest zoals de
-- CBS-backfill, opgezocht op PC6-range in het lazy netbeheer-energy-enricher-stage.
--
-- Eén rij per (netbeheerder, postcode_van, postcode_tot) — ELK en GAS uit het
-- bronbestand zijn gepivot naar één rij. De meeste rijen zijn een exacte PC6
-- (postcode_van == postcode_tot); bij < 10 aansluitingen levert de bron een
-- samengevoegde postcode-reeks (VAN != TOT), vandaar de range-opzoeking.
--
--   solar_feedback_pct = 100 − LEVERINGSRICHTING_PERC (geclamped 0–100): hoger =
--   meer teruglevering ⇒ meer zon-op-dak. Afgeleid uit de ELK-regel.
--
-- ⚠ Scope: alleen KLEINVERBRUIK (huishoudens + klein-zakelijk, tot 3×80A / G25).
-- Grootverbruik (zware B2B-panden) zit hier NIET in. PC6-granulariteit — fijner
-- dan de bestaande CBS-buurt-signalen, die naast deze blijven bestaan.
--
-- Service-role only: RLS aan, geen policies (zelfde patroon als cbs_area_stats /
-- bag_address_cache). Additief + idempotent. Prod-SQL apart aangeleverd.

CREATE TABLE IF NOT EXISTS pc6_energy_stats (
  netbeheerder        TEXT         NOT NULL,               -- "liander" | "stedin" | "enexis" | ...
  postcode_van        TEXT         NOT NULL,               -- PC6 "1234AB" (4 cijfers + 2 letters, geen spatie)
  postcode_tot        TEXT         NOT NULL,               -- == postcode_van voor een exacte PC6, anders reeks-eind
  avg_gas_m3          NUMERIC,                             -- SJA_GEMIDDELD bij PRODUCTSOORT=GAS (m³/jaar)
  avg_elk_kwh         NUMERIC,                             -- SJA_GEMIDDELD bij PRODUCTSOORT=ELK (kWh/jaar)
  solar_feedback_pct  NUMERIC,                             -- 100 − LEVERINGSRICHTING_PERC (ELK), geclamped 0–100
  connections_count   INTEGER,                             -- AANSLUITINGEN_AANTAL (max van ELK/GAS)
  smart_meter_pct     NUMERIC,                             -- SLIMME_METER_PERC (ELK)
  peildatum           DATE,                                -- peildatum uit de bron (1 jan)
  source_year         INTEGER,                             -- jaargang van het bronbestand
  refreshed_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (netbeheerder, postcode_van, postcode_tot)   -- idempotente ingest-sleutel
);

COMMENT ON TABLE pc6_energy_stats IS 'Netbeheerder kleinverbruik energie per PC6 (Fase 2). Bulk-ingest via npm run netbeheer:ingest; range-lookup in de netbeheer-energy-enricher. Alleen kleinverbruik.';

-- Range-lookup: rij waar postcode_van <= pc6 <= postcode_tot. PC6-strings hebben
-- een vast formaat, dus lexicografische ordening == postcode-ordening.
CREATE INDEX IF NOT EXISTS pc6_energy_stats_range_idx ON pc6_energy_stats (postcode_van, postcode_tot);

ALTER TABLE pc6_energy_stats ENABLE ROW LEVEL SECURITY;
