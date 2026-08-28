/**
 * Map a client-side Leadinfo identify result to the ip_company_cache output shape,
 * so a client-identified company warms the platform-wide IP→company cache and a
 * later server-side decision from the same IP is a cache hit (no new paid lookup).
 *
 * Pure — no server-only imports — so it can be unit-tested directly. The route
 * composes this with the shared `ipCompanyCache` writer (schema/TTL stay consistent).
 *
 * companyIndustry has no direct Leadinfo text field: it is derived from the numeric
 * Leadinfo SBI code via the SBI 2025 lookup (#297), English name. The cache reader
 * (rowToOutput) stamps companyMatchSource="leadinfo" on read, so it is not stored
 * here. coc/branch/salesVolume travel in the row's `raw` column (the full data).
 */

import { lookupSbiIndustry } from "@/lib/enrichment/sbi-2025";
import type { LeadinfoData } from "@/context/leadinfo-context";
import type { EnrichmentOutput } from "./types";

/** Map a MATCHED LeadinfoData to the Partial<EnrichmentOutput> the cache row stores. */
export function leadinfoDataToCacheOutput(data: LeadinfoData): Partial<EnrichmentOutput> {
  const out: Partial<EnrichmentOutput> = {};
  if (data.companyName)    out.companyName   = data.companyName;
  if (data.companyDomain)  out.companyDomain = data.companyDomain;
  if (data.companyCountry) out.countryCode   = data.companyCountry;
  if (data.companyCity)    out.city          = data.companyCity;
  if (data.employees)      out.companySize   = data.employees;
  const industry = lookupSbiIndustry(data.branchCode)?.en;
  if (industry)            out.companyIndustry = industry;
  return out;
}
