/**
 * Pure logic for the platform-wide IP→company store (ip_company_cache).
 *
 * Kept free of any server-only imports (no getDb, no "server-only") so it can be
 * unit-tested directly. The DB-backed store (ip-company-store.ts) composes these
 * helpers with a service-role client.
 *
 * Freshness policy — durable first-party company DB (serve-stale-while-revalidate):
 *
 *   The row is no longer a short cache that we discard when it ages. We keep it
 *   durably and classify it into three bands off `last_verified_at` (the last PAID
 *   verification; falls back to `refreshed_at`):
 *
 *     • fresh   — within the soft TTL (match 30d / no-match 7d). Serve it, no paid
 *                 call.
 *     • stale   — past the soft TTL but within hard-retention (match 180d /
 *                 no-match 30d). Serve it immediately (fast + free) AND let a paid
 *                 provider re-verify opportunistically to refresh accuracy.
 *     • expired — past hard-retention. Treat as a miss; a paid call rebuilds it.
 */

import type { EnrichmentOutput } from "./types";

// Soft TTL: how long a row is served without wanting re-verification.
export const MATCH_TTL_MS    = 30 * 24 * 60 * 60 * 1_000; // 30 days
export const NO_MATCH_TTL_MS =  7 * 24 * 60 * 60 * 1_000; //  7 days

// Hard retention: past this a row is stale beyond use → treated as a miss.
export const HARD_RETENTION_MATCH_MS    = 180 * 24 * 60 * 60 * 1_000; // 180 days
export const HARD_RETENTION_NO_MATCH_MS =  30 * 24 * 60 * 60 * 1_000; //  30 days

/** Default confidence for a matched row when none is stored (historical rows). */
export const DEFAULT_MATCH_CONFIDENCE = 0.75;

export type Freshness = "fresh" | "stale" | "expired";

/** Interface the LeadinfoProvider uses to read/write a persistent IP cache. */
export interface LeadinfoPersistentCache {
  /** Fresh/stale hit → { output } (output is {} for a no-match); expired/miss → null. */
  get(ip: string): Promise<{ output: Partial<EnrichmentOutput> } | null>;
  /** Store the result of a lookup (match or no-match), overwriting any prior row. */
  set(ip: string, entry: { matched: boolean; output: Partial<EnrichmentOutput>; raw: unknown; source?: string }): Promise<void>;
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
  confidence:       number | null;
  last_verified_at: string | null;
  verify_count:     number | null;
  source:           string | null;
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
  confidence:       number | null;
  last_verified_at: string;
  verify_count:     number;
  source:           string | null;
}

interface FreshnessOpts {
  matchTtlMs?:            number;
  noMatchTtlMs?:          number;
  hardRetentionMatchMs?:  number;
  hardRetentionNoMatchMs?: number;
}

/** Age of a row, in ms, off its last verification (falls back to refreshed_at). */
function ageMs(
  row: { refreshed_at: string | null; last_verified_at?: string | null },
  nowMs: number,
): number | null {
  const iso = row.last_verified_at ?? row.refreshed_at;
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return nowMs - t;
}

/**
 * Classify a stored row into fresh / stale / expired.
 * Missing/unparseable timestamp → expired. Clock skew (row in the future) → fresh.
 */
export function freshness(
  row: { matched: boolean; refreshed_at: string | null; last_verified_at?: string | null },
  nowMs: number,
  opts?: FreshnessOpts,
): Freshness {
  const age = ageMs(row, nowMs);
  if (age === null) return "expired";
  if (age < 0) return "fresh"; // clock skew
  const soft = row.matched
    ? (opts?.matchTtlMs   ?? MATCH_TTL_MS)
    : (opts?.noMatchTtlMs ?? NO_MATCH_TTL_MS);
  const hard = row.matched
    ? (opts?.hardRetentionMatchMs   ?? HARD_RETENTION_MATCH_MS)
    : (opts?.hardRetentionNoMatchMs ?? HARD_RETENTION_NO_MATCH_MS);
  if (age < soft) return "fresh";
  if (age < hard) return "stale";
  return "expired";
}

/**
 * Back-compat helper: is a row fresh enough to serve without wanting a re-verify?
 * (fresh only). Callers that want serve-stale semantics use `freshness()` directly.
 */
export function isFresh(
  row: { matched: boolean; refreshed_at: string | null; last_verified_at?: string | null },
  nowMs: number,
  opts?: FreshnessOpts,
): boolean {
  return freshness(row, nowMs, opts) === "fresh";
}

/** Map a cached row into the enrichment output shape (mirrors LeadinfoProvider). */
export function rowToOutput(row: IpCompanyRow): Partial<EnrichmentOutput> {
  if (!row.matched) return {};
  const out: Partial<EnrichmentOutput> = {
    companyMatchSource:     row.source ?? "leadinfo",
    companyMatchConfidence: row.confidence ?? DEFAULT_MATCH_CONFIDENCE,
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
 * for tests. A write is always a fresh paid verification, so `refreshed_at` and
 * `last_verified_at` are both set to now.
 */
export function buildIpCompanyRow(
  ipHash: string,
  matched: boolean,
  output: Partial<EnrichmentOutput>,
  raw: unknown,
  source: string | null = null,
  verifyCount = 1,
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
    confidence:       matched ? (output.companyMatchConfidence ?? DEFAULT_MATCH_CONFIDENCE) : null,
    last_verified_at: nowIso,
    verify_count:     verifyCount < 1 ? 1 : verifyCount,
    source:           source ?? output.companyMatchSource ?? null,
  };
}
