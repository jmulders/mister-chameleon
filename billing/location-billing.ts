/**
 * billing/location-billing.ts
 *
 * Dedicated billing for a first-party location lookup (CBS buurt statistics).
 *
 * Mirrors the first-party company-DB billing: a location resolution is served
 * from our own cbs_area_stats store (filled lazily / by backfill), so it is
 * billed here — NOT via the generic enrichment tracker — as a cache-served
 * first-party event with `cache_hit=true` AND a small configurable credit.
 *
 * The price comes from enrichment_pricing.credit_cost for feature key
 * `location_lookup` (admin-editable at /admin/platform/billing/pricing), falling
 * back to the static default (0.5 credit — lower than the company-DB).
 *
 * Fire-and-forget: never throws, never blocks the request path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { trackUsageEvent, buildIdempotencyKey } from "./usage-events";
import { debitWallet } from "./wallet";
import { resolveCreditCost, getStaticCustomerPrice } from "./pricing";

const FEATURE_KEY = "location_lookup" as const;

export interface LocationBillingOptions {
  tenantId:   string;
  sessionId?: string;
  /** CBS buurtcode for the usage-event metadata (optional). */
  areaCode?:  string;
  /** Which first-party location source served this lookup. Default "cbs". */
  source?:    "cbs" | "netbeheer" | "eponline";
  /** PC6 for the usage-event metadata (netbeheer source; optional). */
  pc6?:       string;
  /** True in test_simulated wallet mode — records the event but skips the debit. */
  simulated?: boolean;
}

/**
 * Debit the wallet and record a usage_event for a single first-party location
 * lookup. Safe to call fire-and-forget; all errors are swallowed.
 */
export async function billLocationLookup(
  client:  SupabaseClient,
  options: LocationBillingOptions,
): Promise<void> {
  const { tenantId, sessionId, areaCode, pc6, source = "cbs", simulated = false } = options;

  try {
    const creditCost = await resolveCreditCost(
      client, FEATURE_KEY, getStaticCustomerPrice(FEATURE_KEY),
    );

    if (creditCost > 0 && !simulated) {
      try {
        await debitWallet(
          client, tenantId, creditCost,
          "enrichment_usage", undefined, "first-party location lookup", "recognition",
        );
      } catch (err) {
        console.warn("[billing/location] debit failed", { tenantId, error: String(err) });
      }
    }

    await trackUsageEvent(client, {
      tenantId,
      eventType:   FEATURE_KEY,
      creditsCost: creditCost,
      creditsUsed: creditCost,
      category:    "recognition",
      featureKey:  FEATURE_KEY,
      billable:    true,
      success:     true,
      // Served from our own cbs_area_stats store — a first-party cache lookup.
      cacheHit:    true,
      ...(sessionId ? { sessionId } : {}),
      idempotencyKey: buildIdempotencyKey(FEATURE_KEY, tenantId, sessionId ?? "no-session"),
      simulated,
      metadata: { source, ...(areaCode ? { areaCode } : {}), ...(pc6 ? { pc6 } : {}) },
    });
  } catch (err) {
    console.warn("[billing/location] billLocationLookup failed", { tenantId, error: String(err) });
  }
}
