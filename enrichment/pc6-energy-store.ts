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
  netbeheerder:     string;
  avgGasM3:         number | null;
  avgElkKwh:        number | null;
  solarPct:         number | null;
  smartMeterPct:    number | null;
  connectionsCount: number | null;
}

/** A raw pc6_energy_stats row (numeric columns may arrive as strings from PostgREST). */
export interface Pc6EnergyRow {
  netbeheerder:       string;
  postcode_van:       string;
  postcode_tot:       string;
  avg_gas_m3:         number | string | null;
  avg_elk_kwh:        number | string | null;
  solar_feedback_pct: number | string | null;
  smart_meter_pct:    number | string | null;
  connections_count:  number | string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

const num = (v: unknown): number | null => (v != null && v !== "" ? Number(v) : null);

/**
 * Ordinal for a PC6 ("1234AB"), monotonic with lexicographic order. Used to size a
 * postcode range: span = ordinal(tot) − ordinal(van) (0 for an exact PC6 row).
 */
function pc6Ordinal(pc6: string): number {
  const digits = parseInt(pc6.slice(0, 4), 10);
  const l1 = pc6.charCodeAt(4) - 65; // 'A' → 0
  const l2 = pc6.charCodeAt(5) - 65;
  return (digits * 26 + l1) * 26 + l2;
}
const rangeSpan = (r: Pc6EnergyRow): number =>
  pc6Ordinal(String(r.postcode_tot).toUpperCase()) - pc6Ordinal(String(r.postcode_van).toUpperCase());

/**
 * Coalesce every row that contains `pc6` into one result, taking each field from
 * the TIGHTEST range that has a non-null value (smallest van→tot span; an exact
 * PC6 row has span 0). This handles netbeheerders that group electricity and gas
 * in differently-wide ranges for the same PC6 (e.g. ELK exact per PC6, GAS in a
 * merged range) — with limit(1) you'd get only one fuel. Nulls are skipped per
 * field. Returns null when no row actually contains the PC6. Pure + testable.
 */
export function coalescePc6Rows(pc6: string, rows: Pc6EnergyRow[]): Pc6Energy | null {
  // Defensive hercheck: only rows that truly contain the PC6.
  const inRange = rows.filter((r) => pc6InRange(pc6, String(r.postcode_van), String(r.postcode_tot)));
  if (inRange.length === 0) return null;

  // Tightest range first; stable sort keeps input order for equal spans.
  const sorted = [...inRange].sort((a, b) => rangeSpan(a) - rangeSpan(b));

  const pick = (get: (r: Pc6EnergyRow) => number | string | null): number | null => {
    for (const r of sorted) {
      const v = num(get(r));
      if (v != null) return v;
    }
    return null;
  };

  return {
    netbeheerder:     sorted[0]!.netbeheerder,
    avgGasM3:         pick((r) => r.avg_gas_m3),
    avgElkKwh:        pick((r) => r.avg_elk_kwh),
    solarPct:         pick((r) => r.solar_feedback_pct),
    smartMeterPct:    pick((r) => r.smart_meter_pct),
    connectionsCount: pick((r) => r.connections_count),
  };
}

/**
 * Look up energy stats for a PC6 via the inclusive postcode range
 * (postcode_van <= pc6 <= postcode_tot). Fetches ALL matching rows and coalesces
 * them per field from the tightest range (see coalescePc6Rows), so a PC6 that is
 * exact for one fuel and inside a merged range for the other still returns both.
 * Null on miss / invalid input / error (fail-open).
 */
export async function getPc6Energy(pc6Raw: string): Promise<Pc6Energy | null> {
  const pc6 = normalizePc6(pc6Raw);
  if (!pc6) return null;
  try {
    const { data } = await db()
      .from("pc6_energy_stats")
      .select("netbeheerder, postcode_van, postcode_tot, avg_gas_m3, avg_elk_kwh, solar_feedback_pct, smart_meter_pct, connections_count")
      .lte("postcode_van", pc6)
      .gte("postcode_tot", pc6);
    if (!data || data.length === 0) return null;
    return coalescePc6Rows(pc6, data as Pc6EnergyRow[]);
  } catch (err) {
    logger.debug("[pc6-energy-store] lookup failed", { error: String(err) });
    return null;
  }
}
