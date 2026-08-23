/**
 * Pure logic for the platform-wide IP→company cache (ip_company_cache).
 *
 * Kept free of any server-only imports (no getDb, no "server-only") so it can be
 * unit-tested directly. The DB-backed store (ip-company-store.ts) composes these
 * helpers with a service-role client.
 *
 * Freshness policy (why two TTLs): a matched IP→company mapping is stable, so we
 * trust it for 30 days; a no-match is worth retrying sooner (a company may start
 * being identifiable), so it goes stale after 7 days. A stale row is treated as a
 * miss → we re-query Leadinfo and overwrite the row.
 */

import type { EnrichmentOutput } from "./types";

export const MATCH_TTL_MS    = 30 * 24 * 60 * 60 * 1_000; // 30 days
export const NO_MATCH_TTL_MS =  7 * 24 * 60 * 60 * 1_000; //  7 days

/** Interface the LeadinfoProvider uses to read/write a persistent IP cache. */
export interface LeadinfoPersistentCache {
  /** Fresh hit → { output } (output is {} for a fresh no-match); miss/stale → null. */
  get(ip: string): Promise<{ output: Partial<EnrichmentOutput> } | null>;
  /** Store the result of a lookup (match or no-match), overwriting any prior row. */
  set(ip: string, entry: { matched: boolean; output: Partial<EnrichmentOutput>; raw: unknown }): Promise<void>;
}

/** The columns we read back from ip_company_cache. */
export interface IpCompanyRow {
  matched:          boolean;
  company_name:     string | null;
  company_domain:   string | null;
  company_industry: string | null;
  company_size:     string | null;
  country_code:     string | null;
  region:           string | null;
  city:             string | null;
  refreshed_at:     string | null;
}

/** The row we upsert into ip_company_cache. `ip_hash` is a one-way digest of the IP. */
export interface IpCompanyInsert {
  ip_hash:          string;
  matched:          boolean;
  company_name:     string | null;
  company_domain:   string | null;
  company_industry: string | null;
  company_size:     string | null;
  country_code:     string | null;
  region:           string | null;
  city:             string | null;
  raw:              unknown;
  refreshed_at:     string;
}

/**
 * Is a cached row still fresh enough to serve without re-querying Leadinfo?
 * Missing/unparseable timestamp → stale. Clock skew (row in the future) → fresh.
 */
export function isFresh(
  row: { matched: boolean; refreshed_at: string | null },
  nowMs: number,
  opts?: { matchTtlMs?: number; noMatchTtlMs?: number },
): boolean {
  if (!row.refreshed_at) return false;
  const t = Date.parse(row.refreshed_at);
  if (Number.isNaN(t)) return false;
  const ttl = row.matched
    ? (opts?.matchTtlMs    ?? MATCH_TTL_MS)
    : (opts?.noMatchTtlMs  ?? NO_MATCH_TTL_MS);
  return nowMs - t < ttl;
}

/** Map a cached row into the enrichment output shape (mirrors LeadinfoProvider). */
export function rowToOutput(row: IpCompanyRow): Partial<EnrichmentOutput> {
  if (!row.matched) return {};
  const out: Partial<EnrichmentOutput> = {
    companyMatchSource:     "leadinfo",
    companyMatchConfidence: 0.75,
  };
  if (row.company_name)     out.companyName     = row.company_name;
  if (row.company_domain)   out.companyDomain   = row.company_domain;
  if (row.company_industry) out.companyIndustry = row.company_industry;
  if (row.company_size)     out.companySize     = row.company_size;
  if (row.country_code)     out.countryCode     = row.country_code;
  if (row.region)           out.region          = row.region;
  if (row.city)             out.city            = row.city;
  return out;
}

/**
 * Build the row to upsert from a lookup result. `ipHash` is the one-way IP digest
 * (see lib/ip-hash.ts) used as the key — never the raw IP. `nowIso` is injectable
 * for tests.
 */
export function buildIpCompanyRow(
  ipHash: string,
  matched: boolean,
  output: Partial<EnrichmentOutput>,
  raw: unknown,
  nowIso: string = new Date().toISOString(),
): IpCompanyInsert {
  return {
    ip_hash: ipHash,
    matched,
    company_name:     output.companyName     ?? null,
    company_domain:   output.companyDomain   ?? null,
    company_industry: output.companyIndustry ?? null,
    company_size:     output.companySize     ?? null,
    country_code:     output.countryCode     ?? null,
    region:           output.region          ?? null,
    city:             output.city            ?? null,
    raw:              raw ?? null,
    refreshed_at:     nowIso,
  };
}
