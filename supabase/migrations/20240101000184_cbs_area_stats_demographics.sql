-- migration 184 — cbs_area_stats demographic / housing / wealth / mobility fields
--
-- D5 Fase 0 (vervolg): verbreedt de CBS-buurt-enricher (dataset 85984NED) met
-- genormaliseerde velden — zelfde patroon als migratie 180 (energie/WOZ/sector).
-- GEEN nieuwe bron: alleen het $select + de mapping in lib/enrichment/cbs-ingest.ts
-- worden breder. Alles additief + idempotent (ADD COLUMN IF NOT EXISTS).
--
-- Shares worden opgeslagen als PERCENTAGE (buurt-vergelijkbaar), 1 decimaal;
-- onderdrukte cellen of noemer null/0 → NULL (nooit 0, geen deling door 0),
-- via de bestaande null-veilige toNum-afhandeling. Bedragen in euro (bron in
-- duizend euro → ×1000). Prod-SQL apart aan Jasper; niet naar prod geschreven.

-- Huishoudenssamenstelling (noemer HuishoudensTotaal_29).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_households_with_children NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_single_person_households  NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_avg_household_size            NUMERIC;

-- Leeftijdsopbouw (noemer AantalInwoners_5).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_age_0_15   NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_age_15_25  NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_age_25_45  NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_age_45_65  NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_age_65_plus NUMERIC;

-- Burgerlijke staat (noemer AantalInwoners_5).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_married    NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_unmarried  NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_divorced   NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_widowed    NUMERIC;

-- Woningtype (bron al percentages).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_single_family_homes NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_multi_family_homes  NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_detached_homes      NUMERIC;

-- Eigendom (bron al percentages).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_owner_occupied NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_rental         NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_social_housing NUMERIC;

-- Opleiding (noemer = som laag+midden+hoog).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_higher_educated NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_lower_educated  NUMERIC;

-- Welvaart (bedragen → euro; armoede al %).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_median_household_wealth INTEGER;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_avg_income_per_earner   INTEGER;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_poverty_pct             NUMERIC;

-- Mobiliteit.
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_cars_per_household NUMERIC;
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_pct_non_petrol_cars NUMERIC;

-- Energie (extra — directer zonne-signaal).
ALTER TABLE cbs_area_stats ADD COLUMN IF NOT EXISTS location_avg_electricity_feedback INTEGER;

COMMENT ON COLUMN cbs_area_stats.location_pct_higher_educated  IS 'HboWo_69 / (BasisonderwijsVmboMbo1_67 + HavoVwoMbo24_68 + HboWo_69) ×100 (CBS 85984NED).';
COMMENT ON COLUMN cbs_area_stats.location_median_household_wealth IS 'MediaanVermogenVanParticuliereHuish_86 ×1000 (bron in duizend euro → euro).';
COMMENT ON COLUMN cbs_area_stats.location_pct_non_petrol_cars   IS 'PersonenautoSOverigeBrandstof_106 / PersonenautoSTotaal_104 ×100 (EV/overig-proxy).';
