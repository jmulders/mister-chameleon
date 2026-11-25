/**
 * What a lookup costs, for the public price list.
 *
 * Read from `enrichment_pricing.credit_cost`, the table the platform charges
 * from (billing/enrichment-tracker.ts), so the page cannot say another price
 * than the one that is taken from the wallet. The owner confirmed these are
 * the intended prices on 25 Nov 2026.
 *
 * Returns null when the table cannot be read or a price is missing. The page
 * then shows no prices and no calculator: no number is better than a wrong one.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb }               from "@/data/db";
import { RECOGNITION_CREDIT_COST } from "@/lib/lead-base/bill-lead-credit";

export interface PublicLookupPrices {
  /** Network and place of a visit. */
  network:     number;
  /** The company behind a visit. */
  company:     number;
  /** The customer in the CRM. */
  crm:         number;
  /** Earlier visits from Google Analytics. */
  analytics:   number;
  /** The weather where the visit comes from. */
  weather:     number;
  /** A visitor the site recognises for the first time. */
  recognition: number;
}

const TYPES = {
  network:   "ip_enrich",
  company:   "company_lookup",
  crm:       "crm_lookup",
  analytics: "ga4_history",
  weather:   "weather_enrich",
} as const;

export async function getPublicLookupPrices(): Promise<PublicLookupPrices | null> {
  try {
    const client = getDb() as unknown as SupabaseClient;
    const { data, error } = await client
      .from("enrichment_pricing")
      .select("enrichment_type, credit_cost, active, billable")
      .in("enrichment_type", Object.values(TYPES));
    if (error || !data) return null;

    const cost = new Map<string, number>();
    for (const row of data as { enrichment_type: string; credit_cost: unknown; active: boolean | null; billable: boolean | null }[]) {
      const value = Number(row.credit_cost);
      if (row.active !== false && row.billable !== false && Number.isFinite(value) && value > 0) {
        cost.set(row.enrichment_type, value);
      }
    }

    const prices = {} as Record<keyof typeof TYPES, number>;
    for (const [name, type] of Object.entries(TYPES) as [keyof typeof TYPES, string][]) {
      const value = cost.get(type);
      if (value === undefined) return null;
      prices[name] = value;
    }
    return { ...prices, recognition: RECOGNITION_CREDIT_COST };
  } catch {
    return null;
  }
}
