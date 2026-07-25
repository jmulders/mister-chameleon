/**
 * Leadinfo — IP-to-Company Enrichment Provider
 *
 * Identifies the company visiting a website based on its IP address using
 * the Leadinfo API.  Leadinfo is a commercial provider specializing in
 * B2B visitor identification, particularly strong in Western Europe.
 *
 * ─── API ──────────────────────────────────────────────────────────────────────
 *
 *   GET https://api.leadinfo.com/identify?ip={ip}
 *   Authorization: Bearer {apiKey}
 *
 *   Response (abridged):
 *   {
 *     "company": {
 *       "name":     "Acme Corp",
 *       "website":  "acme.com",
 *       "industry": "Software",
 *       "size":     "51-200"
 *     },
 *     "location": {
 *       "country": "NL",
 *       "city":    "Amsterdam"
 *     }
 *   }
 *
 *   404 = IP not resolved to a company — expected, return `{}`.
 *   Other 4xx / 5xx = API error — logged, return `{}`.
 *
 * ─── Confidence ───────────────────────────────────────────────────────────────
 *
 *   Leadinfo does not provide a confidence score.  We assign:
 *     • 0.75 — company identified (best heuristic without a fuzzy flag)
 *
 * ─── Dev fallback ─────────────────────────────────────────────────────────────
 *
 *   When `isDev` is true and the IP is local (127.0.0.1 / ::1), the provider
 *   substitutes DEV_COMPANY_FALLBACK_IP → DEV_GEO_FALLBACK_IP → "8.8.8.8".
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   `lookup()` always resolves — it never rejects.  All errors return `{}`.
 */

import type { EnrichmentOutput, StagedEnricher, EnricherInput } from "../types";
import { isLocalIp }                                            from "./geo";
import { ProviderCache }                                        from "../provider-cache";
import type { LeadinfoPersistentCache }                         from "../ip-company-cache-ttl";

// ── Module-level result cache ─────────────────────────────────────────────────
//
// Keyed by effective IP address.
// TTL: 1 hour — IP→company mappings are relatively stable; infrequent cache
// misses are acceptable since Leadinfo is a paid API.
const lookupCache = new ProviderCache<Partial<EnrichmentOutput>>(60 * 60 * 1_000);

// ── Leadinfo API types ────────────────────────────────────────────────────────

interface LeadinfoCompany {
  name?:     string;
  website?:  string;
  industry?: string;
  size?:     string;
}

interface LeadinfoLocation {
  country?: string;
  city?:    string;
  region?:  string;
}

interface LeadinfoResponse {
  company?:  LeadinfoCompany;
  location?: LeadinfoLocation;
}

// ── LeadinfoProvider ──────────────────────────────────────────────────────────

export interface LeadinfoProviderOptions {
  /** Leadinfo API key. */
  apiKey:   string;
  /**
   * Enable local-IP substitution in development.
   * Default: false.
   */
  isDev?:   boolean;
  /**
   * Override the API base URL (useful in tests).
   * Default: "https://api.leadinfo.com"
   */
  apiBase?: string;
  /**
   * Optional platform-wide persistent IP→company cache (ip_company_cache).
   * When provided, a fresh cached result short-circuits the paid API call, and
   * every fresh lookup (match or no-match) is written back. Injected — not
   * imported here — so this provider stays free of server-only dependencies and
   * unit-testable.
   */
  persistentCache?: LeadinfoPersistentCache;
}

export class LeadinfoProvider {
  private readonly apiKey:  string;
  private readonly isDev:   boolean;
  private readonly apiBase: string;
  private readonly persistentCache: LeadinfoPersistentCache | undefined;

  constructor(options: LeadinfoProviderOptions) {
    this.apiKey  = options.apiKey;
    this.isDev   = options.isDev  ?? false;
    this.apiBase = options.apiBase ?? "https://api.leadinfo.com";
    this.persistentCache = options.persistentCache;
  }

  /**
   * Identify the company for a visitor IP address.
   *
   * @returns `Partial<EnrichmentOutput>` with company (and geo fallback) fields.
   *          Returns `{}` on 404 or any error.
   */
  async lookup(ip: string | null): Promise<Partial<EnrichmentOutput>> {
    if (!ip) return {};

    // ── Dev: substitute local IPs ────────────────────────────────────────────
    const effectiveIp =
      this.isDev && isLocalIp(ip)
        ? (process.env.DEV_COMPANY_FALLBACK_IP?.trim() ||
           process.env.DEV_GEO_FALLBACK_IP?.trim()     ||
           "8.8.8.8")
        : ip;

    if (this.isDev && effectiveIp !== ip) {
      console.debug("[leadinfo] substituting local IP", { original: ip, effective: effectiveIp });
    }

    // ── Cache check (in-process, then persistent DB) ─────────────────────────
    const cachedResult = lookupCache.get(effectiveIp);
    if (cachedResult.hit) {
      if (this.isDev) {
        console.debug("[leadinfo] cache hit", { ip: effectiveIp });
      }
      return cachedResult.value;
    }

    if (this.persistentCache) {
      const persisted = await this.persistentCache.get(effectiveIp);
      if (persisted) {
        if (this.isDev) {
          console.debug("[leadinfo] persistent cache hit", { ip: effectiveIp });
        }
        lookupCache.set(effectiveIp, persisted.output); // warm the in-process cache
        return persisted.output;
      }
    }

    try {
      const url = `${this.apiBase}/identify?ip=${encodeURIComponent(effectiveIp)}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept:        "application/json",
        },
        signal: AbortSignal.timeout(4_000),
        cache:  "no-store",
        next:   { revalidate: 0 },
      });

      // 404 = IP not identified — not an error; cache the empty result
      if (response.status === 404) {
        if (this.isDev) {
          console.debug("[leadinfo] no company for IP", effectiveIp);
        }
        lookupCache.set(effectiveIp, {});
        void this.persistentCache?.set(effectiveIp, { matched: false, output: {}, raw: null });
        return {};
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.warn(
          `[leadinfo] API error ${response.status} for IP "${effectiveIp}": ${text.slice(0, 200)}`,
        );
        return {};
      }

      const data = (await response.json()) as LeadinfoResponse;

      if (!data.company) {
        lookupCache.set(effectiveIp, {});
        void this.persistentCache?.set(effectiveIp, { matched: false, output: {}, raw: data });
        return {};
      }

      const result: Partial<EnrichmentOutput> = {
        companyMatchSource:     "leadinfo",
        companyMatchConfidence: 0.75,
      };

      if (data.company.name)     result.companyName    = data.company.name;
      if (data.company.website)  result.companyDomain  = data.company.website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
      if (data.company.industry) result.companyIndustry = data.company.industry;
      if (data.company.size)     result.companySize    = data.company.size;

      // Geo fallback — only when prior stages haven't resolved these
      if (data.location?.country) result.countryCode = data.location.country.toUpperCase();
      if (data.location?.city)    result.city        = data.location.city;
      if (data.location?.region)  result.region      = data.location.region;

      if (this.isDev) {
        console.debug("[leadinfo] result", {
          ip:      effectiveIp,
          company: result.companyName,
          domain:  result.companyDomain,
        });
      }

      // Cache successful result (in-process + persistent, with the raw payload)
      lookupCache.set(effectiveIp, result);
      void this.persistentCache?.set(effectiveIp, { matched: true, output: result, raw: data });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.isDev) {
        console.debug("[leadinfo] lookup error", { ip: effectiveIp, error: msg });
      } else {
        console.warn(`[leadinfo] lookup failed for IP "${effectiveIp}": ${msg}`);
      }
      return {};
    }
  }
}

// ── Factory: createLeadinfoStagedEnricher ─────────────────────────────────────

/**
 * Creates a `StagedEnricher` for the Leadinfo stage.
 *
 * Leadinfo is always run when configured (no country gate).  Its output
 * may fill `companyDomain` which is then used by stage 5 (HubSpot CRM).
 *
 * If Clearbit (stage 3) has already provided a high-confidence company domain,
 * the merge strategy in the staged pipeline preserves those values since
 * Leadinfo confidence (0.75) is lower than Clearbit exact-match confidence (0.9).
 * However, because the merge strategy only preserves non-null values and later
 * stages overwrite earlier, Leadinfo may upgrade a Clearbit null/partial result.
 */
export function createLeadinfoStagedEnricher(
  options: LeadinfoProviderOptions,
): StagedEnricher {
  const provider = new LeadinfoProvider(options);

  return {
    label: "Leadinfo",
    enricher: async (input: EnricherInput, _accumulated: Partial<EnrichmentOutput>) => {
      return provider.lookup(input.ip);
    },
  };
}

// ── Debug cache flush ─────────────────────────────────────────────────────────

/**
 * Flush the in-process Leadinfo lookup cache.
 *
 * Called by `enrichment/flush-debug.ts` during a debug session reset so that
 * the post-reset request performs a fresh Leadinfo API call rather than serving
 * TTL-cached company data for the same IP address.
 *
 * Not called in normal request flow — this is a developer tool only.
 */
export function flushLeadinfoProviderCache(): void {
  lookupCache.flush();
}
