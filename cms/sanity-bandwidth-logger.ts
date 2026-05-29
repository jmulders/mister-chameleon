/**
 * cms/sanity-bandwidth-logger.ts
 *
 * Lightweight Sanity API call logger that provides visibility into bandwidth
 * usage by feature area.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   Sanity's bandwidth quota is exhausted.  To understand *which part of the
 *   app* is responsible, every Sanity fetch should be labelled with its call
 *   site so we can trace volume in server logs.
 *
 *   This module is intentionally simple — it logs to the existing `logger`
 *   instance (structured JSON in production, human-readable in dev) and
 *   maintains an in-process call counter per feature area for quick diagnostics.
 *
 * ─── How to use ───────────────────────────────────────────────────────────────
 *
 *   Call `logSanityFetch(label, details?)` immediately before or inside each
 *   Sanity fetch.  The label should identify the call site:
 *
 *     "SanityProvider/getSiteSettings"
 *     "SanityProvider/getPageBySlug"
 *     "SanityProvider/getHeroVariant"
 *     "SanitySearchProvider/search"
 *     "fetchAllVariantCandidates"
 *
 *   In production, the logger writes one JSON line per call to stdout (picked
 *   up by Vercel / any structured log aggregator).  Filter by:
 *
 *     { "feature": "sanity-fetch" }
 *
 *   to see all Sanity API calls with their label, tenant, and query type.
 *
 * ─── Counter API ──────────────────────────────────────────────────────────────
 *
 *   `getSanityCallCounts()` returns a snapshot of per-label call counts since
 *   the current process started.  Useful for health-check endpoints and
 *   debugging.  Counters are NOT reset between requests — they accumulate for
 *   the lifetime of the server process.
 */

import { logger } from "@/lib/logger";

// ── Per-label counters ────────────────────────────────────────────────────────
//
// Tracks how many Sanity API calls have been made per label since process start.
// In serverless environments each cold start resets these counts, so they
// represent per-instance totals rather than global totals.

const _callCounts = new Map<string, number>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Log a Sanity API fetch with its call site label.
 *
 * Call this once per Sanity `client.fetch()` invocation.  The logger is
 * invoked at `debug` level in production (no noise in normal logs) and at
 * `info` level in development so call sites are visible during local testing.
 *
 * @param label    Call-site identifier, e.g. "SanityProvider/getHeroVariant"
 * @param details  Optional structured metadata to include in the log line
 *                 (e.g. { tenantId, key, cacheHit: false })
 */
export function logSanityFetch(
  label:   string,
  details: Record<string, unknown> = {},
): void {
  // Increment per-label counter
  _callCounts.set(label, (_callCounts.get(label) ?? 0) + 1);

  const count = _callCounts.get(label)!;

  // In development, log at info level so calls are visible in the terminal.
  // In production, use debug so they only appear when debug logging is enabled.
  if (process.env.NODE_ENV === "development") {
    logger.info(`[sanity-bandwidth] ${label}`, {
      feature:       "sanity-fetch",
      label,
      callCount:     count,
      ...details,
    });
  } else {
    logger.debug(`[sanity-bandwidth] ${label}`, {
      feature:   "sanity-fetch",
      label,
      callCount: count,
      ...details,
    });
  }
}

/**
 * Returns a snapshot of Sanity API call counts by label since process start.
 *
 * Useful for health-check pages and admin diagnostics:
 *
 *   const counts = getSanityCallCounts();
 *   // { "SanityProvider/getSiteSettings": 42, "SanityProvider/getPageBySlug": 10 }
 */
export function getSanityCallCounts(): Record<string, number> {
  return Object.fromEntries(_callCounts.entries());
}

/**
 * Returns the total number of Sanity API calls made since process start.
 */
export function getTotalSanityCallCount(): number {
  let total = 0;
  for (const count of _callCounts.values()) total += count;
  return total;
}
