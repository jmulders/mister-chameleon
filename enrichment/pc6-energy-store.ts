/**
 * DB-backed reader for netbeheerder kleinverbruik energy per PC6
 * (pc6_energy_stats), server-only.
 *
 * The netbeheer-energy enricher looks up a visitor's PC6 here to add per-PC6
 * energy usage + solar adoption. Reads never throw: on any failure we return null
 * and the enricher simply adds no fields. Filled in bulk by
 * `npm run netbeheer:ingest` (see scripts/netbeheer-ingest.ts).
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import { normalizePc6, pc6InRange } from "@/lib/enrichment/netbeheer-ingest";

export interface Pc6Energy {
  netbeheerder:  string;
  avgGasM3:      number | null;
  avgElkKwh:     number | null;
  solarPct:      number | null;
  smartMeterPct: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

const num = (v: unknown): number | null => (v != null ? Number(v) : null);

/**
 * Look up energy stats for a PC6 via the inclusive postcode range
 * (postcode_van <= pc6 <= postcode_tot). Most PC6 have an exact row
 * (van == tot); merged ranges only cover PC6 with < 10 aansluitingen. Prefers the
 * range whose start is closest at/below the PC6, then guards the match with the
 * pure range predicate. Null on miss / invalid input / error.
 */
export async function getPc6Energy(pc6Raw: string): Promise<Pc6Energy | null> {
  const pc6 = normalizePc6(pc6Raw);
  if (!pc6) return null;
  try {
    const { data } = await db()
      .from("pc6_energy_stats")
      .select("netbeheerder, postcode_van, postcode_tot, avg_gas_m3, avg_elk_kwh, solar_feedback_pct, smart_meter_pct")
      .lte("postcode_van", pc6)
      .gte("postcode_tot", pc6)
      .order("postcode_van", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    // Defensive client-side guard: confirm the row really contains the PC6.
    if (!pc6InRange(pc6, String(data.postcode_van), String(data.postcode_tot))) return null;
    return {
      netbeheerder:  String(data.netbeheerder),
      avgGasM3:      num(data.avg_gas_m3),
      avgElkKwh:     num(data.avg_elk_kwh),
      solarPct:      num(data.solar_feedback_pct),
      smartMeterPct: num(data.smart_meter_pct),
    };
  } catch (err) {
    logger.debug("[pc6-energy-store] lookup failed", { error: String(err) });
    return null;
  }
}
