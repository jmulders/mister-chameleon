/**
 * Weather Enrichment Provider
 *
 * Fetches current weather conditions for a lat/lng coordinate using the
 * Open-Meteo API (https://open-meteo.com/).  No API key required — the
 * service is completely free and open.
 *
 * ─── Role in the pipeline ─────────────────────────────────────────────────────
 *
 *   Runs after the geo stage so that `accumulated.latitude` and
 *   `accumulated.longitude` are available.  The `shouldRun` gate skips the
 *   stage when either coordinate is null.
 *
 *   This is an independent, standalone enricher — it does not interact with
 *   company detection or CRM matching stages.
 *
 * ─── Output fields ────────────────────────────────────────────────────────────
 *
 *   weatherCode                — WMO weather interpretation code (0–99)
 *   temperatureNow             — air temperature at 2 m height (°C, 1 dp)
 *   precipitationProbability   — 0–100 %
 *   isRaining                  — true when WMO code indicates active precipitation
 *   windSpeed                  — 10 m wind speed (km/h, 1 dp)
 *   cloudCover                 — 0–100 %
 *   weatherSummary             — e.g. "Partly cloudy, 8°C, 15 km/h wind"
 *   weatherSource              — "open-meteo"
 *
 * ─── Caching ─────────────────────────────────────────────────────────────────
 *
 *   Results are cached per lat/lng (3 decimal places ≈ 110 m grid) with a
 *   default TTL of 60 minutes.  Weather changes faster than address data.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Never rejects — all errors produce {} (empty partial) so the pipeline
 *   continues unaffected.  Timeout: 5 seconds per request.
 *
 * ─── Debug ────────────────────────────────────────────────────────────────────
 *
 *   When `isDev` is true the enricher emits console.debug entries for:
 *     • which lat/lng was resolved
 *     • whether the cache was hit or missed
 *     • the raw API response or error
 *     • the normalised weather output
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import { ProviderCache } from "../provider-cache";

// ── Default TTL ────────────────────────────────────────────────────────────────

/** 60 minutes — weather data changes faster than address data. */
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1_000;

// ── Module-level cache (process-scoped) ───────────────────────────────────────
//
// One cache instance per process.  Created lazily on first call.
// Because the TTL is applied per-entry, the cache handles TTL mismatches
// between warm and cold starts gracefully.

let _cache: ProviderCache<Partial<EnrichmentOutput>> | null = null;

function getCache(ttlMs: number): ProviderCache<Partial<EnrichmentOutput>> {
  if (!_cache) {
    _cache = new ProviderCache<Partial<EnrichmentOutput>>(ttlMs);
  }
  return _cache;
}

// ── WMO code helpers ──────────────────────────────────────────────────────────

/**
 * WMO Weather Interpretation Code → human-readable description.
 * Reference: https://open-meteo.com/en/docs#weathervariables
 */
function wmoDescription(code: number): string {
  if (code === 0)                    return "Clear sky";
  if (code === 1)                    return "Mainly clear";
  if (code === 2)                    return "Partly cloudy";
  if (code === 3)                    return "Overcast";
  if (code === 45 || code === 48)    return "Fog";
  if (code === 51)                   return "Light drizzle";
  if (code === 53)                   return "Moderate drizzle";
  if (code === 55)                   return "Dense drizzle";
  if (code === 56 || code === 57)    return "Freezing drizzle";
  if (code === 61)                   return "Slight rain";
  if (code === 63)                   return "Moderate rain";
  if (code === 65)                   return "Heavy rain";
  if (code === 66 || code === 67)    return "Freezing rain";
  if (code === 71)                   return "Slight snowfall";
  if (code === 73)                   return "Moderate snowfall";
  if (code === 75)                   return "Heavy snowfall";
  if (code === 77)                   return "Snow grains";
  if (code === 80)                   return "Slight rain showers";
  if (code === 81)                   return "Moderate rain showers";
  if (code === 82)                   return "Violent rain showers";
  if (code === 85 || code === 86)    return "Snow showers";
  if (code === 95)                   return "Thunderstorm";
  if (code === 96 || code === 99)    return "Thunderstorm with hail";
  return "Unknown";
}

/**
 * Returns true when the WMO code represents active precipitation:
 * drizzle, rain, freezing rain, snow, showers, or thunderstorm.
 */
function isPrecipitating(code: number): boolean {
  return (
    (code >= 51 && code <= 67)  ||  // drizzle + rain + freezing rain
    (code >= 71 && code <= 77)  ||  // snow
    (code >= 80 && code <= 82)  ||  // rain showers
    (code >= 85 && code <= 86)  ||  // snow showers
    code === 95                 ||  // thunderstorm
    code === 96 || code === 99      // thunderstorm with hail
  );
}

// ── Open-Meteo API fetch ───────────────────────────────────────────────────────

interface OpenMeteoResponse {
  current?: {
    temperature_2m?:            number;
    precipitation_probability?: number;
    weather_code?:              number;
    wind_speed_10m?:            number;
    cloud_cover?:               number;
  };
}

/**
 * Fetch current weather from the Open-Meteo free API.
 * Returns null on any error (network, timeout, empty response).
 */
async function fetchOpenMeteo(
  lat: number,
  lng: number,
  isDev: boolean,
): Promise<Partial<EnrichmentOutput> | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,cloud_cover` +
    `&timezone=auto` +
    `&forecast_days=1`;

  if (isDev) {
    console.debug("[weather:open-meteo] fetching", { lat, lng });
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal:  AbortSignal.timeout(5_000),
    cache:   "no-store",
  });

  if (!response.ok) {
    if (isDev) {
      console.debug("[weather:open-meteo] non-ok response", { status: response.status });
    }
    return null;
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const c    = data.current;

  if (!c) {
    if (isDev) {
      console.debug("[weather:open-meteo] empty current block");
    }
    return null;
  }

  const code   = c.weather_code                ?? 0;
  const temp   = c.temperature_2m              ?? 0;
  const precip = c.precipitation_probability   ?? 0;
  const wind   = c.wind_speed_10m              ?? 0;
  const cloud  = c.cloud_cover                 ?? 0;

  const description = wmoDescription(code);
  const summary     = `${description}, ${Math.round(temp)}°C, ${Math.round(wind)} km/h wind`;

  const output: Partial<EnrichmentOutput> = {
    weatherCode:              code,
    temperatureNow:           Math.round(temp  * 10) / 10,
    precipitationProbability: Math.round(precip),
    isRaining:                isPrecipitating(code),
    windSpeed:                Math.round(wind  * 10) / 10,
    cloudCover:               Math.round(cloud),
    weatherSummary:           summary,
    weatherSource:            "open-meteo",
  };

  if (isDev) {
    console.debug("[weather:open-meteo] resolved", output);
  }

  return output;
}

// ── Options ────────────────────────────────────────────────────────────────────

export interface WeatherEnricherOptions {
  /**
   * Cache TTL in milliseconds.
   * Default: 3 600 000 ms (60 minutes).
   */
  cacheTtlMs?: number;
  /**
   * Enable verbose console.debug output.
   * Default: false.
   */
  isDev?: boolean;
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create the weather enrichment staged enricher.
 *
 * The stage uses the free Open-Meteo API and requires no API key.
 * It runs after the geo stage (reads `accumulated.latitude` / `.longitude`).
 *
 * @example
 *   stages.push(createWeatherStagedEnricher({ isDev }));
 */
export function createWeatherStagedEnricher(
  options: WeatherEnricherOptions = {},
): StagedEnricher {
  const {
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    isDev      = false,
  } = options;

  const cache = getCache(cacheTtlMs);

  return {
    label: "Weather",

    // ── Gate ─────────────────────────────────────────────────────────────────
    //
    // Skip the stage when geo coordinates are not available from prior stages.
    shouldRun(
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): boolean {
      return (
        typeof accumulated.latitude  === "number" &&
        typeof accumulated.longitude === "number"
      );
    },

    getSkipReason(): string {
      return "No lat/lng coordinates available from geo stage — enable MaxMind, IPinfo, or ensure CDN coordinate headers are present.";
    },

    // ── Enricher ──────────────────────────────────────────────────────────────
    async enricher(
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
      ctx?:        EnricherContext,
    ): Promise<Partial<EnrichmentOutput>> {
      const lat = accumulated.latitude!;
      const lng = accumulated.longitude!;

      // Build cache key: round to 3 decimal places (≈ 110 m grid).
      // This maximises cache reuse for nearby visitors without sacrificing
      // meaningful weather variation (weather rarely changes within 110 m).
      const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

      const cached = cache.get(cacheKey);
      if (cached.hit) {
        ctx?.setCacheSource("provider-cache");
        if (isDev) {
          console.debug("[weather] cache hit", { cacheKey, weatherCode: (cached.value as Partial<EnrichmentOutput>).weatherCode });
        }
        return cached.value;
      }
      ctx?.setCacheSource("fresh");

      if (isDev) {
        console.debug("[weather] cache miss — fetching", { cacheKey });
      }

      try {
        // Coalesce concurrent misses for the same rounded lat/lng so only one
        // Open-Meteo call runs. shouldCache keeps the existing behavior of not
        // caching a no-result (an empty object still coalesces but is not stored,
        // so a later call retries); a real fetch error throws and is not cached.
        return await cache.getOrLoad(
          cacheKey,
          async () => (await fetchOpenMeteo(lat, lng, isDev)) ?? {},
          { shouldCache: (o) => Object.keys(o).length > 0 },
        );
      } catch (err) {
        if (isDev) {
          console.debug(
            "[weather] error",
            err instanceof Error ? err.message : String(err),
          );
        }
        // Fail-safe: never reject, let the pipeline continue.
        return {};
      }
    },
  };
}
