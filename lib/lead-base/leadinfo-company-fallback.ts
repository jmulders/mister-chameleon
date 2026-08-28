/**
 * Firmographic snapshot resolution for the lead-base, with a client-side Leadinfo
 * fallback.
 *
 * The client Leadinfo path (mc_li → leadinfoToEnrichment) fills the leadinfo*
 * fields (leadinfoCompanyName/Domain/Employees/BranchCode) but NOT the generic
 * server-side firmographic fields (companyName/Domain/Size/Industry). Reading only
 * the generic fields recorded a Leadinfo-identified visitor as anonymous. This
 * resolves each firmographic field, falling back to the Leadinfo equivalent —
 * mirroring the webhook-payload fallback (#290/#296).
 *
 * companyIndustry has no direct Leadinfo text field: it is derived from the
 * numeric Leadinfo SBI code via the SBI 2025 lookup (#297), English name. Unknown
 * SBI code → null. Pure and consent-agnostic — consent gating stays in
 * gateProfileWrite (the returned fields are the SAME enrichment-gated fields).
 */

import { lookupSbiIndustry } from "@/lib/enrichment/sbi-2025";
import type { EnrichmentOutput } from "@/enrichment/types";

export interface CompanyFirmographics {
  companyName:     string | null;
  companyDomain:   string | null;
  companySize:     string | null;
  companyIndustry: string | null;
}

/** Resolve the firmographic snapshot, preferring generic fields and falling back
 *  to the client-side Leadinfo (mc_li) fields when the generic ones are empty. */
export function resolveCompanyFirmographics(
  enrichment: Partial<EnrichmentOutput> | null | undefined,
): CompanyFirmographics {
  const e = enrichment ?? undefined;
  return {
    companyName:     e?.companyName     ?? e?.leadinfoCompanyName   ?? null,
    companyDomain:   e?.companyDomain   ?? e?.leadinfoCompanyDomain ?? null,
    companySize:     e?.companySize     ?? e?.leadinfoEmployees     ?? null,
    companyIndustry: e?.companyIndustry ?? lookupSbiIndustry(e?.leadinfoBranchCode)?.en ?? null,
  };
}
