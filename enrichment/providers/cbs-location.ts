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
  /** Injectable form-location→buurtcode geocoder (defaults to PDOK forward) — for tests. */
  formGeocode?: (postcode: string | null, place: string | null) => Promise<string | GeoResolveResult | null>;
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
  async function formGeocode(postcode: string | null, place: string | null): Promise<GeoResolveResult> {
    if (options.formGeocode) return asResult(await options.formGeocode(postcode, place));
    return (await import("@/lib/enrichment/pdok-geocode")).resolveBuurtcodeFromFormLocation(postcode, place);
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
        // 1/2. Explicit form location (postcode primary, place coarse).
        const r = await formGeocode(fl.postcode ?? null, fl.place ?? null);
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
        // session) from a genuine miss (PDOK answered "no buurt").
        if (transient) {
          ctx?.markRetry(`PDOK transient failure resolving buurtcode (source=${source})`);
          ctx?.setNote(`no buurtcode: PDOK transient failure (source=${source}) → retry`);
        } else {
          ctx?.setNote(`no buurtcode from PDOK (source=${source})`);
        }
        return {};
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
        ctx?.setNote(`buurtcode=${areaCode} (${source}) · cbs=empty→negative-cache`);
        return {};
      }

      // Require at least one usable attribute (avoid billing an all-suppressed row).
      if (stats.urbanityProxy == null && stats.incomeBand == null && stats.businessShare == null) {
        ctx?.setNote(`buurtcode=${areaCode} (${source}) · cbs=${statsSource} but all attributes suppressed`);
        return {};
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

      // Note carries the coherence decision + per-field geo provenance so it is
      // visible in the /demo debug even when the pipeline was a session-cache hit.
      const prov = `city←${accumulated.geoCitySource ?? "?"} coords←${accumulated.geoCoordsSource ?? "?"}`;
      const mismatchTag = mismatch
        ? ` · MISMATCH city="${accumulated.city}"≠revgeo="${accumulated.addressCity}" → buurt via city`
        : "";
      ctx?.setNote(`buurtcode=${areaCode} (${source}, ${confidence}) · cbs=${statsSource} · ${prov}${mismatchTag}`);
      if (isDev) {
        const coarse = confidence === "low";
        console.debug("[cbs-location] resolved", { areaCode, source, statsSource, coarse, mismatch, ...out });
      }
      return out;
    },
  };
}
