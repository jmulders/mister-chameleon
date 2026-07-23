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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

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
