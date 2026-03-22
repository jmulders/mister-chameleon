/**
 * Analytics Repository
 *
 * Read-only aggregate queries for the internal dashboard.
 * All functions return summary statistics derived from the three core tables:
 *   sessions · served_variants · events
 *
 * ─── Design notes ─────────────────────────────────────────────────────────────
 *
 *   Counts use PostgREST's built-in `{ count: "exact", head: true }` option
 *   which issues a single COUNT(*) against the database — no rows fetched.
 *
 *   GROUP BY aggregations are performed in application code by fetching only
 *   the relevant column(s) and reducing. This is appropriate for the MVP
 *   data volumes expected here. If row counts grow large, replace with
 *   Postgres functions called via `.rpc()`.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Follows the same `RepositoryResult<T>` pattern as all other repositories:
 *   never throws; callers check `.ok`.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { fetchDashboardMetrics } from "@/data/repositories/analytics-repository";
 *
 *   const metrics = await fetchDashboardMetrics();
 *   if (!metrics.ok) return <ErrorState message={metrics.error} />;
 *   const { pageViews, ctaClicks } = metrics.data;
 */

import { getDb } from "../db";
import { logger } from "@/lib/logger";
import type { RepositoryResult } from "./sessions-repository";
import type { SessionRow, ServedVariantRow, EventRow } from "../types";

// ── Tenant filtering helper ────────────────────────────────────────────────────
//
// Mirrors the same helper in context/fetch-visitor-history.ts.
// A row "matches" a tenant when:
//   - payload._tid === tenantId (event was written with this tenant's ID), OR
//   - payload._tid is absent / null (legacy row pre-dating tenant scoping)
//
// This lets us progressively add tenant context without losing historical data.
// Once migration 20240101000008 is applied and a dedicated tenant_id column
// exists on the events table, this can be replaced with a server-side filter.

function matchesTenant(
  row: { payload?: Record<string, unknown> | null },
  tenantId: string,
): boolean {
  const payload = row.payload as Record<string, unknown> | null | undefined;
  const tid = payload?.["_tid"];
  return tid === undefined || tid === null || tid === tenantId;
}

// ── Typed query helpers ────────────────────────────────────────────────────────
//
// The hand-authored Database type in data/types.ts does not include the
// `PostgrestVersion` discriminant that @supabase/supabase-js v2 needs to fully
// resolve column-level types from `.select()`. As a result, unadorned
// `.select()` calls produce `data: never[] | null` in strict mode. This is the
// same root cause as the pre-existing insert errors elsewhere in the repo.
//
// Workaround: assert the query result to the known Row type immediately.
// This is safe because the Database.Tables schema IS correct — the mismatch is
// purely in the library's generic arity, not the actual data shape.

type SupabaseSelectResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

function asRows<T>(result: unknown): SupabaseSelectResult<T> {
  return result as SupabaseSelectResult<T>;
}

// ── Output types ───────────────────────────────────────────────────────────────

/** A ranked row from any GROUP BY aggregation. */
export interface RankedRow {
  /** The grouped value (e.g. "linkedin", "hero_google_problem"). */
  value: string;
  /** Count of rows with this value. */
  count: number;
}

/** All metrics surfaced on the dashboard overview page. */
export interface DashboardMetrics {
  /** Total "page_view" events recorded. */
  pageViews: number;
  /** Total "cta_click" events recorded. */
  ctaClicks: number;
  /** Total rows in served_variants (one per page render that reached decision). */
  servedVariantsTotal: number;
  /** Top traffic sources by session count, descending. */
  topSources: RankedRow[];
  /** Top hero variant keys by serve count, descending. */
  topHeroVariants: RankedRow[];
  /** Top CTA variant keys by serve count, descending. */
  topCtaVariants: RankedRow[];
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Aggregates an array of single-column string values into a ranked list.
 * Groups by value, sorts by count descending, and trims to `limit`.
 */
function rankByFrequency(values: string[], limit: number): RankedRow[] {
  const counts: Record<string, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ── Atomic queries ─────────────────────────────────────────────────────────────

/**
 * Counts events by type using a server-side COUNT(*) (no rows fetched).
 * Use `countEventsByTypeTenantScoped` when a tenantId filter is required.
 */
async function countEventsByType(
  eventType: string,
): Promise<RepositoryResult<number>> {
  const { count, error } = await getDb()
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("event_type", eventType);

  if (error) {
    logger.error("[analytics-repository] countEventsByType failed", {
      error: error.message,
      eventType,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data: count ?? 0 };
}

/**
 * Counts events by type for a specific tenant.
 *
 * Fetches matching rows and filters in application code using `matchesTenant`
 * (checks `payload._tid` key) because the `tenant_id` DB column from migration
 * 20240101000008 is not yet applied to the live project.
 *
 * Includes legacy rows where `payload._tid` is absent — these were recorded
 * before tenant scoping was added and are treated as belonging to all tenants.
 *
 * @param eventType  The event_type string to count.
 * @param tenantId   Tenant slug to filter by (e.g. "workengine").
 */
async function countEventsByTypeTenantScoped(
  eventType: string,
  tenantId: string,
): Promise<RepositoryResult<number>> {
  // Fetch all rows for this event type — we need payload for JS-side filtering.
  // Capped at 50 000 as a safety guard; at MVP volumes this is well above any
  // realistic event count and still finishes in a single round-trip.
  const { data, error } = asRows<Pick<EventRow, "payload">>(
    await getDb()
      .from("events")
      .select()
      .eq("event_type", eventType)
      .limit(50_000),
  );

  if (error) {
    logger.error("[analytics-repository] countEventsByTypeTenantScoped failed", {
      error: error.message,
      eventType,
      tenantId,
    });
    return { ok: false, error: error.message };
  }

  const count = (data ?? []).filter((row) => matchesTenant(row, tenantId)).length;
  return { ok: true, data: count };
}

/**
 * Counts all rows in served_variants using a server-side COUNT(*).
 */
async function countServedVariants(): Promise<RepositoryResult<number>> {
  const { count, error } = await getDb()
    .from("served_variants")
    .select("*", { count: "exact", head: true });

  if (error) {
    logger.error("[analytics-repository] countServedVariants failed", {
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  return { ok: true, data: count ?? 0 };
}

/**
 * Fetches all session source values and returns ranked counts.
 *
 * Uses `.select()` (all columns) rather than `.select("source")` to work
 * around the pre-existing Supabase type narrowing bug where a column-list
 * select produces `never[]` for the data type. Consistent with the pattern
 * used throughout the other repositories in this codebase.
 */
async function getTopSources(
  limit: number,
): Promise<RepositoryResult<RankedRow[]>> {
  const { data, error } = asRows<Pick<SessionRow, "source">>(
    await getDb().from("sessions").select(),
  );

  if (error) {
    logger.error("[analytics-repository] getTopSources failed", {
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  const ranked = rankByFrequency(
    (data ?? []).map((r) => r.source),
    limit,
  );
  return { ok: true, data: ranked };
}

/**
 * Fetches all hero_key values from served_variants and returns ranked counts.
 */
async function getTopHeroVariants(
  limit: number,
): Promise<RepositoryResult<RankedRow[]>> {
  const { data, error } = asRows<Pick<ServedVariantRow, "hero_key">>(
    await getDb().from("served_variants").select(),
  );

  if (error) {
    logger.error("[analytics-repository] getTopHeroVariants failed", {
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  const ranked = rankByFrequency(
    (data ?? []).map((r) => r.hero_key),
    limit,
  );
  return { ok: true, data: ranked };
}

/**
 * Fetches all cta_key values from served_variants and returns ranked counts.
 */
async function getTopCtaVariants(
  limit: number,
): Promise<RepositoryResult<RankedRow[]>> {
  const { data, error } = asRows<Pick<ServedVariantRow, "cta_key">>(
    await getDb().from("served_variants").select(),
  );

  if (error) {
    logger.error("[analytics-repository] getTopCtaVariants failed", {
      error: error.message,
    });
    return { ok: false, error: error.message };
  }

  const ranked = rankByFrequency(
    (data ?? []).map((r) => r.cta_key),
    limit,
  );
  return { ok: true, data: ranked };
}

// ── Composite query ────────────────────────────────────────────────────────────

/**
 * Fetches all dashboard overview metrics in parallel.
 *
 * Runs all six underlying queries concurrently. If any individual query fails,
 * the failed metric is substituted with a sensible zero/empty default and the
 * error is logged — the page remains renderable with partial data.
 *
 * When `tenantId` is provided, `pageViews` and `ctaClicks` are filtered to
 * events that belong to that tenant (via `payload._tid`). Legacy rows without
 * `_tid` are included for all tenants to preserve historical continuity.
 *
 * `topSources`, `topHeroVariants`, `topCtaVariants`, and `servedVariantsTotal`
 * are currently cross-tenant — the sessions and served_variants tables do not
 * yet have a tenant_id column (pending migration 20240101000008).
 *
 * @param topN      How many rows to return in each ranked table. Defaults to 5.
 * @param tenantId  Optional tenant slug to scope event counts. Pass null/undefined
 *                  to return aggregate counts across all tenants.
 * @returns         A `RepositoryResult<DashboardMetrics>` — always `.ok: true` unless
 *                  every single query fails (handled gracefully with defaults).
 */
export async function fetchDashboardMetrics(
  topN = 5,
  tenantId?: string | null,
): Promise<RepositoryResult<DashboardMetrics>> {
  const [
    pageViewsResult,
    ctaClicksResult,
    servedTotalResult,
    topSourcesResult,
    topHeroResult,
    topCtaResult,
  ] = await Promise.all([
    tenantId
      ? countEventsByTypeTenantScoped("page_view",  tenantId)
      : countEventsByType("page_view"),
    tenantId
      ? countEventsByTypeTenantScoped("cta_click", tenantId)
      : countEventsByType("cta_click"),
    countServedVariants(),
    getTopSources(topN),
    getTopHeroVariants(topN),
    getTopCtaVariants(topN),
  ]);

  // Each metric degrades gracefully — a query failure yields a zero/empty value
  // rather than breaking the entire page. Errors are already logged by the
  // individual query functions above.
  const metrics: DashboardMetrics = {
    pageViews:           pageViewsResult.ok  ? pageViewsResult.data  : 0,
    ctaClicks:           ctaClicksResult.ok  ? ctaClicksResult.data  : 0,
    servedVariantsTotal: servedTotalResult.ok ? servedTotalResult.data : 0,
    topSources:          topSourcesResult.ok  ? topSourcesResult.data  : [],
    topHeroVariants:     topHeroResult.ok     ? topHeroResult.data     : [],
    topCtaVariants:      topCtaResult.ok      ? topCtaResult.data      : [],
  };

  return { ok: true, data: metrics };
}

// ── Session inspector queries ──────────────────────────────────────────────────

/** A single page in the sessions list, plus the unfiltered total count. */
export interface SessionPage {
  sessions: SessionRow[];
  /** Total rows in the sessions table (for pagination display). */
  total: number;
}

/**
 * Fetches a paginated list of sessions, newest first.
 *
 * Runs two queries in parallel: a COUNT(*) for the total and a range-limited
 * SELECT for the page data. Both degrade to empty/zero on error.
 *
 * @param limit   Rows per page. Defaults to 50.
 * @param offset  Row offset for pagination. Defaults to 0 (first page).
 */
export async function listRecentSessions(
  limit = 50,
  offset = 0,
): Promise<RepositoryResult<SessionPage>> {
  const db = getDb();

  const [countResult, dataResult] = await Promise.all([
    db.from("sessions").select("*", { count: "exact", head: true }),
    asRows<SessionRow>(
      await db
        .from("sessions")
        .select()
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    ),
  ]);

  if (countResult.error) {
    logger.error("[analytics-repository] listRecentSessions count failed", {
      error: countResult.error.message,
    });
  }
  if (dataResult.error) {
    logger.error("[analytics-repository] listRecentSessions data failed", {
      error: dataResult.error.message,
    });
    return { ok: false, error: dataResult.error.message };
  }

  return {
    ok: true,
    data: {
      sessions: dataResult.data ?? [],
      total: countResult.count ?? 0,
    },
  };
}

/**
 * The full data set for a single session detail view:
 * the session row, its served variants, and its tracked events.
 */
export interface SessionDetail {
  session: SessionRow;
  variants: ServedVariantRow[];
  events: EventRow[];
}

/**
 * Fetches all data needed to render the session detail page in parallel.
 *
 * Returns `null` when no session exists for the given id.
 *
 * @param sessionId  UUID of the session to inspect.
 */
export async function fetchSessionDetail(
  sessionId: string,
): Promise<RepositoryResult<SessionDetail | null>> {
  const db = getDb();

  // Session row —— use maybeSingle so a missing id yields null, not an error.
  const sessionResult = asRows<SessionRow>(
    await db.from("sessions").select().eq("id", sessionId).limit(1),
  );

  if (sessionResult.error) {
    logger.error("[analytics-repository] fetchSessionDetail session failed", {
      error: sessionResult.error.message,
      sessionId,
    });
    return { ok: false, error: sessionResult.error.message };
  }

  const session = (sessionResult.data ?? [])[0] ?? null;
  if (!session) {
    return { ok: true, data: null };
  }

  // Variants + events in parallel now that we know the session exists.
  const [variantsResult, eventsResult] = await Promise.all([
    asRows<ServedVariantRow>(
      await db
        .from("served_variants")
        .select()
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(10),
    ),
    asRows<EventRow>(
      await db
        .from("events")
        .select()
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(100),
    ),
  ]);

  if (variantsResult.error) {
    logger.warn("[analytics-repository] fetchSessionDetail variants failed", {
      error: variantsResult.error.message,
      sessionId,
    });
  }
  if (eventsResult.error) {
    logger.warn("[analytics-repository] fetchSessionDetail events failed", {
      error: eventsResult.error.message,
      sessionId,
    });
  }

  return {
    ok: true,
    data: {
      session,
      variants: variantsResult.data ?? [],
      events: eventsResult.data ?? [],
    },
  };
}

// ── Variant performance queries ────────────────────────────────────────────────

/**
 * Per-source session count for a variant — shows which audiences saw it most.
 */
export interface VariantSourceBreakdown {
  source: string;
  sessions: number;
}

/**
 * Rolled-up performance stats for a single variant key.
 *
 * ─── Attribution model ────────────────────────────────────────────────────────
 *
 *   ctaClicks is the count of sessions that (a) were served this variant and
 *   (b) produced at least one "cta_click" event in their lifetime.
 *
 *   This is SESSION-LEVEL attribution, not element-level. We do not currently
 *   instrument which specific button triggered the click — only that a click
 *   occurred within a session that saw the variant.
 *
 *   Consequence: for proof variants the CTA click is indirect (the proof block
 *   contains no CTA itself), so the CTR should be read as "sessions that were
 *   served this proof variant and went on to click any CTA", not as a direct
 *   conversion rate for the proof block.
 *
 *   ctr = ctaClicks / serves × 100 (expressed as a percentage, 1 decimal).
 */
export interface VariantStats {
  /** The CMS content key, e.g. "hero_google_problem". */
  key: string;
  /** Which slot this key belongs to. */
  variantType: "hero" | "proof" | "cta";
  /** Total rows in served_variants with this key. */
  serves: number;
  /**
   * Sessions that were served this key AND had ≥1 cta_click event.
   * See attribution note above.
   */
  ctaClicks: number;
  /** ctaClicks / serves × 100, rounded to 1 decimal. 0 when serves === 0. */
  ctr: number;
  /** Top 3 traffic sources among sessions that saw this variant. */
  topSources: VariantSourceBreakdown[];
}

/** Full variant performance dataset returned by fetchVariantPerformance(). */
export interface VariantPerformanceData {
  heroVariants: VariantStats[];
  proofVariants: VariantStats[];
  ctaVariants: VariantStats[];
  /**
   * The total row count fetched from served_variants.
   * When this equals VARIANT_FETCH_LIMIT the data may be truncated —
   * the page surfaces a warning in that case.
   */
  rowsFetched: number;
}

/** Hard limit on served_variants rows fetched per request. */
export const VARIANT_FETCH_LIMIT = 5_000;

// ── Internal aggregation helpers ───────────────────────────────────────────────

/**
 * Builds per-variant stats for a given slot column from the raw row arrays.
 *
 * @param variantRows    All served_variants rows (up to VARIANT_FETCH_LIMIT).
 * @param keyField       Which column to group by: "hero_key" | "proof_key" | "cta_key".
 * @param clickSessionIds Set of session UUIDs that had ≥1 cta_click event.
 * @param sessionSource  Map from session_id → source string.
 * @param variantType    Label applied to each resulting VariantStats row.
 */
function buildVariantStats(
  variantRows: ServedVariantRow[],
  keyField: "hero_key" | "proof_key" | "cta_key",
  clickSessionIds: Set<string>,
  sessionSource: Map<string, string>,
  variantType: VariantStats["variantType"],
): VariantStats[] {
  // Group served_variant rows by key value.
  const byKey = new Map<string, ServedVariantRow[]>();
  for (const row of variantRows) {
    const key = row[keyField];
    const existing = byKey.get(key);
    if (existing) {
      existing.push(row);
    } else {
      byKey.set(key, [row]);
    }
  }

  const stats: VariantStats[] = [];

  for (const [key, rows] of byKey) {
    const serves = rows.length;

    // Count distinct sessions that had a cta_click (one click per session max).
    const clickingSessions = new Set<string>();
    for (const row of rows) {
      if (clickSessionIds.has(row.session_id)) {
        clickingSessions.add(row.session_id);
      }
    }
    const ctaClicks = clickingSessions.size;

    const ctr = serves > 0 ? Math.round((ctaClicks / serves) * 1000) / 10 : 0;

    // Source breakdown: count sessions by source.
    const sourceCounts = new Map<string, number>();
    for (const row of rows) {
      const source = sessionSource.get(row.session_id) ?? "unknown";
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    }
    const topSources: VariantSourceBreakdown[] = Array.from(sourceCounts.entries())
      .map(([source, sessions]) => ({ source, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 3);

    stats.push({ key, variantType, serves, ctaClicks, ctr, topSources });
  }

  // Sort by serves descending so the most-shown variant is always first.
  stats.sort((a, b) => b.serves - a.serves);
  return stats;
}

// ── Public composite query ─────────────────────────────────────────────────────

/**
 * Fetches all data needed to render the variant performance page.
 *
 * Runs three parallel queries then joins entirely in application code:
 *   1. served_variants  — which variants were shown to which sessions
 *   2. events (cta_click only) — which sessions produced a click
 *   3. sessions         — source lookup for the source-breakdown column
 *
 * All three queries are capped. At MVP data volumes (hundreds to low thousands
 * of sessions) this is fast and correct. When rowsFetched === VARIANT_FETCH_LIMIT
 * the result may be truncated and the page surfaces a warning.
 *
 * When `tenantId` is provided, CTA click events are filtered by tenant
 * (via `payload._tid`) so CTR attribution reflects only clicks from that tenant's
 * visitors. The served_variants query remains cross-tenant until migration
 * 20240101000008 adds a dedicated tenant_id column to that table.
 *
 * @param tenantId  Optional tenant slug to scope click attribution.
 */
export async function fetchVariantPerformance(
  tenantId?: string | null,
): Promise<RepositoryResult<VariantPerformanceData>> {
  const db = getDb();

  const [variantsResult, clickEventsResult, sessionsResult] = await Promise.all([
    asRows<ServedVariantRow>(
      await db
        .from("served_variants")
        .select()
        .order("created_at", { ascending: false })
        .limit(VARIANT_FETCH_LIMIT),
    ),
    asRows<Pick<EventRow, "session_id" | "payload">>(
      await db
        .from("events")
        .select()
        .eq("event_type", "cta_click")
        .limit(VARIANT_FETCH_LIMIT),
    ),
    asRows<Pick<SessionRow, "id" | "source">>(
      await db
        .from("sessions")
        .select()
        .limit(VARIANT_FETCH_LIMIT),
    ),
  ]);

  if (variantsResult.error) {
    logger.error("[analytics-repository] fetchVariantPerformance variants failed", {
      error: variantsResult.error.message,
    });
    return { ok: false, error: variantsResult.error.message };
  }
  if (clickEventsResult.error) {
    logger.warn("[analytics-repository] fetchVariantPerformance click events failed", {
      error: clickEventsResult.error.message,
    });
    // Non-fatal: continue with zero click data.
  }
  if (sessionsResult.error) {
    logger.warn("[analytics-repository] fetchVariantPerformance sessions failed", {
      error: sessionsResult.error.message,
    });
    // Non-fatal: source breakdown will show "unknown" for all.
  }

  const variantRows = variantsResult.data ?? [];
  const allClickRows = clickEventsResult.data ?? [];
  const sessionRows = sessionsResult.data ?? [];

  // When tenantId is provided, filter click events to this tenant's rows only.
  // Legacy rows (no _tid in payload) are included for all tenants to preserve
  // historical attribution continuity.
  const clickRows = tenantId
    ? allClickRows.filter((r) => matchesTenant(r as { payload?: Record<string, unknown> }, tenantId))
    : allClickRows;

  // Build lookup structures for the in-memory join.
  const clickSessionIds = new Set(clickRows.map((r) => r.session_id));
  const sessionSource = new Map(sessionRows.map((r) => [r.id, r.source]));

  return {
    ok: true,
    data: {
      heroVariants:  buildVariantStats(variantRows, "hero_key",  clickSessionIds, sessionSource, "hero"),
      proofVariants: buildVariantStats(variantRows, "proof_key", clickSessionIds, sessionSource, "proof"),
      ctaVariants:   buildVariantStats(variantRows, "cta_key",   clickSessionIds, sessionSource, "cta"),
      rowsFetched:   variantRows.length,
    },
  };
}
