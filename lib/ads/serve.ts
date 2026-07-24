/**
 * Ad-serving DB layer (server-only, service-role via getDb).
 *
 * Reads eligible ads + publisher approval, records impression/click events
 * (deduped), and exposes the wallet "servable" gate. Billing itself is async —
 * see lib/ads/rollup.ts. Never throws to the caller: ad-serving must never break
 * a page render.
 */

import { getDb }     from "@/data/db";
import { getWallet } from "@/billing/wallet";
import { logger }    from "@/lib/logger";
import type { Ad, AdEventType } from "./types";
import type { AdAudience, AdFunnelStage } from "./targeting";
import { PROFILING_FEE_CENTS } from "./pricing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

const AD_FUNNEL_STAGES: AdFunnelStage[] = ["awareness", "consideration", "intent", "high_intent", "customer"];

/**
 * Build the behavioural audience profile for a visitor from visitor_behavior_state
 * (the interest/journey signals the advertiser decide branch already records).
 * Returns null when the visitor has no profile yet — untargeted ads still serve,
 * targeted ones do not. Never throws.
 */
/**
 * Record a behavioural-profiling charge for this visitor, deduped per calendar
 * day via UNIQUE(ad_tenant_id, session_id, charge_date). Insert-only and
 * idempotent — the billing rollup debits the wallet for unbilled rows. Never
 * throws (best-effort; profiling billing must not break serving).
 */
export async function recordProfilingCharge(
  tenantId: string, sessionId: string, publisherDomain: string | null,
): Promise<void> {
  try {
    await db()
      .from("ad_profiling_charges")
      .upsert(
        { ad_tenant_id: tenantId, session_id: sessionId, publisher_domain: publisherDomain ?? null, fee_cents: PROFILING_FEE_CENTS },
        { onConflict: "ad_tenant_id,session_id,charge_date", ignoreDuplicates: true },
      );
  } catch (err) {
    logger.warn("[ads] recordProfilingCharge failed", { tenantId, error: String(err) });
  }
}

export async function fetchAdAudience(tenantId: string, sessionId: string | null): Promise<AdAudience | null> {
  if (!sessionId) return null;
  try {
    const { data } = await db()
      .from("visitor_behavior_state")
      .select("funnel_stage, viewed_keywords, page_view_count, first_seen_at, last_seen_at, repeat_session_bonus")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (!data) return null;
    const row = data as {
      funnel_stage: string | null; viewed_keywords: string[] | null; page_view_count: number | null;
      first_seen_at: string | null; last_seen_at: string | null; repeat_session_bonus: number | null;
    };
    const stage = (AD_FUNNEL_STAGES as string[]).includes(row.funnel_stage ?? "")
      ? (row.funnel_stage as AdFunnelStage)
      : "awareness";
    const returning =
      (row.repeat_session_bonus ?? 0) > 0 ||
      (!!row.first_seen_at && !!row.last_seen_at && row.first_seen_at.slice(0, 10) !== row.last_seen_at.slice(0, 10));
    return {
      keywords:    row.viewed_keywords ?? [],
      funnelStage: stage,
      pageviews:   Number(row.page_view_count ?? 0),
      returning,
    };
  } catch (err) {
    logger.warn("[ads] fetchAdAudience failed", { tenantId, error: String(err) });
    return null;
  }
}

/** Normalise an Origin/Referer into a bare, www-insensitive host. */
export function hostFromOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const h = new URL(origin.includes("://") ? origin : `https://${origin}`).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return null;
  }
}

/** True when `host` is an approved publisher for this advertiser tenant. */
export async function isPublisherApproved(tenantId: string, host: string | null): Promise<boolean> {
  if (!host) return false;
  try {
    const { data } = await db()
      .from("ad_publishers")
      .select("publisher_domain")
      .eq("ad_tenant_id", tenantId)
      .eq("status", "approved");
    const approved = new Set(
      ((data ?? []) as { publisher_domain: string }[]).map((r) => {
        const d = String(r.publisher_domain).toLowerCase();
        return d.startsWith("www.") ? d.slice(4) : d;
      }),
    );
    return approved.has(host);
  } catch (err) {
    logger.warn("[ads] isPublisherApproved failed", { tenantId, error: String(err) });
    return false;
  }
}

/** Active ads for a given slot type on this advertiser tenant. */
export async function fetchAdsForSlot(tenantId: string, slotType: string): Promise<Ad[]> {
  try {
    const { data } = await db()
      .from("ads")
      .select("*")
      .eq("ad_tenant_id", tenantId)
      .eq("slot_type", slotType)
      .eq("status", "active");
    return (data ?? []) as Ad[];
  } catch (err) {
    logger.warn("[ads] fetchAdsForSlot failed", { tenantId, slotType, error: String(err) });
    return [];
  }
}

/**
 * The advertiser can serve when their wallet exists, is active, and has a
 * positive balance. Billing lags (async rollup), so this is the "stop serving
 * when the money runs out" gate, checked with a cheap single read.
 */
export async function isWalletServable(tenantId: string): Promise<boolean> {
  try {
    const wallet = await getWallet(getDb(), tenantId);
    if (!wallet) return false;
    if (wallet.status !== "active") return false;
    const balance = (wallet.balance ?? wallet.balance_cents ?? 0) as number;
    return balance > 0;
  } catch (err) {
    logger.warn("[ads] isWalletServable failed", { tenantId, error: String(err) });
    return false;
  }
}

/**
 * Record an impression or click. Deduped on `eventKey` (unique) so the per-slot
 * burst (one page render = up to 6 slot calls) and rapid double-clicks collapse
 * to a single billable event. Fire-and-forget friendly; returns false on error.
 */
export async function recordAdEvent(input: {
  tenantId:         string;
  adId:             string;
  publisherDomain:  string | null;
  eventType:        AdEventType;
  sessionId:        string | null;
  eventKey:         string;
  metadata?:        Record<string, unknown>;
}): Promise<boolean> {
  try {
    const { error } = await db()
      .from("ad_events")
      .upsert(
        {
          ad_tenant_id:     input.tenantId,
          ad_id:            input.adId,
          publisher_domain: input.publisherDomain,
          event_type:       input.eventType,
          session_id:       input.sessionId,
          event_key:        input.eventKey,
          metadata:         input.metadata ?? {},
        },
        { onConflict: "event_key", ignoreDuplicates: true },
      );
    if (error) {
      logger.debug("[ads] recordAdEvent insert failed", { error: error.message });
      return false;
    }
    return true;
  } catch (err) {
    logger.debug("[ads] recordAdEvent threw", { error: String(err) });
    return false;
  }
}

/**
 * Click integrity: true when this visitor had an impression of this ad recently
 * (default 30 min). Billable clicks require this, so hammering the click URL
 * directly (no prior impression) can't drain a CPC budget.
 */
export async function recentImpressionExists(
  adId: string, sessionId: string | null, windowMs = 30 * 60_000,
): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const { data } = await db()
      .from("ad_events")
      .select("id")
      .eq("ad_id", adId)
      .eq("session_id", sessionId)
      .eq("event_type", "impression")
      .gte("occurred_at", since)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/** Look up one ad (for the click endpoint → its click_url). */
export async function getAdById(adId: string): Promise<Ad | null> {
  try {
    const { data } = await db().from("ads").select("*").eq("id", adId).maybeSingle();
    return (data ?? null) as Ad | null;
  } catch {
    return null;
  }
}
