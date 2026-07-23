/**
 * Ad billing rollup (async).
 *
 * Meters unbilled ad_events → debits the advertiser's wallet, increments the
 * ad's spent_cents, and rolls up ad_stats_daily. Runs from a cron (single
 * writer, so the read-modify-write increments are safe). Idempotent per event
 * via the `billed` flag.
 *
 * Units: cost is in cents; the wallet's credit == 1 cent, so cents map 1:1 to
 * debitWallet credits (sub-cent precision supported).
 */

import { getDb }             from "@/data/db";
import { debitWallet }       from "@/billing/wallet";
import { aggregateAdBilling } from "./aggregate-billing";
import { logger }            from "@/lib/logger";
import type { Ad } from "./types";

interface EventRow {
  id: string;
  ad_tenant_id: string;
  ad_id: string;
  publisher_domain: string | null;
  event_type: "impression" | "click";
  occurred_at: string;
}

export async function rollupAdBilling(limit = 5000): Promise<{ processed: number; debitedCents: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getDb() as any;

  // 1. A batch of unbilled events, oldest first.
  const { data: events } = await db
    .from("ad_events")
    .select("id, ad_tenant_id, ad_id, publisher_domain, event_type, occurred_at")
    .eq("billed", false)
    .order("occurred_at", { ascending: true })
    .limit(limit);
  const rows = (events ?? []) as EventRow[];
  if (rows.length === 0) return { processed: 0, debitedCents: 0 };

  // 2. Load referenced ads for pricing.
  const adIds = Array.from(new Set(rows.map((r) => r.ad_id)));
  const { data: adRows } = await db.from("ads").select("*").in("id", adIds);
  const adById = new Map<string, Ad>(((adRows ?? []) as Ad[]).map((a) => [a.id, a]));

  // 3. Aggregate spend per tenant/ad and the per-(ad, publisher, day) rollup
  //    (pure, unit-tested — see aggregate-billing.ts).
  const { perTenantCents, perAdCents, daily } = aggregateAdBilling(rows, adById);

  // 4. Increment each ad's spent_cents (best-effort).
  for (const [adId, s] of perAdCents) {
    const ad = adById.get(adId);
    if (!ad) continue;
    await db.from("ads")
      .update({ spent_cents: Number(ad.spent_cents ?? 0) + s.cents, updated_at: new Date().toISOString() })
      .eq("id", adId);
  }

  // 5. Debit each advertiser's wallet once (aggregate). Best-effort: served
  //    impressions are sunk, so mark billed even if the balance can't cover them
  //    (the serve-time wallet gate limits overspend to the settlement lag).
  let debitedCents = 0;
  for (const [tenantId, cents] of perTenantCents) {
    if (cents <= 0) continue;
    try {
      const res = await debitWallet(getDb(), tenantId, cents, "ad_spend");
      if (res.success) debitedCents += cents;
      else logger.warn("[ads] rollup wallet debit not applied", { tenantId, cents, error: res.error });
    } catch (err) {
      logger.warn("[ads] rollup wallet debit threw", { tenantId, error: String(err) });
    }
  }

  // 6. Upsert daily rollup (increment on top of any existing row).
  for (const d of daily.values()) {
    const { data: existing } = await db.from("ad_stats_daily")
      .select("impressions, clicks, spend_cents")
      .eq("ad_id", d.ad_id).eq("publisher_domain", d.publisher_domain).eq("date", d.date)
      .maybeSingle();
    const base = (existing ?? { impressions: 0, clicks: 0, spend_cents: 0 }) as
      { impressions: number; clicks: number; spend_cents: number };
    await db.from("ad_stats_daily").upsert({
      ad_id: d.ad_id, ad_tenant_id: d.ad_tenant_id, publisher_domain: d.publisher_domain, date: d.date,
      impressions: Number(base.impressions) + d.impressions,
      clicks:      Number(base.clicks) + d.clicks,
      spend_cents: Number(base.spend_cents) + d.spend_cents,
    }, { onConflict: "ad_id,publisher_domain,date" });
  }

  // 7. Mark the batch billed.
  await db.from("ad_events").update({ billed: true }).in("id", rows.map((r) => r.id));

  logger.info("[ads] rollup done", { processed: rows.length, debitedCents });
  return { processed: rows.length, debitedCents };
}
