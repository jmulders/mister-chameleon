/**
 * Lead Base — per-profile activity timeline.
 *
 * A lean page-visit log keyed on `visitor_key` (= mc_session_id). Records what a
 * lead looked at (path, referrer, UTM) so sales can see the journey. Pseudonymous:
 * no PII, no raw IP. Written post-response (fail-open); purged with retention.
 * See docs/lead-base-design.md.
 */

import "server-only";

import { getDb }  from "@/data/db";
import { logger } from "@/lib/logger";

export interface VisitorEvent {
  id:          string;
  path:        string | null;
  referrer:    string | null;
  utmSource:   string | null;
  utmMedium:   string | null;
  utmCampaign: string | null;
  occurredAt:  string;
}

export interface RecordEventInput {
  tenantId:    string;
  visitorKey:  string;
  path?:       string | null;
  referrer?:   string | null;
  utmSource?:  string | null;
  utmMedium?:  string | null;
  utmCampaign?: string | null;
}

/** Append one visit event. Fail-open (never blocks the response path). */
export async function recordVisitorEvent(input: RecordEventInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    await db.from("visitor_events").insert({
      tenant_id:    input.tenantId,
      visitor_key:  input.visitorKey,
      path:         input.path        ?? null,
      referrer:     input.referrer     ?? null,
      utm_source:   input.utmSource    ?? null,
      utm_medium:   input.utmMedium    ?? null,
      utm_campaign: input.utmCampaign  ?? null,
    });
  } catch (err) {
    logger.warn("[lead-base] recordVisitorEvent failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Recent events for one visitor, newest first. */
export async function listVisitorEvents(tenantId: string, visitorKey: string, limit = 50): Promise<VisitorEvent[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_events")
      .select("id, path, referrer, utm_source, utm_medium, utm_campaign, occurred_at")
      .eq("tenant_id", tenantId)
      .eq("visitor_key", visitorKey)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      id:          String(r.id),
      path:        (r.path as string | null) ?? null,
      referrer:    (r.referrer as string | null) ?? null,
      utmSource:   (r.utm_source as string | null) ?? null,
      utmMedium:   (r.utm_medium as string | null) ?? null,
      utmCampaign: (r.utm_campaign as string | null) ?? null,
      occurredAt:  String(r.occurred_at),
    }));
  } catch {
    return [];
  }
}

/** Delete events older than `days`. Returns the count removed. Fail-open. */
export async function purgeOldVisitorEvents(days = 90): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("visitor_events")
      .delete()
      .lt("occurred_at", cutoff)
      .select("id");
    if (error || !data) return 0;
    return (data as unknown[]).length;
  } catch (err) {
    logger.warn("[lead-base] purgeOldVisitorEvents failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
