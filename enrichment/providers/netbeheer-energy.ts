/**
 * First-party netbeheerder PC6 energy enricher stage, LAZY.
 *
 * Adds per-PC6 small-consumption ("kleinverbruik") energy signals — average gas
 * and electricity use, a solar-adoption proxy, and smart-meter penetration — for
 * a visitor whose PC6 postcode is known. Like BAG it fires on the FORM-postcode
 * path (input.formLocation.postcode), but it needs NO house number: PC6 alone is
 * enough. Data comes from our own pc6_energy_stats store (bulk-ingested from the
 * grid operators' open data; see scripts/netbeheer-ingest.ts).
 *
 * Flow: form PC6 → range lookup in pc6_energy_stats → set fields. Fails open (no
 * enrichment on miss/error, never breaks the render). No-ops when the table is
 * empty (returns no fields). NL-only, small-consumption only.
 *
 * ⚠ Kleinverbruik only (households + small business, up to 3×80A / G25).
 * Grootverbruik (heavy B2B sites) is NOT covered. PC6 granularity — finer than
 * the CBS buurt signals, which remain alongside these.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import type { Pc6Energy } from "../pc6-energy-store";

/** A PC6 postcode: 4 digits + 2 letters, no space. */
const PC6_RE = /^\d{4}[A-Z]{2}$/;

export interface NetbeheerEnergyOptions {
  /** Injectable PC6 lookup (defaults to the DB store) — for tests. */
  lookup?: (pc6: string) => Promise<Pc6Energy | null>;
  isDev?:  boolean;
}

export function createNetbeheerEnergyEnricher(options: NetbeheerEnergyOptions = {}): StagedEnricher {
  const isDev = options.isDev ?? false;

  async function lookup(pc6: string): Promise<Pc6Energy | null> {
    if (options.lookup) return options.lookup(pc6);
    return (await import("../pc6-energy-store")).getPc6Energy(pc6);
  }

  return {
    label:    "Netbeheer Energy",
    stageKey: "netbeheer-energy",

    shouldRun: (input: EnricherInput): boolean => {
      const pc = input.formLocation?.postcode;
      return Boolean(pc && PC6_RE.test(pc.replace(/\s+/g, "").toUpperCase()));
    },

    enricher: async (input: EnricherInput, _accumulated: Partial<EnrichmentOutput>, ctx?: EnricherContext) => {
      const pc6 = input.formLocation?.postcode?.replace(/\s+/g, "").toUpperCase() ?? null;
      if (!pc6 || !PC6_RE.test(pc6)) return {};

      const stats = await lookup(pc6);
      if (!stats) {
        const n = `netbeheer: no PC6 energy data (${pc6})`;
        ctx?.setNote(n);
        return {};
      }

      const out: Partial<EnrichmentOutput> = {};
      if (stats.avgGasM3      != null) out.locationPc6AvgGasM3      = stats.avgGasM3;
      if (stats.avgElkKwh     != null) out.locationPc6AvgElkKwh     = stats.avgElkKwh;
      if (stats.solarPct      != null) out.locationPc6SolarPct      = stats.solarPct;
      if (stats.smartMeterPct != null) out.locationPc6SmartMeterPct = stats.smartMeterPct;

      if (Object.keys(out).length === 0) return {};

      const n = `netbeheer ${stats.netbeheerder}: gas=${stats.avgGasM3 ?? "—"}m³ elk=${stats.avgElkKwh ?? "—"}kWh solar=${stats.solarPct ?? "—"}%`;
      out.locationResolutionNote = n;
      ctx?.setNote(n);
      if (isDev) console.debug("[netbeheer-energy] resolved", { pc6, ...out });
      return out;
    },
  };
}
