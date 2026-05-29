/**
 * Cache Layer — Stats Registry
 *
 * Aggregates point-in-time stats from every in-process cache layer into a
 * single response object.  Consumed by GET /api/cache to expose cache
 * observability without requiring direct access to each module.
 *
 * ─── Included layers ──────────────────────────────────────────────────────────
 *
 *   cmsCache       — variant / singleton / slug fetches from Sanity
 *   decisionCache  — resolved ExperiencePlan per (sessionId, contextHash)
 *   sessionCache   — staged enrichment pipeline results per sessionId
 *
 * ─── Provider caches ─────────────────────────────────────────────────────────
 *
 *   Per-provider ProviderCache instances (leadinfo, openkvk, etc.) are
 *   reported under `providerCaches`.  Each provider that uses `ProviderCache`
 *   should register itself via `registerProviderCache`.
 */

import type { CacheStats, SessionCacheStats } from "./types";
import { getCmsCacheStats,       CMS_CACHE_TTL_MS      } from "./cms-cache";
import { getDecisionCacheStats,  DECISION_CACHE_TTL_MS  } from "./decision-cache";
import { getSessionEnrichmentStats }                       from "@/enrichment/session-enrichment-cache";
import type { ProviderCacheStats }                         from "@/enrichment/provider-cache";

// ── Provider cache registry ────────────────────────────────────────────────────

const _providerRegistrations = new Map<string, () => ProviderCacheStats>();

/**
 * Register a ProviderCache instance so it appears in the stats response.
 * Call this once at module initialisation inside each enrichment provider module.
 *
 * @example
 * registerProviderCache("leadinfo", () => leadinfoCache.getStats());
 */
export function registerProviderCache(
  name:     string,
  getStats: () => ProviderCacheStats,
): void {
  _providerRegistrations.set(name, getStats);
}

// ── Aggregated stats ──────────────────────────────────────────────────────────

export interface AllCacheStats {
  generatedAt:    string;
  cmsCache:       CacheStats;
  decisionCache:  CacheStats;
  sessionCache:   SessionCacheStats;
  providerCaches: Record<string, ProviderCacheStats>;
}

/**
 * Returns a point-in-time snapshot of all in-process cache layers.
 *
 * Always fresh — this function is never itself cached.
 */
export function getAllCacheStats(): AllCacheStats {
  const rawCms      = getCmsCacheStats();
  const rawDecision = getDecisionCacheStats();
  const rawSession  = getSessionEnrichmentStats();

  const cmsCache: CacheStats = {
    size:  rawCms.size,
    fresh: rawCms.fresh,
    stale: rawCms.stale,
    ttlMs: CMS_CACHE_TTL_MS,
  };

  const decisionCache: CacheStats = {
    size:  rawDecision.size,
    fresh: rawDecision.fresh,
    stale: rawDecision.stale,
    ttlMs: DECISION_CACHE_TTL_MS,
  };

  const sessionCache: SessionCacheStats = {
    size:         rawSession.size,
    fresh:        rawSession.fresh,
    stale:        rawSession.stale,
    ttlMs:        rawSession.ttlMs,
    inGrace:      rawSession.inGrace,
    staleGraceMs: rawSession.staleGraceMs,
  };

  const providerCaches: Record<string, ProviderCacheStats> = {};
  for (const [name, getStats] of _providerRegistrations.entries()) {
    try {
      providerCaches[name] = getStats();
    } catch {
      // Don't let one broken provider crash the stats endpoint.
      providerCaches[name] = { size: 0, fresh: 0, stale: 0, ttlMs: 0 };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    cmsCache,
    decisionCache,
    sessionCache,
    providerCaches,
  };
}
