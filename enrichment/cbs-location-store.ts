/**
 * DB-backed reader for the CBS buurt (neighbourhood) statistics table
 * (cbs_area_stats), server-only.
 *
 * The location enricher looks up a visitor's CBS buurtcode here to add
 * neighbourhood firmographics to the enrichment output. Reads never throw: on any
 * failure we return null and the enricher simply adds no location fields.
 */

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

export interface CbsAreaStats {
  areaCode:       string;
  urbanityProxy:  number | null;   // official CBS MateVanStedelijkheid (density fallback when suppressed)
  incomeBand:     string | null;
  businessShare:  number | null;
}

const COLS = "area_code, urbanity_proxy, income_band, business_share";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

/** Look up CBS statistics for a buurtcode (e.g. "BU03630000"). Null on miss/error. */
export async function getCbsStatsForArea(areaCode: string): Promise<CbsAreaStats | null> {
  if (!/^BU\d{8}$/.test(areaCode)) return null;
  try {
    const { data } = await db()
      .from("cbs_area_stats")
      .select(COLS)
      .eq("area_code", areaCode)
      .maybeSingle();
    if (!data) return null;
    return {
      areaCode:      data.area_code,
      urbanityProxy: data.urbanity_proxy ?? null,
      incomeBand:    data.income_band ?? null,
      businessShare: data.business_share != null ? Number(data.business_share) : null,
    };
  } catch (err) {
    logger.debug("[cbs-location-store] lookup failed", { areaCode, error: String(err) });
    return null;
  }
}

/**
 * Upsert a mapped CBS row into cbs_area_stats (the lazy per-buurt cache write).
 * Never throws — a failed cache write must not break enrichment; the value is
 * still usable in-memory for this request.
 */
export async function upsertCbsArea(row: Record<string, unknown>): Promise<void> {
  try {
    await db()
      .from("cbs_area_stats")
      .upsert({ ...row, refreshed_at: new Date().toISOString() }, { onConflict: "area_code" });
  } catch (err) {
    logger.debug("[cbs-location-store] upsert failed", { error: String(err) });
  }
}
