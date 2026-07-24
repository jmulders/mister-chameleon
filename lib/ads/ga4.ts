/**
 * GA4 for ads — write the ad-audience session to the advertiser's own GA4 and
 * read the visitor's GA4 history back, keyed by our first-party visitor_id.
 *
 * This sidesteps the multi-publisher problem: one GA4 (the advertiser's) collects
 * events from every publisher, each keyed by the per-publisher visitor_id. On a
 * return visit to the same publisher the id matches and the history is available.
 *
 * Both sides are OFF unless the tenant configures GA4 (Integrations → GA4):
 *   - write:  ga4.tracking.enabled + sendMode "server" + measurementId + apiSecret
 *   - read:   ga4.history.enabled  + propertyId + serviceAccountJson
 * GA4 is free (Measurement Protocol + Data API), so no per-visitor charge.
 * Never throws — ad serving must not break.
 */

import { createGa4HistoryEnricher } from "@/enrichment/providers/ga4-history";
import type { EnrichmentOutput, EnricherInput } from "@/enrichment/types";
import type { TenantGa4Settings } from "@/tenant/types";
import { logger } from "@/lib/logger";

/**
 * Read the visitor's historical GA4 signals from the tenant's GA4 (Data API),
 * reusing the platform's GA4 history enricher. Returns {} unless configured.
 * The enricher caches per (propertyId, visitorId) internally.
 */
export async function resolveAdGa4History(
  ga4: TenantGa4Settings | undefined,
  visitorId: string | null,
): Promise<Partial<EnrichmentOutput>> {
  const h = ga4?.history;
  if (!visitorId || !h?.enabled || !h.propertyId || !h.serviceAccountJson) return {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serviceAccount = JSON.parse(h.serviceAccountJson) as any;
    const enricher = createGa4HistoryEnricher({
      propertyId:          h.propertyId,
      serviceAccount,
      visitorIdDimension:  h.visitorIdDimension,
      lookbackDays:        h.lookbackDays,
      cacheTtlMs:          h.cacheTtlMinutes ? h.cacheTtlMinutes * 60_000 : undefined,
      isDev:               process.env["NODE_ENV"] !== "production",
    });
    // The GA4 history enricher only reads input.visitorId; the rest is filler.
    const input = {
      visitorId, ip: null, effectiveIp: null, tenantId: null, sessionId: visitorId, email: null,
      utm: { campaign: null, source: null, medium: null, term: null, content: null },
    } as unknown as EnricherInput;
    return await enricher.enricher(input, {});
  } catch (err) {
    logger.warn("[ads] resolveAdGa4History failed", { error: String(err) });
    return {};
  }
}

/**
 * Record the ad-audience session into the tenant's GA4 via the Measurement
 * Protocol (server-side), keyed by the first-party visitor_id so it can be read
 * back later. Fire-and-forget; off unless server tracking is configured.
 */
export async function writeAdGa4Event(
  ga4: TenantGa4Settings | undefined,
  visitorId: string | null,
  params: { page?: string | null; publisher?: string | null },
): Promise<void> {
  const t = ga4?.tracking;
  if (!visitorId || !t?.enabled || t.sendMode !== "server" || !t.measurementId || !t.apiSecret) return;
  const dim = t.visitorIdParamName || "visitor_id";
  try {
    const url = "https://www.google-analytics.com/mp/collect"
      + `?measurement_id=${encodeURIComponent(t.measurementId)}`
      + `&api_secret=${encodeURIComponent(t.apiSecret)}`;
    await fetch(url, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id:       visitorId,
        user_properties: { [dim]: { value: visitorId } },
        events: [{
          name: "ad_pageview",
          params: {
            [dim]:         visitorId,
            page_location: params.page ?? undefined,
            publisher:     params.publisher ?? undefined,
          },
        }],
      }),
      signal: AbortSignal.timeout(2_000),
      cache:  "no-store",
    });
  } catch (err) {
    logger.debug("[ads] writeAdGa4Event failed", { error: String(err) });
  }
}
