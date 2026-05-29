/**
 * Debug Cache Flush — Provider cache invalidation for debug/reset operations.
 *
 * Exports a single `flushAllProviderCaches()` function that atomically clears
 * every in-process enrichment provider cache.  Called from:
 *
 *   • POST /api/debug/reset-session — when the developer clicks "Reset session"
 *     in Scenario Control, ensuring the post-reset page load performs fresh
 *     enrichment API calls rather than serving stale TTL-cached data.
 *
 *   • handleInvalidation({ type: "full-flush" }) — in the admin-triggered
 *     full-flush path so that operator-initiated flushes also cover providers.
 *
 * ─── Why provider caches must be flushed on reset ─────────────────────────────
 *
 *   The context pipeline has two cache tiers:
 *
 *   1. Session enrichment cache (keyed by sessionId)
 *      → Naturally bypassed by a new sessionId after reset ✓
 *
 *   2. Provider caches (keyed by IP or query string, 1–6 h TTLs):
 *      Leadinfo    — 1 h, keyed by IP
 *      IPinfo      — 1 h, keyed by IP
 *      OpenKvK     — 6 h, keyed by company query
 *      Seasonal    — 24 h, keyed by country/year
 *      GA4 History — 30 min, keyed internally
 *      RevGeocode  — configurable, keyed by lat/lng
 *
 *   After a session reset the server generates a new sessionId — bypassing the
 *   session enrichment cache.  But the enrichment pipeline calls each provider,
 *   which reads from its own IP-keyed cache.  The new session gets the exact
 *   same enrichment as the old session because the developer's IP hasn't changed.
 *   From the Debug panel's perspective, context variables appear "stuck".
 *
 *   Flushing provider caches forces every enrichment provider to re-run a live
 *   API call on the next request, producing genuinely fresh context values.
 *
 * ─── Scope ─────────────────────────────────────────────────────────────────────
 *
 *   In development there is at most one developer — flushing all caches is safe.
 *   In production the reset endpoint requires `ENABLE_DEBUG_RESET=true`, so this
 *   function is never called in a live multi-user environment unless opted in.
 *
 * ─── Import safety ─────────────────────────────────────────────────────────────
 *
 *   `import "server-only"` prevents this module from being imported in Client
 *   Components or Edge runtime code.  All provider caches live in Node.js module
 *   scope and are safe to call from any Server Component or route handler.
 */

import "server-only";

import { flushLeadinfoProviderCache }       from "./providers/leadinfo";
import { flushIpInfoProviderCache }         from "./providers/ipinfo";
import { flushOpenKvKProviderCache }        from "./providers/openkvk";
import { flushSeasonalEventProviderCache }  from "./providers/seasonal-event";
import { flushGa4HistoryProviderCache }     from "./providers/ga4-history";
import { flushReverseGeocodeProviderCache } from "./providers/reverse-geocode";

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Flush every in-process enrichment provider cache.
 *
 * After this call the next enrichment request will perform fresh API calls for
 * all providers, bypassing all TTL-based caching.  The caches will re-populate
 * from live API responses on the first post-flush request.
 *
 * This is intentionally synchronous — all provider caches are in-memory Maps
 * or ProviderCache instances; `.flush()` / `.clear()` are O(1) operations.
 */
export function flushAllProviderCaches(): void {
  flushLeadinfoProviderCache();       // IP-keyed, 1 h TTL
  flushIpInfoProviderCache();         // IP-keyed, 1 h TTL
  flushOpenKvKProviderCache();        // query-keyed, 6 h TTL
  flushSeasonalEventProviderCache();  // country/year-keyed, 24 h TTL
  flushGa4HistoryProviderCache();     // internally keyed, 30 min TTL
  flushReverseGeocodeProviderCache(); // lat/lng-keyed, configurable TTL
}
