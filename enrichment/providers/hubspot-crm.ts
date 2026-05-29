/**
 * HubSpot CRM Provider
 *
 * Implements `CrmProvider` using the HubSpot Private App API.
 *
 * ─── Match strategy ───────────────────────────────────────────────────────────
 *
 *   Primary:   company-by-domain (from visitor's email address domain)
 *              POST /crm/v3/objects/companies/search
 *              Filter: domain == extracted_domain
 *
 *   The visitor email is the key signal.  When no email is known the provider
 *   returns `{ crmMatched: false }` immediately — no API call is made.
 *
 * ─── Fields resolved ─────────────────────────────────────────────────────────
 *
 *   crmMatched        — true when a company was found
 *   crmLifecycleStage — mapped from company.properties.lifecyclestage
 *   crmCompanyId      — HubSpot company object ID
 *   crmCompanyName    — company.properties.name
 *   crmCompanyDomain  — company.properties.domain
 *   crmIndustry       — company.properties.industry
 *   crmIsCustomer     — derived: lifecyclestage === "customer"
 *
 *   crmSegment / crmAccountOwner are not populated from the company endpoint;
 *   they remain null unless a future contact-lookup enricher sets them.
 *
 * ─── HubSpot Private App authentication ─────────────────────────────────────
 *
 *   Uses a Private App access token (Bearer) rather than OAuth.
 *   Token is stored in platform_settings["crm"].accessToken (server-only).
 *   Never logged, never returned to the client.
 *
 * ─── Error handling ──────────────────────────────────────────────────────────
 *
 *   All errors are caught and logged to console.warn.
 *   The method always resolves — on any failure it returns `{ crmMatched: false }`.
 *   This preserves the enrichment pipeline's fail-safe guarantee.
 *
 * ─── Rate limits ─────────────────────────────────────────────────────────────
 *
 *   HubSpot imposes 100 requests/10 seconds per token for the CRM API.
 *   The enrichment pipeline's per-enricher timeout (default 2 s) is the
 *   primary guard; callers should add caching at the session level if needed.
 */

import type { EnricherInput }    from "../types";
import type { CrmOutput, CrmProvider } from "./crm";

// ── HubSpot API types (minimal surface) ───────────────────────────────────────

interface HubSpotCompanyProperties {
  name?:             string;
  domain?:           string;
  industry?:         string;
  lifecyclestage?:   string;
}

interface HubSpotCompanyResult {
  id:         string;
  properties: HubSpotCompanyProperties;
}

interface HubSpotSearchResponse {
  results: HubSpotCompanyResult[];
  total:   number;
}

// ── HubSpotCrmProvider ────────────────────────────────────────────────────────

/**
 * CRM provider that looks up a company in HubSpot by the visitor's email domain.
 *
 * @example
 * import { HubSpotCrmProvider }  from "@/enrichment/providers/hubspot-crm";
 * import { createCrmEnricher }   from "@/enrichment/providers/crm";
 *
 * const provider  = new HubSpotCrmProvider({ accessToken: "pat-na1-..." });
 * const enrichers = [createCrmEnricher(provider)];
 */
export class HubSpotCrmProvider implements CrmProvider {
  private readonly accessToken: string;
  private readonly apiBase:     string;

  constructor(options: { accessToken: string; apiBase?: string }) {
    this.accessToken = options.accessToken;
    this.apiBase     = options.apiBase ?? "https://api.hubapi.com";
  }

  // ── match ──────────────────────────────────────────────────────────────────

  async match(input: EnricherInput): Promise<Partial<CrmOutput>> {
    // Derive domain from the visitor's known email address.
    // Without an email we cannot do the company-by-domain lookup.
    const domain = extractEmailDomain(input.email);
    if (!domain) {
      return { crmMatched: false };
    }
    return this.matchByDomain(domain);
  }

  // ── matchByDomain ──────────────────────────────────────────────────────────

  /**
   * Look up a HubSpot company by domain name.
   *
   * Public so that combined enrichers (e.g. `IpCompanyHubSpotEnricher`) can
   * reuse the HubSpot company search without going through the email-extraction
   * path in `match()`.
   *
   * Returns `{ crmMatched: false }` when no company is found or when an
   * API error occurs — never rejects.
   *
   * @param domain  Plain domain string, e.g. "acme.com".
   */
  async matchByDomain(domain: string): Promise<Partial<CrmOutput>> {
    let company: HubSpotCompanyResult | null = null;

    try {
      company = await this.searchCompanyByDomain(domain);
    } catch (err) {
      console.warn(
        `[hubspot-crm] Company search failed for domain "${domain}":`,
        err instanceof Error ? err.message : String(err),
      );
      return { crmMatched: false };
    }

    if (!company) {
      return { crmMatched: false };
    }

    // Normalise to CrmOutput
    const props          = company.properties;
    const lifecycleStage = normalizeLifecycleStage(props.lifecyclestage);

    return {
      crmMatched:        true,
      crmLifecycleStage: lifecycleStage,
      crmSegment:        null,          // not available from company endpoint
      crmAccountOwner:   null,          // not available from company endpoint
      crmCompanyId:      company.id,
      crmCompanyName:    props.name     ?? null,
      crmCompanyDomain:  props.domain   ?? domain,
      crmIndustry:       props.industry ?? null,
      crmIsCustomer:     lifecycleStage === "customer",
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * POST /crm/v3/objects/companies/search
   * Returns the first company whose `domain` property matches the given domain,
   * or null when no match is found.
   *
   * Throws on network or API errors — caller is responsible for catch.
   */
  private async searchCompanyByDomain(
    domain: string,
  ): Promise<HubSpotCompanyResult | null> {
    const url  = `${this.apiBase}/crm/v3/objects/companies/search`;
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "domain",
              operator:     "EQ",
              value:        domain,
            },
          ],
        },
      ],
      properties: ["name", "domain", "industry", "lifecyclestage"],
      limit:      1,
    };

    const response = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `HubSpot API error ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as HubSpotSearchResponse;
    return data.results?.[0] ?? null;
  }
}

// ── Utility functions ─────────────────────────────────────────────────────────

/**
 * Extract the domain part from an email address.
 * Returns null when the email is absent or malformed.
 *
 * @example
 *   extractEmailDomain("alice@acme.com") // "acme.com"
 *   extractEmailDomain(null)             // null
 */
function extractEmailDomain(email: string | null): string | null {
  if (!email) return null;
  const atIdx = email.indexOf("@");
  if (atIdx < 0) return null;
  const domain = email.slice(atIdx + 1).toLowerCase().trim();
  return domain || null;
}

/**
 * Normalise a HubSpot lifecycle stage value to a predictable lowercase string.
 * Returns null when the value is absent or empty.
 */
function normalizeLifecycleStage(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.toLowerCase().trim() || null;
}
