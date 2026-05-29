/**
 * Cache Layer — Invalidation Handler
 *
 * Central dispatcher for all cache invalidation events.  Receives an
 * `InvalidationEvent` and fans out the eviction calls to every in-process
 * cache layer that holds data affected by that event type.
 *
 * ─── Event types ─────────────────────────────────────────────────────────────
 *
 *   cms-content-updated    — A Sanity document changed.
 *                            Evict: CMS cache for the affected tenant.
 *
 *   tenant-config-changed  — Tenant DB settings changed (theme, features, etc.).
 *                            Evict: CMS cache + decision cache for the tenant.
 *
 *   session-reset          — A specific session should be treated as fresh.
 *                            Evict: session enrichment cache + decision cache
 *                            for the given sessionId.
 *
 *   full-flush             — Nuclear option; clears all in-process caches.
 *                            Optional tenantId: scoped flush where possible;
 *                            session cache is always fully cleared.
 *
 * ─── Callers ─────────────────────────────────────────────────────────────────
 *
 *   app/api/cache/route.ts              — POST /api/cache
 *   app/api/revalidate/route.ts         — Sanity webhook
 *   app/api/debug/reset-session/route.ts
 *   app/api/debug/reset-session-full/route.ts
 */

import type { InvalidationEvent } from "./types";
import {
  pruneCmsCacheForTenant,
  flushAllCmsCache,
} from "./cms-cache";
import {
  pruneDecisionCacheForTenant,
  pruneDecisionCacheForSession,
  flushAllDecisionCache,
} from "./decision-cache";
import {
  invalidateSessionEnrichment,
  flushAllSessionEnrichment,
} from "@/enrichment/session-enrichment-cache";

/**
 * Dispatch a cache invalidation event.
 *
 * All operations are synchronous (in-process Map mutations).  The function is
 * declared async so callers can `await` it without change if the implementation
 * is later upgraded to broadcast across replicas.
 */
export async function handleInvalidation(event: InvalidationEvent): Promise<void> {
  switch (event.type) {
    case "cms-content-updated": {
      // Content changed in Sanity — flush the CMS variant/singleton/slug cache
      // for this tenant so the next request fetches fresh data.
      pruneCmsCacheForTenant(event.tenantId);
      break;
    }

    case "tenant-config-changed": {
      // Tenant settings changed — flush both the CMS cache (site settings, page
      // documents may have changed) and the decision cache (rules / experiments
      // may behave differently after config changes).
      pruneCmsCacheForTenant(event.tenantId);
      pruneDecisionCacheForTenant(event.tenantId);
      break;
    }

    case "session-reset": {
      // A specific session should be re-evaluated from scratch.
      // Evict both the session enrichment result and any cached decision plans.
      invalidateSessionEnrichment(event.sessionId);
      pruneDecisionCacheForSession(event.sessionId);
      break;
    }

    case "full-flush": {
      if (event.tenantId) {
        // Scoped flush: CMS and decision cache can be pruned by tenant;
        // session enrichment cache has no tenant-scoped flush, so skip it.
        pruneCmsCacheForTenant(event.tenantId);
        pruneDecisionCacheForTenant(event.tenantId);
      } else {
        // Full flush: evict everything.
        flushAllCmsCache();
        flushAllDecisionCache();
        flushAllSessionEnrichment();
      }
      break;
    }

    default: {
      // Exhaustiveness guard — TypeScript will error if a new event type is
      // added to the union without being handled here.
      const _exhaustive: never = event;
      console.warn("[cache/invalidation] Unknown event type:", (_exhaustive as InvalidationEvent).type);
    }
  }
}
