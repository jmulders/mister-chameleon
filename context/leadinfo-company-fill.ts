/**
 * Fill the generic company fields from a client-side Leadinfo match.
 *
 * The client Leadinfo path (mc_li cookie -> leadinfoToEnrichment) sets only the
 * leadinfo* fields. The server-side Leadinfo stage and the ip_company_cache row
 * warmed from the very same client identify both set the generic fields
 * (companyName / companyDomain / companyIndustry / companySize), so a tenant that
 * recognises companies through the cookie alone had rules, derived signals
 * (companyType, industryGroup) and tokens that never saw the company.
 *
 * The condition, in full:
 *   1. Leadinfo matched a company (`leadinfoMatched === true`), and
 *   2. the generic field is empty (null, undefined or blank).
 * A value another provider set (OpenKvK, IPinfo, HubSpot, first-party pool, an
 * ABM known lead) is never overwritten. Each field is filled on its own, with
 * the same mapping the lead base and the rule webhook already use
 * (resolveCompanyFirmographics), so all three agree on what the company is.
 *
 * The match source and confidence are stamped the way the server-side Leadinfo
 * stage and the cache reader stamp them, and only when Leadinfo is the one that
 * named the company and no provider claimed the match before.
 *
 * Pure: returns the input object untouched when there is nothing to fill.
 */

import { resolveCompanyFirmographics } from "@/lib/lead-base/leadinfo-company-fallback";
import { DEFAULT_MATCH_CONFIDENCE }    from "@/enrichment/ip-company-cache-ttl";
import type { EnrichmentOutput }       from "@/enrichment/types";

/** The generic company fields a Leadinfo match can fill. */
export const LEADINFO_FILLABLE_FIELDS = [
  "companyName", "companyDomain", "companySize", "companyIndustry",
] as const;

export type LeadinfoFillableField = (typeof LEADINFO_FILLABLE_FIELDS)[number];

export interface LeadinfoCompanyFill {
  /** The enrichment with the empty generic company fields filled. */
  enrichment: Partial<EnrichmentOutput>;
  /** Which generic fields were filled from Leadinfo (empty when none). */
  filled: LeadinfoFillableField[];
}

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

export function fillCompanyFromLeadinfo(
  enrichment: Partial<EnrichmentOutput>,
): LeadinfoCompanyFill {
  if (enrichment.leadinfoMatched !== true) return { enrichment, filled: [] };

  // Leadinfo's own view of the company, through the shared mapping. Only the
  // leadinfo* fields go in, so nothing generic can leak back out as "Leadinfo".
  const fromLeadinfo = resolveCompanyFirmographics({
    leadinfoCompanyName:   enrichment.leadinfoCompanyName,
    leadinfoCompanyDomain: enrichment.leadinfoCompanyDomain,
    leadinfoEmployees:     enrichment.leadinfoEmployees,
    leadinfoBranchCode:    enrichment.leadinfoBranchCode,
  });

  const patch: Partial<EnrichmentOutput> = {};
  const filled: LeadinfoFillableField[] = [];
  for (const field of LEADINFO_FILLABLE_FIELDS) {
    const value = fromLeadinfo[field];
    if (isBlank(enrichment[field]) && !isBlank(value)) {
      patch[field] = value;
      filled.push(field);
    }
  }
  if (filled.length === 0) return { enrichment, filled };

  const namedByLeadinfo = filled.includes("companyName") || filled.includes("companyDomain");
  if (namedByLeadinfo && isBlank(enrichment.companyMatchSource)) {
    patch.companyMatchSource = "leadinfo";
    if (enrichment.companyMatchConfidence == null) {
      patch.companyMatchConfidence = DEFAULT_MATCH_CONFIDENCE;
    }
  }

  return { enrichment: { ...enrichment, ...patch }, filled };
}
