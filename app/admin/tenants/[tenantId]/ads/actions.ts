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
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { getTenantById, saveTenant } from "@/tenant/server";
import { getDb } from "@/data/db";
import { getWallet } from "@/billing/wallet";
import { renderBlockHtml } from "@/lib/snippet/render-block-html";
import { logger } from "@/lib/logger";
import type { Ad, AdPublisher, AdSlotType, AdPricingModel } from "@/lib/ads/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

export interface AdsOverview {
  isAdvertiser:  boolean;
  siteKey:       string | null;
  walletBalance: number | null; // cents / credits
  publishers:    AdPublisher[];
  ads:           Ad[];
  stats:         Array<{ ad_id: string; impressions: number; clicks: number; spend_cents: number }>;
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

  // Aggregate stats per ad from the daily rollup.
  const { data: statRows } = await db()
    .from("ad_stats_daily").select("ad_id, impressions, clicks, spend_cents").eq("ad_tenant_id", tenantId);
  const byAd = new Map<string, { ad_id: string; impressions: number; clicks: number; spend_cents: number }>();
  for (const r of (statRows ?? []) as Array<{ ad_id: string; impressions: number; clicks: number; spend_cents: number }>) {
    const cur = byAd.get(r.ad_id) ?? { ad_id: r.ad_id, impressions: 0, clicks: 0, spend_cents: 0 };
    cur.impressions += Number(r.impressions); cur.clicks += Number(r.clicks); cur.spend_cents += Number(r.spend_cents);
    byAd.set(r.ad_id, cur);
  }

  return {
    isAdvertiser,
    siteKey,
    walletBalance,
    publishers: (publishers ?? []) as AdPublisher[],
    ads:        (ads ?? []) as Ad[],
    stats:      Array.from(byAd.values()),
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
