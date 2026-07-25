"use server";

/**
 * Platform — Publishers (revenue-share side of the ad network).
 *
 * Aggregates ad revenue per publisher domain (settled ad_stats_daily + pending
 * unbilled ad_events), applies the effective revshare % (per-publisher override
 * → platform default), and lets a super-admin set the per-publisher override.
 * Read-only accounting — no money is moved here (payouts are a later phase).
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, isSuperAdmin } from "@/lib/admin-auth/authorization";
import { getDb } from "@/data/db";
import { getPlatformAdPricingSettings, AD_PRICING_DEFAULTS } from "@/platform/platform-store";
import { aggregateAdBilling } from "@/lib/ads/aggregate-billing";
import type { Ad } from "@/lib/ads/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

export interface PublisherRow {
  domain:        string;
  impressions:   number;
  clicks:        number;
  /** Ad revenue generated on this publisher (settled + pending), cents. */
  revenueCents:  number;
  /** Effective revshare % applied (override → platform default). */
  revsharePct:   number;
  /** Per-publisher override (null = inherit the platform default). */
  overridePct:   number | null;
  /** Publisher's earnings = revenueCents × revsharePct / 100. */
  earningsCents: number;
}

export interface PublishersOverview {
  defaultRevsharePct: number;
  windowDays:         number;
  publishers:         PublisherRow[];
  isSuperAdmin:       boolean;
}

export async function fetchPublishersOverviewAction(): Promise<PublishersOverview> {
  const session = await getRequiredAdminSession();
  const admin   = isSuperAdmin(session);
  const windowDays = 30;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

  const agg = new Map<string, { impr: number; clicks: number; rev: number }>();
  const add = (domain: string | null, impr: number, clicks: number, rev: number) => {
    const d = (domain && domain.trim()) ? domain.trim().toLowerCase() : "(unknown)";
    const cur = agg.get(d) ?? { impr: 0, clicks: 0, rev: 0 };
    cur.impr += impr; cur.clicks += clicks; cur.rev += rev;
    agg.set(d, cur);
  };

  // Settled revenue per publisher (from the daily rollup).
  try {
    const { data } = await db()
      .from("ad_stats_daily")
      .select("publisher_domain, impressions, clicks, spend_cents")
      .gte("date", since);
    for (const r of (data ?? []) as { publisher_domain: string | null; impressions: number; clicks: number; spend_cents: number }[]) {
      add(r.publisher_domain, Number(r.impressions), Number(r.clicks), Number(r.spend_cents));
    }
  } catch { /* best-effort */ }

  // Pending revenue per publisher (unbilled ad_events), metered like the rollup.
  try {
    const { data: pendingEvents } = await db()
      .from("ad_events")
      .select("ad_id, ad_tenant_id, publisher_domain, event_type, occurred_at")
      .eq("billed", false)
      .limit(50_000);
    const { data: ads } = await db().from("ads").select("*");
    const adsById = new Map<string, Ad>(((ads ?? []) as Ad[]).map((a): [string, Ad] => [a.id, a]));
    const bill = aggregateAdBilling(pendingEvents ?? [], adsById);
    for (const d of bill.daily) add(d.publisher_domain, d.impressions, d.clicks, d.spend_cents);
  } catch { /* best-effort */ }

  // Effective revshare = per-publisher override → platform default.
  const pr = await getPlatformAdPricingSettings();
  const defaultPct = (pr.ok ? pr.data.revsharePct : undefined) ?? AD_PRICING_DEFAULTS.revsharePct;
  const overrides = new Map<string, number | null>();
  try {
    const { data } = await db().from("ad_publisher_accounts").select("publisher_domain, revshare_pct");
    for (const r of (data ?? []) as { publisher_domain: string; revshare_pct: number | null }[]) {
      overrides.set(r.publisher_domain, r.revshare_pct);
    }
  } catch { /* best-effort */ }

  const publishers: PublisherRow[] = Array.from(agg.entries()).map(([domain, v]) => {
    const ov  = overrides.has(domain) ? overrides.get(domain)! : null;
    const pct = ov ?? defaultPct;
    return {
      domain,
      impressions:   v.impr,
      clicks:        v.clicks,
      revenueCents:  Math.round(v.rev),
      overridePct:   ov,
      revsharePct:   pct,
      earningsCents: Math.round((v.rev * pct) / 100),
    };
  }).sort((a, b) => b.revenueCents - a.revenueCents);

  return { defaultRevsharePct: defaultPct, windowDays, publishers, isSuperAdmin: admin };
}

export async function setPublisherRevshareAction(
  domain: string, pct: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) return { ok: false, error: "Only platform admins can set revshare." };
  const d = domain.trim().toLowerCase();
  if (!d) return { ok: false, error: "Missing publisher domain." };
  const clean = pct === null ? null : Math.min(100, Math.max(0, Number(pct)));
  if (clean !== null && !Number.isFinite(clean)) return { ok: false, error: "Revshare must be between 0 and 100 percent." };

  const { error } = await db().from("ad_publisher_accounts").upsert(
    { publisher_domain: d, revshare_pct: clean, updated_at: new Date().toISOString() },
    { onConflict: "publisher_domain" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/platform/publishers");
  return { ok: true };
}
