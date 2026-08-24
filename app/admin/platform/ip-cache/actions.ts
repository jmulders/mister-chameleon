"use server";

/**
 * Platform - IP company cache (read-only admin view).
 *
 * ip_company_cache is our platform-wide IP to company lookup cache: one paid
 * Leadinfo identify per IP per freshness window, shared across all tenants. This
 * screen lets a platform admin inspect what firmographics we hold and clear the
 * whole cache. It is deliberately read-only per row (no per-row refresh).
 *
 * Privacy: the table is keyed by a one-way IP hash (ip_hash) and the raw IP was
 * dropped (migrations 169/170). This view NEVER selects ip_hash or the raw
 * response payload; only the firmographic columns leave the server.
 *
 * Super-admin only, matching the other platform screens.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, isSuperAdmin, requireSuperAdmin } from "@/lib/admin-auth/authorization";
import { getDb } from "@/data/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

/** Safe firmographic columns only - never ip_hash, never raw. */
const SAFE_COLS =
  "matched, company_name, company_domain, company_industry, company_size, country_code, region, city, refreshed_at";

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
}

export interface IpCacheOverview {
  rows:      IpCacheEntry[];
  total:     number;   // total rows in the cache (may exceed rows.length)
  matched:   number;   // matched rows in this page
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
}

export async function fetchIpCacheAction(): Promise<IpCacheOverview> {
  await requireSuperAdmin();

  let rows: IpCacheEntry[] = [];
  let total = 0;
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
    }));
  } catch {
    // Best-effort: an empty table (or a missing cache) renders the empty state.
    rows = [];
    total = 0;
  }

  const matched = rows.filter((r) => r.matched).length;
  return { rows, total, matched, truncated: total > rows.length };
}

/**
 * Delete every row in ip_company_cache. The cache simply refills, keyed, on the
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
