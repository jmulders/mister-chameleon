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
import { getRequiredAdminSession, assertTenantAccess, isSuperAdmin } from "@/lib/admin-auth/authorization";
import { getTenantById, saveTenant } from "@/tenant/server";
import { getDb } from "@/data/db";
import { getWallet, creditWallet } from "@/billing/wallet";
import { getPlatformStripeSettings } from "@/platform/platform-store";
import { STRIPE_API_VERSION } from "@/billing/stripe-config";
import { renderBlockHtml } from "@/lib/snippet/render-block-html";
import { logger } from "@/lib/logger";
import type { Ad, AdPublisher, AdSlotType, AdPricingModel } from "@/lib/ads/types";
import { aggregateAdBilling } from "@/lib/ads/aggregate-billing";
import { parseAdTargeting, type AdTargeting } from "@/lib/ads/targeting";
import { resolveAdGa4History } from "@/lib/ads/ga4";
import { getPlatformAdPricingSettings, AD_PRICING_DEFAULTS } from "@/platform/platform-store";
import { THEME_PRESETS, isThemePresetKey } from "@/design-system/theme/presets";

/** Title-case a theme key ("corporate-blue" → "Corporate blue"). */
function themeLabel(key: string): string {
  const s = key.replace(/[-_]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Theme presets an ad account can pick as its base look (+ the platform default). */
const AD_THEME_OPTIONS: { key: string; label: string }[] = [
  { key: "default", label: "Default" },
  ...Object.keys(THEME_PRESETS).map((k) => ({ key: k, label: themeLabel(k) })),
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

type RateCard = { cpmCents: number; cpcCents: number };
type TenantRateOverride = { cpmCents?: number; cpcCents?: number };

/** Global CPM/CPC (cents) from the platform rate-card, with safe defaults. */
async function globalRateCard(): Promise<RateCard> {
  const r = await getPlatformAdPricingSettings();
  return {
    cpmCents: (r.ok ? r.data.cpmCents : undefined) ?? AD_PRICING_DEFAULTS.cpmCents,
    cpcCents: (r.ok ? r.data.cpcCents : undefined) ?? AD_PRICING_DEFAULTS.cpcCents,
  };
}

/** Effective rate for a model: per-advertiser override → global rate-card. */
function effectiveRate(override: TenantRateOverride | undefined, global: RateCard, model: AdPricingModel): number {
  return model === "cpm" ? (override?.cpmCents ?? global.cpmCents) : (override?.cpcCents ?? global.cpcCents);
}

/** Read the per-tenant rate-card override off a tenant record (untyped JSONB field). */
function tenantRateOverride(tenant: unknown): TenantRateOverride | undefined {
  return (tenant as { adRateCard?: TenantRateOverride } | null)?.adRateCard;
}

export interface DayReport { date: string; impressions: number; clicks: number; spend_cents: number }

/**
 * GA4-for-ads readiness, derived from the tenant's GA4 config. Secrets
 * (apiSecret / serviceAccountJson) are NEVER included — only booleans and the
 * non-secret IDs, safe to send to the client.
 */
export interface Ga4AdStatus {
  trackingEnabled: boolean;
  historyEnabled:  boolean;
  sendMode:        "off" | "client" | "server" | null;
  measurementId:   string | null;
  propertyId:      string | null;
  /** Server-side event write fully configured (enabled + server + measurementId + apiSecret). */
  writeReady:      boolean;
  /** History read fully configured (enabled + propertyId + serviceAccountJson). */
  readReady:       boolean;
}

export interface AdsOverview {
  isAdvertiser:  boolean;
  siteKey:       string | null;
  walletBalance: number | null; // cents / credits
  publishers:    AdPublisher[];
  ads:           Ad[];
  stats:         Array<{ ad_id: string; impressions: number; clicks: number; spend_cents: number }>;
  /** Per-day totals across all ads (last 30 days), oldest → newest. Includes
      pending (not-yet-settled) impressions/clicks so counts are live. */
  report:        DayReport[];
  /** Impressions/clicks recorded but not yet metered by the billing rollup. */
  pendingImpressions: number;
  pendingClicks:      number;
  /** Spend those pending events represent, in cents (will be debited on rollup). */
  pendingSpendCents:  number;
  /** Settled behavioural-targeting profiling fees (last 30 days), in cents. */
  profilingSpentCents:   number;
  /** Profiling fees recorded but not yet billed, in cents. */
  pendingProfilingCents: number;
  /** Slot types this ad account offers to publishers (defaults to all). */
  activeSlots:           AdSlotType[];
  /** Global platform rate-card (cents) — the default when a tenant has no override. */
  rateCard:              { cpmCents: number; cpcCents: number };
  /** Effective rate applied to this advertiser's ads (per-tenant override → global). */
  effectiveRateCard:     { cpmCents: number; cpcCents: number };
  /** This advertiser's per-tenant override (null = inherit the global rate-card). */
  tenantRateOverride:    { cpmCents: number | null; cpcCents: number | null };
  /** True when the viewer is a platform super-admin (may set the per-tenant rate). */
  isSuperAdmin:          boolean;
  /** GA4-for-ads readiness (write/read), for the ads-page status card. */
  ga4:                   Ga4AdStatus;
  /** Autocomplete suggestions for firmographic targeting, taken from the
      company values we've actually observed from Leadinfo (ip_company_cache), so
      a chosen value is guaranteed to be matchable. */
  companySuggestions:    { industries: string[]; sizes: string[] };
  /** The ad account's base theme preset (its default look; per-ad Styling overrides it). */
  themePreset:           string;
  /** Available theme presets to choose from. */
  themeOptions:          { key: string; label: string }[];
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

  // ── Live layer: fold in pending (unbilled) events ──────────────────────────
  // ad_stats_daily is only written by the billing rollup, which lags. To make
  // the report feel live, meter the not-yet-billed ad_events the same way the
  // rollup will (reusing aggregateAdBilling) and add them on top. Spend from
  // these is "pending" — it will hit the wallet on the next rollup.
  const adsArr  = (ads ?? []) as Ad[];
  const adsById = new Map<string, Ad>(adsArr.map((a): [string, Ad] => [a.id, a]));
  let pendingImpressions = 0, pendingClicks = 0, pendingSpendCents = 0;
  try {
    const { data: pendingEvents } = await db()
      .from("ad_events")
      .select("ad_id, ad_tenant_id, publisher_domain, event_type, occurred_at")
      .eq("ad_tenant_id", tenantId)
      .eq("billed", false)
      .limit(20_000);
    const agg = aggregateAdBilling(pendingEvents ?? [], adsById);
    for (const [, c] of agg.perTenantCents) pendingSpendCents += c;
    for (const d of agg.daily) {
      pendingImpressions += d.impressions;
      pendingClicks      += d.clicks;
      const day = byDay.get(d.date) ?? { date: d.date, impressions: 0, clicks: 0, spend_cents: 0 };
      day.impressions += d.impressions; day.clicks += d.clicks; day.spend_cents += d.spend_cents;
      byDay.set(d.date, day);
      const a = byAd.get(d.ad_id) ?? { ad_id: d.ad_id, impressions: 0, clicks: 0, spend_cents: 0 };
      a.impressions += d.impressions; a.clicks += d.clicks; a.spend_cents += d.spend_cents;
      byAd.set(d.ad_id, a);
    }
  } catch { /* pending layer is best-effort — never break the report */ }

  // ── Profiling fees (behavioural targeting) ─────────────────────────────────
  // Settled fees come from the wallet ledger (reference_type "ad_profiling",
  // last 30 days); pending fees are unbilled ad_profiling_charges rows.
  let profilingSpentCents = 0, pendingProfilingCents = 0;
  try {
    const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [{ data: ledger }, { data: charges }] = await Promise.all([
      db().from("wallet_ledger").select("amount, amount_cents")
        .eq("tenant_id", tenantId).in("reference_type", ["ad_profiling", "ad_geo", "ad_firmographic"]).gte("created_at", sinceIso),
      db().from("ad_profiling_charges").select("fee_cents")
        .eq("ad_tenant_id", tenantId).eq("billed", false),
    ]);
    for (const r of (ledger ?? []) as { amount: number | null; amount_cents: number | null }[]) {
      profilingSpentCents += Math.abs(Number(r.amount ?? r.amount_cents ?? 0));
    }
    for (const c of (charges ?? []) as { fee_cents: number }[]) pendingProfilingCents += Number(c.fee_cents ?? 0);
  } catch { /* best-effort */ }

  // Rate-card: global platform default + this advertiser's per-tenant override.
  const globalRc = await globalRateCard();
  const rateOverride = tenantRateOverride(tenant);

  // Firmographic autocomplete suggestions — distinct industries/sizes we've
  // actually seen from Leadinfo (matched rows in the shared IP→company cache).
  // Guarantees a chosen value can match; grows as the cache fills. Best-effort.
  const companySuggestions = { industries: [] as string[], sizes: [] as string[] };
  try {
    const { data: obs } = await db()
      .from("ip_company_cache")
      .select("company_industry, company_size")
      .eq("matched", true)
      .limit(5000);
    const inds = new Set<string>(), sizes = new Set<string>();
    for (const r of (obs ?? []) as { company_industry: string | null; company_size: string | null }[]) {
      if (r.company_industry) inds.add(r.company_industry.trim());
      if (r.company_size)     sizes.add(r.company_size.trim());
    }
    companySuggestions.industries = Array.from(inds).filter(Boolean).sort((a, b) => a.localeCompare(b)).slice(0, 200);
    companySuggestions.sizes      = Array.from(sizes).filter(Boolean).sort((a, b) => a.localeCompare(b)).slice(0, 50);
  } catch { /* suggestions are optional */ }

  // GA4-for-ads readiness (no secrets leave the server).
  const gTrack = tenant?.ga4?.tracking;
  const gHist  = tenant?.ga4?.history;
  const ga4: Ga4AdStatus = {
    trackingEnabled: !!gTrack?.enabled,
    historyEnabled:  !!gHist?.enabled,
    sendMode:        gTrack?.sendMode ?? null,
    measurementId:   gTrack?.measurementId ?? null,
    propertyId:      gHist?.propertyId ?? null,
    writeReady:      !!(gTrack?.enabled && gTrack.sendMode === "server" && gTrack.measurementId && gTrack.apiSecret),
    readReady:       !!(gHist?.enabled && gHist.propertyId && gHist.serviceAccountJson),
  };

  return {
    isAdvertiser,
    siteKey,
    walletBalance,
    publishers: (publishers ?? []) as AdPublisher[],
    ads:        adsArr,
    stats:      Array.from(byAd.values()),
    report:     Array.from(byDay.values()).sort((x, y) => x.date.localeCompare(y.date)),
    pendingImpressions,
    pendingClicks,
    pendingSpendCents: Math.round(pendingSpendCents),
    profilingSpentCents: Math.round(profilingSpentCents),
    pendingProfilingCents: Math.round(pendingProfilingCents),
    activeSlots: tenant?.adSlots == null
      ? SLOTS                                            // legacy/unset = all slots
      : SLOTS.filter((s) => tenant.adSlots!.includes(s)),
    rateCard: globalRc,
    effectiveRateCard: {
      cpmCents: rateOverride?.cpmCents ?? globalRc.cpmCents,
      cpcCents: rateOverride?.cpcCents ?? globalRc.cpcCents,
    },
    tenantRateOverride: {
      cpmCents: rateOverride?.cpmCents ?? null,
      cpcCents: rateOverride?.cpcCents ?? null,
    },
    isSuperAdmin: isSuperAdmin(session),
    ga4,
    companySuggestions,
    themePreset:  (tenant?.design?.theme as string | undefined) ?? "default",
    themeOptions: AD_THEME_OPTIONS,
  };
}

/**
 * Set the ad account's base theme preset (its default look for all ads; the
 * per-ad "Styling" design tokens still override it). Accessible to the advertiser
 * (their own branding). saveTenant enforces package theme limits, so if the
 * chosen preset isn't allowed for the tenant's package we report it back.
 */
export async function setAdAccountThemeAction(tenantId: string, theme: string): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  if (theme !== "default" && !isThemePresetKey(theme)) return { ok: false, error: "Unknown theme preset." };
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await saveTenant({ ...tenant, design: { ...(tenant.design ?? {}), theme } } as any);
  const after = await getTenantById(tenantId);
  if (((after?.design?.theme as string | undefined) ?? "default") !== theme) {
    return { ok: false, error: "That theme isn't available for this account's package." };
  }
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

// ── Ad-audience sessions + journeys ───────────────────────────────────────────

export interface AdSessionStep { at: string; path: string | null; keywords: string[] }
export interface AdSession {
  sessionId:       string;
  publisherDomain: string | null;
  adsSeen:         string[];   // ad names shown to this session
  impressions:     number;
  clicks:          number;
  firstSeen:       string;
  lastSeen:        string;
  journey:         AdSessionStep[];
  /** Firmographic company for this session (from ad_company_cache), if matched. */
  company:         { name: string | null; industry: string | null; size: string | null } | null;
}

/** GA4 history signals for one session's visitor (loaded on demand). */
export interface AdSessionGa4 {
  sessionCount: number | null;
  lastCountry:  string | null;
  lastRegion:   string | null;
  lastCity:     string | null;
  lastChannel:  string | null;
  source:       string | null;
}

/**
 * Recent sessions that were served ads, enriched with each session's journey.
 * Anchors on ad_events (so only sessions that actually saw an ad appear) and
 * folds in the page_view journey recorded for the advertiser tenant.
 */
export async function fetchAdSessionsAction(tenantId: string): Promise<AdSession[]> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  // 1. Recent ad events → which sessions saw which ads.
  const { data: events } = await db()
    .from("ad_events")
    .select("session_id, ad_id, publisher_domain, event_type, occurred_at")
    .eq("ad_tenant_id", tenantId)
    .order("occurred_at", { ascending: false })
    .limit(1000);
  type Ev = { session_id: string | null; ad_id: string; publisher_domain: string | null; event_type: string; occurred_at: string };
  const evRows = (events ?? []) as Ev[];
  if (evRows.length === 0) return [];

  // 2. Resolve ad names.
  const adIds = Array.from(new Set(evRows.map((e) => e.ad_id)));
  const { data: adRows } = await db().from("ads").select("id, name").in("id", adIds);
  const adName = new Map<string, string>(((adRows ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));

  // 3. Fold events into per-session summaries.
  const sessions = new Map<string, AdSession>();
  for (const e of evRows) {
    const sid = e.session_id;
    if (!sid) continue;
    const s = sessions.get(sid) ?? {
      sessionId: sid, publisherDomain: e.publisher_domain ?? null,
      adsSeen: [], impressions: 0, clicks: 0, firstSeen: e.occurred_at, lastSeen: e.occurred_at, journey: [], company: null,
    };
    if (e.event_type === "impression") s.impressions += 1;
    else if (e.event_type === "click") s.clicks += 1;
    const nm = adName.get(e.ad_id);
    if (nm && !s.adsSeen.includes(nm)) s.adsSeen.push(nm);
    if (e.occurred_at < s.firstSeen) s.firstSeen = e.occurred_at;
    if (e.occurred_at > s.lastSeen)  s.lastSeen  = e.occurred_at;
    if (!s.publisherDomain && e.publisher_domain) s.publisherDomain = e.publisher_domain;
    sessions.set(sid, s);
  }

  // 4. Keep the 50 most-recently-active sessions.
  const top = Array.from(sessions.values())
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, 50);
  const topIds = top.map((s) => s.sessionId);

  // 5. Attach each session's journey (page_views recorded for this tenant).
  const { data: jEvents } = await db()
    .from("visitor_journey_events")
    .select("session_id, occurred_at, page_path, page_keywords")
    .eq("tenant_id", tenantId)
    .in("session_id", topIds)
    .order("occurred_at", { ascending: true })
    .limit(2000);
  type J = { session_id: string; occurred_at: string; page_path: string | null; page_keywords: string[] | null };
  const byId = new Map(top.map((s) => [s.sessionId, s]));
  for (const j of (jEvents ?? []) as J[]) {
    const s = byId.get(j.session_id);
    if (!s) continue;
    s.journey.push({ at: j.occurred_at, path: j.page_path ?? null, keywords: j.page_keywords ?? [] });
  }

  // 6. Attach the firmographic company we resolved for each session (if any).
  try {
    const { data: co } = await db()
      .from("ad_company_cache")
      .select("session_id, company_name, company_industry, company_size, resolved_date")
      .eq("ad_tenant_id", tenantId)
      .eq("matched", true)
      .in("session_id", topIds);
    type Co = { session_id: string; company_name: string | null; company_industry: string | null; company_size: string | null; resolved_date: string };
    const latest = new Map<string, Co>();
    for (const r of (co ?? []) as Co[]) {
      const cur = latest.get(r.session_id);
      if (!cur || r.resolved_date > cur.resolved_date) latest.set(r.session_id, r);
    }
    for (const s of top) {
      const r = latest.get(s.sessionId);
      if (r) s.company = { name: r.company_name, industry: r.company_industry, size: r.company_size };
    }
  } catch { /* company enrichment is best-effort */ }

  return top;
}

/**
 * On-demand GA4 history for one session's visitor. Kept out of the list query
 * because it's a live GA4 Data API call per visitor — only run when a row is
 * expanded and only when the tenant has GA4 history configured.
 */
export async function fetchAdSessionGa4Action(tenantId: string, sessionId: string): Promise<AdSessionGa4 | null> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  const tenant = await getTenantById(tenantId);
  if (!tenant?.ga4?.history?.enabled) return null;
  try {
    const out = await resolveAdGa4History(tenant.ga4, sessionId);
    const has = out.gaSessionCount != null || !!out.gaLastKnownCountry || !!out.gaLastKnownCity || !!out.gaLastChannelGroup;
    if (!has) return null;
    return {
      sessionCount: out.gaSessionCount ?? null,
      lastCountry:  out.gaLastKnownCountry ?? null,
      lastRegion:   out.gaLastKnownRegion ?? null,
      lastCity:     out.gaLastKnownCity ?? null,
      lastChannel:  out.gaLastChannelGroup ?? null,
      source:       out.gaHistorySource ?? null,
    };
  } catch {
    return null;
  }
}

// ── Publisher breakdown ────────────────────────────────────────────────────────

export interface PublisherBreakdownRow {
  /** Publisher domain the ad was served on, or a placeholder for unknown/direct. */
  publisher:   string;
  impressions: number;
  clicks:      number;
  /** clicks / impressions, 0..1. */
  ctr:         number;
  /** Which of this advertiser's ads ran on this publisher (impressions desc). */
  ads:         { adId: string; label: string; impressions: number; clicks: number }[];
}

export interface PublisherBreakdownResult {
  /** Current page of rows (sorted by impressions desc). */
  rows:       PublisherBreakdownRow[];
  page:       number;
  pageSize:   number;
  /** Distinct publisher rows after the publisher filter (for pagination). */
  totalRows:  number;
  /** Totals across the filtered set. */
  totals:     { impressions: number; clicks: number; publishers: number };
  /** All distinct publishers in the period (unfiltered) — feeds the filter dropdown. */
  publishers: string[];
  /** Echo of the resolved period (days; 0 = all time). */
  days:       number;
  /** True when the 50k event scan was hit (counts may be partial). */
  truncated:  boolean;
}

const UNKNOWN_PUBLISHER = "(direct / unknown)";
const BREAKDOWN_EVENT_CAP = 50_000;

/**
 * Per-publisher impression/click breakdown for an advertiser, from ad_events
 * (which records publisher_domain on every event — so this is complete and live,
 * including not-yet-billed events). Supports a period filter, a publisher filter,
 * and pagination over the distinct-publisher rows.
 */
export async function fetchAdPublisherBreakdownAction(
  tenantId: string,
  input: { publisher?: string | null; days?: number; page?: number; pageSize?: number } = {},
): Promise<PublisherBreakdownResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const days     = [7, 30, 90, 0].includes(input.days ?? 30) ? (input.days ?? 30) : 30;
  const page     = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(5, Math.floor(input.pageSize ?? 25)));

  let query = db()
    .from("ad_events")
    .select("publisher_domain, event_type, ad_id")
    .eq("ad_tenant_id", tenantId)
    .limit(BREAKDOWN_EVENT_CAP);
  if (days > 0) {
    query = query.gte("occurred_at", new Date(Date.now() - days * 86_400_000).toISOString());
  }
  const { data } = await query;
  const events = (data ?? []) as { publisher_domain: string | null; event_type: string; ad_id: string | null }[];

  // Ad id → human label (name, falling back to slot type, then short id).
  const adLabels = new Map<string, string>();
  try {
    const { data: adRows } = await db().from("ads").select("id, name, slot_type").eq("ad_tenant_id", tenantId);
    for (const a of (adRows ?? []) as { id: string; name: string | null; slot_type: string | null }[]) {
      adLabels.set(a.id, a.name?.trim() || a.slot_type || a.id.slice(0, 8));
    }
  } catch { /* labels are best-effort */ }

  interface PubAgg { impressions: number; clicks: number; ads: Map<string, { impressions: number; clicks: number }> }
  const byPublisher = new Map<string, PubAgg>();
  for (const e of events) {
    const key = e.publisher_domain?.trim() || UNKNOWN_PUBLISHER;
    const agg = byPublisher.get(key) ?? { impressions: 0, clicks: 0, ads: new Map() };
    const adKey  = e.ad_id ?? "(unknown)";
    const adAgg  = agg.ads.get(adKey) ?? { impressions: 0, clicks: 0 };
    if (e.event_type === "impression") { agg.impressions += 1; adAgg.impressions += 1; }
    else if (e.event_type === "click") { agg.clicks += 1; adAgg.clicks += 1; }
    agg.ads.set(adKey, adAgg);
    byPublisher.set(key, agg);
  }

  const publishers = [...byPublisher.keys()].sort((a, b) => a.localeCompare(b));

  const filter = input.publisher?.trim() || null;
  let all: PublisherBreakdownRow[] = [...byPublisher.entries()]
    .filter(([pub]) => !filter || pub === filter)
    .map(([publisher, v]) => ({
      publisher,
      impressions: v.impressions,
      clicks:      v.clicks,
      ctr:         v.impressions > 0 ? v.clicks / v.impressions : 0,
      ads: [...v.ads.entries()]
        .map(([adId, a]) => ({
          adId,
          label:       adId === "(unknown)" ? "(unknown ad)" : (adLabels.get(adId) ?? adId.slice(0, 8)),
          impressions: a.impressions,
          clicks:      a.clicks,
        }))
        .sort((x, y) => y.impressions - x.impressions || y.clicks - x.clicks),
    }));
  all = all.sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);

  const totals = {
    impressions: all.reduce((s, r) => s + r.impressions, 0),
    clicks:      all.reduce((s, r) => s + r.clicks, 0),
    publishers:  all.length,
  };
  const start = (page - 1) * pageSize;

  return {
    rows:       all.slice(start, start + pageSize),
    page,
    pageSize,
    totalRows:  all.length,
    totals,
    publishers,
    days,
    truncated:  events.length >= BREAKDOWN_EVENT_CAP,
  };
}

/** Set which adaptive slot types this advertiser account offers to publishers. */
export async function setAdSlotsAction(tenantId: string, slots: AdSlotType[]): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  const clean = SLOTS.filter((s) => slots.includes(s));   // keep canonical order, drop junk
  await saveTenant({ ...tenant, adSlots: clean });
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

/**
 * Set (or clear) this advertiser's per-tenant CPM/CPC rate-card override.
 * Super-admin only — advertisers must never be able to set their own price.
 * Pass null for a field to clear it (that model then inherits the global rate).
 */
export async function setTenantAdRateCardAction(
  tenantId: string, input: { cpmCents: number | null; cpcCents: number | null },
): Promise<ActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  if (!isSuperAdmin(session)) return { ok: false, error: "Only platform admins can set advertiser rates." };
  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  const clean: TenantRateOverride = {
    ...(typeof input.cpmCents === "number" && input.cpmCents >= 0 ? { cpmCents: Math.round(input.cpmCents) } : {}),
    ...(typeof input.cpcCents === "number" && input.cpcCents >= 0 ? { cpcCents: Math.round(input.cpcCents) } : {}),
  };
  await saveTenant({ ...tenant, adRateCard: Object.keys(clean).length > 0 ? clean : undefined });
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
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
  /** Optional behavioural targeting; empty/omitted = show to everyone. */
  targeting?:    AdTargeting;
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

  // Rate is platform-controlled: per-advertiser override → global rate-card.
  // Any client-supplied rate is ignored so an advertiser can't set their price.
  const rateTenant = await getTenantById(tenantId);
  const enforcedRate = effectiveRate(tenantRateOverride(rateTenant), await globalRateCard(), input.pricing_model);

  const { error } = await db().from("ads").insert({
    ad_tenant_id:  tenantId,
    name:          input.name.trim(),
    slot_type:     input.slot_type,
    creative,
    click_url:     input.click_url || null,
    pricing_model: input.pricing_model,
    rate_cents:    enforcedRate,
    budget_cents:  Math.max(0, input.budget_cents),
    weight:        Math.max(1, input.weight),
    targeting:     input.targeting ? parseAdTargeting(input.targeting) : {},
    status:        "active",
    start_at:      new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  logger.info("[ads-admin] ad created", { tenantId, slot: input.slot_type });
  revalidatePath(`/admin/tenants/${tenantId}/ads`);
  return { ok: true };
}

/** Edit an existing ad's content/settings. Same guardrails as createAdAction. */
export async function editAdAction(tenantId: string, adId: string, input: CreateAdInput): Promise<ActionResult> {
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
  if (!renderBlockHtml(input.slot_type, creative)) {
    return { ok: false, error: `This creative renders empty for a "${input.slot_type}" block. Check the field shape (see the ad-network setup doc).` };
  }
  if (input.click_url && !/^https?:\/\//.test(input.click_url)) {
    return { ok: false, error: "Click URL must start with http(s)://." };
  }

  // Rate stays platform-controlled on edit too (advertiser can't change it).
  const rateTenant = await getTenantById(tenantId);
  const enforcedRate = effectiveRate(tenantRateOverride(rateTenant), await globalRateCard(), input.pricing_model);

  const { error } = await db().from("ads")
    .update({
      name:          input.name.trim(),
      slot_type:     input.slot_type,
      creative,
      click_url:     input.click_url || null,
      pricing_model: input.pricing_model,
      rate_cents:    enforcedRate,
      budget_cents:  Math.max(0, input.budget_cents),
      weight:        Math.max(1, input.weight),
      targeting:     input.targeting ? parseAdTargeting(input.targeting) : {},
      updated_at:    new Date().toISOString(),
    })
    .eq("id", adId).eq("ad_tenant_id", tenantId);
  if (error) return { ok: false, error: error.message };
  logger.info("[ads-admin] ad edited", { tenantId, adId, slot: input.slot_type });
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
