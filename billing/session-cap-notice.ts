/**
 * billing/session-cap-notice.ts
 *
 * A tenant is told when the month's personalised sessions run out.
 *
 * Over the plan limit a visitor gets the default page (billing/plan-enforcement).
 * Until this module the tenant heard nothing: the number stood in the dashboard
 * for whoever looked. With plans of 1,500 / 7,500 / 40,000 sessions a tenant
 * will reach the limit, so it now gets one mail at 80% of the plan and one when
 * the plan is used up.
 *
 * ─── Once per threshold ───────────────────────────────────────────────────────
 *
 *   Many requests cross a threshold at the same moment. The table
 *   session_cap_notices (migration 190) holds one row per tenant, month and
 *   threshold; the insert that creates the row is the claim, and only the
 *   request whose insert created it sends the mail.
 *
 *   A tenant that jumps from below 80% to the limit between two counts gets the
 *   mail of the limit only: both rows are claimed, the lower one is not sent.
 *
 * ─── What it costs ────────────────────────────────────────────────────────────
 *
 *   It runs after a session was newly counted, behind the response. Below
 *   three quarters of the plan it does nothing at all. Above that it counts the
 *   month once, exactly: the count the caller holds may be a minute old.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export const SESSION_CAP_NOTICE_THRESHOLDS = [80, 100] as const;
export type SessionCapNoticeThreshold = (typeof SESSION_CAP_NOTICE_THRESHOLDS)[number];

/**
 * The highest threshold the month's count has reached, or null.
 * A plan without a limit (0) has no thresholds.
 */
export function sessionCapNoticeDue(count: number, planLimit: number): SessionCapNoticeThreshold | null {
  if (!(planLimit > 0) || !(count > 0)) return null;
  let due: SessionCapNoticeThreshold | null = null;
  for (const threshold of SESSION_CAP_NOTICE_THRESHOLDS) {
    // Whole sessions: 80% of 1,500 is 1,200, of 7 it is 6.
    if (count >= Math.ceil((planLimit * threshold) / 100)) due = threshold;
  }
  return due;
}

/**
 * Whether an exact count is worth its read. `knownCount` is the count the
 * caller decided with, which may be a minute old and does not include the
 * session just recorded: three quarters of the plan leaves room for both.
 */
export function nearSessionCapNotice(knownCount: number, planLimit: number): boolean {
  if (!(planLimit > 0)) return false;
  return knownCount + 1 >= Math.floor(planLimit * 0.75);
}

/** The thresholds to claim for a count that reached `due`: it and every lower one. */
export function thresholdsUpTo(due: SessionCapNoticeThreshold): SessionCapNoticeThreshold[] {
  return SESSION_CAP_NOTICE_THRESHOLDS.filter((t) => t <= due);
}

export interface SessionCountedInput {
  tenantId:      string;
  monthKey:      string;
  /** The count the caller decided with (may be a minute old). */
  knownCount:    number;
  planLimit:     number;
  bonusSessions: number;
}

/**
 * Called after a session was newly counted. Sends the tenant a mail when the
 * month reached a threshold for the first time. Never throws.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function noteSessionCounted(db: SupabaseClient<any>, input: SessionCountedInput): Promise<void> {
  const { tenantId, monthKey, knownCount, planLimit, bonusSessions } = input;
  try {
    if (!nearSessionCapNotice(knownCount, planLimit)) return;

    const { count, error: countError } = await db
      .from("personalization_sessions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("month_key", monthKey);
    if (countError || typeof count !== "number") return;

    const due = sessionCapNoticeDue(count, planLimit);
    if (!due) return;

    // The claim. Rows that existed come back as nothing.
    const { data: claimed, error: claimError } = await db
      .from("session_cap_notices")
      .upsert(
        thresholdsUpTo(due).map((threshold) => ({ tenant_id: tenantId, month_key: monthKey, threshold })),
        { onConflict: "tenant_id,month_key,threshold", ignoreDuplicates: true },
      )
      .select("threshold");
    if (claimError) {
      // Most likely the table is not there yet (migration 190 is applied by
      // hand). Without a claim no mail: better silent than one per request.
      logger.warn("[billing/session-cap-notice] could not claim a notice; none sent", {
        tenantId, monthKey, due, error: claimError.message,
      });
      return;
    }
    const mine = Array.isArray(claimed) && claimed.some((row) => (row as { threshold: number }).threshold === due);
    if (!mine) return;

    // Loaded here and not at the top: this module sits on the path of every
    // page, the mail transport is needed twice a month per tenant.
    const { notifySessionCap } = await import("./notifications");
    await notifySessionCap(db, tenantId, { threshold: due, count, planLimit, bonusSessions, monthKey });
  } catch (err) {
    logger.warn("[billing/session-cap-notice] failed", {
      tenantId, monthKey, error: err instanceof Error ? err.message : String(err),
    });
  }
}
