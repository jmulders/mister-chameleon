/**
 * Pure ad-billing aggregation.
 *
 * Given a batch of ad events and the ads they reference, compute what to charge
 * (per tenant, per ad) and the per-(ad, publisher, day) rollup. Pure and fully
 * unit-tested so the CPM/CPC billing maths can't silently drift. The DB side
 * (reading events, debiting the wallet, upserting stats) lives in rollup.ts.
 *
 * Units: cost is in cents; 1 wallet credit == 1 cent.
 *   CPM ad → impression costs rate/1000, click costs 0.
 *   CPC ad → click costs rate, impression costs 0.
 */

import { eventCostCents } from "./pricing";
import type { Ad } from "./types";

export interface AdEventLite {
  ad_id:            string;
  ad_tenant_id:     string;
  publisher_domain: string | null;
  event_type:       "impression" | "click";
  occurred_at:      string;
}

export interface DailyRow {
  ad_id:            string;
  ad_tenant_id:     string;
  publisher_domain: string;
  date:             string;   // YYYY-MM-DD
  impressions:      number;
  clicks:           number;
  spend_cents:      number;
}

export interface BillingAggregate {
  /** Total to debit per advertiser tenant (cents). */
  perTenantCents: Map<string, number>;
  /** Spend per ad (for ads.spent_cents), with the owning tenant. */
  perAdCents:     Map<string, { tenantId: string; cents: number }>;
  /** Rollup rows to upsert into ad_stats_daily. */
  daily:          DailyRow[];
}

type PricedAd = Pick<Ad, "id" | "pricing_model" | "rate_cents">;

export function aggregateAdBilling(
  events:  readonly AdEventLite[],
  adsById: Map<string, PricedAd>,
): BillingAggregate {
  const perTenantCents = new Map<string, number>();
  const perAdCents     = new Map<string, { tenantId: string; cents: number }>();
  const dailyMap       = new Map<string, DailyRow>();

  for (const e of events) {
    const ad = adsById.get(e.ad_id);
    if (!ad) continue;

    const cost = eventCostCents(ad, e.event_type);
    const date = e.occurred_at.slice(0, 10);
    const pub  = e.publisher_domain ?? "";
    const dk   = `${e.ad_id}|${pub}|${date}`;

    const d = dailyMap.get(dk) ?? {
      ad_id: e.ad_id, ad_tenant_id: e.ad_tenant_id, publisher_domain: pub, date,
      impressions: 0, clicks: 0, spend_cents: 0,
    };
    if (e.event_type === "impression") d.impressions += 1; else d.clicks += 1;
    d.spend_cents += cost;
    dailyMap.set(dk, d);

    perTenantCents.set(e.ad_tenant_id, (perTenantCents.get(e.ad_tenant_id) ?? 0) + cost);
    const pa = perAdCents.get(e.ad_id) ?? { tenantId: e.ad_tenant_id, cents: 0 };
    pa.cents += cost;
    perAdCents.set(e.ad_id, pa);
  }

  return { perTenantCents, perAdCents, daily: Array.from(dailyMap.values()) };
}
