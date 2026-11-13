/**
 * lib/rate-limiting/cleanup.ts
 *
 * Removes rate-limit counters whose window is over.
 *
 * Migration 101 shipped a cleanup function and suggested a pg_cron job for it,
 * but nothing ever called it: on 13 Nov 2026 production held 103,703 counters
 * going back to 30 April. A counter is only read during its own window (one
 * minute, or ten for login attempts), so everything older is dead weight.
 */

import { getDb } from "@/data/db";

/**
 * Counters older than this are removed. The longest window is ten minutes
 * (login and 2FA attempts); fifteen leaves room for clock drift.
 */
export const RATE_LIMIT_RETENTION_MS = 15 * 60 * 1000;

/** ISO timestamp before which a counter may be removed. */
export function rateLimitCutoff(nowMs: number = Date.now()): string {
  return new Date(nowMs - RATE_LIMIT_RETENTION_MS).toISOString();
}

/**
 * Delete the counters whose window is over and return how many were removed.
 * Throws when the database refuses, so the cron reports the failure.
 */
export async function purgeExpiredRateLimitCounters(nowMs: number = Date.now()): Promise<number> {
  const { count, error } = await getDb()
    .from("rate_limit_counters")
    .delete({ count: "exact" })
    .lt("created_at", rateLimitCutoff(nowMs));
  if (error) throw new Error(error.message);
  return typeof count === "number" ? count : 0;
}
