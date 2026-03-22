/**
 * Repositories barrel export
 *
 * Public API of the data access layer. Import from "@/data/repositories"
 * to access any repository function without importing the concrete file.
 *
 * All functions return `RepositoryResult<T>` — a discriminated union with
 * `{ ok: true; data: T }` and `{ ok: false; error: string }` branches.
 * They never throw so callers can handle failures gracefully.
 *
 * ─── Quick reference ──────────────────────────────────────────────────────────
 *
 *   Sessions
 *     createSession(input)           → RepositoryResult<SessionRow>
 *     upsertSession(input)           → RepositoryResult<SessionRow>   ← use this from the homepage
 *     getSessionById(id)             → RepositoryResult<SessionRow | null>
 *     sessionInputFromContext(ctx, pathname)  → CreateSessionInput
 *
 *   Served variants
 *     saveServedVariants(input)             → RepositoryResult<ServedVariantRow>
 *     servedVariantsInputFromPlan(id, plan) → SaveServedVariantsInput
 *     getServedVariantsBySession(id, limit) → RepositoryResult<ServedVariantRow[]>
 *
 *   Events
 *     saveEvent(input)                      → RepositoryResult<EventRow>
 *     getRecentEventsBySession(id, limit)   → RepositoryResult<EventRow[]>
 */

// ── Sessions ──────────────────────────────────────────────────────────────────

export {
  createSession,
  upsertSession,
  getSessionById,
  sessionInputFromContext,
  type CreateSessionInput,
  type UpsertSessionInput,
  type RepositoryOk,
  type RepositoryErr,
  type RepositoryResult,
} from "./sessions-repository";

// ── Served variants ───────────────────────────────────────────────────────────

export {
  saveServedVariants,
  servedVariantsInputFromPlan,
  getServedVariantsBySession,
  type SaveServedVariantsInput,
} from "./variants-repository";

// ── Events ────────────────────────────────────────────────────────────────────

export {
  saveEvent,
  getRecentEventsBySession,
  type SaveEventInput,
} from "./events-repository";

// ── Analytics ─────────────────────────────────────────────────────────────────

export {
  fetchDashboardMetrics,
  type DashboardMetrics,
  type RankedRow,
} from "./analytics-repository";

// Analytics — updated quick reference:
//   listRecentSessions(limit?, offset?)  → RepositoryResult<SessionPage>
//   fetchSessionDetail(sessionId)        → RepositoryResult<SessionDetail | null>

export {
  listRecentSessions,
  fetchSessionDetail,
  type SessionPage,
  type SessionDetail,
} from "./analytics-repository";

export {
  fetchVariantPerformance,
  VARIANT_FETCH_LIMIT,
  type VariantStats,
  type VariantSourceBreakdown,
  type VariantPerformanceData,
} from "./analytics-repository";

// ── Experiments ───────────────────────────────────────────────────────────────

export {
  getActiveExperiments,
  saveExperimentAssignment,
  getAssignmentsForSession,
  listAllExperiments,
  type ExperimentRow,
  type ExperimentAssignmentRow,
  type ExperimentAssignmentInsert,
} from "./experiments-repository";

// ── AI decision logs ──────────────────────────────────────────────────────────

export {
  saveAiDecisionLog,
  getRecentAiDecisionLogs,
  getAiDecisionLogsBySession,
  type GetRecentAiDecisionLogsOptions,
  type AiDecisionLogRow,
  type AiDecisionLogInsert,
} from "./ai-decisions-repository";
