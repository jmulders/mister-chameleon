/**
 * First-party BAG address enricher stage (Kadaster BAG), LAZY.
 *
 * Adds per-address building facts — construction year, use, and floor area — for a
 * visitor who typed a real address (postcode + house number) in a form. BAG needs
 * a real address, which IP-geo cannot provide, so this stage fires ONLY on the
 * FORM-address path (like the form-postcode CBS path). No address → skip.
 *
 * Flow: form postcode + huisnummer → cache lookup (bag_address_cache) → MISS →
 * one BAG API call → map → upsert → use. Every step fails open (no enrichment on
 * error, never breaks the render). Requires BAG_API_KEY; without it the stage
 * no-ops. Runs sequentially (NL-only address path).
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";
import type { BagAddress, BagFetchResult } from "@/lib/enrichment/bag-ingest";

export interface BagLocationOptions {
  /** Injectable API key resolver (defaults to env BAG_API_KEY) — for tests. */
  resolveKey?: () => string | null;
  /** Injectable cache lookup (defaults to the DB store) — for tests. */
  cacheLookup?: (postcode: string, houseNumber: string) => Promise<BagAddress | null>;
  /** Injectable live BAG fetch (defaults to the Kadaster API) — for tests. */
  liveFetch?:  (postcode: string, houseNumber: string, apiKey: string) => Promise<BagFetchResult>;
  /** Injectable cache upsert (defaults to the DB store) — for tests. */
  upsert?:     (postcode: string, houseNumber: string, data: BagAddress) => Promise<void>;
  isDev?:      boolean;
}

export function createBagLocationEnricher(options: BagLocationOptions = {}): StagedEnricher {
  const isDev = options.isDev ?? false;

  async function resolveKey(): Promise<string | null> {
    if (options.resolveKey) return options.resolveKey();
    return (await import("@/lib/enrichment/bag-ingest")).resolveBagApiKey();
  }
  async function cacheLookup(pc: string, hn: string): Promise<BagAddress | null> {
    if (options.cacheLookup) return options.cacheLookup(pc, hn);
    return (await import("../bag-address-store")).getBagAddress(pc, hn);
  }
  async function liveFetch(pc: string, hn: string, key: string): Promise<BagFetchResult> {
    if (options.liveFetch) return options.liveFetch(pc, hn, key);
    return (await import("@/lib/enrichment/bag-ingest")).fetchBagAddress(pc, hn, key);
  }
  async function upsert(pc: string, hn: string, data: BagAddress): Promise<void> {
    if (options.upsert) return options.upsert(pc, hn, data);
    return (await import("../bag-address-store")).upsertBagAddress(pc, hn, data);
  }

  return {
    label:    "BAG Location",
    stageKey: "bag-location",

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
        ctx?.setNote("BAG skipped: no BAG_API_KEY configured");
        return { locationResolutionNote: "BAG skipped: no BAG_API_KEY configured" };
      }

      // Cache first, then a single live BAG call.
      let facts = await cacheLookup(pc, hn);
      let source: "cache" | "live" | "empty" = facts ? "cache" : "empty";
      if (!facts) {
        const r = await liveFetch(pc, hn, key);
        if (r.status === "error") {
          ctx?.markRetry("BAG transient failure");
          const n = "BAG transient failure → retry";
          ctx?.setNote(n);
          return { locationResolutionNote: n };
        }
        if (r.status === "found" && r.data) {
          facts = r.data;
          source = "live";
          await upsert(pc, hn, r.data);
        }
      }

      if (!facts || (facts.buildYear == null && facts.buildingUse == null && facts.areaM2 == null)) {
        const n = `BAG: no address facts (${source})`;
        ctx?.setNote(n);
        return { locationResolutionNote: n };
      }

      const out: Partial<EnrichmentOutput> = {};
      if (facts.buildYear != null)   out.locationBuildingYear   = facts.buildYear;
      if (facts.buildingUse)         out.locationBuildingUse    = facts.buildingUse;
      if (facts.areaM2 != null)      out.locationBuildingAreaM2 = facts.areaM2;

      const n = `BAG ${source}: year=${facts.buildYear ?? "—"} use=${facts.buildingUse ?? "—"} area=${facts.areaM2 ?? "—"}m²`;
      out.locationResolutionNote = n;
      ctx?.setNote(n);
      if (isDev) console.debug("[bag-location] resolved", { source, ...out });
      return out;
    },
  };
}
