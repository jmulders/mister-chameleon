/**
 * First-party LOCATION enricher stage (CBS StatLine buurt statistics).
 *
 * Adds neighbourhood firmographics — a density-derived urbanity band, income
 * band, business share — to the enrichment output by resolving the visitor's CBS
 * buurtcode and joining it against the cross-tenant cbs_area_stats reference
 * table (fed by the CBS ingestion job). Free first-party open data; billed via
 * the generic tracker as a small `location_lookup` event (stage label
 * "CBS Location").
 *
 * Buurtcode resolution: lat/lng → PDOK Locatieserver reverse (type=buurt).
 * Requires coordinates from a prior geo stage. NL-only: skipped when a non-NL
 * country is already resolved.
 *
 * Runs sequentially (after wave 2) so geo / reverse-geo have populated lat/lng
 * and country.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput } from "../types";
import type { CbsAreaStats } from "../cbs-location-store";

export interface CbsLocationOptions {
  /** Injectable CBS lookup (defaults to the DB store) — for tests. */
  lookup?:  (areaCode: string) => Promise<CbsAreaStats | null>;
  /** Injectable lat/lng→buurtcode geocoder (defaults to PDOK) — for tests. */
  geocode?: (lat: number, lng: number) => Promise<string | null>;
  isDev?:   boolean;
}

export function createCbsLocationEnricher(options: CbsLocationOptions = {}): StagedEnricher {
  const isDev = options.isDev ?? false;

  async function lookup(areaCode: string): Promise<CbsAreaStats | null> {
    if (options.lookup) return options.lookup(areaCode);
    return (await import("../cbs-location-store")).getCbsStatsForArea(areaCode);
  }
  async function geocode(lat: number, lng: number): Promise<string | null> {
    if (options.geocode) return options.geocode(lat, lng);
    return (await import("@/lib/enrichment/pdok-geocode")).buurtcodeFromLatLng(lat, lng);
  }

  return {
    label:    "CBS Location",
    stageKey: "cbs-location",

    // Needs coordinates to reverse-geocode to a buurt. Skipped for a resolved
    // non-NL country (CBS buurt data is NL-only).
    shouldRun: (_input: EnricherInput, accumulated: Partial<EnrichmentOutput>): boolean => {
      const country = accumulated.addressCountry ?? accumulated.countryCode;
      if (country && country.toUpperCase() !== "NL") return false;
      return accumulated.latitude != null && accumulated.longitude != null;
    },

    enricher: async (_input: EnricherInput, accumulated: Partial<EnrichmentOutput>) => {
      if (accumulated.latitude == null || accumulated.longitude == null) return {};

      const areaCode = await geocode(accumulated.latitude, accumulated.longitude);
      if (!areaCode) return {};

      const stats = await lookup(areaCode);
      if (!stats) {
        if (isDev) console.debug("[cbs-location] no CBS row for buurt", areaCode);
        return {};
      }

      const out: Partial<EnrichmentOutput> = { locationAreaCode: areaCode };
      if (stats.urbanityProxy != null) out.locationUrbanityClass = stats.urbanityProxy;
      if (stats.incomeBand)            out.locationIncomeBand    = stats.incomeBand;
      if (stats.businessShare != null) out.locationBusinessShare = stats.businessShare;

      if (isDev) console.debug("[cbs-location] resolved", { areaCode, ...out });
      return out;
    },
  };
}
