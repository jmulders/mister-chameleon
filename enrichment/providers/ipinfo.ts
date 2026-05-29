/**
 * IPinfo Lite — Network / ISP Enrichment Provider
 *
 * Provides Autonomous System (ASN), organization, and network domain data
 * for a visitor IP address using the IPinfo API.
 *
 * ─── API ──────────────────────────────────────────────────────────────────────
 *
 *   GET https://ipinfo.io/{ip}?token={token}
 *   (no auth header needed — token in query string)
 *
 *   Response (abridged):
 *   {
 *     "ip":       "8.8.8.8",
 *     "country":  "US",
 *     "region":   "California",
 *     "city":     "Mountain View",
 *     "org":      "AS15169 Google LLC",
 *     "hostname": "dns.google"
 *   }
 *
 *   The `org` field is always in the format "AS{number} {Organization Name}".
 *   We split on the first space to extract the ASN and org name separately.
 *
 *   The `hostname` field provides the network domain when available.
 *   When absent, we derive a best-guess domain from the org name by lowercasing
 *   and appending ".com" (e.g. "Google LLC" → "google.com").
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Requires a free or paid IPinfo API token.  The token is passed as a query
 *   parameter so it MUST be server-side only and never logged.
 *
 * ─── Country fallback ────────────────────────────────────────────────────────
 *
 *   IPinfo also returns `country`, `region`, and `city`.  When earlier stages
 *   have not resolved a `countryCode`, these values are returned as a fallback.
 *   When a prior stage (MaxMind, CDN headers) has already provided geo data,
 *   the merge strategy in the staged pipeline preserves those values.
 *
 * ─── Dev fallback ─────────────────────────────────────────────────────────────
 *
 *   On localhost (127.0.0.1 / ::1), IPinfo returns an empty or private result.
 *   When `isDev` is true and the IP is local, the provider substitutes
 *   DEV_GEO_FALLBACK_IP (or "8.8.8.8") so the API returns real data during
 *   development.
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   `lookup()` always resolves — it never rejects.  Any error returns `{}`.
 */

import type { EnrichmentOutput } from "../types";
import { isLocalIp }             from "./geo";
import { ProviderCache }         from "../provider-cache";

// ── IPinfo API response type ──────────────────────────────────────────────────

interface IpInfoResponse {
  ip?:       string;
  country?:  string;
  region?:   string;
  city?:     string;
  /** "AS15169 Google LLC" */
  org?:      string;
  hostname?: string;
  /** Present on bogon/private IPs */
  bogon?:    boolean;
  /**
   * Latitude and longitude in "lat,lon" format, e.g. "52.3676,4.9041".
   * City-level precision (same accuracy as MaxMind GeoLite2-City).
   */
  loc?:      string;
}

// ── Helper: parse ASN org field ───────────────────────────────────────────────

/**
 * Parse IPinfo's `org` field ("AS15169 Google LLC") into parts.
 * Returns nulls if the string is empty or not in expected format.
 */
function parseOrgField(org: string | undefined): {
  asn:     string | null;
  orgName: string | null;
} {
  if (!org || !org.trim()) return { asn: null, orgName: null };

  const spaceIdx = org.indexOf(" ");
  if (spaceIdx < 2) return { asn: null, orgName: org.trim() || null };

  const asn     = org.slice(0, spaceIdx).trim();  // e.g. "AS15169"
  const orgName = org.slice(spaceIdx + 1).trim(); // e.g. "Google LLC"

  return {
    asn:     asn.match(/^AS\d+$/) ? asn : null,
    orgName: orgName || null,
  };
}

/**
 * Derive a best-guess domain from an organization name.
 *
 * Rules (in order):
 *   1. Strip common suffixes: "LLC", "Ltd", "Limited", "Inc", "Corp", etc.
 *   2. Take the first word that is longer than 2 characters.
 *   3. Lowercase and append ".com".
 *
 * This is intentionally simple — it is a heuristic used to seed stage 3
 * (OpenKvK) when no hostname is available.  Always a guess.
 *
 * @example parseOrgDomain("Google LLC") → "google.com"
 * @example parseOrgDomain("T-Mobile Netherlands")  → "t-mobile.com"
 */
function parseOrgDomain(orgName: string | null, hostname: string | undefined): string | null {
  // Prefer the real hostname when available
  if (hostname && hostname.trim()) {
    const parts = hostname.trim().toLowerCase().split(".");
    // Return the last two segments (e.g. "google.com" from "dns.google")
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return hostname.trim().toLowerCase();
  }

  if (!orgName) return null;

  // Heuristic: strip legal suffixes, take first meaningful word
  const SUFFIXES = /\b(llc|ltd|limited|inc|corp|corporation|bv|gmbh|ag|sa|as|nv|plc|pty|group)\b\.?/gi;
  const cleaned = orgName.replace(SUFFIXES, " ").trim();
  const words   = cleaned.split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;

  const base = words[0].toLowerCase().replace(/[^a-z0-9-]/g, "");
  return base ? `${base}.com` : null;
}

// ── IpInfoProvider ────────────────────────────────────────────────────────────

export interface IpInfoProviderOptions {
  /** IPinfo API token. */
  token:   string;
  /**
   * Enable local-IP substitution in development.
   * Default: false.
   */
  isDev?:  boolean;
  /**
   * Override the IPinfo API base URL (useful in tests).
   * Default: "https://ipinfo.io"
   */
  apiBase?: string;
}

/**
 * Fetches ASN / network org data from IPinfo and maps to `Partial<EnrichmentOutput>`.
 *
 * Returns `networkAsn`, `networkOrg`, `networkDomain`, and optionally
 * `countryCode` / `region` / `city` as a geo fallback for when MaxMind is not
 * configured.
 */
export class IpInfoProvider {
  private readonly token:   string;
  private readonly isDev:   boolean;
  private readonly apiBase: string;

  constructor(options: IpInfoProviderOptions) {
    this.token   = options.token;
    this.isDev   = options.isDev  ?? false;
    this.apiBase = options.apiBase ?? "https://ipinfo.io";
  }

  /**
   * Look up network information for an IP address.
   *
   * @returns `Partial<EnrichmentOutput>` with network fields (and geo fallbacks).
   *          Returns `{}` on any error.
   */
  async lookup(ip: string | null): Promise<Partial<EnrichmentOutput>> {
    // ── Dev: substitute null or local IPs ─────────────────────────────────
    // Substitution MUST happen before the null guard so that dev sessions —
    // where x-forwarded-for is absent and `ip` is null — still produce real
    // geo / network data instead of returning {} immediately.
    const effectiveIp =
      this.isDev && (!ip || isLocalIp(ip))
        ? (process.env.DEV_GEO_FALLBACK_IP?.trim() || "8.8.8.8")
        : ip;

    if (!effectiveIp) return {};

    if (this.isDev && effectiveIp !== ip) {
      console.debug("[ipinfo] substituting local/null IP", { original: ip, effective: effectiveIp });
    }

    try {
      const url = `${this.apiBase}/${encodeURIComponent(effectiveIp)}?token=${encodeURIComponent(this.token)}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal:  AbortSignal.timeout(3_000),
        cache:   "no-store",
        next:    { revalidate: 0 },
      });

      if (!response.ok) {
        console.warn(`[ipinfo] API error ${response.status} for IP "${effectiveIp}"`);
        return {};
      }

      const data = (await response.json()) as IpInfoResponse;

      // Bogon/private IPs return { bogon: true } with no useful data
      if (data.bogon) return {};

      const { asn, orgName } = parseOrgField(data.org);
      const domain           = parseOrgDomain(orgName, data.hostname);

      const result: Partial<EnrichmentOutput> = {
        networkAsn:    asn,
        networkOrg:    orgName,
        networkDomain: domain,
      };

      // Provide geo fallback when MaxMind has not already filled these fields.
      // The staged pipeline merge strategy preserves non-null earlier values, so
      // if MaxMind already wrote countryCode this becomes a no-op.
      if (data.country) result.countryCode = data.country.toUpperCase();
      if (data.region)  result.region      = data.region;
      if (data.city)    result.city        = data.city;

      // Parse lat/lng from the "loc" field ("lat,lon" format, e.g. "52.3676,4.9041").
      // These are city-level coordinates — same precision as MaxMind GeoLite2-City.
      // The merge strategy preserves any non-null value from a prior stage, so if
      // MaxMind or the CDN headers already produced coordinates this is a no-op.
      if (data.loc) {
        const parts = data.loc.split(",");
        if (parts.length === 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (isFinite(lat) && isFinite(lng)) {
            result.latitude  = lat;
            result.longitude = lng;
            if (this.isDev) {
              console.debug("[ipinfo] parsed lat/lng from loc", { lat, lng });
            }
          }
        }
      }

      if (this.isDev) {
        console.debug("[ipinfo] result", { ip: effectiveIp, asn, orgName, domain });
      }

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.isDev) {
        console.debug("[ipinfo] lookup error", { ip: effectiveIp, error: msg });
      } else {
        console.warn(`[ipinfo] lookup failed for IP "${effectiveIp}": ${msg}`);
      }
      return {};
    }
  }
}

// ── Module-level provider cache ───────────────────────────────────────────────
//
// Keyed by the effective IP address.  TTL: 60 minutes — IP → ISP/ASN mappings
// are stable over the course of a browsing session and change infrequently.
// Process-scoped: resets on cold start, which is acceptable for this data.

const IPINFO_CACHE_TTL_MS = 60 * 60 * 1_000; // 60 minutes

let _ipinfoCache: ProviderCache<Partial<EnrichmentOutput>> | null = null;

function getIpInfoCache(): ProviderCache<Partial<EnrichmentOutput>> {
  if (!_ipinfoCache) {
    _ipinfoCache = new ProviderCache<Partial<EnrichmentOutput>>(IPINFO_CACHE_TTL_MS);
  }
  return _ipinfoCache;
}

// ── Factory: createIpInfoStagedEnricher ───────────────────────────────────────

import type { StagedEnricher, EnricherContext } from "../types";

/**
 * Creates a `StagedEnricher` for the IPinfo stage of the sequential pipeline.
 *
 * Receives the accumulated output from prior stages (e.g. MaxMind geo) but
 * always runs regardless — it adds network fields that MaxMind does not provide.
 *
 * @example
 * const stage = createIpInfoStagedEnricher({ token: "abc123" });
 */
export function createIpInfoStagedEnricher(
  options: IpInfoProviderOptions,
): StagedEnricher {
  const provider = new IpInfoProvider(options);
  const cache    = getIpInfoCache();

  return {
    label:   "IPinfo Lite",
    enricher: async (input, _accumulated, ctx?: EnricherContext) => {
      // Use effectiveIp so test-IP overrides (tenant settings, query param)
      // and dev local-IP substitution are respected.  Falls back to raw ip
      // when effectiveIp is not set (e.g. very early in the pipeline).
      const effectiveIp = input.effectiveIp ?? input.ip;

      // ── Provider cache check ──────────────────────────────────────────────
      // Cache key: the effective IP (after dev substitution etc.).
      // Only cache when an IP is available — skip caching for null IPs.
      if (effectiveIp) {
        const cached = cache.get(effectiveIp);
        if (cached.hit) {
          ctx?.setCacheSource("provider-cache");
          if (options.isDev) {
            console.debug("[ipinfo] provider cache HIT", { ip: effectiveIp });
          }
          return cached.value;
        }
      }

      // ── Live API call ─────────────────────────────────────────────────────
      ctx?.setCacheSource("fresh");
      const result = await provider.lookup(effectiveIp);

      // Store in cache when the lookup returned useful data and an IP is known.
      if (effectiveIp && Object.keys(result).length > 0) {
        cache.set(effectiveIp, result);
      }

      return result;
    },
  };
}

// ── Debug cache flush ─────────────────────────────────────────────────────────

/**
 * Flush the in-process IPinfo geo-IP lookup cache.
 *
 * Called by `enrichment/flush-debug.ts` during a debug session reset so that
 * the post-reset request performs a fresh IPinfo API call rather than serving
 * TTL-cached geo data for the same IP address.
 *
 * The cache is lazily initialized — if it has never been used, this is a no-op.
 */
export function flushIpInfoProviderCache(): void {
  if (_ipinfoCache) _ipinfoCache.flush();
}
