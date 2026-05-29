/**
 * IP → Company → HubSpot CRM — Sequential Enricher
 *
 * Two-stage enrichment pipeline in a single `LabeledEnricher`:
 *
 *   Stage 1  IP address → Company identification (e.g. Clearbit Reveal)
 *            Identifies the company that owns the visitor's IP and returns
 *            firmographic fields: name, domain, industry, size, confidence.
 *
 *   Stage 2  Company domain → HubSpot CRM search
 *            Searches the platform's HubSpot instance for a company record
 *            whose `domain` property matches the domain resolved in stage 1.
 *            Returns CRM fields: crmMatched, crmCompanyId, crmLifecycleStage,
 *            crmIsCustomer, crmCompanyName, crmCompanyDomain, crmIndustry.
 *
 * ─── Why sequential rather than parallel? ────────────────────────────────────
 *
 *   The `runEnrichmentPipeline` runs all enrichers concurrently.  Stage 2
 *   (HubSpot) requires stage 1's output (the company domain), so these two
 *   steps cannot run in parallel.  This combined enricher keeps them together
 *   as a single pipeline entry.
 *
 * ─── Output ───────────────────────────────────────────────────────────────────
 *
 *   When IP resolves to a company:
 *     companyName, companyDomain, companyIndustry, companySize,
 *     companyMatchConfidence, companyMatchSource
 *
 *   When HubSpot finds a matching company record:
 *     crmMatched: true, crmCompanyId, crmLifecycleStage, crmIsCustomer,
 *     crmCompanyName, crmCompanyDomain, crmIndustry
 *
 *   When HubSpot finds no match:
 *     crmMatched: false  (company fields still populated if IP resolved)
 *
 *   When IP cannot be resolved:
 *     {} — empty, all fields absent
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   Both stages catch all errors internally and return partial results.
 *   The enricher always resolves — it never rejects — preserving the
 *   pipeline's fail-safe guarantee.
 *
 * ─── Dev logging ──────────────────────────────────────────────────────────────
 *
 *   When `isDev` is true, `console.debug` lines are emitted at each stage:
 *     [ip-company-hubspot] resolved IP: ...
 *     [ip-company-hubspot] stage 1 company: { name, domain, industry }
 *     [ip-company-hubspot] stage 2 HubSpot: { crmMatched, crmCompanyId, ... }
 */

import type { EnricherInput, EnrichmentOutput, LabeledEnricher } from "../types";
import type { CompanyProvider }   from "./company";
import { normalizeCompanyOutput } from "./company";
import { HubSpotCrmProvider }     from "./hubspot-crm";

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Build a sequential IP → company → HubSpot LabeledEnricher.
 *
 * Pass this to `runEnrichmentPipeline` in place of the separate
 * `createCompanyEnricher` + `createCrmEnricher` pair.
 *
 * @param options.companyProvider     Any `CompanyProvider` — e.g. a
 *                                    `ClearbitCompanyProvider` for production
 *                                    or a `MockCompanyProvider` for dev.
 * @param options.hubspotAccessToken  HubSpot Private App access token.
 *                                    Server-only — never reaches the client.
 * @param options.isDev               Enable verbose `console.debug` logging.
 *                                    Defaults to false.
 * @param options.hubspotApiBase      Override HubSpot API base URL (tests).
 *
 * @example
 * import { ClearbitCompanyProvider } from "@/enrichment/providers/clearbit-company";
 * import { createIpCompanyHubSpotEnricher } from "@/enrichment/providers/ip-company-hubspot-enricher";
 *
 * const enricher = createIpCompanyHubSpotEnricher({
 *   companyProvider:    new ClearbitCompanyProvider({ secretKey: "sk_live_..." }),
 *   hubspotAccessToken: "pat-na1-...",
 *   isDev:              process.env.NODE_ENV === "development",
 * });
 *
 * const { output } = await runEnrichmentPipeline([...geoEnrichers, enricher], input);
 * // output.companyName    → "Acme Corp"
 * // output.crmMatched     → true
 * // output.crmCompanyId   → "12345678"
 */
export function createIpCompanyHubSpotEnricher(options: {
  companyProvider:     CompanyProvider;
  hubspotAccessToken:  string;
  isDev?:              boolean;
  hubspotApiBase?:     string;
}): LabeledEnricher {
  const { companyProvider, hubspotAccessToken, isDev = false, hubspotApiBase } = options;

  const hubspot = new HubSpotCrmProvider({
    accessToken: hubspotAccessToken,
    ...(hubspotApiBase ? { apiBase: hubspotApiBase } : {}),
  });

  return {
    label: "ip-company-hubspot",
    enricher: async (input: EnricherInput): Promise<Partial<EnrichmentOutput>> => {
      if (isDev) {
        console.debug("[ip-company-hubspot] starting — IP:", input.ip ?? "(null)");
      }

      // ── Stage 1: IP → Company ─────────────────────────────────────────────

      let companyRaw: Awaited<ReturnType<CompanyProvider["identify"]>>;
      try {
        companyRaw = await companyProvider.identify(input.ip);
      } catch {
        // CompanyProvider implementations should never reject, but guard anyway.
        companyRaw = {};
      }

      const companyOutput = normalizeCompanyOutput(companyRaw);

      if (isDev) {
        console.debug("[ip-company-hubspot] stage 1 company:", {
          name:       companyOutput.companyName       ?? null,
          domain:     companyOutput.companyDomain     ?? null,
          industry:   companyOutput.companyIndustry   ?? null,
          size:       companyOutput.companySize       ?? null,
          confidence: companyOutput.companyMatchConfidence ?? null,
          source:     companyOutput.companyMatchSource ?? null,
        });
      }

      // If stage 1 produced no domain there is nothing to search in HubSpot.
      if (!companyOutput.companyDomain) {
        return {
          ...companyOutput,
          crmMatched: false,
        };
      }

      // ── Stage 2: Company domain → HubSpot ────────────────────────────────

      const crmResult = await hubspot.matchByDomain(companyOutput.companyDomain);

      if (isDev) {
        console.debug("[ip-company-hubspot] stage 2 HubSpot:", {
          crmMatched:        crmResult.crmMatched        ?? null,
          crmCompanyId:      crmResult.crmCompanyId      ?? null,
          crmLifecycleStage: crmResult.crmLifecycleStage ?? null,
          crmIsCustomer:     crmResult.crmIsCustomer     ?? null,
          crmCompanyDomain:  crmResult.crmCompanyDomain  ?? null,
        });
      }

      // Merge: company fields (stage 1) + CRM fields (stage 2).
      // When crmMatched is false the company fields are still kept so
      // firmographic rules continue to fire even without a CRM record.
      return {
        ...companyOutput,
        crmMatched:        crmResult.crmMatched        ?? false,
        crmLifecycleStage: crmResult.crmLifecycleStage ?? null,
        crmSegment:        crmResult.crmSegment        ?? null,
        crmAccountOwner:   crmResult.crmAccountOwner   ?? null,
        crmCompanyId:      crmResult.crmCompanyId      ?? null,
        crmCompanyName:    crmResult.crmCompanyName    ?? null,
        crmCompanyDomain:  crmResult.crmCompanyDomain  ?? null,
        crmIndustry:       crmResult.crmIndustry       ?? null,
        crmIsCustomer:     crmResult.crmIsCustomer     ?? null,
      };
    },
  };
}
