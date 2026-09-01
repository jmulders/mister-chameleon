/**
 * First-party EP-Online energy-label enricher stage (RVO EP-Online), LAZY.
 *
 * Adds the building's energy label + derived signals for a visitor who typed a
 * real address (postcode + house number) in a form — the same FORM-address path
 * as the BAG enricher. Flow: cache lookup (eponline_label_cache) → MISS → one
 * EP-Online API call → parse → cache → use. Fails open (no enrichment on error,
 * never breaks the render). Requires EPONLINE_API_KEY; without it the stage no-ops.
 *
 * ⚠ Licence: registrations with is_prive=true are NOT in the open dataset and are
 * SKIPPED (no output). The RAW class (location_energy_label) is display-gated by
 * the tenant flag epLabelDisplayAllowed (see substitute-context-tokens); the BAND
 * + internal-derived signals are always available to rules/AI.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import type { EpOnlineLabel, EpOnlineFetchResult } from "@/lib/enrichment/eponline-ingest";

export interface EpOnlineLabelOptions {
  /** Injectable API key resolver (defaults to env EPONLINE_API_KEY) — for tests. */
  resolveKey?: () => string | null;
  /** Injectable cache lookup (defaults to the DB store) — for tests. */
  cacheLookup?: (postcode: string, houseNumber: string) => Promise<EpOnlineLabel | null>;
  /** Injectable live API fetch (defaults to EP-Online) — for tests. */
  liveFetch?:  (postcode: string, houseNumber: string, apiKey: string) => Promise<EpOnlineFetchResult>;
  /** Injectable cache upsert (defaults to the DB store) — for tests. */
  upsert?:     (postcode: string, houseNumber: string, data: EpOnlineLabel) => Promise<void>;
  isDev?:      boolean;
}

export function createEpOnlineLabelEnricher(options: EpOnlineLabelOptions = {}): StagedEnricher {
  const isDev = options.isDev ?? false;

  async function resolveKey(): Promise<string | null> {
    if (options.resolveKey) return options.resolveKey();
    return (await import("@/lib/enrichment/eponline-ingest")).resolveEpOnlineApiKey();
  }
  async function cacheLookup(pc: string, hn: string): Promise<EpOnlineLabel | null> {
    if (options.cacheLookup) return options.cacheLookup(pc, hn);
    return (await import("../eponline-label-store")).getEpOnlineLabel(pc, hn);
  }
  async function liveFetch(pc: string, hn: string, key: string): Promise<EpOnlineFetchResult> {
    if (options.liveFetch) return options.liveFetch(pc, hn, key);
    return (await import("@/lib/enrichment/eponline-ingest")).fetchEpOnlineLabel(pc, hn, key);
  }
  async function upsert(pc: string, hn: string, data: EpOnlineLabel): Promise<void> {
    if (options.upsert) return options.upsert(pc, hn, data);
    return (await import("../eponline-label-store")).upsertEpOnlineLabel(pc, hn, data);
  }

  return {
    label:    "EP-Online Label",
    stageKey: "eponline-label",

    shouldRun: (input: EnricherInput): boolean => {
      const fl = input.formLocation;
      return Boolean(fl && fl.postcode && fl.houseNumber);
    },

    enricher: async (input: EnricherInput, _accumulated: Partial<EnrichmentOutput>, ctx?: EnricherContext) => {
      const fl = input.formLocation;
      const pc = fl?.postcode ?? null;
      const hn = fl?.houseNumber ?? null;
      if (!pc || !hn) return {};

      const key = await resolveKey();
      if (!key) {
        const n = "EP-Online skipped: no EPONLINE_API_KEY configured";
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      let label = await cacheLookup(pc, hn);
      let source: "cache" | "live" | "empty" = label ? "cache" : "empty";
      if (!label) {
        const r = await liveFetch(pc, hn, key);
        if (r.status === "error") {
          ctx?.markRetry("EP-Online transient failure");
          const n = "EP-Online transient failure → retry";
          ctx?.setNote(n);
          return { locationResolutionNote: n };
        }
        if (r.status === "found" && r.data) {
          label = r.data;
          source = "live";
          await upsert(pc, hn, r.data); // cache it (incl. is_prive) to avoid re-fetching
        }
      }

      if (!label) {
        const n = `EP-Online: no registration (${source})`;
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      // Private registrations are NOT in the open dataset — never surface them.
      if (label.isPrive) {
        const n = `EP-Online: registration is private (${source}) → skipped`;
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      const out: Partial<EnrichmentOutput> = {};
      if (label.energyLabel)               out.locationEnergyLabel          = label.energyLabel;      // raw (display-gated downstream)
      if (label.energyLabelBand)           out.locationEnergyLabelBand      = label.energyLabelBand;  // safe aggregate
      if (label.energyIndex != null)       out.locationEnergyIndex          = label.energyIndex;
      if (label.energiebehoefte != null)   out.locationBuildingEnergyDemand = label.energiebehoefte;
      if (label.aandeelHernieuwbaar != null) out.locationRenewableShare     = label.aandeelHernieuwbaar;
      if (label.geldigTot)                 out.locationEnergyLabelValidUntil = label.geldigTot;

      if (Object.keys(out).length === 0) {
        const n = `EP-Online: no usable label fields (${source})`;
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      const n = `EP-Online ${source}: label=${label.energyLabel ?? "—"} band=${label.energyLabelBand ?? "—"}`;
      out.locationResolutionNote = n;
      ctx?.setNote(n);
      if (isDev) console.debug("[eponline-label] resolved", { source, band: label.energyLabelBand });
      return out;
    },
  };
}
