"use server";

/**
 * Ads admin — server actions.
 *
 * Manage an advertiser tenant: toggle the advertiser role, approve publisher
 * domains, and CRUD ads. All actions are admin-authenticated and tenant-scoped.
 * Writes use the service-role client (getDb). Creating/updating an ad validates
 * that its creative actually renders (renderBlockHtml) so a broken creative can
 * never be saved and silently serve an empty block.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { getTenantById, saveTenant } from "@/tenant/server";
import { getDb } from "@/data/db";
import { getWallet, creditWallet } from "@/billing/wallet";
import { getPlatformStripeSettings } from "@/platform/platform-store";
import { STRIPE_API_VERSION } from "@/billing/stripe-config";
import { renderBlockHtml } from "@/lib/snippet/render-block-html";
import { logger } from "@/lib/logger";
import type { Ad, AdPublisher, AdSlotType, AdPricingModel } from "@/lib/ads/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

export interface DayReport { date: string; impressions: number; clicks: number; spend_cents: number }

export interface AdsOverview {
  isAdvertiser:  boolean;
  siteKey:       string | null;
  walletBalance: number | null; // cents / credits
  publishers:    AdPublisher[];
  ads:           Ad[];
  stats:         Array<{ ad_id: string; impressions: number; clicks: number; spend_cents: number }>;
  /** Per-day totals across all ads (last 30 days), oldest → newest. */
  report:        DayReport[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

const SLOTS: AdSlotType[] = ["hero", "proof", "cta", "feature", "conversion", "notification"];

export async function fetchAdsOverviewAction(tenantId: string): Promise<AdsOverview> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  const isAdvertiser = tenant?.tenantRole === "advertiser";
  const siteKey = tenant?.snippet?.siteKey ?? null;

  let walletBalance: number | null = null;
  try {
    const w = await getWallet(getDb(), tenantId);
    walletBalance = w ? ((w.balance ?? w.balance_cents ?? 0) as number) : null;
  } catch { /* wallet optional */ }

  const [{ data: publishers }, { data: ads }] = await Promise.all([
    db().from("ad_publishers").select("*").eq("ad_tenant_id", tenantId).order("created_at", { ascending: false }),
    db().from("ads").select("*").eq("ad_tenant_id", tenantId).order("created_at", { ascending: false }),
  ]);

  // Aggregate stats per ad AND per day from the daily rollup (last 30 days).
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data: statRows } = await db()
    .from("ad_stats_daily")
    .select("ad_id, date, impressions, clicks, spend_cents")
    .eq("ad_tenant_id", tenantId)
    .gte("date", since);
  type Row = { ad_id: string; date: string; impressions: number; clicks: number; spend_cents: number };
  const byAd  = new Map<string, { ad_id: string; impressions: number; clicks: number; spend_cents: number }>();
  const byDay = new Map<string, DayReport>();
  for (const r of (statRows ?? []) as Row[]) {
    const a = byAd.get(r.ad_id) ?? { ad_id: r.ad_id, impressions: 0, clicks: 0, spend_cents: 0 };
    a.impressions += Number(r.impressions); a.clicks += Number(r.clicks); a.spend_cents += Number(r.spend_cents);
    byAd.set(r.ad_id, a);
    const d = byDay.get(r.date) ?? { date: r.date, impressions: 0, clicks: 0, spend_cents: 0 };
    d.impressions += Number(r.impressions); d.clicks += Number(r.clicks); d.spend_cents += Number(r.spend_cents);
    byDay.set(r.date, d);
  }

  return {
    isAdvertiser,
    siteKey,
    walletBalance,
    publishers: (publishers ?? []) as AdPublisher[],
    ads:        (ads ?? []) as Ad[],
    stats:      Array.from(byAd.values()),
    report:     Array.from(byDay.values()).sort((x, y) => x.date.localeCompare(y.date)),
  };
}

export async function setAdvertiserRoleAction(tenantId: string, on: boolean): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  await saveTenant({
    ...tenant,
    tenantRole:  on ? "advertiser" : undefined,
    billingMode: on ? "usage_ads"  : undefined,
  });
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

export async function addPublisherAction(tenantId: string, domain: string, approved: boolean): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  if (!host || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return { ok: false, error: "Enter a valid domain (e.g. publisher.nl)." };
  const { error } = await db().from("ad_publishers").upsert({
    ad_tenant_id: tenantId,
    publisher_domain: host,
    status: approved ? "approved" : "pending",
    approved_at: approved ? new Date().toISOString() : null,
  }, { onConflict: "ad_tenant_id,publisher_domain" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

export async function setPublisherStatusAction(
  tenantId: string, id: string, status: "approved" | "blocked" | "pending",
): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  const { error } = await db().from("ad_publishers")
    .update({ status, approved_at: status === "approved" ? new Date().toISOString() : null })
    .eq("id", id).eq("ad_tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

export interface CreateAdInput {
  name:          string;
  slot_type:     AdSlotType;
  creativeJson:  string;
  click_url:     string;
  pricing_model: AdPricingModel;
  rate_cents:    number;
  budget_cents:  number;
  weight:        number;
}

export async function createAdAction(tenantId: string, input: CreateAdInput): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!SLOTS.includes(input.slot_type)) return { ok: false, error: "Invalid slot type." };

  let creative: Record<string, unknown>;
  try {
    creative = JSON.parse(input.creativeJson);
  } catch {
    return { ok: false, error: "Creative is not valid JSON." };
  }

  // Guardrail: the creative MUST render, or it would serve an empty block.
  if (!renderBlockHtml(input.slot_type, creative)) {
    return { ok: false, error: `This creative renders empty for a "${input.slot_type}" block. Check the field shape (see the ad-network setup doc).` };
  }

  if (input.click_url && !/^https?:\/\//.test(input.click_url)) {
    return { ok: false, error: "Click URL must start with http(s)://." };
  }

  const { error } = await db().from("ads").insert({
    ad_tenant_id:  tenantId,
    name:          input.name.trim(),
    slot_type:     input.slot_type,
    creative,
    click_url:     input.click_url || null,
    pricing_model: input.pricing_model,
    rate_cents:    Math.max(0, input.rate_cents),
    budget_cents:  Math.max(0, input.budget_cents),
    weight:        Math.max(1, input.weight),
    status:        "active",
    start_at:      new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  logger.info("[ads-admin] ad created", { tenantId, slot: input.slot_type });
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

export async function setAdStatusAction(
  tenantId: string, adId: string, status: "active" | "paused" | "ended",
): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  const { error } = await db().from("ads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", adId).eq("ad_tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

// ── Wallet top-up (advertiser self-serve, 1:1 euro → ad budget) ────────────────
//
//   Unlike enrichment credit bundles (which carry a margin), ad budget is 1:1:
//   the advertiser pays X euros and gets X euros of wallet balance (1 credit =
//   €0.01, the same unit the ad rollup debits). A one-off Stripe payment
//   (price_data, no pre-created Price), credited on return, idempotent per
//   checkout session — mirrors confirmBundlePurchaseAction.

async function resolveStripeKey(): Promise<string | null> {
  let key: string | undefined = process.env["STRIPE_TEST_SECRET_KEY"] ?? process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    try { const s = await getPlatformStripeSettings(); if (s.ok) key = s.data.secretKey?.trim(); }
    catch { /* non-fatal */ }
  }
  return key ?? null;
}

export async function createAdTopUpCheckoutAction(
  tenantId: string, amountCents: number,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const amount = Math.round(amountCents);
  if (!Number.isFinite(amount) || amount < 500)   return { ok: false, error: "Minimum top-up is €5.00." };
  if (amount > 1_000_000_00)                       return { ok: false, error: "Amount too large." };

  const key = await resolveStripeKey();
  if (!key) return { ok: false, error: "Stripe is not configured." };

  const h    = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/admin/tenants/${tenantId}/billing`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe: any = new (Stripe as any)(key, { apiVersion: STRIPE_API_VERSION });
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amount, product_data: { name: "Ad budget top-up" } } }],
      success_url: `${base}?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}?topup=cancelled`,
      metadata: { tenant_id: tenantId, ad_topup: "1", credit_cents: String(amount) },
    });
    if (!checkout.url) return { ok: false, error: "Stripe returned no checkout URL." };
    return { ok: true, url: checkout.url };
  } catch (err) {
    logger.error("[ads] createAdTopUpCheckout failed", { tenantId, error: String(err) });
    return { ok: false, error: "Could not start checkout." };
  }
}

export async function confirmAdTopUpAction(
  tenantId: string, checkoutSessionId: string,
): Promise<{ ok: true; creditedCents: number; alreadyCredited: boolean } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  if (!checkoutSessionId.startsWith("cs_")) return { ok: false, error: "Invalid session." };

  // Idempotency: already credited for this checkout session? (keyed by reference_id)
  const { data: existing } = await db()
    .from("wallet_ledger").select("id")
    .eq("tenant_id", tenantId).eq("reference_id", checkoutSessionId).maybeSingle();
  if (existing) return { ok: true, creditedCents: 0, alreadyCredited: true };

  const key = await resolveStripeKey();
  if (!key) return { ok: false, error: "Stripe is not configured." };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe: any = new (Stripe as any)(key, { apiVersion: STRIPE_API_VERSION });
    const cs = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (cs.payment_status !== "paid")          return { ok: false, error: "Payment not completed." };
    if (cs.metadata?.tenant_id !== tenantId)   return { ok: false, error: "Session tenant mismatch." };
    const cents = Number(cs.metadata?.credit_cents ?? cs.amount_total ?? 0);
    if (!(cents > 0))                          return { ok: false, error: "No amount to credit." };

    await creditWallet(getDb(), tenantId, cents, "top_up_manual", "ad_topup", checkoutSessionId, "Ad budget top-up", "topup");
    revalidatePath(`/admin/tenants/${tenantId}/billing`);
    return { ok: true, creditedCents: cents, alreadyCredited: false };
  } catch (err) {
    logger.error("[ads] confirmAdTopUp failed", { tenantId, error: String(err) });
    return { ok: false, error: "Could not confirm the top-up." };
  }
}
