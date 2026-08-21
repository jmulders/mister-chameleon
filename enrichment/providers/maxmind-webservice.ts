/**
 * MaxMind GeoLite2 Web Service — Geo Enrichment Provider
 *
 * Uses MaxMind's hosted GeoLite2 City web service (no local .mmdb file needed —
 * so it works on serverless / Vercel, unlike MaxMindGeoProvider which reads a
 * local database). Authenticated with the platform account ID + license key via
 * HTTP Basic auth.
 *
 *   GET https://geolite.info/geoip/v2.1/city/{ip}
 *   Authorization: Basic base64(accountId:licenseKey)
 *
 * Maps to countryCode / region / city / latitude / longitude. Fail-safe: any
 * error or non-2xx returns {}. See https://dev.maxmind.com/geoip/docs/web-services
 */

import type { EnrichmentOutput, StagedEnricher, EnricherInput, EnricherContext } from "../types";
import { isLocalIp }    from "./geo";
import { ProviderCache } from "../provider-cache";

interface MaxMindCityResponse {
  country?:      { iso_code?: string };
  subdivisions?: Array<{ names?: { en?: string } }>;
  city?:         { names?: { en?: string } };
  location?:     { latitude?: number; longitude?: number };
}

export interface MaxMindWebServiceOptions {
  accountId:  string;
  licenseKey: string;
  isDev?:     boolean;
  /** Override base host (tests). Default: "https://geolite.info". */
  apiBase?:   string;
}

const cache = new ProviderCache<Partial<EnrichmentOutput>>(60 * 60 * 1_000);

export class MaxMindWebServiceProvider {
  private readonly auth:    string;
  private readonly isDev:   boolean;
  private readonly apiBase: string;

  constructor(options: MaxMindWebServiceOptions) {
    // Buffer is available server-side (Node) — these enrichers run on the server.
    this.auth    = Buffer.from(`${options.accountId}:${options.licenseKey}`).toString("base64");
    this.isDev   = options.isDev ?? false;
    this.apiBase = options.apiBase ?? "https://geolite.info";
  }

  async lookup(ip: string | null): Promise<Partial<EnrichmentOutput>> {
    const effectiveIp =
      this.isDev && (!ip || isLocalIp(ip))
        ? (process.env.DEV_GEO_FALLBACK_IP?.trim() || "8.8.8.8")
        : ip;
    if (!effectiveIp) return {};

    try {
      const res = await fetch(`${this.apiBase}/geoip/v2.1/city/${encodeURIComponent(effectiveIp)}`, {
        headers: { Authorization: `Basic ${this.auth}`, Accept: "application/json" },
        signal:  AbortSignal.timeout(3_000),
        cache:   "no-store",
        next:    { revalidate: 0 },
      });
      if (!res.ok) {
        if (res.status !== 404) console.warn(`[maxmind-ws] API error ${res.status} for IP "${effectiveIp}"`);
        return {};
      }
      const data = (await res.json()) as MaxMindCityResponse;

      const result: Partial<EnrichmentOutput> = {};
      if (data.country?.iso_code)         result.countryCode = data.country.iso_code.toUpperCase();
      if (data.subdivisions?.[0]?.names?.en) result.region   = data.subdivisions[0].names!.en!;
      if (data.city?.names?.en)           result.city        = data.city.names.en;
      if (typeof data.location?.latitude  === "number") result.latitude  = data.location.latitude;
      if (typeof data.location?.longitude === "number") result.longitude = data.location.longitude;
      return result;
    } catch (err) {
      if (this.isDev) console.debug("[maxmind-ws] lookup error", { ip: effectiveIp, err: String(err) });
      return {};
    }
  }
}

/** Staged enricher for the MaxMind GeoLite2 web service (wave 1, geo). */
export function createMaxMindWebServiceStagedEnricher(
  options: MaxMindWebServiceOptions,
): StagedEnricher {
  const provider = new MaxMindWebServiceProvider(options);
  return {
    label: "MaxMind GeoIP (web)",
    enricher: async (input: EnricherInput, _accumulated: Partial<EnrichmentOutput>, ctx?: EnricherContext) => {
      const effectiveIp = input.effectiveIp ?? input.ip;
      if (effectiveIp) {
        const cached = cache.get(effectiveIp);
        if (cached.hit) { ctx?.setCacheSource("provider-cache"); return cached.value; }
      }
      ctx?.setCacheSource("fresh");
      // No IP: nothing to cache or coalesce on.
      if (!effectiveIp) return provider.lookup(effectiveIp);
      // Coalesce concurrent misses for the same IP; only non-empty results are
      // stored (empties still coalesce but are not negative-cached).
      return cache.getOrLoad(
        effectiveIp,
        () => provider.lookup(effectiveIp),
        { shouldCache: (r) => Object.keys(r).length > 0 },
      );
    },
  };
}

export function flushMaxMindWebServiceCache(): void {
  cache.flush();
}
