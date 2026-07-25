"use server";

/**
 * Platform — Publishers (revenue-share side of the ad network).
 *
 * Aggregates settled ad revenue per publisher domain, applies the effective
 * revshare % (per-publisher override → platform default), and tracks a manual
 * payout ledger: earned − paid = outstanding. Recording a payout does NOT move
 * money — it logs that an offline/manual payment happened (the seam where
 * automated payouts would plug in later). Super-admin only for all writes.
 */

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession, isSuperAdmin } from "@/lib/admin-auth/authorization";
import { getDb } from "@/data/db";
import { getPlatformAdPricingSettings, AD_PRICING_DEFAULTS } from "@/platform/platform-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

export interface PublisherPayout { amountCents: number; note: string | null; paidAt: string }

export interface PublisherRow {
  domain:              string;
  name:                string | null;
  impressions30d:      number;
  clicks30d:           number;
  /** Settled ad revenue on this publisher, last 30 days (activity), cents. */
  revenue30dCents:     number;
  revsharePct:         number;       // effective (override → default)
  overridePct:         number | null;
  /** Lifetime settled revenue × revshare — what the publisher has earned, cents. */
  lifetimeEarnedCents: number;
  /** Sum of recorded payouts, cents. */
  paidCents:           number;
  /** earned − paid, cents. */
  outstandingCents:    number;
  contactEmail:        string | null;
  vatNumber:           string | null;
  cocNumber:           string | null;
  payoutNotes:         string | null;
  payouts:             PublisherPayout[];
}

export interface PublishersOverview {
  defaultRevsharePct: number;
  windowDays:         number;
  publishers:         PublisherRow[];
  isSuperAdmin:       boolean;
}

const norm = (d: string | null | undefined) => (d && d.trim() ? d.trim().toLowerCase() : "(unknown)");

export async function fetchPublishersOverviewAction(): Promise<PublishersOverview> {
  const session = await getRequiredAdminSession();
  const admin   = isSuperAdmin(session);
  const windowDays = 30;
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);

  // Settled revenue per publisher: lifetime (payout basis) + last 30 days (activity).
  const agg = new Map<string, { impr30: number; clk30: number; rev30: number; revLife: number }>();
  try {
    const { data } = await db()
      .from("ad_stats_daily")
      .select("publisher_domain, date, impressions, clicks, spend_cents");
    for (const r of (data ?? []) as { publisher_domain: string | null; date: string; impressions: number; clicks: number; spend_cents: number }[]) {
      const d = norm(r.publisher_domain);
      const cur = agg.get(d) ?? { impr30: 0, clk30: 0, rev30: 0, revLife: 0 };
      cur.revLife += Number(r.spend_cents);
      if (r.date >= since) { cur.impr30 += Number(r.impressions); cur.clk30 += Number(r.clicks); cur.rev30 += Number(r.spend_cents); }
      agg.set(d, cur);
    }
  } catch { /* best-effort */ }

  // Accounts (name, override, contact).
  interface AccountRow { publisher_domain: string; name: string | null; revshare_pct: number | null; contact_email: string | null; vat_number: string | null; coc_number: string | null; payout_notes: string | null }
  const accounts = new Map<string, AccountRow>();
  try {
    const { data } = await db().from("ad_publisher_accounts").select("publisher_domain, name, revshare_pct, contact_email, vat_number, coc_number, payout_notes");
    for (const r of (data ?? []) as AccountRow[]) accounts.set(r.publisher_domain, r);
  } catch { /* best-effort */ }

  // Recorded payouts.
  const paidBy = new Map<string, { total: number; list: PublisherPayout[] }>();
  try {
    const { data } = await db().from("ad_publisher_payouts").select("publisher_domain, amount_cents, note, paid_at").order("paid_at", { ascending: false });
    for (const r of (data ?? []) as { publisher_domain: string; amount_cents: number; note: string | null; paid_at: string }[]) {
      const cur = paidBy.get(r.publisher_domain) ?? { total: 0, list: [] };
      cur.total += Number(r.amount_cents);
      cur.list.push({ amountCents: Number(r.amount_cents), note: r.note, paidAt: r.paid_at });
      paidBy.set(r.publisher_domain, cur);
    }
  } catch { /* best-effort */ }

  const pr = await getPlatformAdPricingSettings();
  const defaultPct = (pr.ok ? pr.data.revsharePct : undefined) ?? AD_PRICING_DEFAULTS.revsharePct;

  const domains = new Set<string>([...agg.keys(), ...accounts.keys(), ...paidBy.keys()]);
  const publishers: PublisherRow[] = Array.from(domains).map((domain) => {
    const a  = agg.get(domain);
    const ac = accounts.get(domain);
    const po = paidBy.get(domain);
    const ov  = ac?.revshare_pct ?? null;
    const pct = ov ?? defaultPct;
    const lifetimeEarned = Math.round(((a?.revLife ?? 0) * pct) / 100);
    const paid = Math.round(po?.total ?? 0);
    return {
      domain,
      name:                ac?.name ?? null,
      impressions30d:      a?.impr30 ?? 0,
      clicks30d:           a?.clk30 ?? 0,
      revenue30dCents:     Math.round(a?.rev30 ?? 0),
      revsharePct:         pct,
      overridePct:         ov,
      lifetimeEarnedCents: lifetimeEarned,
      paidCents:           paid,
      outstandingCents:    lifetimeEarned - paid,
      contactEmail:        ac?.contact_email ?? null,
      vatNumber:           ac?.vat_number ?? null,
      cocNumber:           ac?.coc_number ?? null,
      payoutNotes:         ac?.payout_notes ?? null,
      payouts:             po?.list ?? [],
    };
  }).sort((x, y) => (y.outstandingCents - x.outstandingCents) || (y.revenue30dCents - x.revenue30dCents));

  return { defaultRevsharePct: defaultPct, windowDays, publishers, isSuperAdmin: admin };
}

async function requireSuper(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) return { ok: false, error: "Only platform admins can manage publishers." };
  return { ok: true };
}

export async function setPublisherRevshareAction(
  domain: string, pct: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireSuper(); if (!gate.ok) return gate;
  const d = norm(domain);
  if (d === "(unknown)") return { ok: false, error: "Missing publisher domain." };
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

export async function setPublisherAccountAction(
  domain: string,
  input: { name?: string | null; contactEmail?: string | null; vatNumber?: string | null; cocNumber?: string | null; payoutNotes?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireSuper(); if (!gate.ok) return gate;
  const d = norm(domain);
  if (d === "(unknown)") return { ok: false, error: "Missing publisher domain." };
  const t = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const { error } = await db().from("ad_publisher_accounts").upsert(
    {
      publisher_domain: d,
      name:          t(input.name),
      contact_email: t(input.contactEmail),
      vat_number:    t(input.vatNumber),
      coc_number:    t(input.cocNumber),
      payout_notes:  t(input.payoutNotes),
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "publisher_domain" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/platform/publishers");
  return { ok: true };
}

/**
 * Record a (manual/offline) payout to a publisher. This logs money already paid
 * outside the system — it does NOT initiate any transfer.
 */
export async function recordPublisherPayoutAction(
  domain: string, amountCents: number, note?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireSuper(); if (!gate.ok) return gate;
  const d = norm(domain);
  if (d === "(unknown)") return { ok: false, error: "Missing publisher domain." };
  const cents = Math.round(Number(amountCents));
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, error: "Payout amount must be a positive number of cents." };
  const { error } = await db().from("ad_publisher_payouts").insert({
    publisher_domain: d,
    amount_cents:     cents,
    note:             note && note.trim() ? note.trim() : null,
    status:           "paid",
    paid_at:          new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/platform/publishers");
  return { ok: true };
}
