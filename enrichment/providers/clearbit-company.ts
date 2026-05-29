/**
 * Clearbit Reveal — Company Identification Provider
 *
 * Implements `CompanyProvider` using the Clearbit Reveal API.
 * Clearbit Reveal performs reverse-IP lookup to identify the company that
 * owns a given IP address, returning firmographic data.
 *
 * ─── API ─────────────────────────────────────────────────────────────────────
 *
 *   GET https://reveal.clearbit.com/v1/companies/find?ip={ip}
 *   Authorization: Basic base64("{secretKey}:")
 *
 *   Response (abridged):
 *   {
 *     "ip":    "...",
 *     "fuzzy": false,
 *     "company": {
 *       "name":   "Acme Corp",
 *       "domain": "acme.com",
 *       "category": { "industry": "Software" },
 *       "metrics": { "employeesRange": "51-200" }
 *     }
 *   }
 *
 *   404 = IP not resolved to a company (not an error — return empty match).
 *   Other 4xx / 5xx = API error — logged and returned as empty match.
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Uses a secret key (CLEARBIT_SECRET_KEY) passed as the Basic Auth username
 *   with an empty password.  The key is server-only — never sent to the client.
 *
 * ─── Confidence ───────────────────────────────────────────────────────────────
 *
 *   Clearbit returns `fuzzy: true` when the match is low-confidence (e.g. ISP
 *   or VPN IP).  We map this to companyMatchConfidence 0.6 (vs 0.9 for an
 *   exact match) so downstream rules can filter on confidence thresholds.
 *
 * ─── Dev fallback ─────────────────────────────────────────────────────────────
 *
 *   On localhost, the visitor IP is 127.0.0.1 or ::1, which Clearbit cannot
 *   resolve.  When `isDev` is true and the IP is local, the provider substitutes
 *   the public fallback IP from DEV_COMPANY_FALLBACK_IP (or DEV_GEO_FALLBACK_IP,
 *   or "8.8.8.8") so Clearbit returns meaningful data during development.
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   All errors (network, timeout, API, parse) are caught and logged.
 *   `identify()` always resolves with either a partial result or `{}` — never
 *   rejects, preserving the enrichment pipeline's fail-safe guarantee.
 */

import type { CompanyOutput, CompanyProvider } from "./company";
import { isLocalIp }                           from "./geo";

// ── Clearbit API types ────────────────────────────────────────────────────────

interface ClearbitCategory {
  industry?:      string;
  industryGroup?: string;
  sector?:        string;
  subIndustry?:   string;
}

interface ClearbitMetrics {
  employees?:      number;
  employeesRange?: string;
}

interface ClearbitCompanyObject {
  id?:       string;
  name?:     string;
  domain?:   string;
  category?: ClearbitCategory;
  metrics?:  ClearbitMetrics;
}

interface ClearbitRevealResponse {
  ip?:      string;
  fuzzy?:   boolean;
  company?: ClearbitCompanyObject;
}

// ── ClearbitCompanyProvider ───────────────────────────────────────────────────

/**
 * Identifies the company associated with a visitor IP using Clearbit Reveal.
 *
 * @example
 * import { ClearbitCompanyProvider } from "@/enrichment/providers/clearbit-company";
 *
 * const provider = new ClearbitCompanyProvider({
 *   secretKey: process.env.CLEARBIT_SECRET_KEY!,
 *   isDev:     process.env.NODE_ENV === "development",
 * });
 * const enrichers = [createCompanyEnricher(provider)];
 */
export class ClearbitCompanyProvider implements CompanyProvider {
  private readonly secretKey: string;
  private readonly isDev:     boolean;
  private readonly apiBase:   string;

  constructor(options: {
    /** Clearbit Secret Key — set CLEARBIT_SECRET_KEY in your environment. */
    secretKey: string;
    /**
     * Set to true in development to enable local-IP substitution
     * (127.0.0.1 / ::1 → DEV_COMPANY_FALLBACK_IP or 8.8.8.8).
     */
    isDev?:    boolean;
    /**
     * Override the Clearbit API base URL.
     * Useful for tests with a mock HTTP server.
     * Default: "https://reveal.clearbit.com"
     */
    apiBase?:  string;
  }) {
    this.secretKey = options.secretKey;
    this.isDev     = options.isDev  ?? false;
    this.apiBase   = options.apiBase ?? "https://reveal.clearbit.com";
  }

  /**
   * Look up the company for a visitor IP address.
   *
   * Returns an empty object (`{}`) when:
   *   - ip is null or empty
   *   - Clearbit returns 404 (no company found)
   *   - Any error occurs (network, timeout, API, parse)
   */
  async identify(ip: string | null): Promise<Partial<CompanyOutput>> {
    if (!ip) return {};

    // ── Dev: substitute local IPs with a public address ─────────────────────
    const effectiveIp =
      this.isDev && isLocalIp(ip)
        ? (process.env.DEV_COMPANY_FALLBACK_IP?.trim() ||
           process.env.DEV_GEO_FALLBACK_IP?.trim()     ||
           "8.8.8.8")
        : ip;

    if (this.isDev) {
      console.debug(
        "[clearbit-company] identify",
        { original: ip, effective: effectiveIp },
      );
    }

    try {
      const url = `${this.apiBase}/v1/companies/find?ip=${encodeURIComponent(effectiveIp)}`;

      const response = await fetch(url, {
        headers: {
          // Clearbit Basic Auth: secretKey as username, empty password
          Authorization: `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`,
          Accept:        "application/json",
        },
        // Stay within the enrichment pipeline's 2 s budget with a small margin
        signal:     AbortSignal.timeout(3_000),
        cache:      "no-store",
        next:       { revalidate: 0 },
      });

      // 404 means no company found for this IP — expected, not an error
      if (response.status === 404) {
        if (this.isDev) {
          console.debug("[clearbit-company] no company for IP", effectiveIp);
        }
        return {};
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.warn(
          `[clearbit-company] API error ${response.status} for IP "${effectiveIp}": ${text.slice(0, 200)}`,
        );
        return {};
      }

      const data = (await response.json()) as ClearbitRevealResponse;
      const company = data.company;

      if (!company) return {};

      const result: Partial<CompanyOutput> = {
        companyName:            company.name                    ?? null,
        companyDomain:          company.domain                  ?? null,
        companyIndustry:        company.category?.industry      ?? null,
        companySize:            company.metrics?.employeesRange ?? null,
        companyMatchConfidence: data.fuzzy === true ? 0.6 : 0.9,
        companyMatchSource:     "clearbit",
      };

      if (this.isDev) {
        console.debug("[clearbit-company] matched", {
          ip:          effectiveIp,
          company:     result.companyName,
          domain:      result.companyDomain,
          industry:    result.companyIndustry,
          size:        result.companySize,
          confidence:  result.companyMatchConfidence,
          fuzzy:       data.fuzzy,
        });
      }

      return result;
    } catch (err) {
      // Network errors, timeouts, and JSON parse failures are all caught here.
      // Return {} — do not let enrichment errors propagate.
      if (this.isDev) {
        console.debug(
          "[clearbit-company] lookup error for IP",
          effectiveIp,
          err instanceof Error ? err.message : String(err),
        );
      } else {
        console.warn(
          `[clearbit-company] lookup failed for IP "${effectiveIp}":`,
          err instanceof Error ? err.message : String(err),
        );
      }
      return {};
    }
  }
}
