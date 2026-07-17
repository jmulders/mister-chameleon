/**
 * Cache Layer — Shared Types
 *
 * Discriminated union of all cache invalidation events dispatched by
 * POST /api/cache or by internal revalidation hooks.
 *
 * Consumed by:
 *   cache/invalidation.ts   — event handler
 *   app/api/cache/route.ts  — POST body type
 *   app/api/revalidate/route.ts — Sanity webhook → cms-content-updated
 */

// ── Invalidation events ──────────────────────────────────────────────────────

/**
 * All cache invalidation event types.
 *
 *   cms-content-updated    — Sanity content changed; flush CMS cache for tenant.
 *   tenant-config-changed  — Tenant DB settings changed; flush CMS + decision cache.
 *   session-reset          — Specific session should be evicted from session cache.
 *   full-flush             — Flush all in-process caches (optionally scoped to one tenant).
 */
export type InvalidationEvent =
  // tenantId is nullable: a CMS webhook payload may carry no tenantId, and the
  // cache layer has always handled that — pruneCmsCacheForTenant() takes
  // `string | null | undefined` and buckets it under "_". The event type said
  // `string`, so /api/revalidate could not pass its own `string | null` through.
  // Narrowing the caller instead (skip when null) would have been worse: a
  // webhook without a tenantId would then invalidate nothing at all.
  | { type: "cms-content-updated";   tenantId: string | null }
  | { type: "tenant-config-changed"; tenantId: string }
  | { type: "session-reset";         sessionId: string }
  | { type: "full-flush";            tenantId?: string };

// ── Cache stats shapes ────────────────────────────────────────────────────────

/** Generic stats snapshot returned by any simple TTL cache. */
export interface CacheStats {
  /** Total number of entries (including stale). */
  size:  number;
  /** Entries within their TTL window. */
  fresh: number;
  /** Entries past their TTL (not yet evicted). */
  stale: number;
  /** TTL in milliseconds. */
  ttlMs: number;
}

/**
 * Stats for the session enrichment cache, which uses a stale-while-revalidate
 * pattern (entries survive past TTL by an additional grace window).
 */
export interface SessionCacheStats extends CacheStats {
  /** Entries in the stale-but-still-usable grace window. */
  inGrace?: number;
  /** Grace window duration in milliseconds. */
  staleGraceMs?: number;
}
