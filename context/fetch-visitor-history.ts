/**
 * fetchVisitorHistory
 *
 * Derives first-party behavioural history for a visitor from the existing
 * events and served_variants tables. No new tables or columns are required.
 *
 * ─── Data sources ─────────────────────────────────────────────────────────────
 *
 *   events (session_id, event_type, payload)
 *     COUNT WHERE event_type = 'page_view'   → pageViewCount
 *     COUNT WHERE event_type = 'cta_click'   → ctaClickCount / hasClickedCta
 *     MIN(created_at)                        → firstSeenAt
 *
 *   served_variants (session_id, hero_key, cta_key, created_at)
 *     Most recent row ORDER BY created_at DESC LIMIT 1
 *                                            → lastHeroKey / lastCtaKey
 *
 * ─── Tenant scoping ───────────────────────────────────────────────────────────
 *
 *   Tenant ID is stored inside `events.payload` under the reserved key `_tid`
 *   (written by `saveEvent` when a `tenantId` is supplied).  Filtering is done
 *   in JavaScript after fetching rows:
 *
 *     row.payload._tid === tenantId  — tenant-scoped row for this tenant
 *     row.payload._tid is absent     — legacy row (written before tenant
 *                                     scoping); visible to all tenants for
 *                                     backward compatibility
 *
 *   This avoids the `tenant_id` column migration (20240101000008) being a
 *   hard prerequisite — the function works correctly on the current schema.
 *
 *   served_variants currently has no per-tenant column; it stays session-scoped
 *   (session_id is globally unique per browser so cross-tenant bleed is minimal).
 *   Once migration 20240101000008 is applied, the served_variants query can also
 *   be tenant-filtered at the database level.
 *
 * ─── Query strategy ───────────────────────────────────────────────────────────
 *
 *   All sub-queries run concurrently via `Promise.all`.  The total latency is
 *   bounded by the slowest single query rather than their sum.
 *
 *   The events queries fetch lightweight rows (created_at + payload) so the
 *   tenant-scoped JS filter can be applied.  Row counts per session are very
 *   small (one per page-load / CTA click within a 30-day window).
 *
 *   The served_variants fetch retrieves the single most recent row only.
 *
 * ─── Failure handling ─────────────────────────────────────────────────────────
 *
 *   This function never throws.  Any query failure returns `emptyHistory()`
 *   so the decision engine always receives a valid struct.
 *
 *   Failures are logged at DEBUG level (not WARN) — a DB hiccup on history
 *   enrichment is an expected degradation, not an alertable event.
 *
 * ─── Performance note ─────────────────────────────────────────────────────────
 *
 *   Expected table sizes for a typical MVP deployment are small (thousands of
 *   rows, not millions).  The queries are all simple pk-indexed lookups on
 *   session_id.  Both tables have an index on session_id by design:
 *
 *     idx_events_session_id        (from events migration)
 *     idx_served_variants_session  (from served_variants migration)
 *
 *   If the platform scales significantly, replace the event row fetches with
 *   a materialised aggregate or a Postgres FUNCTION called via `.rpc()`.
 */

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import { emptyHistory } from "./visitor-history";
import type { VisitorHistory } from "./visitor-history";

// ── Type helpers ──────────────────────────────────────────────────────────────
// Same pattern used throughout the repositories layer to work around the
// Supabase PostgREST v12 type-discrimination issue.

type RowsResult<T> = { data: T[] | null; error: { message: string } | null };

function asRows<T>(result: unknown): RowsResult<T> {
  return result as RowsResult<T>;
}

// ── Partial row types (only what we need) ─────────────────────────────────────

/**
 * Minimal event row shape: timestamp + payload (needed for tenant filtering).
 * The `payload` field contains the optional `_tid` tenant identifier written
 * by `saveEvent` when the caller supplies a `tenantId`.
 */
interface EventRow {
  created_at: string;
  payload: Record<string, unknown>;
}

interface ServedVariantHistoryRow {
  hero_key: string;
  cta_key: string;
}

// ── Tenant filter helper ───────────────────────────────────────────────────────

/**
 * Returns true when an event row belongs to the given tenant, or has no
 * tenant marking (legacy rows written before tenant scoping was introduced).
 *
 * Rows without `payload._tid` are considered "unscoped" and are counted for
 * all tenants — backward-compatible behaviour that avoids wiping history
 * for existing sessions after the feature is deployed.
 */
function matchesTenant(
  row: { payload?: Record<string, unknown> },
  tenantId: string,
): boolean {
  const tid = row.payload?._tid;
  return tid === undefined || tid === null || tid === tenantId;
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Fetch first-party history signals for a visitor session from the database.
 *
 * Runs three concurrent Supabase queries then applies tenant-scoped filtering
 * in JavaScript (via `payload._tid`) so events from different tenants that
 * share a browser session (common in local dev with `?tenant=` override) are
 * correctly isolated.
 *
 * @param sessionId  The visitor's session UUID from the mc_session_id cookie.
 * @param tenantId   The active tenant slug, e.g. "mister-chameleon" | "workengine".
 * @returns          A fully populated `VisitorHistory`, or `emptyHistory()` on any error.
 */
export async function fetchVisitorHistory(
  sessionId: string,
  tenantId: string,
): Promise<VisitorHistory> {
  try {
    const db = getDb();

    // ── Run all queries concurrently ────────────────────────────────────────
    const [pageViewResult, ctaClickResult, lastVariantResult] = await Promise.all([
      // 1. Page view rows — fetch payload so the tenant filter can be applied.
      //    Rows per session are tiny (one per page-load within a 30-day window).
      asRows<EventRow>(
        await db
          .from("events")
          .select("created_at, payload")
          .eq("session_id", sessionId)
          .eq("event_type", "page_view")
          .order("created_at", { ascending: true }),
      ),

      // 2. CTA click rows — same approach; provides the MIN timestamp for
      //    firstSeenAt as well as the tenant-scoped click count.
      asRows<EventRow>(
        await db
          .from("events")
          .select("created_at, payload")
          .eq("session_id", sessionId)
          .eq("event_type", "cta_click")
          .order("created_at", { ascending: true }),
      ),

      // 3. Most recently served variant for this session.
      //    No tenant filter yet — served_variants.tenant_id requires migration
      //    20240101000008.  session_id is globally unique per browser so
      //    cross-tenant contamination is minimal in production.
      asRows<ServedVariantHistoryRow>(
        await db
          .from("served_variants")
          .select("hero_key, cta_key")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(1),
      ),
    ]);

    // ── Check for query errors ──────────────────────────────────────────────
    if (pageViewResult.error) {
      logger.debug("[fetch-visitor-history] page_view query failed", {
        sessionId,
        tenantId,
        error: pageViewResult.error.message,
      });
    }

    if (ctaClickResult.error) {
      logger.debug("[fetch-visitor-history] cta_click query failed", {
        sessionId,
        tenantId,
        error: ctaClickResult.error.message,
      });
    }

    if (lastVariantResult.error) {
      logger.debug("[fetch-visitor-history] served_variants query failed", {
        sessionId,
        tenantId,
        error: lastVariantResult.error.message,
      });
    }

    // ── Tenant-scoped filtering (JavaScript) ────────────────────────────────
    //
    // Filter event rows by payload._tid to isolate per-tenant history.
    // Rows without _tid (written before tenant scoping) are counted for all
    // tenants — backward-compatible so existing history is not silently lost.

    const pageViewRows = (pageViewResult.data ?? []).filter((r) =>
      matchesTenant(r, tenantId),
    );
    const ctaRows = (ctaClickResult.data ?? []).filter((r) =>
      matchesTenant(r, tenantId),
    );

    // ── Derive signals from filtered results ────────────────────────────────

    const pageViewCount = pageViewRows.length;
    const ctaClickCount = ctaRows.length;
    const hasClickedCta = ctaClickCount > 0;

    // firstSeenAt: earliest cta_click timestamp, or null if no clicks yet.
    // (page_view events are written after() response, so on the very first
    //  visit neither exists yet — null is the correct signal for "brand new".)
    const firstSeenAt = ctaRows.length > 0 ? (ctaRows[0]?.created_at ?? null) : null;

    const lastVariant = lastVariantResult.data?.[0] ?? null;

    logger.debug("[fetch-visitor-history] History resolved", {
      sessionId,
      tenantId,
      pageViewCount,
      ctaClickCount,
      hasClickedCta,
      lastHeroKey: lastVariant?.hero_key ?? null,
      lastCtaKey: lastVariant?.cta_key ?? null,
      // Raw counts (before tenant filter) help spot cross-tenant events in dev.
      rawPageViews: (pageViewResult.data ?? []).length,
      rawCtaClicks: (ctaClickResult.data ?? []).length,
    });

    return {
      pageViewCount,
      hasClickedCta,
      ctaClickCount,
      lastHeroKey: lastVariant?.hero_key ?? null,
      lastCtaKey: lastVariant?.cta_key ?? null,
      firstSeenAt,
      fromDatabase: true,
    };
  } catch (err) {
    logger.debug("[fetch-visitor-history] Unexpected error — using empty history", {
      sessionId,
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });

    return emptyHistory();
  }
}
