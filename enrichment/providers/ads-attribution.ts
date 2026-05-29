/**
 * Ads Attribution Enrichment Provider
 *
 * Resolves: adCampaign, adAdGroup, adKeyword
 *
 * ─── Provider contract ────────────────────────────────────────────────────────
 *
 *   AdsAttributionProvider is the vendor-agnostic interface.
 *   The primary source for most implementations is UTM parameter parsing —
 *   utm_campaign → adCampaign, utm_term → adKeyword.
 *
 *   For richer attribution (ad group, keyword from match type, etc.), swap to:
 *   - Google Ads Click Identifier (gclid) lookup via Google Ads API
 *   - Microsoft Ads Click ID (msclkid) lookup
 *   - Meta / LinkedIn click ID resolution
 *   - Any server-side click-tracking platform (Triple Whale, Northbeam, etc.)
 *
 * ─── UTM-based default ────────────────────────────────────────────────────────
 *
 *   `UtmAdsAttributionProvider` is the practical default for most tenants:
 *   it reads utm_campaign / utm_content / utm_term from the `EnricherInput.utm`
 *   object — no network call required, zero latency.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // Default: derive attribution from UTM params (no API call)
 *   const enrichers = [
 *     createAdsAttributionEnricher(new UtmAdsAttributionProvider()),
 *   ];
 *
 *   // Advanced: lookup richer data via Google Ads API
 *   const googleAdsProvider: AdsAttributionProvider = {
 *     resolve: async ({ utm, ip }) => {
 *       const row = await googleAdsClient.getClickDetails(gclid);
 *       return { adCampaign: row.campaign, adAdGroup: row.adGroup, adKeyword: row.keyword };
 *     },
 *   };
 */

import type { EnrichmentOutput, EnricherInput, LabeledEnricher } from "../types";

// ── AdsAttributionOutput ──────────────────────────────────────────────────────

/** Fields this provider can resolve. */
export interface AdsAttributionOutput {
  /** Campaign name or ID, e.g. "spring-2025-brand". */
  adCampaign: string | null;
  /** Ad group / ad set name, e.g. "brand-exact-match". */
  adAdGroup:  string | null;
  /** Matched search keyword, e.g. "crm software". */
  adKeyword:  string | null;
}

// ── AdsAttributionProvider ────────────────────────────────────────────────────

/**
 * Vendor-agnostic ads attribution provider interface.
 *
 * Receives the full `EnricherInput` (which includes `utm` params and `ip`)
 * so implementations can choose their preferred signal source.
 */
export interface AdsAttributionProvider {
  /**
   * Resolve ad attribution for this request.
   *
   * @param input - Enricher input including UTM params and IP.
   * @returns     - Partial attribution output. Missing fields default to null.
   */
  resolve(input: EnricherInput): Promise<Partial<AdsAttributionOutput>>;
}

// ── UtmAdsAttributionProvider ─────────────────────────────────────────────────

/**
 * Zero-latency attribution provider that reads directly from UTM parameters.
 *
 * Mapping:
 *   utm_campaign → adCampaign
 *   utm_content  → adAdGroup  (common convention for ad group labeling)
 *   utm_term     → adKeyword
 *
 * No network call. Safe for production and development alike.
 * Use as the default; replace with a platform API provider for richer data.
 */
export class UtmAdsAttributionProvider implements AdsAttributionProvider {
  async resolve(input: EnricherInput): Promise<Partial<AdsAttributionOutput>> {
    const { utm } = input;

    // Only emit fields that have actual values — avoids overwriting richer
    // data from another provider with nulls.
    const result: Partial<AdsAttributionOutput> = {};

    if (utm.campaign) result.adCampaign = utm.campaign;
    if (utm.content)  result.adAdGroup  = utm.content;
    if (utm.term)     result.adKeyword   = utm.term;

    return result;
  }
}

/**
 * No-op provider for tests where ads attribution should be absent.
 */
export class StubAdsAttributionProvider implements AdsAttributionProvider {
  async resolve(_input: EnricherInput): Promise<Partial<AdsAttributionOutput>> {
    return {};
  }
}

// ── createAdsAttributionEnricher ──────────────────────────────────────────────

/**
 * Adapts an `AdsAttributionProvider` into a generic `LabeledEnricher`.
 *
 * @param provider - Any AdsAttributionProvider implementation.
 * @returns        - A LabeledEnricher ready to pass to runEnrichmentPipeline().
 *
 * @example
 * import {
 *   createAdsAttributionEnricher,
 *   UtmAdsAttributionProvider,
 * } from "@/enrichment/providers/ads-attribution";
 *
 * const enrichers = [
 *   createAdsAttributionEnricher(new UtmAdsAttributionProvider()),
 * ];
 */
export function createAdsAttributionEnricher(
  provider: AdsAttributionProvider,
): LabeledEnricher {
  return {
    label: "ads-attribution",
    enricher: async (input: EnricherInput): Promise<Partial<EnrichmentOutput>> => {
      const result = await provider.resolve(input);
      return {
        adCampaign: result.adCampaign ?? null,
        adAdGroup:  result.adAdGroup  ?? null,
        adKeyword:  result.adKeyword  ?? null,
      };
    },
  };
}
