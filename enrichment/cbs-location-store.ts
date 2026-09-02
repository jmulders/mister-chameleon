/**
 * DB-backed reader for the CBS buurt (neighbourhood) statistics table
 * (cbs_area_stats), server-only.
 *
 * The location enricher looks up a visitor's CBS buurtcode here to add
 * neighbourhood firmographics to the enrichment output. Reads never throw: on any
 * failure we return null and the enricher simply adds no location fields.
 */

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

export interface CbsAreaStats {
  areaCode:       string;
  urbanityProxy:  number | null;   // official CBS MateVanStedelijkheid (density fallback when suppressed)
  incomeBand:     string | null;
  businessShare:  number | null;
  // D5 Fase 0 — energy / solar / WOZ / dominant sector. Optional so older cached
  // rows (and test fixtures) that predate these columns still type-check; the store
  // always populates them (null when the CBS cell is suppressed).
  avgGasUsage?:            number | null;   // m³
  avgElectricityUsage?:    number | null;   // kWh
  solarPct?:               number | null;   // %
  avgWozValue?:            number | null;   // euro
  dominantBusinessSector?: string | null;   // SBI-group slug
  // D5 Fase 0 (vervolg) — demografie / wonen / opleiding / welvaart / mobiliteit.
  // All optional so older cached rows / fixtures still type-check; percentages.
  pctHouseholdsWithChildren?: number | null;
  pctSinglePersonHouseholds?: number | null;
  avgHouseholdSize?:          number | null;
  pctAge0_15?:                number | null;
  pctAge15_25?:               number | null;
  pctAge25_45?:               number | null;
  pctAge45_65?:               number | null;
  pctAge65Plus?:              number | null;
  pctMarried?:                number | null;
  pctUnmarried?:              number | null;
  pctDivorced?:               number | null;
  pctWidowed?:                number | null;
  pctSingleFamilyHomes?:      number | null;
  pctMultiFamilyHomes?:       number | null;
  pctDetachedHomes?:          number | null;
  pctOwnerOccupied?:          number | null;
  pctRental?:                 number | null;
  pctSocialHousing?:          number | null;
  pctHigherEducated?:         number | null;
  pctLowerEducated?:          number | null;
  medianHouseholdWealth?:     number | null;   // euro
  avgIncomePerEarner?:        number | null;   // euro
  povertyPct?:                number | null;
  carsPerHousehold?:          number | null;
  pctNonPetrolCars?:          number | null;
  avgElectricityFeedback?:    number | null;   // kWh
}

const COLS = "area_code, urbanity_proxy, income_band, business_share, location_avg_gas_usage, location_avg_electricity_usage, location_solar_pct, location_avg_woz_value, location_dominant_business_sector, location_pct_households_with_children, location_pct_single_person_households, location_avg_household_size, location_pct_age_0_15, location_pct_age_15_25, location_pct_age_25_45, location_pct_age_45_65, location_pct_age_65_plus, location_pct_married, location_pct_unmarried, location_pct_divorced, location_pct_widowed, location_pct_single_family_homes, location_pct_multi_family_homes, location_pct_detached_homes, location_pct_owner_occupied, location_pct_rental, location_pct_social_housing, location_pct_higher_educated, location_pct_lower_educated, location_median_household_wealth, location_avg_income_per_earner, location_poverty_pct, location_cars_per_household, location_pct_non_petrol_cars, location_avg_electricity_feedback";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

/** Look up CBS statistics for a buurtcode (e.g. "BU03630000"). Null on miss/error. */
export async function getCbsStatsForArea(areaCode: string): Promise<CbsAreaStats | null> {
  if (!/^BU\d{8}$/.test(areaCode)) return null;
  try {
    const { data } = await db()
      .from("cbs_area_stats")
      .select(COLS)
      .eq("area_code", areaCode)
      .maybeSingle();
    if (!data) return null;
    const num = (v: unknown) => (v != null ? Number(v) : null);
    return {
      areaCode:      data.area_code,
      urbanityProxy: data.urbanity_proxy ?? null,
      incomeBand:    data.income_band ?? null,
      businessShare: num(data.business_share),
      avgGasUsage:            num(data.location_avg_gas_usage),
      avgElectricityUsage:    num(data.location_avg_electricity_usage),
      solarPct:               num(data.location_solar_pct),
      avgWozValue:            num(data.location_avg_woz_value),
      dominantBusinessSector: data.location_dominant_business_sector ?? null,
      pctHouseholdsWithChildren: num(data.location_pct_households_with_children),
      pctSinglePersonHouseholds: num(data.location_pct_single_person_households),
      avgHouseholdSize:          num(data.location_avg_household_size),
      pctAge0_15:                num(data.location_pct_age_0_15),
      pctAge15_25:               num(data.location_pct_age_15_25),
      pctAge25_45:               num(data.location_pct_age_25_45),
      pctAge45_65:               num(data.location_pct_age_45_65),
      pctAge65Plus:              num(data.location_pct_age_65_plus),
      pctMarried:                num(data.location_pct_married),
      pctUnmarried:              num(data.location_pct_unmarried),
      pctDivorced:               num(data.location_pct_divorced),
      pctWidowed:                num(data.location_pct_widowed),
      pctSingleFamilyHomes:      num(data.location_pct_single_family_homes),
      pctMultiFamilyHomes:       num(data.location_pct_multi_family_homes),
      pctDetachedHomes:          num(data.location_pct_detached_homes),
      pctOwnerOccupied:          num(data.location_pct_owner_occupied),
      pctRental:                 num(data.location_pct_rental),
      pctSocialHousing:          num(data.location_pct_social_housing),
      pctHigherEducated:         num(data.location_pct_higher_educated),
      pctLowerEducated:          num(data.location_pct_lower_educated),
      medianHouseholdWealth:     num(data.location_median_household_wealth),
      avgIncomePerEarner:        num(data.location_avg_income_per_earner),
      povertyPct:                num(data.location_poverty_pct),
      carsPerHousehold:          num(data.location_cars_per_household),
      pctNonPetrolCars:          num(data.location_pct_non_petrol_cars),
      avgElectricityFeedback:    num(data.location_avg_electricity_feedback),
    };
  } catch (err) {
    logger.debug("[cbs-location-store] lookup failed", { areaCode, error: String(err) });
    return null;
  }
}

/**
 * Upsert a mapped CBS row into cbs_area_stats (the lazy per-buurt cache write).
 * Never throws — a failed cache write must not break enrichment; the value is
 * still usable in-memory for this request.
 */
export async function upsertCbsArea(row: Record<string, unknown>): Promise<void> {
  try {
    await db()
      .from("cbs_area_stats")
      .upsert({ ...row, refreshed_at: new Date().toISOString() }, { onConflict: "area_code" });
  } catch (err) {
    logger.debug("[cbs-location-store] upsert failed", { error: String(err) });
  }
}
