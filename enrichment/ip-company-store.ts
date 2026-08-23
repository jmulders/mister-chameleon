/**
 * DB-backed platform-wide IP→company cache (ip_company_cache), server-only.
 *
 * Exposes a single shared `ipCompanyCache` implementing LeadinfoPersistentCache.
 * Both Leadinfo call sites (ads: resolveAdCompany; CMS: the enrichment chain)
 * inject it into LeadinfoProvider, so a paid identify call runs at most once per
 * IP per freshness window and the result is reused across every tenant.
 *
 * Never throws: a cache read/write failure must never break enrichment or ad
 * serving — on failure we fall through to a live Leadinfo call.
 */

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import { ipHash } from "@/lib/ip-hash";
import {
  isFresh, rowToOutput, buildIpCompanyRow,
  type LeadinfoPersistentCache, type IpCompanyRow,
} from "./ip-company-cache-ttl";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

const COLS = "matched, company_name, company_domain, company_industry, company_size, country_code, region, city, refreshed_at";

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
      if (!isFresh(row, Date.now())) return null; // stale → treat as a miss (re-query)
      return { output: rowToOutput(row) };
    } catch (err) {
      logger.debug("[ip-company-cache] get failed", { error: String(err) });
      return null;
    }
  },

  async set(ip, entry) {
    if (!ip) return;
    try {
      await db()
        .from("ip_company_cache")
        .upsert(buildIpCompanyRow(ipHash(ip), entry.matched, entry.output, entry.raw), { onConflict: "ip_hash" });
    } catch (err) {
      logger.debug("[ip-company-cache] set failed", { error: String(err) });
    }
  },
};
