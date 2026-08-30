/**
 * DB-backed lazy cache for BAG per-address building facts (bag_address_cache),
 * server-only. Keyed on a SHA-256 hash of "postcode:huisnummer" — the raw address
 * (personal data) is NEVER stored, only the hash + the derived building facts.
 *
 * Reads/writes never throw: on any failure the enricher simply adds no fields.
 * BAG facts (build year / use / area) are very stable, so the TTL is long.
 */

import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import type { BagAddress } from "@/lib/enrichment/bag-ingest";

export const BAG_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1_000; // 180 days

/** SHA-256 of the normalised "postcode:huisnummer" — the cache key (no raw address stored). */
export function bagAddrHash(postcode: string, houseNumber: string): string {
  const pc = postcode.replace(/\s+/g, "").toUpperCase();
  const hn = houseNumber.trim();
  return createHash("sha256").update(`${pc}:${hn}`, "utf8").digest("hex");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

/** Look up cached BAG facts for an address. Null on miss / expiry / error. */
export async function getBagAddress(postcode: string, houseNumber: string): Promise<BagAddress | null> {
  try {
    const { data } = await db()
      .from("bag_address_cache")
      .select("build_year, building_use, area_m2, expires_at")
      .eq("addr_hash", bagAddrHash(postcode, houseNumber))
      .maybeSingle();
    if (!data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null; // expired
    return {
      buildYear:   data.build_year ?? null,
      buildingUse: data.building_use ?? null,
      areaM2:      data.area_m2 ?? null,
    };
  } catch (err) {
    logger.debug("[bag-address-store] lookup failed", { error: String(err) });
    return null;
  }
}

/** Upsert BAG facts for an address (the lazy cache write). Never throws. */
export async function upsertBagAddress(postcode: string, houseNumber: string, data: BagAddress): Promise<void> {
  try {
    await db()
      .from("bag_address_cache")
      .upsert({
        addr_hash:    bagAddrHash(postcode, houseNumber),
        build_year:   data.buildYear,
        building_use: data.buildingUse,
        area_m2:      data.areaM2,
        refreshed_at: new Date().toISOString(),
        expires_at:   new Date(Date.now() + BAG_CACHE_TTL_MS).toISOString(),
      }, { onConflict: "addr_hash" });
  } catch (err) {
    logger.debug("[bag-address-store] upsert failed", { error: String(err) });
  }
}
