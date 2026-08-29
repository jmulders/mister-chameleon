/**
 * Enrichment Layer — Session-Scoped Enrichment Cache
 *
 * Prevents the staged enrichment pipeline from re-running on every page view
 * within the same visitor session.  Geo, network, company, CRM, and seasonal
 * enrichments are stable for the duration of a session: the visitor's IP does
 * not change, their corporate network does not change, and public holidays
 * do not change mid-visit.
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 *
 *   On the FIRST request in a session:
 *     1. Cache miss → run the full staged enrichment pipeline.
 *     2. Store `{ enrichment, ip, tenantId, cachedAt }` keyed by sessionId.
 *     3. Return fresh enrichment.
 *
 *   On SUBSEQUENT requests in the same session (same sessionId cookie):
 *     1. Cache hit AND IP unchanged AND tenant unchanged → return cached enrichment.
 *     2. No extra API calls.
 *
 * ─── Invalidation conditions ─────────────────────────────────────────────────
 *
 *   The cache entry is invalidated (treated as a miss) when any of:
 *     • Entry does not exist (first visit in this process lifetime)
 *     • TTL has expired (default: 4 hours)
 *     • Visitor IP has changed (mobile user switching networks, VPN toggle)
 *     • Tenant has changed (multi-tenant host scenarios)
 *
 *   When invalidated, the pipeline re-runs and a fresh entry is stored.
 *
 * ─── Storage ─────────────────────────────────────────────────────────────────
 *
 *   An in-process `Map` keyed by sessionId UUID.  This means:
 *     • Cache is local to the Node.js process (not shared across Vercel replicas)
 *     • Resets on cold start — worst case is one extra pipeline run per session
 *     • No external dependency (Redis, KV, DB) required
 *
 *   This is intentional: enrichment data is cheap to re-derive after a cold
 *   start, and the operational simplicity of a process-local cache outweighs
 *   the marginal benefit of cross-replica sharing.
 *
 * ─── TTL ─────────────────────────────────────────────────────────────────────
 *
 *   4 hours.  Longer than a typical browsing session; short enough that
 *   company identity or CRM status changes within a working day are
 *   eventually reflected.
 *
 * ─── Debug ───────────────────────────────────────────────────────────────────
 *
 *   `getSessionEnrichment` returns a `CacheMiss` that includes a `reason`
 *   string so `buildDecisionContext` can emit a structured log showing
 *   why the pipeline was re-run.
 */

import type { EnrichmentOutput }  from "./types";
import type { SessionCacheStats } from "@/cache/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const _IS_DEV = process.env.NODE_ENV === "development";

/**
 * How long a session enrichment result is considered fully fresh.
 *
 * Development: 30 seconds by default so changes to IP overrides or enrichment
 *   config are visible quickly.  Override with `SESSION_CACHE_TTL_SECONDS`.
 *
 * Production: 4 hours by default — stable for a typical browsing session.
 *   Override with `SESSION_CACHE_TTL_SECONDS`.
 */
export const SESSION_TTL_MS: number = _IS_DEV
  ? Number(process.env.SESSION_CACHE_TTL_SECONDS ?? "30") * 1_000
  : Number(process.env.SESSION_CACHE_TTL_SECONDS ?? String(4 * 60 * 60)) * 1_000;

/**
 * Grace window after TTL expiry during which stale data is still served
 * immediately (stale-while-revalidate pattern).
 *
 * Within the grace window the cache returns the stale entry with
 * `stale: true` so callers can schedule a background refresh without
 * blocking the current render.  After the grace window the entry is hard-
 * evicted and the pipeline runs synchronously on the next request.
 *
 * Development: 10 seconds (short grace matches the short TTL).
 * Production:  1 hour — matches original behaviour.
 *
 * Total maximum age before hard eviction: SESSION_TTL_MS + SESSION_STALE_GRACE_MS
 */
export const SESSION_STALE_GRACE_MS: number = _IS_DEV
  ? Number(process.env.SESSION_CACHE_STALE_GRACE_SECONDS ?? "10") * 1_000
  : Number(process.env.SESSION_CACHE_STALE_GRACE_SECONDS ?? String(60 * 60)) * 1_000;

/**
 * TTL for an entry stored with `{ retry: true }` — a pipeline run that came back
 * INCOMPLETE because of a transient upstream failure (e.g. a PDOK geocode
 * timeout left the CBS location empty). Such an entry is served for this short
 * window (so we don't hammer the upstreams on every page view) and then treated
 * as a hard miss so the pipeline re-runs and gets another chance — instead of
 * pinning the empty result for the full 4h session TTL. No stale grace applies.
 *
 * Development: 15 seconds. Production: 2 minutes. Override with
 * `SESSION_CACHE_RETRY_TTL_SECONDS`.
 */
export const SESSION_RETRY_TTL_MS: number = _IS_DEV
  ? Number(process.env.SESSION_CACHE_RETRY_TTL_SECONDS ?? "15") * 1_000
  : Number(process.env.SESSION_CACHE_RETRY_TTL_SECONDS ?? String(2 * 60)) * 1_000;

// ── Internal store ────────────────────────────────────────────────────────────

interface SessionEnrichmentEntry {
  enrichment: Partial<EnrichmentOutput>;
  /** IP address at the time of caching — used for change detection. */
  ip:         string | null;
  /** Tenant ID at the time of caching — invalidated on tenant switch. */
  tenantId:   string | null;
  /** `Date.now()` timestamp when the entry was stored. */
  cachedAt:   number;
  /**
   * True when this entry came from an INCOMPLETE pipeline run (a transient
   * upstream failure). Such entries use the short `SESSION_RETRY_TTL_MS` and get
   * no stale grace, so the pipeline re-runs soon and can fill in the missing data.
   */
  retry?:     boolean;
}

/** Module-level store — survives hot reloads in dev, resets on cold start. */
const store = new Map<string, SessionEnrichmentEntry>();

// ── Public API ────────────────────────────────────────────────────────────────

/** A fresh (or stale-but-usable) cache entry. */
export type SessionCacheHit = {
  hit:        true;
  enrichment: Partial<EnrichmentOutput>;
  /**
   * True when the entry has passed its TTL but is still within the stale
   * grace window (stale-while-revalidate pattern).
   *
   * When `stale` is true, callers should serve the stale enrichment
   * immediately for the current render and schedule a fire-and-forget
   * background pipeline refresh to repopulate the cache.  This avoids
   * blocking the render on a full enrichment pipeline run just because
   * the TTL expired.
   *
   * Callers can detect staleness with:
   *   if (result.hit && result.stale) scheduleBackgroundRefresh(sessionId);
   */
  stale?: boolean;
};

/**
 * A cache miss with a reason for why the pipeline must run.
 * Used in debug logs to explain cache misses.
 */
export type SessionCacheMiss = {
  hit:    false;
  /**
   * Why the cache was not used:
   *   "no-entry"       — first request in this process for this session
   *   "ttl-expired"    — TTL exceeded and beyond the stale grace window;
   *                      entry hard-evicted
   *   "ip-changed"     — visitor IP changed (network switch / VPN toggle)
   *   "tenant-changed" — serving a different tenant than when cached
   */
  reason: "no-entry" | "ttl-expired" | "ip-changed" | "tenant-changed";
};

export type SessionCacheResult = SessionCacheHit | SessionCacheMiss;

/**
 * Attempt to retrieve cached enrichment output for a session.
 *
 * Checks staleness and invalidation conditions.  Returns a discriminated
 * union so callers can branch cleanly on hit vs miss and log the reason.
 *
 * @param sessionId     UUID from the `mc_session_id` cookie.
 * @param currentIp     IP address extracted from the current request headers.
 * @param currentTenantId  Tenant ID for the current request.
 */
export function getSessionEnrichment(
  sessionId:         string,
  currentIp:         string | null,
  currentTenantId:   string | null,
): SessionCacheResult {
  const entry = store.get(sessionId);

  // ── No entry ────────────────────────────────────────────────────────────────
  if (!entry) {
    return { hit: false, reason: "no-entry" };
  }

  // ── TTL check (stale-while-revalidate) ─────────────────────────────────────
  //
  // Two-stage expiry:
  //   1. Within SESSION_TTL_MS           → fresh hit (stale: undefined)
  //   2. Within SESSION_STALE_GRACE_MS   → stale hit (stale: true); caller
  //      should schedule a background refresh
  //   3. Beyond SESSION_STALE_GRACE_MS   → hard evict → pipeline must re-run
  //
  // This avoids blocking a render on a full pipeline run just because the
  // TTL expired by a few minutes.  The next background refresh repopulates
  // the cache and the entry becomes fresh again.
  const age = Date.now() - entry.cachedAt;

  // ── Retry entry (incomplete run) — short TTL, no stale grace ─────────────────
  // An entry from a transient-failure run is served only briefly, then hard-
  // evicted so the pipeline re-runs and gets another chance to resolve the miss.
  if (entry.retry) {
    if (age > SESSION_RETRY_TTL_MS) {
      store.delete(sessionId);
      return { hit: false, reason: "ttl-expired" };
    }
    // Within the short window: fall through to IP/tenant checks, serve fresh.
  } else {
    if (age > SESSION_TTL_MS + SESSION_STALE_GRACE_MS) {
      // Beyond grace window — hard evict.
      store.delete(sessionId);
      return { hit: false, reason: "ttl-expired" };
    }
    if (age > SESSION_TTL_MS) {
      // Stale but within grace window — serve stale, signal caller to refresh.
      return { hit: true, enrichment: entry.enrichment, stale: true };
    }
  }

  // ── IP change detection ──────────────────────────────────────────────────────
  // Only invalidate when BOTH the cached IP and the current IP are known
  // (non-null) — avoids spurious invalidation when the IP is missing in
  // some edge environments.
  if (entry.ip && currentIp && entry.ip !== currentIp) {
    store.delete(sessionId);
    return { hit: false, reason: "ip-changed" };
  }

  // ── Tenant change detection ──────────────────────────────────────────────────
  if (entry.tenantId && currentTenantId && entry.tenantId !== currentTenantId) {
    store.delete(sessionId);
    return { hit: false, reason: "tenant-changed" };
  }

  return { hit: true, enrichment: entry.enrichment };
}

/**
 * Store enrichment output for a session.
 *
 * Overwrites any existing entry for the given sessionId.
 * Call this after the staged pipeline completes with a fresh result.
 *
 * @param sessionId   UUID from the `mc_session_id` cookie.
 * @param enrichment  The merged pipeline output to cache.
 * @param ip          IP address at the time of caching (for change detection).
 * @param tenantId    Tenant ID at the time of caching (for tenant-change invalidation).
 */
export function setSessionEnrichment(
  sessionId: string,
  enrichment: Partial<EnrichmentOutput>,
  ip:         string | null,
  tenantId:   string | null,
  opts?:      { retry?: boolean },
): void {
  store.set(sessionId, {
    enrichment,
    ip,
    tenantId,
    cachedAt: Date.now(),
    ...(opts?.retry ? { retry: true } : {}),
  });
}

/**
 * Explicitly invalidate the session enrichment cache for a session.
 *
 * Call this when a debug/refresh action is requested, or when the
 * pipeline must be forced to re-run for a specific session.
 */
export function invalidateSessionEnrichment(sessionId: string): void {
  store.delete(sessionId);
}

/**
 * Flush all session enrichment entries immediately.
 *
 * Used by the full-flush invalidation event and the admin /api/cache route.
 * In production this discards enrichment data for every active session in
 * this process — the next request per session will re-run the pipeline.
 */
export function flushAllSessionEnrichment(): void {
  store.clear();
}

/**
 * Return an aggregated occupancy snapshot for the admin/debug API.
 *
 * Mirrors the `CacheStats` shape used by other in-process cache layers, plus
 * the session-specific `inGrace` counter and `staleGraceMs` duration.
 */
export function getSessionEnrichmentStats(): SessionCacheStats {
  const now = Date.now();
  let fresh   = 0;
  let stale   = 0;
  let inGrace = 0;
  for (const entry of store.values()) {
    const age = now - entry.cachedAt;
    if (age <= SESSION_TTL_MS) {
      fresh++;
    } else if (age <= SESSION_TTL_MS + SESSION_STALE_GRACE_MS) {
      stale++;
      inGrace++;
    } else {
      stale++;
    }
  }
  return {
    size:         store.size,
    fresh,
    stale,
    ttlMs:        SESSION_TTL_MS,
    inGrace,
    staleGraceMs: SESSION_STALE_GRACE_MS,
  };
}

/**
 * Return cache diagnostic metadata for a session.
 * Used in debug mode to show cache state in the observability overlay.
 */
export function getSessionEnrichmentMeta(sessionId: string): {
  exists:        boolean;
  cachedAt:      number | null;
  ageMs:         number | null;
  ttlMs:         number;
  staleGraceMs:  number;
  isStale:       boolean;
  ip:            string | null;
  tenantId:      string | null;
} {
  const entry = store.get(sessionId);
  if (!entry) {
    return {
      exists:       false,
      cachedAt:     null,
      ageMs:        null,
      ttlMs:        SESSION_TTL_MS,
      staleGraceMs: SESSION_STALE_GRACE_MS,
      isStale:      false,
      ip:           null,
      tenantId:     null,
    };
  }
  const ageMs = Date.now() - entry.cachedAt;
  return {
    exists:       true,
    cachedAt:     entry.cachedAt,
    ageMs,
    ttlMs:        SESSION_TTL_MS,
    staleGraceMs: SESSION_STALE_GRACE_MS,
    isStale:      ageMs > SESSION_TTL_MS,
    ip:           entry.ip,
    tenantId:     entry.tenantId,
  };
}
