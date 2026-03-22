/**
 * AI Decisions Repository
 *
 * All database access for the `ai_decision_logs` table.
 * Called fire-and-forget from `AiDecisionProvider` after every AI inference,
 * regardless of whether the AI plan was ultimately served to the visitor.
 *
 * ─── What this stores ────────────────────────────────────────────────────────
 *
 *   Every time the AI provider runs, we record a single row containing:
 *
 *     live_plan     — the ExperiencePlan that was actually rendered.
 *     shadow_plan   — what the AI suggested, plus confidence, policy verdict,
 *                     model ID, latency, and gate results for analysis.
 *     plans_match   — whether AI and rules agreed on all three variant keys.
 *     context       — a VisitorContext snapshot at decision time.
 *
 *   This data powers the `/dashboard/ai` page and agreement-rate analytics.
 *
 * ─── Primary write function ───────────────────────────────────────────────────
 *
 *   Always call `saveAiDecisionLog` via fire-and-forget from the provider:
 *
 *     void saveAiDecisionLog({
 *       session_id:      sessionId,
 *       page_type:       "homepage",
 *       live_provider:   "rules",
 *       live_plan:       livePlanSnapshot,
 *       shadow_provider: `ai:${aiOutput.modelId}`,
 *       shadow_plan:     shadowPlanSnapshot,
 *       plans_match:     plansAreEqual(aiPlan, rulesPlan),
 *       context:         contextSnapshot,
 *     });
 *
 * ─── Error policy ─────────────────────────────────────────────────────────────
 *
 *   Every function returns a `RepositoryResult<T>` — never throws.
 *   Write failures are logged at `warn` (non-critical observability path).
 *   Read failures are logged at `error` (operator should know why a dashboard
 *   query fails).  Neither failure category affects visitor experience.
 *
 * ─── Backward compat ──────────────────────────────────────────────────────────
 *
 *   `data/repositories/ai-logs-repository.ts` re-exports everything from this
 *   file so existing direct imports (e.g. in `AiDecisionProvider`) continue
 *   to work without modification.
 */

import { getDb } from "@/data/db";
import type { AiDecisionLogRow, AiDecisionLogInsert } from "@/data/types";
import type { RepositoryResult } from "./sessions-repository";
import { logger } from "@/lib/logger";

// ── Internal type helpers ─────────────────────────────────────────────────────
// Workaround for the Supabase PostgREST v12 discriminated-union TS issue.
// Using `as never` on insert + explicit result casting avoids TS2769.

type SingleQueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type ListQueryResult<T> = {
  data: T[] | null;
  error: { message: string; code?: string } | null;
};

function asSingleResult<T>(result: unknown): SingleQueryResult<T> {
  return result as SingleQueryResult<T>;
}

// ── saveAiDecisionLog ─────────────────────────────────────────────────────────

/**
 * Persists one AI decision comparison row to `ai_decision_logs`.
 *
 * This is a best-effort write — callers should fire-and-forget rather than
 * blocking the HTTP response on the result:
 *
 *   void saveAiDecisionLog(input);
 *
 * The return value is available for callers that want to inspect the outcome
 * (e.g. tests), but is safe to discard entirely in production paths.
 *
 * @param input  The complete log row, built by `AiDecisionProvider.persistLog()`.
 * @returns      `RepositoryResult<AiDecisionLogRow>`.  Failures are logged
 *               internally; callers do not need to handle them.
 */
export async function saveAiDecisionLog(
  input: AiDecisionLogInsert,
): Promise<RepositoryResult<AiDecisionLogRow>> {
  try {
    const db = getDb();

    const result = asSingleResult<AiDecisionLogRow>(
      await db
        .from("ai_decision_logs")
        .insert(input as never)
        .select()
        .single(),
    );

    if (result.error) {
      logger.warn("[ai-decisions] Failed to save AI decision log", {
        sessionId: input.session_id,
        tenantId: input.tenant_id ?? null,
        pageType: input.page_type,
        liveProvider: input.live_provider,
        shadowProvider: input.shadow_provider,
        plansMatch: input.plans_match,
        error: result.error.message,
        code: result.error.code,
      });
      return { ok: false, error: result.error.message };
    }

    logger.debug("[ai-decisions] AI decision log saved", {
      id: result.data?.id,
      sessionId: input.session_id,
      tenantId: input.tenant_id ?? null,
      liveProvider: input.live_provider,
      shadowProvider: input.shadow_provider,
      plansMatch: input.plans_match,
      policyVerdict: input.shadow_plan.policyVerdict,
      confidence: input.shadow_plan.confidence,
    });

    return { ok: true, data: result.data as AiDecisionLogRow };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[ai-decisions] Unexpected error saving AI decision log", {
      sessionId: input.session_id,
      error: message,
    });
    return { ok: false, error: message };
  }
}

// ── Read helpers ──────────────────────────────────────────────────────────────

/**
 * Options for {@link getRecentAiDecisionLogs}.
 */
export interface GetRecentAiDecisionLogsOptions {
  /**
   * Maximum rows to return.
   * Capped server-side at 200 regardless of the value supplied.
   * Default: 50.
   */
  limit?: number;

  /**
   * When provided, restricts the query to a single visitor session.
   * Useful for the session inspector panel in the dashboard.
   */
  sessionId?: string;

  /**
   * When provided, restricts the query to a single tenant.
   * Used by the /admin/ai-logs?tenant=<slug> dashboard filter.
   */
  tenantId?: string;

  /**
   * Filter by plan agreement at the database level:
   *   true  → only rows where live and shadow plans matched
   *   false → only rows where they differed (mismatches)
   *   omit  → all rows (no filter applied)
   *
   * Prefer omitting this and filtering in JS when you also need aggregate
   * counts (e.g. dashboard summary block) so you only make one DB round-trip.
   */
  plansMatch?: boolean;
}

/**
 * Returns recent AI decision log rows, newest first.
 *
 * Accepts either the legacy positional signature `(limit, sessionId?)` or
 * the newer options-bag form — both are supported so existing call sites
 * do not need to be updated.
 *
 * Used by:
 *   - `/dashboard/ai` page (reads all rows, filters in JS for summary counts)
 *   - Session inspector panel (filters by sessionId)
 *
 * @param limitOrOptions  Row limit (number) or options bag.
 * @param sessionId       Positional session ID — only used when `limitOrOptions`
 *                        is a plain number.  Prefer the options bag for new call
 *                        sites.
 * @returns               `RepositoryResult<AiDecisionLogRow[]>`.
 */
export async function getRecentAiDecisionLogs(
  limitOrOptions: number | GetRecentAiDecisionLogsOptions = 50,
  sessionId?: string,
): Promise<RepositoryResult<AiDecisionLogRow[]>> {
  // Normalise to options bag regardless of which calling convention was used.
  const opts: GetRecentAiDecisionLogsOptions =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions, sessionId }
      : limitOrOptions;

  const {
    limit = 50,
    sessionId: sid = sessionId,
    tenantId,
    plansMatch,
  } = opts;

  try {
    const db = getDb();

    let query = db
      .from("ai_decision_logs")
      .select()
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (sid) {
      query = query.eq("session_id", sid);
    }

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    if (plansMatch !== undefined) {
      query = query.eq("plans_match", plansMatch);
    }

    const result = (await query) as ListQueryResult<AiDecisionLogRow>;

    if (result.error) {
      logger.error("[ai-decisions] getRecentAiDecisionLogs failed", {
        error: result.error.message,
        code: result.error.code,
        limit,
        sessionId: sid,
        plansMatch,
      });
      return { ok: false, error: result.error.message };
    }

    return { ok: true, data: result.data ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[ai-decisions] Unexpected error in getRecentAiDecisionLogs", {
      error: message,
    });
    return { ok: false, error: message };
  }
}

/**
 * Returns all AI decision logs for a specific session, newest first.
 *
 * Convenience wrapper around `getRecentAiDecisionLogs` for the common
 * "show AI decisions for this visitor" use-case in the session inspector.
 *
 * @param sessionId  The visitor's session UUID.
 * @param limit      Maximum rows to return. Default: 20.
 */
export async function getAiDecisionLogsBySession(
  sessionId: string,
  limit = 20,
): Promise<RepositoryResult<AiDecisionLogRow[]>> {
  return getRecentAiDecisionLogs({ sessionId, limit });
}

/**
 * Returns recent AI decision logs for a specific tenant, newest first.
 *
 * Used by the /admin/ai-logs?tenant=<slug> dashboard page to show per-tenant
 * AI decision history.
 *
 * @param tenantId  The tenant slug, e.g. "mister-chameleon".
 * @param limit     Maximum rows to return. Default: 100, capped at 200.
 */
export async function getAiDecisionLogsByTenant(
  tenantId: string,
  limit = 100,
): Promise<RepositoryResult<AiDecisionLogRow[]>> {
  return getRecentAiDecisionLogs({ tenantId, limit });
}

// ── Type re-exports ───────────────────────────────────────────────────────────

export type { AiDecisionLogRow, AiDecisionLogInsert };
