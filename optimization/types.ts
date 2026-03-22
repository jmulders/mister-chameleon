/**
 * Optimization Cycle Types
 *
 * The operating model layer of the Mister Chameleon platform.
 *
 * An optimization cycle defines how the platform is used as a recurring service
 * rather than a one-time implementation. Cycles standardize when to review
 * performance, who is involved, what inputs are required, what gets produced,
 * and how decisions connect back to the platform's data and tooling.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   The platform generates data continuously. Without a structured review
 *   cadence, that data sits unused and variant performance stagnates. Cycles
 *   transform raw platform data into client-visible improvements:
 *
 *     Data   → Monthly Review  → Action Backlog
 *     Data   → Experiment      → Better Variant
 *     Stale Content → Refresh  → Higher CTR
 *     Trends → Quarterly QBR   → Strategy Update
 *
 *   Cycles are also the primary mechanism for the recurring service model —
 *   they define the scope, frequency, and value of ongoing MC engagement
 *   beyond the initial onboarding implementation.
 *
 * ─── Four cycles ─────────────────────────────────────────────────────────────
 *
 *   monthly-performance-review   The core monthly check-in. Data → actions.
 *   quarterly-strategy-review    QBR + forward planning. Trends → direction.
 *   experiment-review            Triggered by A/B test conclusion. Test → decision.
 *   content-refresh              Triggered or monthly. Staleness → updated variants.
 *
 * ─── Connection map ───────────────────────────────────────────────────────────
 *
 *   OptimizationCycle.linkedReportSections → reports/types.ts (ReportSectionId)
 *   OptimizationCycle.linkedKpiIds         → analytics/kpi-types.ts (KpiId)
 *   OptimizationCycle.linkedModules        → product/types.ts (ProductModuleId)
 *   OptimizationCycle.linkedServiceOfferingId → product/types.ts (ServiceOfferingId)
 *   OptimizationCycle.linkedDashboards     → internal dashboard routes
 *   CycleInputRequirement.linkedReportSection → specific report section consumed
 *   CycleOutput.linkedReportTemplateId    → which report template produces this
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   optimization/types.ts   ← YOU ARE HERE — all type definitions
 *   optimization/cycles.ts  ← four concrete cycle definitions + catalog
 *   optimization/index.ts   ← barrel re-export
 */

import type { KpiId }               from "@/analytics/kpi-types";
import type { ReportSectionId }     from "@/reports/types";
import type { ProductModuleId, ServiceOfferingId } from "@/product/types";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for each defined optimization cycle.
 *
 * Convention: lowercase-hyphenated. Never rename — these IDs may appear
 * in stored CycleInstance records and client-facing documentation.
 *
 * monthly-performance-review   Runs every month. Core delivery rhythm.
 * quarterly-strategy-review    Runs every quarter. Strategic direction setting.
 * experiment-review            Triggered when an A/B experiment concludes.
 * content-refresh              Triggered by staleness or underperformance.
 */
export type OptimizationCycleId =
  | "monthly-performance-review"
  | "quarterly-strategy-review"
  | "experiment-review"
  | "content-refresh";

/**
 * How frequently a cycle runs.
 *
 * weekly      Every 7 days. Reserved for high-intensity launch periods.
 * monthly     Once per calendar month. The standard delivery cadence.
 * quarterly   Once per quarter (Q1–Q4). Strategic review cadence.
 * triggered   Fires on a specific platform event, not a calendar date.
 * ad-hoc      No fixed schedule — client-requested or situationally warranted.
 */
export type OptimizationCadence =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "triggered"
  | "ad-hoc";

/**
 * Roles that participate in optimization cycles.
 *
 * These map to specific people in the engagement model:
 *
 *   account-manager      MC-side relationship owner. Runs reviews, owns client comms.
 *   platform-engineer    MC-side technical owner. Manages platform config and data.
 *   content-strategist   MC-side content specialist. Leads variant briefs and audits.
 *   client-marketing     Client's marketing or content team. Produces variant content.
 *   client-leadership    Client's senior decision-makers (GM, CMO, founder).
 *                        Participates in QBR and strategic sessions.
 *   client-technical     Client's developer. Involved when CMS or integration work
 *                        requires client-side technical coordination.
 */
export type CycleRole =
  | "account-manager"
  | "platform-engineer"
  | "content-strategist"
  | "client-marketing"
  | "client-leadership"
  | "client-technical";

/**
 * What initiates a cycle.
 *
 * calendar             A fixed date arrives (monthly on the 1st, quarterly start).
 * threshold-breach     A KPI value drops below its defined warning threshold.
 * experiment-concluded An A/B experiment meets its minimum session count and
 *                      duration requirements and is ready for a decision.
 * content-staleness    A variant has not been updated in more than N days
 *                      (typically 90 days for a monthly delivery cadence).
 * client-request       The client or account manager manually initiates a cycle
 *                      outside the normal schedule.
 * launch               Fires once, at or shortly after the platform goes live.
 *                      Used for launch-period intensive cycles.
 */
export type CycleTrigger =
  | "calendar"
  | "threshold-breach"
  | "experiment-concluded"
  | "content-staleness"
  | "client-request"
  | "launch";

/**
 * What category of data or artefact a cycle input requires.
 *
 * report            A full or partial client report (from reports/ module).
 * kpi-snapshot      Point-in-time KPI values (from analytics/ module).
 * variant-data      Served variant performance statistics (from analytics-repository).
 * experiment-data   A/B experiment results including per-bucket CTR and session counts.
 * content-inventory Current CMS content state — which variant keys exist and are valid.
 * rule-config       The current decision rules configuration (from decision/rules/).
 * client-brief      Free-form context provided by the client (goals, constraints).
 * action-backlog    Outstanding recommendations and their completion status from
 *                   previous cycles.
 */
export type CycleInputType =
  | "report"
  | "kpi-snapshot"
  | "variant-data"
  | "experiment-data"
  | "content-inventory"
  | "rule-config"
  | "client-brief"
  | "action-backlog";

/**
 * What category of artefact a cycle produces.
 *
 * report              A formatted performance report for the client.
 * action-plan         A prioritised list of recommendations with owners and dates.
 * variant-update      A change to CMS variant content (new, edited, or retired).
 * rule-update         A change to the decision rules configuration.
 * experiment-brief    A specification for a new A/B experiment.
 * strategy-memo       A narrative document capturing strategic direction.
 * kpi-target-revision Updated performance targets for the next reporting period.
 * learnings-log       A documented observation or conclusion for future reference.
 * content-brief       Instructions for the client to produce new variant content.
 */
export type CycleOutputType =
  | "report"
  | "action-plan"
  | "variant-update"
  | "rule-update"
  | "experiment-brief"
  | "strategy-memo"
  | "kpi-target-revision"
  | "learnings-log"
  | "content-brief";

/**
 * Lifecycle state of a specific cycle run (CycleInstance).
 *
 * scheduled         Planned but not yet started.
 * in-progress       Actively being worked on.
 * awaiting-client   Blocked on client input, content production, or approval.
 * completed         All required outputs produced and delivered.
 * skipped           Intentionally skipped (e.g. holiday period, low data volume).
 * escalated         The cycle's findings triggered a higher-cadence review
 *                   (e.g. a monthly review escalated to a quarterly strategy call).
 */
export type CycleStatus =
  | "scheduled"
  | "in-progress"
  | "awaiting-client"
  | "completed"
  | "skipped"
  | "escalated";

// ─────────────────────────────────────────────────────────────────────────────
// INPUT REQUIREMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A specific piece of data or documentation that a cycle requires in order
 * to run effectively.
 *
 * Inputs are either pulled from the platform automatically (platform-data),
 * produced by the MC team before the cycle (internal-analysis), or provided
 * by the client (client).
 */
export interface CycleInputRequirement {
  /** Stable ID within this cycle. Used to reference inputs from phases. */
  id: string;

  /** Short label for checklists and meeting agendas. */
  label: string;

  /**
   * What this input is and why it's needed for this cycle.
   * 1–2 sentences. Written for account managers, not engineers.
   */
  description: string;

  /** What category of input this is. */
  type: CycleInputType;

  /**
   * Whether this input is mandatory.
   * When false, the cycle can proceed without it — but the output quality
   * will be reduced and this should be noted in the session.
   */
  required: boolean;

  /**
   * Who produces or provides this input.
   *
   * platform-data        Fetched automatically from the analytics pipeline.
   *                      Account manager pulls it from the dashboard before the cycle.
   * internal-analysis    Produced by the MC team (AM or Engineer) in preparation.
   * client               The client must provide this before the cycle can proceed.
   */
  source: "platform-data" | "internal-analysis" | "client";

  /**
   * The internal dashboard route where this data can be found or generated.
   * Examples: "/dashboard/variants", "/dashboard/reporting-preview"
   */
  linkedDashboardPath?: string;

  /**
   * Which report section provides this input.
   * Maps to ReportSectionId in reports/types.ts.
   */
  linkedReportSection?: ReportSectionId;

  /**
   * The KPI IDs most relevant to this input.
   * Maps to KpiId in analytics/kpi-types.ts.
   */
  linkedKpiIds?: readonly KpiId[];
}

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An artefact that a cycle produces.
 *
 * Some outputs are client-facing deliverables (a monthly report, a strategy memo).
 * Others are internal platform changes (a rule update, a variant upload).
 * Both matter — the internal changes are what drive performance improvement.
 */
export interface CycleOutput {
  /** Stable ID within this cycle. Used to reference outputs from phases. */
  id: string;

  /** Short label for output checklists and delivery confirmations. */
  label: string;

  /**
   * What this output is and why it matters.
   * 1–2 sentences. Written for account managers.
   */
  description: string;

  /** What category of artefact this is. */
  type: CycleOutputType;

  /** Which role is responsible for producing this output. */
  owner: CycleRole;

  /**
   * Whether this output is shared with the client.
   * True for reports, memos, and briefs. False for internal platform changes
   * (rule updates, config changes) that don't require a client-facing artefact.
   */
  isClientDeliverable: boolean;

  /**
   * The report template ID used when this output is a formatted report.
   * References the template.id field in reports/templates/default-report.ts.
   */
  linkedReportTemplateId?: string;

  /**
   * The service offering this output supports or belongs to.
   * Connects the output back to the product/catalog service model.
   */
  linkedServiceOfferingId?: ServiceOfferingId;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A structured step within a cycle.
 *
 * Phases are sequential and together constitute the full cycle. Breaking cycles
 * into phases makes them actionable — an account manager knows exactly what to
 * do in the first 30 minutes vs. the final hour.
 *
 * Phase inputs reference CycleInputRequirement.id values.
 * Phase outputs reference CycleOutput.id values.
 */
export interface CyclePhase {
  /** Stable phase ID within this cycle. */
  id: string;

  /** Short name for the phase. Example: "Data Preparation" */
  label: string;

  /**
   * What happens in this phase and what the goal is.
   * 2–3 sentences.
   */
  description: string;

  /**
   * Execution order — phases are run in ascending order.
   * Gaps are intentional (e.g. 1, 2, 3, 4) to allow future insertion.
   */
  order: number;

  /**
   * How long this phase typically takes.
   * Examples: "30 minutes", "2 hours", "1–2 business days"
   */
  estimatedDuration: string;

  /** The role who drives this phase. */
  primaryRole: CycleRole;

  /** Other roles who participate in this phase. */
  supportingRoles: readonly CycleRole[];

  /**
   * Which required inputs are consumed in this phase.
   * References CycleInputRequirement.id values defined on the same cycle.
   */
  consumedInputIds: readonly string[];

  /**
   * Which outputs are produced in this phase.
   * References CycleOutput.id values defined on the same cycle.
   */
  producedOutputIds: readonly string[];

  /**
   * Specific action items for the primary role during this phase.
   * Written as imperatives. Specific enough to check off in a meeting agenda.
   *
   * Example: "Pull fetchDashboardMetrics() for the prior month window"
   * Example: "Identify the lowest-CTR variant in each slot"
   */
  checklist: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes a specific role's involvement in a cycle — their responsibilities,
 * time commitment, and whether their participation is optional.
 */
export interface OptimizationCycleRole {
  /** Which role this describes. */
  role: CycleRole;

  /**
   * Display label including context.
   * Example: "Account Manager (MC)", "Client Marketing Lead"
   */
  label: string;

  /**
   * What this role is responsible for in this cycle.
   * Written as ownership statements, not task lists.
   *
   * Example: "Owns the client relationship through the review session"
   */
  responsibilities: readonly string[];

  /**
   * How much time this role should expect to spend per cycle occurrence.
   * Example: "~2 hours per month", "~30 minutes (async preparation only)"
   */
  timeCommitment: string;

  /**
   * Whether this role is required for the cycle to proceed, or merely helpful.
   * Optional roles can be skipped if the person is unavailable.
   */
  optional: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD LINKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A reference to an internal dashboard that supports this cycle.
 *
 * The path is a relative route within the dashboard (/dashboard/...).
 * These links anchor each cycle to specific platform tooling rather than
 * leaving the operating model as abstract documentation.
 */
export interface LinkedDashboard {
  /** Human-readable name for the dashboard link. */
  label: string;

  /**
   * Relative URL path within the platform.
   * Examples: "/dashboard/variants", "/dashboard/content-status"
   */
  path: string;

  /**
   * What this dashboard provides in the context of this cycle.
   * Written specifically for this cycle — the same dashboard may serve
   * different purposes in different cycles.
   */
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZATION CYCLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete optimization cycle definition.
 *
 * This is the core entity of the operating model. It defines everything
 * about how a specific type of review or improvement activity is run —
 * who participates, when, with what data, producing what outputs.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   Cycles should be opinionated but not rigid. The phases define the ideal
 *   execution path; real engagements will adapt based on client maturity,
 *   data volume, and available time.
 *
 *   The `operatingNotes` field carries practical guidance for account managers —
 *   the kind of knowledge that doesn't fit neatly into a structured type but
 *   determines whether the cycle produces real value or just burns an hour.
 */
export interface OptimizationCycle {
  /** Stable cycle identifier. Never changes once published. */
  id: OptimizationCycleId;

  /**
   * Full display name.
   * Example: "Monthly Performance Review"
   */
  name: string;

  /**
   * One-sentence value proposition for this cycle.
   * Answers: "Why does this cycle exist?" for a client or new account manager.
   *
   * Example: "Turn last month's platform data into this month's improvements."
   */
  tagline: string;

  /**
   * 2–4 sentence description of what this cycle covers, how it works,
   * and where it fits in the broader operating model.
   */
  description: string;

  // ── Scheduling ─────────────────────────────────────────────────────────────

  /** How often this cycle runs. */
  cadence: OptimizationCadence;

  /**
   * Approximate number of times this cycle occurs per year.
   * "variable" for triggered cycles whose frequency depends on events.
   */
  annualFrequency: number | "variable";

  /**
   * How long the full cycle takes from start to final output delivery.
   * This is wall-clock time, not effort — includes async client production time.
   *
   * Examples: "2–3 hours", "Half-day (4–5 hours)", "3–5 business days"
   */
  typicalDuration: string;

  /**
   * What can trigger this cycle.
   * Calendar-driven cycles have "calendar" here.
   * Event-driven cycles list the specific events that fire them.
   * Most cycles accept both a calendar trigger and specific event triggers.
   */
  triggers: readonly CycleTrigger[];

  // ── People ─────────────────────────────────────────────────────────────────

  /**
   * All roles involved in this cycle, with their responsibilities and
   * time commitments. Defines the engagement model for this cycle type.
   */
  roles: readonly OptimizationCycleRole[];

  // ── Process ────────────────────────────────────────────────────────────────

  /**
   * The required data and artefacts that must be available before or during
   * the cycle. Required inputs gate cycle quality — missing them forces
   * qualitative discussion where quantitative decisions should be made.
   */
  requiredInputs: readonly CycleInputRequirement[];

  /**
   * The artefacts this cycle produces. Includes both client deliverables
   * and internal platform changes.
   */
  outputs: readonly CycleOutput[];

  /**
   * The sequential phases that make up this cycle.
   * Ordered by CyclePhase.order ascending.
   */
  phases: readonly CyclePhase[];

  // ── Connections ────────────────────────────────────────────────────────────

  /**
   * Internal dashboard routes that support this cycle.
   * Each link describes what the dashboard provides in the context of this
   * specific cycle — not just a generic "see the dashboard" pointer.
   */
  linkedDashboards: readonly LinkedDashboard[];

  /**
   * Report sections that are consumed or produced by this cycle.
   * Maps to ReportSectionId in reports/types.ts.
   */
  linkedReportSections: readonly ReportSectionId[];

  /**
   * The KPIs that this cycle reviews, optimises, or sets targets for.
   * Maps to KpiId in analytics/kpi-types.ts.
   */
  linkedKpiIds: readonly KpiId[];

  /**
   * The product modules whose performance this cycle directly addresses.
   * Maps to ProductModuleId in product/types.ts.
   */
  linkedModules: readonly ProductModuleId[];

  /**
   * The service offering this cycle belongs to.
   * Monthly and quarterly cycles belong to "optimisation" and "strategy".
   * Maps to ServiceOfferingId in product/types.ts.
   */
  linkedServiceOfferingId?: ServiceOfferingId;

  // ── Quality gates ──────────────────────────────────────────────────────────

  /**
   * Conditions that must be true for a cycle run to be considered complete.
   * Written as observable, verifiable statements — not aspirations.
   *
   * Example: "Client has acknowledged receipt of the monthly report"
   * Example: "At least one high-priority recommendation has a named owner"
   */
  successCriteria: readonly string[];

  /**
   * Conditions that warrant escalating to a higher-cadence or higher-authority
   * review. These are specific and observable — not vague "if things are bad".
   *
   * Example: "CTA click rate drops more than 20% month-over-month"
   * Example: "Experiment is inconclusive after 500 sessions per bucket"
   */
  escalationConditions: readonly string[];

  // ── Operating guidance ─────────────────────────────────────────────────────

  /**
   * Practical guidance for account managers running this cycle.
   *
   * This is where the tacit knowledge lives — what makes this cycle work in
   * practice, common failure modes, framing advice for client conversations,
   * and what to do when the data is thin or the client is disengaged.
   *
   * Written for an experienced AM who is running this cycle for the first time.
   */
  operatingNotes: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete optimization catalog — all defined cycles in one typed structure.
 *
 * Defined in optimization/cycles.ts and re-exported from optimization/index.ts.
 */
export interface OptimizationCatalog {
  /** All cycles, ordered from highest frequency (monthly) to triggered. */
  cycles: readonly OptimizationCycle[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNTIME TRACKING  (CycleInstance)
// ─────────────────────────────────────────────────────────────────────────────
//
// CycleInstance tracks a specific execution of a cycle for a specific tenant.
// Unlike the cycle definitions above (which are static and reusable), instances
// are dynamic and per-tenant. They would be stored in the database in a
// production system.
//
// Not yet wired to a database table — this type is forward-looking for when
// the operating model is tracked in the platform itself.

/**
 * A specific execution of an optimization cycle for a tenant.
 *
 * One CycleInstance per (tenantId × cycleId × period). Tracks progress,
 * completion, and notes for a single cycle run.
 *
 * Future: store in a `cycle_instances` Supabase table and surface in the
 * dashboard as a delivery tracker for account managers.
 */
export interface CycleInstance {
  /** UUID, generated at instance creation time. */
  id: string;

  /** Which cycle definition this instance is running. */
  cycleId: OptimizationCycleId;

  /** Which tenant this instance is for. */
  tenantId: string;

  /** Lifecycle state of this instance. */
  status: CycleStatus;

  /**
   * ISO date when this cycle is scheduled to run (or was triggered).
   * For calendar cycles: the first business day of the relevant period.
   * For triggered cycles: the date the trigger event was detected.
   */
  scheduledDate: string;

  /** ISO date when all required outputs were delivered. Null until complete. */
  completedDate?: string;

  /**
   * The time window this cycle covers.
   * For monthly reviews: the prior calendar month.
   * For triggered cycles: the period from the last review to trigger date.
   */
  periodStart: string;
  periodEnd:   string;

  /**
   * Which phases have been completed.
   * Maps phase.id → true when complete.
   * Allows partial progress to be tracked across asynchronous execution.
   */
  phaseProgress?: Partial<Record<string, boolean>>;

  /**
   * Which outputs have been produced and delivered.
   * Maps output.id → true when complete.
   */
  outputProgress?: Partial<Record<string, boolean>>;

  /**
   * Free-text session notes captured during or after the cycle.
   * Typically the account manager's summary of what was discussed and decided.
   */
  notes?: string;

  /**
   * When this instance was escalated, which cycle it escalated to.
   * Example: a monthly review escalates to a quarterly strategy session.
   */
  escalatedTo?: OptimizationCycleId;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY TYPES  (for tooling and dashboard display)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A lightweight summary of a cycle — suitable for list views and calendars
 * without loading the full OptimizationCycle definition.
 */
export interface CycleSummary {
  id:              OptimizationCycleId;
  name:            string;
  tagline:         string;
  cadence:         OptimizationCadence;
  annualFrequency: number | "variable";
  typicalDuration: string;
  primaryRole:     CycleRole;
  outputCount:     number;
  phaseCount:      number;
}
