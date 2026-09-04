/**
 * First-party LOCATION enricher stage (CBS StatLine buurt statistics), LAZY.
 *
 * Adds neighbourhood firmographics — the official CBS urbanity class, income
 * band, business share — to the enrichment output by resolving the visitor's CBS
 * buurtcode and looking it up in cbs_area_stats. Because CBS OData v3 cannot be
 * bulk-paginated, the table is filled lazily: on a cache miss we fetch that ONE
 * buurt live (single-predicate `eq`), cache it, and use it.
 *
 * Flow:
 *   1. Resolve a buurtcode from the best available location signal (see below).
 *   2. Look up cbs_area_stats (cache).
 *   3. MISS → fetch the single buurt live from CBS, map, upsert, use.
 *   4. Empty CBS result (buurt not in the dataset, e.g. recoding) → short-lived
 *      negative cache so we stop re-querying CBS for it.
 * All external calls fail open (no enrichment on error), never break the render.
 *
 * ─── Location precedence & accuracy (most → least precise) ────────────────────
 *   1. Form postcode  — exact buurt for that postcode (PC6 ≈ a street); precise.
 *   2. Form place     — COARSE: the city/place centroid's buurt (city-level).
 *   3. IP lat/lng     — the buurt at the IP geolocation (city/district precision;
 *                       accurate for fixed lines, looser for mobile/CGNAT).
 *      3b. IP CITY-FIRST (mismatch) — when the IP city (IPinfo) and the reverse-
 *                       geocoded city of the IP coordinates (MaxMind) DISAGREE,
 *                       the coordinates are incoherent with the reliable city, so
 *                       we resolve the buurt via the CITY centroid instead. COARSE.
 *   4. GA4 last-known city — COARSE: forward-geocode the GA4 city name to its
 *                       centroid buurt. Representative of the CITY, not the
 *                       visitor's actual neighbourhood — a last resort used only
 *                       when there is no lat/lng and no form location.
 *   Coarse tiers (form-place, ip-city, ga4-city) set locationConfidence="low";
 *   precise tiers (form-postcode, ip-geo) set "high". A mismatch also sets
 *   locationCityCoordMismatch=true. All are surfaced in the /demo debug (and
 *   persisted on the output, so they survive a session-cache hit).
 *
 * NL-only; runs sequentially (after wave 2) so geo has resolved lat/lng and GA4
 * history has resolved gaLastKnownCity.
 *
 * CAVEAT: PDOK's buurtcode vintage must match the CBS dataset year (85984NED =
 * 2024 indeling). A mismatch yields an empty `eq` → no enrichment (fail-open).
 *
 * Billing: a first-party location_lookup event (cache_hit=true, small credit) is
 * charged post-pipeline in build-decision-context when a location is resolved —
 * mirroring the first-party company DB.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import type { CbsAreaStats } from "../cbs-location-store";
import type { CbsFetchResult } from "@/lib/enrichment/cbs-ingest";
import type { GeoResolveResult } from "@/lib/enrichment/pdok-geocode";
import { DEFAULT_CBS_DATASET } from "@/lib/enrichment/cbs-ingest";

/** Short-lived negative cache: buurtcode → expiry ms. Empty CBS results only. */
const NEGATIVE_TTL_MS = 6 * 60 * 60 * 1_000;
const negativeCache = new Map<string, number>();

/** Test helper: clear the module-level negative cache between cases. */
export function resetCbsNegativeCache(): void { negativeCache.clear(); }

/**
 * Normalise a city name for coherence comparison: lowercase, strip accents,
 * drop a leading "gemeente "/"'s-" style noise and non-alphanumerics. So
 * "Den Haag" vs "'s-Gravenhage" still differ (they are genuinely different
 * strings), but "Rotterdam " and "rotterdam" match. Conservative on purpose —
 * a false "match" would skip the city-first fallback we want.
 */
export function normalizeCityName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface CbsLocationOptions {
  /** CBS dataset id for the live per-buurt fetch. Default 85984NED. */
  datasetId?:   string;
  /** Source year recorded on rows written by the lazy fetch. */
  sourceYear?:  number;
  /**
   * Injectable lat/lng→buurtcode geocoder (defaults to PDOK) — for tests. May
   * return a bare code|null (code → "ok", null → genuine "empty") or a classified
   * {@link GeoResolveResult} to simulate a transient ("error") failure.
   */
  geocode?:     (lat: number, lng: number) => Promise<string | GeoResolveResult | null>;
  /** Injectable form-location→buurtcode geocoder (defaults to PDOK forward) — for tests.
   *  `houseNumber` enables the exact address-level buurt lookup when present. */
  formGeocode?: (postcode: string | null, place: string | null, houseNumber?: string | null) => Promise<string | GeoResolveResult | null>;
  /** Injectable cache lookup (defaults to the DB store) — for tests. */
  cacheLookup?: (areaCode: string) => Promise<CbsAreaStats | null>;
  /** Injectable single-buurt live fetch (defaults to CBS OData) — for tests. */
  liveFetch?:   (datasetId: string, areaCode: string) => Promise<CbsFetchResult>;
  /** Injectable cache upsert (defaults to the DB store) — for tests. */
  upsert?:      (row: Record<string, unknown>) => Promise<void>;
  isDev?:       boolean;
}

export function createCbsLocationEnricher(options: CbsLocationOptions = {}): StagedEnricher {
  const datasetId  = options.datasetId ?? DEFAULT_CBS_DATASET;
  const sourceYear = options.sourceYear ?? 0;
  const isDev      = options.isDev ?? false;

  // Both geocoders return a classified {status, code}: "error" = transient PDOK
  // failure (retry later), "empty" = genuine no-buurt, "ok" = resolved. An
  // injected geocoder (tests) returns a bare code|null; adapt it to the classified
  // shape — a returned code is "ok", a null is a genuine "empty".
  const asResult = (v: string | GeoResolveResult | null): GeoResolveResult => {
    if (v && typeof v === "object") return v; // already a classified result
    return v ? { status: "ok", code: v } : { status: "empty", code: null };
  };

  async function geocode(lat: number, lng: number): Promise<GeoResolveResult> {
    if (options.geocode) return asResult(await options.geocode(lat, lng));
    return (await import("@/lib/enrichment/pdok-geocode")).resolveBuurtcodeFromLatLng(lat, lng);
  }
  async function formGeocode(postcode: string | null, place: string | null, houseNumber?: string | null): Promise<GeoResolveResult> {
    if (options.formGeocode) return asResult(await options.formGeocode(postcode, place, houseNumber));
    // houseNumber (when present) routes through the exact address-level lookup;
    // positional undefined,undefined keep the default timeout + fetch.
    return (await import("@/lib/enrichment/pdok-geocode"))
      .resolveBuurtcodeFromFormLocation(postcode, place, undefined, undefined, houseNumber);
  }
  async function cacheLookup(areaCode: string): Promise<CbsAreaStats | null> {
    if (options.cacheLookup) return options.cacheLookup(areaCode);
    return (await import("../cbs-location-store")).getCbsStatsForArea(areaCode);
  }
  async function liveFetch(ds: string, areaCode: string): Promise<CbsFetchResult> {
    if (options.liveFetch) return options.liveFetch(ds, areaCode);
    return (await import("@/lib/enrichment/cbs-ingest")).fetchCbsArea(ds, areaCode);
  }
  async function upsert(row: Record<string, unknown>): Promise<void> {
    if (options.upsert) return options.upsert(row);
    return (await import("../cbs-location-store")).upsertCbsArea(row);
  }

  /** Cache miss → negative-cache check → live single-buurt fetch → map + upsert. */
  async function resolveFromCbs(areaCode: string): Promise<CbsAreaStats | null> {
    const now = Date.now();
    const negExpiry = negativeCache.get(areaCode);
    if (negExpiry && negExpiry > now) return null; // recently empty — don't re-query

    const result = await liveFetch(datasetId, areaCode);
    if (result.status === "empty") {
      negativeCache.set(areaCode, now + NEGATIVE_TTL_MS);
      return null;
    }
    if (result.status === "error") return null; // transient — do not cache

    const { mapCbsRow } = await import("@/lib/enrichment/cbs-ingest");
    const mapped = mapCbsRow(result.raw, sourceYear, datasetId);
    if (!mapped) return null;
    await upsert(mapped);
    return {
      areaCode:      mapped.area_code,
      urbanityProxy: mapped.urbanity_proxy,
      incomeBand:    mapped.income_band,
      businessShare: mapped.business_share,
      avgGasUsage:            mapped.location_avg_gas_usage,
      avgElectricityUsage:    mapped.location_avg_electricity_usage,
      solarPct:               mapped.location_solar_pct,
      avgWozValue:            mapped.location_avg_woz_value,
      dominantBusinessSector: mapped.location_dominant_business_sector,
      pctHouseholdsWithChildren: mapped.location_pct_households_with_children,
      pctSinglePersonHouseholds: mapped.location_pct_single_person_households,
      avgHouseholdSize:          mapped.location_avg_household_size,
      pctAge0_15:                mapped.location_pct_age_0_15,
      pctAge15_25:               mapped.location_pct_age_15_25,
      pctAge25_45:               mapped.location_pct_age_25_45,
      pctAge45_65:               mapped.location_pct_age_45_65,
      pctAge65Plus:              mapped.location_pct_age_65_plus,
      pctMarried:                mapped.location_pct_married,
      pctUnmarried:              mapped.location_pct_unmarried,
      pctDivorced:               mapped.location_pct_divorced,
      pctWidowed:                mapped.location_pct_widowed,
      pctSingleFamilyHomes:      mapped.location_pct_single_family_homes,
      pctMultiFamilyHomes:       mapped.location_pct_multi_family_homes,
      pctDetachedHomes:          mapped.location_pct_detached_homes,
      pctOwnerOccupied:          mapped.location_pct_owner_occupied,
      pctRental:                 mapped.location_pct_rental,
      pctSocialHousing:          mapped.location_pct_social_housing,
      pctHigherEducated:         mapped.location_pct_higher_educated,
      pctLowerEducated:          mapped.location_pct_lower_educated,
      medianHouseholdWealth:     mapped.location_median_household_wealth,
      avgIncomePerEarner:        mapped.location_avg_income_per_earner,
      povertyPct:                mapped.location_poverty_pct,
      carsPerHousehold:          mapped.location_cars_per_household,
      pctNonPetrolCars:          mapped.location_pct_non_petrol_cars,
      avgElectricityFeedback:    mapped.location_avg_electricity_feedback,
    };
  }

  return {
    label:    "CBS Location",
    stageKey: "cbs-location",

    shouldRun: (input: EnricherInput, accumulated: Partial<EnrichmentOutput>): boolean => {
      // An explicit form-provided location fires the stage regardless of IP geo /
      // country (the visitor gave their own NL location).
      const fl = input.formLocation;
      if (fl && (fl.postcode || fl.place)) return true;
      const country = accumulated.addressCountry ?? accumulated.countryCode;
      if (country && country.toUpperCase() !== "NL") return false;
      if (accumulated.latitude != null && accumulated.longitude != null) return true;
      // Coarse fallback: no lat/lng, but the GA4 enricher knows a last-known city.
      return Boolean(accumulated.gaLastKnownCity);
    },

    enricher: async (input: EnricherInput, accumulated: Partial<EnrichmentOutput>, ctx?: EnricherContext) => {
      // Resolve a buurtcode from the most precise signal available (see the
      // precedence/accuracy note in the header). Each attempt returns a classified
      // result: "error" = transient PDOK failure (retry later, do not cache the
      // miss), "empty" = genuine no-buurt, "ok" = resolved.
      let areaCode: string | null = null;
      let source: "form-postcode" | "form-place" | "ip-geo" | "ip-city" | "ga4-city" = "ip-geo";
      let transient = false; // any attempt failed transiently → mark the stage for retry
      let mismatch = false;  // IP city ≠ reverse-geocoded city of the IP coordinates

      const note = (r: GeoResolveResult) => { if (r.status === "error") transient = true; };

      const fl = input.formLocation;
      if (fl && (fl.postcode || fl.place)) {
        // 1/2. Explicit form location. With a house number this resolves the
        //   EXACT address-level buurt (postcode + huisnummer → PDOK type:adres),
        //   which is precise even when the PC6 centroid sits in another/central
        //   buurt; without one it falls back to the postcode centroid (or the
        //   place centroid, coarse). See resolveBuurtcodeFromFormLocation.
        const r = await formGeocode(fl.postcode ?? null, fl.place ?? null, fl.houseNumber ?? null);
        note(r); areaCode = r.code;
        source   = fl.postcode ? "form-postcode" : "form-place";
      }
      if (!areaCode && accumulated.latitude != null && accumulated.longitude != null) {
        // 3. IP-derived location. City and coordinates can come from DIFFERENT
        //    providers (IPinfo city vs MaxMind coordinates — see geo precedence),
        //    which can leave them pointing at different places. When the reliable
        //    IP city disagrees with the reverse-geocoded city of the coordinates,
        //    resolve the buurt via the CITY (coarse) instead of trusting the
        //    incoherent coordinates. Otherwise use the coordinates (precise).
        const ipCity  = accumulated.city;
        const revCity = accumulated.addressCity; // reverse-geocoded from lat/lng
        mismatch = Boolean(ipCity && revCity && normalizeCityName(ipCity) !== normalizeCityName(revCity));

        if (mismatch && ipCity) {
          const r = await formGeocode(null, ipCity); // city centroid → buurt (coarse)
          note(r); areaCode = r.code;
          source   = "ip-city";
        } else {
          const r = await geocode(accumulated.latitude, accumulated.longitude);
          note(r); areaCode = r.code;
          source   = "ip-geo";
        }
      }
      if (!areaCode && accumulated.gaLastKnownCity) {
        // 4. COARSE: forward-geocode the GA4 last-known city to a centroid buurt.
        //    Same PDOK forward → centroid → reverse(type=buurt) flow as the
        //    form-place fallback; representative of the city, not the visitor's
        //    actual buurt. Last resort only (no lat/lng, no form location).
        const r = await formGeocode(null, accumulated.gaLastKnownCity);
        note(r); areaCode = r.code;
        source   = "ga4-city";
      }
      if (!areaCode) {
        // No buurtcode. Distinguish a TRANSIENT PDOK failure (retry on a later
        // request — do not let one timeout pin an empty location for the whole
        // session) from a genuine miss (PDOK answered "no buurt"). The note is
        // persisted on the output so /demo shows WHY even on a later cache hit.
        const n = transient
          ? `no buurtcode: PDOK transient failure (source=${source}) → retry`
          : `no buurtcode from PDOK (source=${source})`;
        if (transient) ctx?.markRetry(`PDOK transient failure resolving buurtcode (source=${source})`);
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      // Resolve buurt stats: cache first, then a single live CBS fetch. Track WHICH
      // so the debug overlay shows hit/miss instead of a silent empty output.
      let stats = await cacheLookup(areaCode);
      let statsSource: "cache" | "live" | "empty" = stats ? "cache" : "empty";
      if (!stats) {
        stats = await resolveFromCbs(areaCode);
        if (stats) statsSource = "live";
      }
      if (!stats) {
        const n = `buurtcode=${areaCode} (${source}) · cbs=empty→negative-cache`;
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      // Require at least one usable attribute (avoid billing an all-suppressed row).
      const demographic = [
        stats.pctHouseholdsWithChildren, stats.pctSinglePersonHouseholds, stats.avgHouseholdSize,
        stats.pctAge0_15, stats.pctAge15_25, stats.pctAge25_45, stats.pctAge45_65, stats.pctAge65Plus,
        stats.pctMarried, stats.pctUnmarried, stats.pctDivorced, stats.pctWidowed,
        stats.pctSingleFamilyHomes, stats.pctMultiFamilyHomes, stats.pctDetachedHomes,
        stats.pctOwnerOccupied, stats.pctRental, stats.pctSocialHousing,
        stats.pctHigherEducated, stats.pctLowerEducated,
        stats.medianHouseholdWealth, stats.avgIncomePerEarner, stats.povertyPct,
        stats.carsPerHousehold, stats.pctNonPetrolCars, stats.avgElectricityFeedback,
      ].some((v) => v != null);
      const hasAnyAttribute =
        stats.urbanityProxy != null || stats.incomeBand != null || stats.businessShare != null ||
        stats.avgGasUsage != null || stats.avgElectricityUsage != null || stats.solarPct != null ||
        stats.avgWozValue != null || stats.dominantBusinessSector != null || demographic;
      if (!hasAnyAttribute) {
        const n = `buurtcode=${areaCode} (${source}) · cbs=${statsSource} but all attributes suppressed`;
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      // Confidence: "high" only for a precise, coherent signal (form postcode, or
      // IP coordinates that agreed with the IP city). A city/place centroid, the
      // GA4 city, or the city-first mismatch fallback are all COARSE → "low".
      const confidence: "high" | "low" =
        source === "form-postcode" || source === "ip-geo" ? "high" : "low";

      const out: Partial<EnrichmentOutput> = {
        locationAreaCode:          areaCode,
        locationConfidence:        confidence,
        locationCityCoordMismatch: mismatch,
      };
      if (stats.urbanityProxy != null) out.locationUrbanityClass = stats.urbanityProxy;
      if (stats.incomeBand)            out.locationIncomeBand    = stats.incomeBand;
      if (stats.businessShare != null) out.locationBusinessShare = stats.businessShare;
      // D5 Fase 0 — energy / solar / WOZ / dominant sector (persisted on the output).
      if (stats.avgGasUsage != null)            out.locationAvgGasUsage         = stats.avgGasUsage;
      if (stats.avgElectricityUsage != null)    out.locationAvgElectricityUsage = stats.avgElectricityUsage;
      if (stats.solarPct != null)               out.locationSolarPct            = stats.solarPct;
      if (stats.avgWozValue != null)            out.locationAvgWozValue         = stats.avgWozValue;
      if (stats.dominantBusinessSector)         out.locationDominantBusinessSector = stats.dominantBusinessSector;
      // D5 Fase 0 (vervolg) — demografie / wonen / opleiding / welvaart / mobiliteit.
      if (stats.pctHouseholdsWithChildren != null) out.locationPctHouseholdsWithChildren = stats.pctHouseholdsWithChildren;
      if (stats.pctSinglePersonHouseholds != null) out.locationPctSinglePersonHouseholds = stats.pctSinglePersonHouseholds;
      if (stats.avgHouseholdSize != null)          out.locationAvgHouseholdSize          = stats.avgHouseholdSize;
      if (stats.pctAge0_15 != null)                out.locationPctAge0_15                = stats.pctAge0_15;
      if (stats.pctAge15_25 != null)               out.locationPctAge15_25               = stats.pctAge15_25;
      if (stats.pctAge25_45 != null)               out.locationPctAge25_45               = stats.pctAge25_45;
      if (stats.pctAge45_65 != null)               out.locationPctAge45_65               = stats.pctAge45_65;
      if (stats.pctAge65Plus != null)              out.locationPctAge65Plus              = stats.pctAge65Plus;
      if (stats.pctMarried != null)                out.locationPctMarried                = stats.pctMarried;
      if (stats.pctUnmarried != null)              out.locationPctUnmarried              = stats.pctUnmarried;
      if (stats.pctDivorced != null)               out.locationPctDivorced               = stats.pctDivorced;
      if (stats.pctWidowed != null)                out.locationPctWidowed                = stats.pctWidowed;
      if (stats.pctSingleFamilyHomes != null)      out.locationPctSingleFamilyHomes      = stats.pctSingleFamilyHomes;
      if (stats.pctMultiFamilyHomes != null)       out.locationPctMultiFamilyHomes       = stats.pctMultiFamilyHomes;
      if (stats.pctDetachedHomes != null)          out.locationPctDetachedHomes          = stats.pctDetachedHomes;
      if (stats.pctOwnerOccupied != null)          out.locationPctOwnerOccupied          = stats.pctOwnerOccupied;
      if (stats.pctRental != null)                 out.locationPctRental                 = stats.pctRental;
      if (stats.pctSocialHousing != null)          out.locationPctSocialHousing          = stats.pctSocialHousing;
      if (stats.pctHigherEducated != null)         out.locationPctHigherEducated         = stats.pctHigherEducated;
      if (stats.pctLowerEducated != null)          out.locationPctLowerEducated          = stats.pctLowerEducated;
      if (stats.medianHouseholdWealth != null)     out.locationMedianHouseholdWealth     = stats.medianHouseholdWealth;
      if (stats.avgIncomePerEarner != null)        out.locationAvgIncomePerEarner        = stats.avgIncomePerEarner;
      if (stats.povertyPct != null)                out.locationPovertyPct                = stats.povertyPct;
      if (stats.carsPerHousehold != null)          out.locationCarsPerHousehold          = stats.carsPerHousehold;
      if (stats.pctNonPetrolCars != null)          out.locationPctNonPetrolCars          = stats.pctNonPetrolCars;
      if (stats.avgElectricityFeedback != null)    out.locationAvgElectricityFeedback    = stats.avgElectricityFeedback;

      // Note carries the coherence decision + per-field geo provenance so it is
      // visible in the /demo debug even when the pipeline was a session-cache hit.
      const prov = `city←${accumulated.geoCitySource ?? "?"} coords←${accumulated.geoCoordsSource ?? "?"}`;
      const mismatchTag = mismatch
        ? ` · MISMATCH city="${accumulated.city}"≠revgeo="${accumulated.addressCity}" → buurt via city`
        : "";
      const n = `buurtcode=${areaCode} (${source}, ${confidence}) · cbs=${statsSource} · ${prov}${mismatchTag}`;
      out.locationResolutionNote = n;
      ctx?.setNote(n);
      if (isDev) {
        const coarse = confidence === "low";
        console.debug("[cbs-location] resolved", { areaCode, source, statsSource, coarse, mismatch, ...out });
      }
      return out;
    },
  };
}
