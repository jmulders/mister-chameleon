/**
 * Reverse Geocode Enrichment Provider
 *
 * A standalone address/location enricher that resolves a lat/lng coordinate
 * (produced by an upstream geo stage) into human-readable address fields.
 *
 * ─── Role in the pipeline ─────────────────────────────────────────────────────
 *
 *   This enricher is NOT a primary company-detection mechanism.  Its job is
 *   to translate approximate lat/lng coordinates into readable address fields
 *   (country, region, city, municipality, postcode, formatted address).
 *
 *   Those address fields may then be used by downstream consumers — such as
 *   the OpenKvK candidate scorer — as additional location signals to improve
 *   match quality.  However, company identification remains the exclusive
 *   responsibility of the company enrichment stages.
 *
 *   The enricher MUST run after the geo stage so that `accumulated.latitude`
 *   and `accumulated.longitude` are available.  Its `shouldRun` gate enforces
 *   this ordering automatically.
 *
 * ─── Provider fallback chain ──────────────────────────────────────────────────
 *
 *   Priority order (tried in sequence; first success wins):
 *
 *   1. LocationIQ   — Requires a free API key.  High quality, low latency.
 *                     Endpoint: us1.locationiq.com/v1/reverse
 *                     Free tier: 5,000 req/day, 2 req/sec.
 *
 *   2. BigDataCloud — No API key required.  Free tier (10,000 req/month).
 *                     Endpoint: api.bigdatacloud.net/data/reverse-geocode-client
 *                     Returns principalSubdivision, city, locality, postcode.
 *
 *   3. Nominatim    — No API key required.  Rate-limited (1 req/sec).
 *                     Endpoint: nominatim.openstreetmap.org/reverse
 *                     OpenStreetMap data.  Must include User-Agent per ToS.
 *
 *   If a provider is not configured, fails, times out, or returns an empty
 *   response, the next provider in the chain is attempted immediately.
 *   If all providers fail the enricher returns {} (no address fields set).
 *
 * ─── Input ────────────────────────────────────────────────────────────────────
 *
 *   Consumed from `accumulated` (populated by prior geo stage):
 *     latitude    — from MaxMindGeoProvider / IpApiGeoProvider
 *     longitude   — from MaxMindGeoProvider / IpApiGeoProvider
 *
 *   The stage is skipped when either coordinate is null.
 *
 * ─── Output fields ───────────────────────────────────────────────────────────
 *
 *   addressCountry      — ISO 3166-1 alpha-2 country code
 *   addressRegion       — state / province / region name
 *   addressCity         — city name
 *   addressMunicipality — municipality / district (may differ from city)
 *   addressPostcode     — postal / ZIP code
 *   addressFormatted    — full human-readable formatted address
 *   addressSource       — "locationiq" | "bigdatacloud" | "nominatim"
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   Results are cached in a module-level ProviderCache keyed by the rounded
 *   lat/lng pair.  Coordinates are rounded to 3 decimal places (≈ 110 m
 *   granularity) to maximise cache reuse for nearby points.
 *
 *   Cache key:  "{lat.toFixed(3)},{lng.toFixed(3)}"
 *   Default TTL: 6 hours (configurable via `ReverseGeocodeOptions.cacheTtlMs`)
 *
 *   The cache is process-scoped (in-memory) — it resets on cold start, which
 *   is acceptable because address data for a given coordinate is stable.
 *
 * ─── Debug ────────────────────────────────────────────────────────────────────
 *
 *   When `isDev` is true the enricher emits console.debug entries for:
 *     • which lat/lng was resolved
 *     • whether the cache was hit or missed
 *     • which provider was attempted and whether it succeeded or fell through
 *     • whether a fallback provider was used
 *     • the normalised address fields returned
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   The enricher always resolves — never rejects.  If every provider in the
 *   chain fails the enricher returns {} and records the failure in a debug log.
 *   Provider errors are absorbed; they never propagate to the pipeline.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import { ProviderCache } from "../provider-cache";

// ── Normalised address output ─────────────────────────────────────────────────

/**
 * Normalised address fields produced by a single reverse-geocode provider.
 * All fields are optional — providers may omit fields they cannot resolve.
 */
export interface ReverseGeocodeAddress {
  /** ISO 3166-1 alpha-2 country code, e.g. "NL". */
  countryCode?:   string | null;
  /** State / province / region name, e.g. "Noord-Holland". */
  region?:        string | null;
  /** City name, e.g. "Amsterdam". */
  city?:          string | null;
  /** Municipality or district, e.g. "Amsterdam" (may differ from city). */
  municipality?:  string | null;
  /** Postal / ZIP code, e.g. "1012". */
  postcode?:      string | null;
  /** Full formatted address string. */
  formatted?:     string | null;
}

// ── Provider interface ────────────────────────────────────────────────────────

/**
 * Vendor-agnostic reverse-geocode provider contract.
 *
 * Implementations must:
 *   - Always resolve (never reject)
 *   - Return `null` on error or when no result is found
 *   - Not include credentials in the returned object
 */
export interface ReverseGeocodeProvider {
  /** Human-readable name used in logs and `addressSource` field. */
  readonly name: string;
  /**
   * Resolve lat/lng into a normalised address.
   * Returns null when the provider is unavailable, the request fails, or no
   * result is found — the caller will fall through to the next provider.
   */
  lookup(lat: number, lng: number): Promise<ReverseGeocodeAddress | null>;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

/** 6-hour default TTL — address data for a given coordinate is stable. */
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

/** Module-level cache shared across all instances (process-scoped). */
let _cache: ProviderCache<ReverseGeocodeAddress & { source: string }> | null = null;

function getCache(ttlMs: number): ProviderCache<ReverseGeocodeAddress & { source: string }> {
  if (!_cache) _cache = new ProviderCache(ttlMs);
  return _cache;
}

/**
 * Build a cache key for a lat/lng pair.
 * Rounds to 3 decimal places (≈ 110 m grid) to increase cache hit rates for
 * nearby coordinates that would resolve to the same address anyway.
 */
function buildCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementations
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. LocationIQ ─────────────────────────────────────────────────────────────

/**
 * LocationIQ reverse-geocode provider.
 *
 * Requires a free API key from locationiq.com.
 * Endpoint: GET https://us1.locationiq.com/v1/reverse
 * Free tier: 5,000 requests/day, 2 requests/second.
 *
 * Returns high-quality OSM-backed address data including country_code, state,
 * city/town/village, municipality, postcode, and a display_name.
 */
export class LocationIQProvider implements ReverseGeocodeProvider {
  readonly name = "locationiq";

  constructor(private readonly apiKey: string) {}

  async lookup(lat: number, lng: number): Promise<ReverseGeocodeAddress | null> {
    try {
      const url =
        `https://us1.locationiq.com/v1/reverse` +
        `?key=${encodeURIComponent(this.apiKey)}` +
        `&lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal:  AbortSignal.timeout(5_000),
        cache:   "no-store",
      });

      if (!res.ok) return null;

      type LocationIQResponse = {
        display_name?: string;
        address?: {
          country_code?: string;
          state?:        string;
          county?:       string;
          city?:         string;
          town?:         string;
          village?:      string;
          municipality?: string;
          postcode?:     string;
        };
      };

      const data = await res.json() as LocationIQResponse;
      const addr = data.address;
      if (!addr) return null;

      return {
        countryCode:  addr.country_code?.toUpperCase() || null,
        region:       addr.state    || null,
        city:         addr.city || addr.town || addr.village || null,
        municipality: addr.municipality || addr.county || null,
        postcode:     addr.postcode   || null,
        formatted:    data.display_name || null,
      };
    } catch {
      return null;
    }
  }
}

// ── 2. BigDataCloud ───────────────────────────────────────────────────────────

/**
 * BigDataCloud reverse-geocode provider.
 *
 * No API key required.  Free tier: 10,000 requests/month.
 * Endpoint: GET https://api.bigdatacloud.net/data/reverse-geocode-client
 *
 * Returns structured admin divisions including principalSubdivision (state),
 * city, locality, and postcode.
 */
export class BigDataCloudProvider implements ReverseGeocodeProvider {
  readonly name = "bigdatacloud";

  async lookup(lat: number, lng: number): Promise<ReverseGeocodeAddress | null> {
    try {
      const url =
        `https://api.bigdatacloud.net/data/reverse-geocode-client` +
        `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal:  AbortSignal.timeout(5_000),
        cache:   "no-store",
      });

      if (!res.ok) return null;

      type BigDataCloudResponse = {
        countryCode?:          string;
        principalSubdivision?: string;
        city?:                 string;
        locality?:             string;
        postcode?:             string;
        localityInfo?: {
          administrative?: Array<{ name?: string; adminLevel?: number }>;
        };
      };

      const data = await res.json() as BigDataCloudResponse;

      if (!data.countryCode && !data.city && !data.locality) return null;

      // Build a simple formatted string from available components.
      const parts = [
        data.locality || data.city,
        data.principalSubdivision,
        data.countryCode,
      ].filter(Boolean);

      return {
        countryCode:  data.countryCode?.toUpperCase() || null,
        region:       data.principalSubdivision       || null,
        city:         data.city || data.locality       || null,
        municipality: null, // BigDataCloud does not return a dedicated municipality field
        postcode:     data.postcode                    || null,
        formatted:    parts.join(", ")                || null,
      };
    } catch {
      return null;
    }
  }
}

// ── 3. Nominatim (OpenStreetMap) ──────────────────────────────────────────────

/**
 * Nominatim reverse-geocode provider (OpenStreetMap data).
 *
 * No API key required.  Rate limit: 1 request/second (enforced by OSM policy).
 * Endpoint: GET https://nominatim.openstreetmap.org/reverse
 *
 * A User-Agent header is required by Nominatim's usage policy.
 * Uses the `addressdetails=1` flag to receive a structured address object.
 */
export class NominatimProvider implements ReverseGeocodeProvider {
  readonly name = "nominatim";

  constructor(
    private readonly userAgent: string = "mister-chameleon-enrichment/1.0 (contact@mister-chameleon.com)",
  ) {}

  async lookup(lat: number, lng: number): Promise<ReverseGeocodeAddress | null> {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

      const res = await fetch(url, {
        headers: {
          Accept:       "application/json",
          "User-Agent": this.userAgent,
        },
        signal: AbortSignal.timeout(6_000),
        cache:  "no-store",
      });

      if (!res.ok) return null;

      type NominatimResponse = {
        display_name?: string;
        address?: {
          country_code?: string;
          state?:        string;
          county?:       string;
          city?:         string;
          town?:         string;
          village?:      string;
          municipality?: string;
          postcode?:     string;
        };
      };

      const data = await res.json() as NominatimResponse;
      const addr = data.address;
      if (!addr) return null;

      return {
        countryCode:  addr.country_code?.toUpperCase() || null,
        region:       addr.state    || null,
        city:         addr.city || addr.town || addr.village || null,
        municipality: addr.municipality || addr.county || null,
        postcode:     addr.postcode   || null,
        formatted:    data.display_name || null,
      };
    } catch {
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback Chain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the provider fallback chain.
 *
 * Tries each provider in order.  Returns the first successful result.
 * Returns `null` when all providers fail or return no data.
 *
 * @param providers  — ordered list of providers (priority first)
 * @param lat        — latitude to resolve
 * @param lng        — longitude to resolve
 * @param isDev      — emit debug logs when true
 * @returns          — address + source name, or null
 */
async function runProviderChain(
  providers: ReverseGeocodeProvider[],
  lat:       number,
  lng:       number,
  isDev:     boolean,
): Promise<(ReverseGeocodeAddress & { source: string }) | null> {
  for (const provider of providers) {
    if (isDev) {
      console.debug(`[ReverseGeocode] trying provider "${provider.name}" for (${lat}, ${lng})`);
    }

    const result = await provider.lookup(lat, lng);

    if (result && (result.countryCode || result.city || result.formatted)) {
      if (isDev) {
        console.debug(`[ReverseGeocode] provider "${provider.name}" succeeded:`, {
          countryCode:  result.countryCode,
          region:       result.region,
          city:         result.city,
          municipality: result.municipality,
          postcode:     result.postcode,
          formatted:    result.formatted?.slice(0, 80),
        });
      }
      return { ...result, source: provider.name };
    }

    if (isDev) {
      console.debug(`[ReverseGeocode] provider "${provider.name}" failed or returned empty — falling through`);
    }
  }

  if (isDev) {
    console.debug(`[ReverseGeocode] all providers exhausted for (${lat}, ${lng}) — no address resolved`);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for `createReverseGeocodeStagedEnricher`.
 */
export interface ReverseGeocodeOptions {
  /**
   * Ordered provider list.  The first provider to return a valid result wins.
   * Omit to use the default chain: [LocationIQ, BigDataCloud, Nominatim].
   *
   * When `locationIqApiKey` is not provided, LocationIQ is excluded from the
   * default chain automatically.
   */
  providers?: ReverseGeocodeProvider[];

  /**
   * LocationIQ API key (used in the default provider chain).
   * When present, LocationIQ is tried first.
   * When absent, the chain starts at BigDataCloud.
   */
  locationIqApiKey?: string;

  /**
   * Cache TTL in milliseconds.
   * Default: 6 hours (DEFAULT_CACHE_TTL_MS).
   */
  cacheTtlMs?: number;

  /**
   * Whether to emit debug logs.
   * Defaults to `process.env.NODE_ENV === "development"`.
   */
  isDev?: boolean;

  /**
   * User-Agent string for Nominatim requests.
   * Default: "mister-chameleon-enrichment/1.0".
   */
  nominatimUserAgent?: string;
}

/**
 * Create a `StagedEnricher` that enriches lat/lng coordinates into human-readable
 * address fields using a provider fallback chain.
 *
 * The enricher is designed to run AFTER the geo stage (which populates
 * `accumulated.latitude` and `accumulated.longitude`).  Its `shouldRun` gate
 * skips the stage automatically when no coordinates are available.
 *
 * Output fields written:
 *   addressCountry, addressRegion, addressCity, addressMunicipality,
 *   addressPostcode, addressFormatted, addressSource
 *
 * These fields are purely for address/location context.  Company identification
 * remains the responsibility of separate enrichment stages.
 *
 * @example
 * // In your staged pipeline setup:
 * const reverseGeocodeStage = createReverseGeocodeStagedEnricher({
 *   locationIqApiKey: process.env.LOCATIONIQ_API_KEY,
 * });
 * const stages: StagedEnricher[] = [
 *   geoStage,
 *   ipinfoStage,
 *   reverseGeocodeStage,  // runs after geo; uses accumulated.latitude/longitude
 *   openKvKStage,         // can optionally consume addressCity for scoring
 * ];
 */
export function createReverseGeocodeStagedEnricher(
  options: ReverseGeocodeOptions = {},
): StagedEnricher {
  const {
    locationIqApiKey,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    isDev      = process.env.NODE_ENV === "development",
    nominatimUserAgent,
  } = options;

  // Build the provider chain.
  const providers: ReverseGeocodeProvider[] = options.providers ?? buildDefaultProviders({
    locationIqApiKey,
    nominatimUserAgent,
  });

  const cache = getCache(cacheTtlMs);

  return {
    label: "Reverse Geocode",

    // ── Gate ─────────────────────────────────────────────────────────────────
    shouldRun(
      _input: EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): boolean {
      const hasCoords =
        typeof accumulated.latitude  === "number" &&
        typeof accumulated.longitude === "number";

      if (!hasCoords && isDev) {
        console.debug("[ReverseGeocode] skipped — no lat/lng in accumulated output");
      }

      return hasCoords;
    },

    getSkipReason(): string {
      return "No lat/lng coordinates available from geo stage — enable MaxMind, IPinfo, or ensure CDN coordinate headers are present.";
    },

    // ── Enricher ──────────────────────────────────────────────────────────────
    async enricher(
      _input:       EnricherInput,
      accumulated:  Partial<EnrichmentOutput>,
      ctx?:         EnricherContext,
    ): Promise<Partial<EnrichmentOutput>> {
      const lat = accumulated.latitude!;
      const lng = accumulated.longitude!;
      const key = buildCacheKey(lat, lng);

      // ── Cache check ─────────────────────────────────────────────────────────
      const cached = cache.get(key);
      if (cached.hit) {
        ctx?.setCacheSource("provider-cache");
        if (isDev) {
          console.debug(`[ReverseGeocode] cache HIT for key="${key}":`, {
            source: cached.value.source,
            city:   cached.value.city,
          });
        }
        return toEnrichmentOutput(cached.value);
      }
      ctx?.setCacheSource("fresh");

      if (isDev) {
        console.debug(`[ReverseGeocode] cache MISS for key="${key}" — querying providers`);
      }

      // ── Provider chain ──────────────────────────────────────────────────────
      try {
        // Coalesce concurrent misses for the same rounded lat/lng so only one
        // provider-chain run happens. A no-result (or error) throws so it is not
        // cached (matching the previous behavior of re-querying next time); a
        // successful address is cached by getOrLoad. toEnrichmentOutput stays
        // outside the coalesced value so it is applied once on both hit and miss.
        const result = await cache.getOrLoad(key, async () => {
          const r = await runProviderChain(providers, lat, lng, isDev);
          if (!r) throw new Error("reverse-geocode: no result");
          return r;
        });

        return toEnrichmentOutput(result);
      } catch {
        // Absorb no-result and unexpected errors (never propagate to the
        // pipeline, and never cache them).
        return {};
      }
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the default provider chain.
 *
 * Order:
 *   1. LocationIQ (when apiKey is provided)
 *   2. BigDataCloud (no key needed)
 *   3. Nominatim   (no key needed, OSM, rate-limited)
 */
function buildDefaultProviders(options: {
  locationIqApiKey?:  string;
  nominatimUserAgent?: string;
}): ReverseGeocodeProvider[] {
  const chain: ReverseGeocodeProvider[] = [];

  if (options.locationIqApiKey) {
    chain.push(new LocationIQProvider(options.locationIqApiKey));
  }

  chain.push(new BigDataCloudProvider());
  chain.push(new NominatimProvider(options.nominatimUserAgent));

  return chain;
}

/** Map a resolved address+source into the flat `EnrichmentOutput` shape. */
function toEnrichmentOutput(
  result: ReverseGeocodeAddress & { source: string },
): Partial<EnrichmentOutput> {
  return {
    addressCountry:      result.countryCode  ?? null,
    addressRegion:       result.region       ?? null,
    addressCity:         result.city         ?? null,
    addressMunicipality: result.municipality ?? null,
    addressPostcode:     result.postcode     ?? null,
    addressFormatted:    result.formatted    ?? null,
    addressSource:       result.source,
  };
}

// ── Debug cache flush ─────────────────────────────────────────────────────────

/**
 * Flush the in-process reverse-geocode address cache.
 *
 * Called by `enrichment/flush-debug.ts` during a debug session reset so that
 * the post-reset request re-resolves lat/lng coordinates rather than serving
 * TTL-cached address lookups.
 *
 * The cache is lazily initialized — if it has never been used, this is a no-op.
 */
export function flushReverseGeocodeProviderCache(): void {
  if (_cache) _cache.flush();
}
