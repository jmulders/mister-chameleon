/**
 * billing/firstparty-company-billing.ts
 *
 * Dedicated billing for a first-party company-DB hit.
 *
 * A first-party hit is served from the shared, durable ip_company_cache instead
 * of a paid Leadinfo identify. It is billed here — NOT via the generic
 * enrichment tracker — because it is deliberately a cheaper, cache-served charge:
 * the tracker couples `cacheHit=true` to a zero cost, whereas a first-party hit
 * is recorded with `cache_hit=true` AND a (configurable, small) credit cost.
 *
 * The price comes from enrichment_pricing.credit_cost for feature key
 * `firstparty_company_lookup` (admin-editable at
 * /admin/platform/billing/pricing), falling back to a static default. Default is
 * lower than Leadinfo's cost, reflecting the saved paid call.
 *
 * Fire-and-forget: never throws, never blocks the request path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { trackUsageEvent, buildIdempotencyKey } from "./usage-events";
import { debitWallet } from "./wallet";
import { resolveCreditCost, getStaticCustomerPrice } from "./pricing";

const FEATURE_KEY = "firstparty_company_lookup" as const;

export interface FirstPartyBillingOptions {
  tenantId:   string;
  sessionId?: string;
  /** Company name for the usage-event metadata (optional). */
  company?:   string;
  /** True in test_simulated wallet mode — records the event but skips the debit. */
  simulated?: boolean;
}

/**
 * Debit the wallet and record a usage_event for a single first-party company-DB
 * hit. Safe to call fire-and-forget; all errors are swallowed.
 */
export async function billFirstPartyCompanyHit(
  client:  SupabaseClient,
  options: FirstPartyBillingOptions,
): Promise<void> {
  const { tenantId, sessionId, company, simulated = false } = options;

  try {
    const creditCost = await resolveCreditCost(
      client, FEATURE_KEY, getStaticCustomerPrice(FEATURE_KEY),
    );

    // Debit only for a real (non-simulated) positive charge.
    if (creditCost > 0 && !simulated) {
      try {
        await debitWallet(
          client, tenantId, creditCost,
          "enrichment_usage", undefined, "first-party company DB hit", "recognition",
        );
      } catch (err) {
        console.warn("[billing/firstparty] debit failed", { tenantId, error: String(err) });
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
      // Deliberately cache_hit=true: served from the first-party pool, saving a
      // paid Leadinfo call. Unlike an in-process cache hit, it still carries a cost.
      cacheHit:    true,
      ...(sessionId ? { sessionId } : {}),
      idempotencyKey: buildIdempotencyKey(FEATURE_KEY, tenantId, sessionId ?? "no-session"),
      simulated,
      metadata: { source: "firstparty", ...(company ? { company } : {}) },
    });
  } catch (err) {
    console.warn("[billing/firstparty] billFirstPartyCompanyHit failed", { tenantId, error: String(err) });
  }
}
