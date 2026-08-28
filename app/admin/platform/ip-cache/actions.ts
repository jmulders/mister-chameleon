"use server";

/**
 * Platform - first-party company DB (read-only admin view).
 *
 * ip_company_cache is our durable, platform-wide IP to company store: a paid
 * Leadinfo identify per IP per freshness window, shared across all tenants and
 * reused first-party to skip paid calls. This screen lets a platform admin
 * inspect what firmographics we hold (including the raw provider payload and the
 * pool stats) and clear the whole store.
 *
 * Privacy: the table is keyed by a one-way IP hash (ip_hash) and the raw IP was
 * dropped (migrations 169/170). This view NEVER selects ip_hash. The `raw`
 * payload IS shown here — it is firmographic, company-level data (KvK/SBI/SIC/
 * employees/sales), not personal data, and this is a super-admin-only screen.
 *
 * Super-admin only, matching the other platform screens.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, isSuperAdmin, requireSuperAdmin } from "@/lib/admin-auth/authorization";
import { getDb } from "@/data/db";
import { freshness, type Freshness } from "@/enrichment/ip-company-cache-ttl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

/** Firmographic + provenance columns, plus the raw payload. Never ip_hash. */
const SAFE_COLS =
  "matched, company_name, company_domain, company_industry, company_size, " +
  "country_code, region, city, refreshed_at, confidence, last_verified_at, verify_count, source, raw";

/** Upper bound on rows returned to the table (newest first). */
const ROW_LIMIT = 2000;

export interface IpCacheEntry {
  matched:         boolean;
  companyName:     string | null;
  companyDomain:   string | null;
  companyIndustry: string | null;
  companySize:     string | null;
  countryCode:     string | null;
  region:          string | null;
  city:            string | null;
  refreshedAt:     string;
  confidence:      number | null;
  lastVerifiedAt:  string | null;
  verifyCount:     number;
  source:          string | null;
  freshness:       Freshness;
  raw:             unknown;
}

export interface IpCacheStats {
  /** Total rows in the store (exact). */
  total:          number;
  /** Matched rows (exact) — the pool coverage numerator. */
  matched:        number;
  /** Saved paid Leadinfo calls = first-party lookup usage events (exact, best-effort). */
  savedLeadinfoCalls: number;
  /** Freshness breakdown over the rows shown (page-scoped, honest about scope). */
  fresh:          number;
  stale:          number;
  expired:        number;
}

export interface IpCacheOverview {
  rows:      IpCacheEntry[];
  stats:     IpCacheStats;
  truncated: boolean;  // true when total > rows.length (some rows not shown)
}

interface CacheDbRow {
  matched:          boolean | null;
  company_name:     string | null;
  company_domain:   string | null;
  company_industry: string | null;
  company_size:     string | null;
  country_code:     string | null;
  region:           string | null;
  city:             string | null;
  refreshed_at:     string;
  confidence:       number | null;
  last_verified_at: string | null;
  verify_count:     number | null;
  source:           string | null;
  raw:              unknown;
}

export async function fetchIpCacheAction(): Promise<IpCacheOverview> {
  await requireSuperAdmin();

  let rows: IpCacheEntry[] = [];
  let total = 0;
  const now = Date.now();
  try {
    // count(exact) so the UI can honestly report truncation.
    const { data, count } = await db()
      .from("ip_company_cache")
      .select(SAFE_COLS, { count: "exact" })
      .order("refreshed_at", { ascending: false })
      .limit(ROW_LIMIT);
    total = typeof count === "number" ? count : (data?.length ?? 0);
    rows = ((data ?? []) as CacheDbRow[]).map((r) => ({
      matched:         r.matched === true,
      companyName:     r.company_name,
      companyDomain:   r.company_domain,
      companyIndustry: r.company_industry,
      companySize:     r.company_size,
      countryCode:     r.country_code,
      region:          r.region,
      city:            r.city,
      refreshedAt:     r.refreshed_at,
      confidence:      r.confidence,
      lastVerifiedAt:  r.last_verified_at,
      verifyCount:     Number(r.verify_count ?? 0) || 0,
      source:          r.source,
      freshness:       freshness({ matched: r.matched === true, refreshed_at: r.refreshed_at, last_verified_at: r.last_verified_at }, now),
      raw:             r.raw ?? null,
    }));
  } catch {
    // Best-effort: an empty table (or a missing store) renders the empty state.
    rows = [];
    total = 0;
  }

  // Exact matched count over the whole store (not just the page).
  let matchedTotal = rows.filter((r) => r.matched).length;
  try {
    const { count } = await db()
      .from("ip_company_cache")
      .select("refreshed_at", { count: "exact", head: true })
      .eq("matched", true);
    if (typeof count === "number") matchedTotal = count;
  } catch { /* keep page-based fallback */ }

  // Saved paid Leadinfo calls = number of first-party lookup usage events.
  let savedLeadinfoCalls = 0;
  try {
    const { count } = await db()
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("feature_key", "firstparty_company_lookup");
    if (typeof count === "number") savedLeadinfoCalls = count;
  } catch { /* best-effort */ }

  const stats: IpCacheStats = {
    total,
    matched:            matchedTotal,
    savedLeadinfoCalls,
    fresh:   rows.filter((r) => r.freshness === "fresh").length,
    stale:   rows.filter((r) => r.freshness === "stale").length,
    expired: rows.filter((r) => r.freshness === "expired").length,
  };

  return { rows, stats, truncated: total > rows.length };
}

/**
 * Delete every row in ip_company_cache. The store simply refills, keyed, on the
 * next lookup, so this is safe - it only discards firmographics we would re-query.
 * Super-admin only; the client confirms before calling.
 */
export async function clearIpCacheAction(): Promise<{ ok: true; cleared: number } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) return { ok: false, error: "Only platform admins can clear the IP cache." };

  try {
    // Count first so we can report how many rows were cleared.
    const { count } = await db().from("ip_company_cache").select("refreshed_at", { count: "exact", head: true });
    // Delete all rows. The refreshed_at filter matches every row (non-null column)
    // while satisfying the client's requirement that a delete carries a filter.
    const { error } = await db().from("ip_company_cache").delete().not("refreshed_at", "is", null);
    if (error) return { ok: false, error: "Could not clear the cache. Please try again." };
    revalidatePath("/admin/platform/ip-cache");
    return { ok: true, cleared: typeof count === "number" ? count : 0 };
  } catch {
    return { ok: false, error: "Could not clear the cache. Please try again." };
  }
}
