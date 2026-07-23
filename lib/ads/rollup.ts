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

import { getDb }         from "@/data/db";
import { debitWallet }   from "@/billing/wallet";
import { eventCostCents } from "./pricing";
import { logger }        from "@/lib/logger";
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

  // 3. Aggregate spend per ad and per (ad, publisher, date).
  const perAd    = new Map<string, { tenantId: string; cents: number }>();
  const perTenant = new Map<string, number>();
  const daily = new Map<string, {
    ad_id: string; ad_tenant_id: string; publisher_domain: string; date: string;
    impressions: number; clicks: number; spend_cents: number;
  }>();

  for (const r of rows) {
    const ad = adById.get(r.ad_id);
    if (!ad) continue;
    const cost = eventCostCents(ad, r.event_type);
    const date = r.occurred_at.slice(0, 10);
    const pub  = r.publisher_domain ?? "";
    const dk   = `${r.ad_id}|${pub}|${date}`;
    const d = daily.get(dk) ?? {
      ad_id: r.ad_id, ad_tenant_id: r.ad_tenant_id, publisher_domain: pub, date,
      impressions: 0, clicks: 0, spend_cents: 0,
    };
    if (r.event_type === "impression") d.impressions += 1; else d.clicks += 1;
    d.spend_cents += cost;
    daily.set(dk, d);

    const p = perAd.get(r.ad_id) ?? { tenantId: r.ad_tenant_id, cents: 0 };
    p.cents += cost;
    perAd.set(r.ad_id, p);
    perTenant.set(r.ad_tenant_id, (perTenant.get(r.ad_tenant_id) ?? 0) + cost);
  }

  // 4. Increment each ad's spent_cents (best-effort).
  for (const [adId, s] of perAd) {
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
  for (const [tenantId, cents] of perTenant) {
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
