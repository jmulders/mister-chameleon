/**
 * Geo Enrichment Provider
 *
 * Resolves: countryCode, region, city
 *
 * ─── Provider contract ────────────────────────────────────────────────────────
 *
 *   GeoProvider is the vendor-agnostic interface. Three concrete implementations:
 *
 *   1. HeadersGeoProvider  — reads Vercel / Cloudflare CDN headers
 *      Zero-latency. Preferred for production on Vercel. Absent on localhost.
 *
 *   2. MaxMindGeoProvider  — self-hosted MaxMind GeoLite2 / GeoIP2 .mmdb lookup
 *      Requires: `npm install maxmind` + a GeoLite2-City.mmdb file.
 *      Set MAXMIND_DB_PATH=/path/to/GeoLite2-City.mmdb.
 *      result.country?.iso_code → countryCode.
 *      Falls back gracefully when package or DB file is absent.
 *
 *   3. IpApiGeoProvider    — calls ip-api.com (free, dev-only, no key required)
 *      No dependencies, uses native fetch(). Rate-limited (45 req/min).
 *      Only use in development — NOT for production traffic.
 *
 * ─── DevFallbackGeoProvider ──────────────────────────────────────────────────
 *
 *   Wraps any GeoProvider to substitute local IPs (127.0.0.1 / ::1) with a
 *   public fallback IP so IP-based lookups can return meaningful results.
 *   Only active in development; a no-op in production.
 *
 * ─── Pipeline (build-decision-context.ts) ────────────────────────────────────
 *
 *   Production (Vercel):
 *     [createHeadersGeoEnricher]     → CDN injects real geo headers
 *
 *   Development (localhost):
 *     [createHeadersGeoEnricher]     → no CDN headers → all null
 *     [createIpApiGeoEnricher]       → DevFallbackGeoProvider(IpApiGeoProvider)
 *                                        127.0.0.1 → 8.8.8.8 → ip-api.com → "US"
 *
 *   With MaxMind DB configured (any env):
 *     [createHeadersGeoEnricher]     → CDN headers (Vercel) or null (local)
 *     [createMaxMindGeoEnricher]     → DevFallbackGeoProvider(MaxMindGeoProvider)
 *                                        real IP → mmdb → countryCode
 *   CDN header results overwrite MaxMind results on Vercel (pipeline merge order).
 *
 * ─── Local IPs replaced in development ───────────────────────────────────────
 *
 *   DEV_GEO_FALLBACK_IP — env var to override the default 8.8.8.8 fallback IP.
 *   Useful for testing specific geos (e.g. "2.125.160.216" → GB).
 */

import type { EnrichmentOutput, EnricherInput, LabeledEnricher } from "../types";

// ── GeoOutput ─────────────────────────────────────────────────────────────────

/** Fields this provider can resolve. */
export interface GeoOutput {
  countryCode: string | null;
  region:      string | null;
  city:        string | null;
  /** Approximate latitude from IP-geo lookup (city-level precision). */
  latitude:    number | null;
  /** Approximate longitude from IP-geo lookup (city-level precision). */
  longitude:   number | null;
}

// ── GeoProvider ───────────────────────────────────────────────────────────────

/**
 * Vendor-agnostic geo provider interface.
 *
 * Implement this interface for any IP-to-location data source.
 * The returned object may omit any field — unresolved fields default to null.
 */
export interface GeoProvider {
  /**
   * Resolve geo signals from the visitor's IP address.
   *
   * @param ip - The visitor IP (IPv4 or IPv6). May be null in some environments.
   * @returns  - Partial geo output. Missing fields are treated as null.
   */
  lookup(ip: string | null): Promise<Partial<GeoOutput>>;
}

// ── Local-IP helpers ──────────────────────────────────────────────────────────

/**
 * Returns true when `ip` is a loopback, link-local, or private address that
 * cannot be resolved by any IP-to-geo service.
 *
 * Recognised patterns:
 *
 *   IPv4
 *     "127.x.x.x"            Loopback (RFC 5735)
 *     "localhost"             Hostname alias for loopback
 *     "10.x.x.x"             RFC 1918 private range
 *     "172.16.x.x–172.31.x.x" RFC 1918 private range
 *     "192.168.x.x"          RFC 1918 private range
 *     "169.254.x.x"          Link-local (APIPA, RFC 3927)
 *
 *   IPv6
 *     "::1"                  Loopback (RFC 4291)
 *     "::ffff:127.x.x.x"     IPv4-mapped loopback
 *     "::ffff:10.x.x.x"      IPv4-mapped RFC 1918
 *     "::ffff:192.168.x.x"   IPv4-mapped RFC 1918
 *     "fe80::"               Link-local prefix (RFC 4291)
 *     "fc…" / "fd…"          Unique-local prefix (RFC 4193)
 */
export function isLocalIp(ip: string | null): boolean {
  if (!ip) return false;
  const t = ip.trim().toLowerCase();

  // ── IPv4 patterns ────────────────────────────────────────────────────────
  if (t === "localhost")         return true;
  if (t.startsWith("127."))      return true;  // 127.0.0.0/8 loopback
  if (t.startsWith("10."))       return true;  // 10.0.0.0/8 RFC 1918
  if (t.startsWith("192.168."))  return true;  // 192.168.0.0/16 RFC 1918
  if (t.startsWith("169.254."))  return true;  // 169.254.0.0/16 link-local
  if (t.startsWith("172.")) {                  // 172.16.0.0/12 RFC 1918
    const second = parseInt(t.split(".")[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  // ── IPv6 patterns ────────────────────────────────────────────────────────
  if (t === "::1")                       return true;  // loopback
  if (t.startsWith("fe80:"))             return true;  // link-local
  if (t.startsWith("fc") || t.startsWith("fd")) return true; // unique-local
  // IPv4-mapped loopback and RFC 1918
  if (t.startsWith("::ffff:127."))       return true;
  if (t.startsWith("::ffff:10."))        return true;
  if (t.startsWith("::ffff:192.168."))   return true;
  if (t.startsWith("::ffff:169.254."))   return true;

  return false;
}

/**
 * Returns the resolved IP for an enricher call.
 *
 * In development only: if the IP is a local loopback, replaces it with the
 * value of DEV_GEO_FALLBACK_IP (default: "8.8.8.8") so IP-based geo lookups
 * can return real data during local development.
 *
 * In production: always returns the original IP unchanged.
 *
 * @param ip     - Raw IP from the request.
 * @param isDev  - Whether to apply the dev fallback (pass NODE_ENV === "development").
 */
export function resolveGeoIp(
  ip: string | null,
  isDev: boolean,
): { ip: string | null; wasSubstituted: boolean } {
  if (!isDev || !isLocalIp(ip)) {
    return { ip, wasSubstituted: false };
  }
  const fallback =
    process.env.DEV_GEO_FALLBACK_IP?.trim() || "8.8.8.8";
  return { ip: fallback, wasSubstituted: true };
}

// ── StubGeoProvider ───────────────────────────────────────────────────────────

/**
 * No-op geo provider for unit tests.
 * Returns null for all fields without making any network call.
 */
export class StubGeoProvider implements GeoProvider {
  async lookup(_ip: string | null): Promise<Partial<GeoOutput>> {
    return {};
  }
}

// ── HeadersGeoProvider ────────────────────────────────────────────────────────

/**
 * Zero-latency geo provider that reads from hosting platform HTTP headers.
 *
 * No external API call — data is injected by the CDN before the request
 * reaches the application server, so this provider adds < 1 ms of overhead.
 *
 * ─── Platform header support ─────────────────────────────────────────────────
 *
 *   Vercel (preferred)
 *     x-vercel-ip-country         ISO 3166-1 alpha-2, e.g. "NL"
 *     x-vercel-ip-country-region  ISO 3166-2 subdivision code, e.g. "NH"
 *     x-vercel-ip-city            URL-encoded city name, e.g. "Amsterdam"
 *     x-vercel-ip-latitude        Decimal latitude, e.g. "52.3676"
 *     x-vercel-ip-longitude       Decimal longitude, e.g. "4.9041"
 *
 *   Cloudflare (fallback for countryCode only)
 *     cf-ipcountry                ISO 3166-1 alpha-2, e.g. "NL"
 *
 * ─── Local development ───────────────────────────────────────────────────────
 *
 *   Platform headers are absent in `next dev`. All fields return null.
 *   Use MaxMindGeoProvider or IpApiGeoProvider as a secondary enricher in dev.
 *
 *   To test specific geos locally without a secondary provider, inject headers
 *   in middleware or mock the enrichment output in test fixtures:
 *     requestHeaders.set("x-vercel-ip-country", "NL");
 *     requestHeaders.set("x-vercel-ip-city",    "Amsterdam");
 */
export class HeadersGeoProvider implements GeoProvider {
  constructor(private readonly headers: Headers) {}

  async lookup(_ip: string | null): Promise<Partial<GeoOutput>> {
    // Country code: Vercel header preferred, Cloudflare as fallback.
    const rawCountry =
      this.headers.get("x-vercel-ip-country") ??
      this.headers.get("cf-ipcountry") ??
      null;

    // Region: Vercel injects the ISO 3166-2 subdivision code.
    const rawRegion = this.headers.get("x-vercel-ip-country-region") ?? null;

    // City: Vercel URL-encodes the value to handle non-ASCII characters
    // (e.g. "%C3%BCbach" → "übach"). Decode defensively.
    const rawCity = this.headers.get("x-vercel-ip-city") ?? null;
    let city: string | null = null;
    if (rawCity) {
      try {
        city = decodeURIComponent(rawCity).trim() || null;
      } catch {
        // Raw value is safe to use as-is if decodeURIComponent throws.
        city = rawCity.trim() || null;
      }
    }

    // Coordinates: Vercel injects decimal lat/lng headers (city-level precision).
    const rawLat = this.headers.get("x-vercel-ip-latitude")  ?? null;
    const rawLng = this.headers.get("x-vercel-ip-longitude") ?? null;
    let latitude:  number | null = null;
    let longitude: number | null = null;
    if (rawLat) { const p = parseFloat(rawLat); if (isFinite(p)) latitude  = p; }
    if (rawLng) { const p = parseFloat(rawLng); if (isFinite(p)) longitude = p; }

    return {
      countryCode: rawCountry?.trim().toUpperCase() || null,
      region:      rawRegion?.trim()               || null,
      city,
      latitude,
      longitude,
    };
  }
}

// ── MaxMindGeoProvider ────────────────────────────────────────────────────────

/**
 * MaxMind GeoIP2 / GeoLite2 provider using a local .mmdb database file.
 *
 * ─── Setup ───────────────────────────────────────────────────────────────────
 *
 *   1. Install the maxmind package:
 *        npm install maxmind
 *
 *   2. Download a MaxMind database file:
 *        GeoLite2-City.mmdb  — free, from dev.maxmind.com
 *        GeoIP2-City.mmdb    — paid, higher accuracy
 *
 *   3. Set the environment variable:
 *        MAXMIND_DB_PATH=/absolute/path/to/GeoLite2-City.mmdb
 *        (or place GeoLite2-City.mmdb in the project root)
 *
 * ─── Graceful degradation ────────────────────────────────────────────────────
 *
 *   If the maxmind package is not installed, or the .mmdb file is missing or
 *   unreadable, MaxMindGeoProvider returns {} and emits a console.warn.
 *   The enrichment pipeline continues with the remaining providers; the page
 *   always renders — geo fields will simply be null.
 *
 * ─── Field mapping ───────────────────────────────────────────────────────────
 *
 *   result.country?.iso_code           → countryCode
 *   result.subdivisions?.[0]?.iso_code → region
 *   result.city?.names?.en             → city
 */
export class MaxMindGeoProvider implements GeoProvider {
  private readonly dbPath: string;
  private readonly isDev:  boolean;

  // Singleton lookup table — opened once and reused for every request.
  // Typed as `unknown` to avoid importing maxmind types (package may be absent).
  private static _lookup: unknown = null;
  private static _loadAttempted = false;

  constructor(options?: { dbPath?: string; isDev?: boolean }) {
    this.dbPath = options?.dbPath
      ?? process.env.MAXMIND_DB_PATH
      ?? "./GeoLite2-City.mmdb";
    this.isDev = options?.isDev ?? process.env.NODE_ENV === "development";
  }

  async lookup(ip: string | null): Promise<Partial<GeoOutput>> {
    if (!ip) return {};

    // Apply dev IP fallback before passing to MaxMind.
    const { ip: resolvedIp, wasSubstituted } = resolveGeoIp(ip, this.isDev);

    if (this.isDev && resolvedIp !== ip) {
      console.debug(
        `[MaxMindGeoProvider] dev: local IP ${ip} → fallback ${resolvedIp}`,
      );
    }

    const lookupFn = await this._getOrLoadLookup();
    if (!lookupFn) return {};

    try {
      // `lookupFn` is the `lookup.get` method from the maxmind Reader.
      type LookupFn = (ip: string) => {
        country?:      { iso_code?: string };
        subdivisions?: Array<{ iso_code?: string }>;
        city?:         { names?: { en?: string } };
        location?:     { latitude?: number; longitude?: number };
      } | null;

      const result = (lookupFn as LookupFn)(resolvedIp ?? "");

      if (this.isDev) {
        console.debug("[MaxMindGeoProvider] raw result:", {
          resolvedIp,
          wasSubstituted,
          country:   result?.country?.iso_code ?? null,
          region:    result?.subdivisions?.[0]?.iso_code ?? null,
          city:      result?.city?.names?.en ?? null,
          latitude:  result?.location?.latitude  ?? null,
          longitude: result?.location?.longitude ?? null,
        });
      }

      if (!result) return {};

      return {
        countryCode: result.country?.iso_code?.toUpperCase()   ?? null,
        region:      result.subdivisions?.[0]?.iso_code        ?? null,
        city:        result.city?.names?.en                    ?? null,
        latitude:    result.location?.latitude  ?? null,
        longitude:   result.location?.longitude ?? null,
      };
    } catch (err) {
      if (this.isDev) {
        console.warn("[MaxMindGeoProvider] lookup error:", err);
      }
      return {};
    }
  }

  /**
   * Open the .mmdb database once and cache the reader as a singleton.
   * Returns null when the maxmind package is not installed or the DB is absent.
   */
  private async _getOrLoadLookup(): Promise<unknown> {
    if (MaxMindGeoProvider._lookup !== null) {
      return MaxMindGeoProvider._lookup;
    }
    if (MaxMindGeoProvider._loadAttempted) return null;
    MaxMindGeoProvider._loadAttempted = true;

    try {
      // Use eval("require") so webpack's static analyser never tries to bundle
      // this module — it is intentionally optional and may not be installed.
      // The try/catch handles MODULE_NOT_FOUND at runtime without crashing.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, no-eval
      const maxmind = eval("require")("maxmind") as {
        open: <T>(path: string) => Promise<{ get: (ip: string) => T | null }>;
      };

      const reader = await maxmind.open(this.dbPath);
      // Store the bound `get` method directly for zero-overhead per-request calls.
      MaxMindGeoProvider._lookup = reader.get.bind(reader);

      if (this.isDev) {
        console.debug(`[MaxMindGeoProvider] database loaded from: ${this.dbPath}`);
      }

      return MaxMindGeoProvider._lookup;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // NODE_MODULE_NOT_FOUND / Cannot find module — package is not installed.
      const notInstalled =
        msg.includes("Cannot find module") ||
        (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND");

      if (notInstalled) {
        console.warn(
          "[MaxMindGeoProvider] maxmind package not installed — geo lookup disabled. " +
          "Run `npm install maxmind` and set MAXMIND_DB_PATH to enable IP-based geo lookup.",
        );
      } else {
        console.warn(
          `[MaxMindGeoProvider] failed to open database at "${this.dbPath}": ${msg}. ` +
          "Geo lookup will return null. Check that the .mmdb file exists and MAXMIND_DB_PATH is correct.",
        );
      }

      return null;
    }
  }
}

// ── IpApiGeoProvider (dev-only HTTP fallback) ─────────────────────────────────

/**
 * Dev-only geo provider that calls ip-api.com.
 *
 * Free tier: up to 45 requests/minute, no API key required.
 * Suitable for local development only — do NOT use in production.
 *
 * ─── Response fields used ────────────────────────────────────────────────────
 *
 *   countryCode  → GeoOutput.countryCode   (ISO 3166-1 alpha-2)
 *   regionName   → GeoOutput.region
 *   city         → GeoOutput.city
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   Automatically used in development when no other provider resolves geo data.
 *   Wraps IpApiGeoProvider with DevFallbackGeoProvider so local IPs are
 *   substituted with a public IP before the API call.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Production guard: returns {} immediately when NODE_ENV !== "development".
 *   This ensures a misconfiguration cannot accidentally route production traffic
 *   to an external HTTP API.
 */
export class IpApiGeoProvider implements GeoProvider {
  private readonly isDev: boolean;

  constructor(options?: { isDev?: boolean }) {
    this.isDev = options?.isDev ?? process.env.NODE_ENV === "development";
  }

  async lookup(ip: string | null): Promise<Partial<GeoOutput>> {
    // Hard production guard — never call an external API in production.
    if (!this.isDev) return {};
    if (!ip) return {};

    try {
      const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,regionName,city,lat,lon`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(3_000),
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) return {};

      type IpApiResponse = {
        status:      string;
        countryCode: string;
        regionName:  string;
        city:        string;
        lat:         number;
        lon:         number;
      };

      const data = await res.json() as IpApiResponse;

      if (this.isDev) {
        console.debug("[IpApiGeoProvider] raw result:", {
          ip,
          status:      data.status,
          countryCode: data.countryCode ?? null,
          region:      data.regionName  ?? null,
          city:        data.city        ?? null,
          latitude:    data.lat         ?? null,
          longitude:   data.lon         ?? null,
        });
      }

      if (data.status !== "success") return {};

      return {
        countryCode: data.countryCode?.toUpperCase() || null,
        region:      data.regionName                 || null,
        city:        data.city                       || null,
        latitude:    typeof data.lat === "number" ? data.lat : null,
        longitude:   typeof data.lon === "number" ? data.lon : null,
      };
    } catch (err) {
      if (this.isDev) {
        console.warn("[IpApiGeoProvider] fetch error:", err);
      }
      return {};
    }
  }
}

// ── DevFallbackGeoProvider ────────────────────────────────────────────────────

/**
 * Provider wrapper that replaces local IPs with a public fallback IP in dev.
 *
 * In development, the visitor IP is typically 127.0.0.1 or ::1 which cannot
 * be resolved by any IP-to-geo service.  This wrapper intercepts the lookup
 * call and substitutes a known-public IP so the inner provider returns real data.
 *
 * In production (isDev = false), this wrapper is transparent — it passes
 * the original IP through unchanged without any substitution.
 *
 * @example
 * // In build-decision-context.ts (dev only):
 * const devGeoProvider = new DevFallbackGeoProvider(
 *   new IpApiGeoProvider({ isDev: true }),
 *   { isDev: true },
 * );
 * // When request IP is 127.0.0.1:
 * //   → DevFallbackGeoProvider replaces with 8.8.8.8
 * //   → IpApiGeoProvider receives 8.8.8.8
 * //   → returns { countryCode: "US", city: "Mountain View", ... }
 */
export class DevFallbackGeoProvider implements GeoProvider {
  private readonly inner:  GeoProvider;
  private readonly isDev:  boolean;

  constructor(inner: GeoProvider, options?: { isDev?: boolean }) {
    this.inner  = inner;
    this.isDev  = options?.isDev ?? process.env.NODE_ENV === "development";
  }

  async lookup(ip: string | null): Promise<Partial<GeoOutput>> {
    const { ip: resolvedIp, wasSubstituted } = resolveGeoIp(ip, this.isDev);

    if (wasSubstituted) {
      console.debug(
        `[DevFallbackGeoProvider] local IP "${ip}" substituted with "${resolvedIp}" for geo lookup.`,
      );
    }

    return this.inner.lookup(resolvedIp);
  }
}

// ── createGeoEnricher ─────────────────────────────────────────────────────────

/**
 * Adapts a `GeoProvider` into a generic `LabeledEnricher` for the pipeline.
 *
 * @param provider - Any GeoProvider implementation.
 * @param label    - Optional label override (default: "geo").
 */
export function createGeoEnricher(
  provider: GeoProvider,
  label = "geo",
): LabeledEnricher {
  return {
    label,
    enricher: async (input: EnricherInput): Promise<Partial<EnrichmentOutput>> => {
      // Use effectiveIp so test-IP overrides (tenant settings + env gate) and
      // dev local-IP substitution are respected.  Falls back to the real visitor
      // IP when no override is active (effectiveIp === ip in that case anyway).
      const result = await provider.lookup(input.effectiveIp ?? input.ip);
      return {
        countryCode: result.countryCode ?? null,
        region:      result.region      ?? null,
        city:        result.city        ?? null,
        latitude:    result.latitude    ?? null,
        longitude:   result.longitude   ?? null,
      };
    },
  };
}

// ── createHeadersGeoEnricher ──────────────────────────────────────────────────

/**
 * Convenience factory: creates a `LabeledEnricher` backed by
 * `HeadersGeoProvider` for the given request headers.
 *
 * Preferred for production on Vercel / Cloudflare — instant, no I/O.
 */
export function createHeadersGeoEnricher(headers: Headers): LabeledEnricher {
  return createGeoEnricher(new HeadersGeoProvider(headers), "geo:headers");
}

// ── createMaxMindGeoEnricher ──────────────────────────────────────────────────

/**
 * Convenience factory: creates a `LabeledEnricher` backed by
 * `MaxMindGeoProvider` (with dev-IP fallback applied automatically).
 *
 * Requires:
 *   - `npm install maxmind`
 *   - A GeoLite2-City.mmdb or GeoIP2-City.mmdb file
 *   - MAXMIND_DB_PATH env var pointing to the file
 *
 * Falls back gracefully (returns {}) when the package or DB is absent.
 */
export function createMaxMindGeoEnricher(options?: {
  dbPath?: string;
  isDev?:  boolean;
}): LabeledEnricher {
  const isDev = options?.isDev ?? process.env.NODE_ENV === "development";
  const inner = new MaxMindGeoProvider({ dbPath: options?.dbPath, isDev });
  const provider = new DevFallbackGeoProvider(inner, { isDev });
  return createGeoEnricher(provider, "geo:maxmind");
}

// ── createIpApiGeoEnricher ────────────────────────────────────────────────────

/**
 * Convenience factory: creates a `LabeledEnricher` backed by
 * `IpApiGeoProvider` (with dev-IP fallback applied automatically).
 *
 * Dev-only: production guard built into IpApiGeoProvider.
 * Useful for local development when no MaxMind DB is configured.
 */
export function createIpApiGeoEnricher(options?: {
  isDev?: boolean;
}): LabeledEnricher {
  const isDev = options?.isDev ?? process.env.NODE_ENV === "development";
  const inner = new IpApiGeoProvider({ isDev });
  const provider = new DevFallbackGeoProvider(inner, { isDev });
  return createGeoEnricher(provider, "geo:ipapi");
}
