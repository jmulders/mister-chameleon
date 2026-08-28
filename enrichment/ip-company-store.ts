/**
 * DB-backed platform-wide IP→company store (ip_company_cache), server-only.
 *
 * This is the durable first-party company DB. It exposes the shared
 * `ipCompanyCache` implementing LeadinfoPersistentCache — both Leadinfo call
 * sites (ads: resolveAdCompany; CMS: the enrichment chain) and the first-party
 * enricher stage read/write it, so a paid identify runs at most once per IP per
 * freshness window and the result is reused across every tenant.
 *
 * Serve-stale-while-revalidate: `get()` returns fresh AND stale rows (only
 * expired/missing rows read as a miss). The caller (the first-party stage /
 * LeadinfoProvider) uses the value immediately; a paid re-verify still happens
 * opportunistically when a stale row triggers a downstream paid call, refreshing
 * accuracy without ever blocking the request.
 *
 * Never throws: a read/write failure must never break enrichment or ad serving —
 * on failure we fall through to a live Leadinfo call.
 */

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import { ipHash } from "@/lib/ip-hash";
import {
  freshness, rowToOutput, buildIpCompanyRow,
  HARD_RETENTION_MATCH_MS, HARD_RETENTION_NO_MATCH_MS,
  type LeadinfoPersistentCache, type IpCompanyRow,
} from "./ip-company-cache-ttl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

const COLS =
  "matched, company_name, company_domain, company_industry, company_size, " +
  "country_code, region, city, refreshed_at, confidence, last_verified_at, verify_count, source";

export const ipCompanyCache: LeadinfoPersistentCache = {
  async get(ip) {
    if (!ip) return null;
    try {
      const { data } = await db()
        .from("ip_company_cache")
        .select(COLS)
        .eq("ip_hash", ipHash(ip))
        .maybeSingle();
      if (!data) return null;
      const row = data as IpCompanyRow;
      // Serve fresh AND stale (durable DB); only expired reads as a miss so a
      // paid call rebuilds the row.
      if (freshness(row, Date.now()) === "expired") return null;
      return { output: rowToOutput(row) };
    } catch (err) {
      logger.debug("[ip-company-cache] get failed", { error: String(err) });
      return null;
    }
  },

  async set(ip, entry) {
    if (!ip) return;
    try {
      // Best-effort verify_count increment: writes only happen on a paid
      // verification, which is rare, so the extra read is cheap. Racy by at most
      // one under concurrent writes — acceptable for an observability counter.
      let priorCount = 0;
      try {
        const { data: prior } = await db()
          .from("ip_company_cache")
          .select("verify_count")
          .eq("ip_hash", ipHash(ip))
          .maybeSingle();
        priorCount = Number(prior?.verify_count ?? 0) || 0;
      } catch { /* first write / read failure → start at 1 */ }

      const row = buildIpCompanyRow(
        ipHash(ip), entry.matched, entry.output, entry.raw,
        entry.source ?? null, priorCount + 1,
      );
      await db()
        .from("ip_company_cache")
        .upsert(row, { onConflict: "ip_hash" });
    } catch (err) {
      logger.debug("[ip-company-cache] set failed", { error: String(err) });
    }
  },
};

/**
 * Retention sweep for the durable first-party company DB.
 *
 * Deletes rows past hard-retention (matched > 180d, no-match > 30d since the last
 * verification). Expired rows are already treated as a miss on read, so deleting
 * them only reclaims space — a later lookup rebuilds the row via a paid call.
 * Keyed off `last_verified_at`, which the migration backfilled for every existing
 * row and every write sets. Never throws; returns how many rows were removed.
 */
export async function purgeExpiredIpCompanyRows(
  nowMs: number = Date.now(),
): Promise<{ matched: number; noMatch: number }> {
  const matchedCutoff = new Date(nowMs - HARD_RETENTION_MATCH_MS).toISOString();
  const noMatchCutoff = new Date(nowMs - HARD_RETENTION_NO_MATCH_MS).toISOString();

  async function purge(matched: boolean, cutoff: string): Promise<number> {
    try {
      const { count } = await db()
        .from("ip_company_cache")
        .delete({ count: "exact" })
        .eq("matched", matched)
        .lt("last_verified_at", cutoff);
      return typeof count === "number" ? count : 0;
    } catch (err) {
      logger.debug("[ip-company-cache] purge failed", { matched, error: String(err) });
      return 0;
    }
  }

  const [matched, noMatch] = await Promise.all([
    purge(true, matchedCutoff),
    purge(false, noMatchCutoff),
  ]);
  return { matched, noMatch };
}
