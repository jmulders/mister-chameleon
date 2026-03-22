/**
 * Support Process Types
 *
 * The operational support architecture for the Mister Chameleon platform.
 *
 * Defines the structured types used to categorize, route, and resolve support
 * events across the platform. This is not a full ticketing system — it is the
 * authoritative definition of what a "support process" is, how it flows, who
 * owns it, and when it escalates.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   Without process definitions, support is reactive and inconsistent:
 *   - The same CMS issue gets handled differently by different engineers.
 *   - Incidents have no SLA, so clients have no expectations to hold.
 *   - Feature requests disappear into Slack instead of a backlog.
 *
 *   Formalising processes creates: consistent client experience, clear
 *   internal ownership, auditable escalation trails, and a foundation for
 *   tooling (Linear, Slack workflows, client portals).
 *
 * ─── Six process types ────────────────────────────────────────────────────────
 *
 *   incident             Platform or integration failure affecting live traffic.
 *   content-issue        Variant content missing, malformed, or serving incorrectly.
 *   cms-issue            CMS connectivity, schema mismatch, or content modelling error.
 *   tracking-data-issue  Analytics gap, event misfiring, or session data anomaly.
 *   tenant-config-issue  Incorrect flag, rule, or theme configuration for a tenant.
 *   feature-request      Client or internal request for new platform behaviour.
 *
 * ─── Connection map ───────────────────────────────────────────────────────────
 *
 *   SupportProcessDefinition.linkedModules   → product/types.ts (ProductModuleId)
 *   SupportProcessDefinition.linkedServices  → product/types.ts (ServiceOfferingId)
 *   EscalationStep.role                      → CycleRole (optimization/types.ts)
 *   SupportOwnerRole                         → subset of CycleRole
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   support/types.ts     ← YOU ARE HERE — all type definitions
 *   support/processes.ts ← six concrete process definitions + catalog
 *   support/index.ts     ← barrel re-export
 *
 * ─── Tooling notes ────────────────────────────────────────────────────────────
 *
 *   This module is designed to be tooling-agnostic. The structures map cleanly
 *   to Linear issues (SupportSeverity → priority, SupportProcessTypeId →
 *   label/team), Slack workflows (ResponseStep → workflow action), and future
 *   client portal ticket types. See toolingNotes on SupportProcessDefinition.
 */

import type { ProductModuleId, ServiceOfferingId } from "@/product/types";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for each defined support process type.
 *
 * Convention: lowercase-hyphenated. Never rename — these IDs may appear
 * in stored ticket records, Slack workflow metadata, and client communications.
 *
 * incident             Platform or integration failure. Highest urgency.
 * content-issue        Variant content gap or serving error. Client-visible.
 * cms-issue            CMS connectivity, schema, or modelling failure.
 * tracking-data-issue  Analytics event or session data problem.
 * tenant-config-issue  Wrong flag, rule, or theme config for a specific tenant.
 * feature-request      New behaviour or integration requested by client or team.
 */
export type SupportProcessTypeId =
  | "incident"
  | "content-issue"
  | "cms-issue"
  | "tracking-data-issue"
  | "tenant-config-issue"
  | "feature-request";

/**
 * Severity levels for support events.
 *
 * Maps to urgency, SLA response targets, and escalation thresholds.
 *
 * critical   Live platform failure, revenue or data impact. Immediate response.
 * high       Significant degradation or client-visible error. Same-day response.
 * medium     Notable issue with workaround available. 2-business-day response.
 * low        Minor issue or cosmetic problem. 5-business-day response.
 * advisory   No immediate action required. Tracked for pattern monitoring.
 */
export type SupportSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "advisory";

/**
 * Roles that can own or participate in support processes.
 *
 * Subset of CycleRole (optimization/types.ts) — same engagement model,
 * applied to reactive support rather than scheduled optimization cycles.
 *
 * account-manager      MC-side: client relationship, first point of contact.
 * platform-engineer    MC-side: technical diagnosis, platform-level fixes.
 * content-strategist   MC-side: variant quality, content modelling guidance.
 * client-marketing     Client-side: content production, CMS operations.
 * client-technical     Client-side: CMS config, integration, access credentials.
 */
export type SupportOwnerRole =
  | "account-manager"
  | "platform-engineer"
  | "content-strategist"
  | "client-marketing"
  | "client-technical";

/**
 * How a support event is initially received.
 *
 * slack-alert        Automated or manual message in the #support Slack channel.
 * client-email       Direct email from client to account manager or inbox.
 * platform-monitor   Automated alert from uptime/error monitoring (e.g. Sentry).
 * internal-review    Identified during a scheduled optimization cycle or QBR.
 * client-portal      Submitted through a future client-facing support portal.
 */
export type SupportChannelId =
  | "slack-alert"
  | "client-email"
  | "platform-monitor"
  | "internal-review"
  | "client-portal";

/**
 * Lifecycle state of a support event.
 *
 * open            Received but not yet triaged.
 * triaged         Assessed, owner assigned, severity confirmed.
 * in-progress     Actively being investigated or resolved.
 * awaiting-client Blocked on information or action from the client.
 * resolved        Fix confirmed and verified in the live environment.
 * closed          Resolution communicated to client, ticket archived.
 * escalated       Elevated to a higher-severity response or external party.
 * wont-fix        Acknowledged but out of scope; client informed with reason.
 */
export type SupportTicketStatus =
  | "open"
  | "triaged"
  | "in-progress"
  | "awaiting-client"
  | "resolved"
  | "closed"
  | "escalated"
  | "wont-fix";

// ─────────────────────────────────────────────────────────────────────────────
// SLA TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Response SLA targets for a given severity level.
 *
 * All durations are in business hours unless noted.
 * "Business hours" = Monday–Friday, 09:00–18:00 UK time.
 *
 * firstResponseHours    Time from receipt to first acknowledgement.
 * resolutionTargetHours Time from acknowledgement to confirmed resolution.
 *                       Null for feature-requests (no fixed resolution target).
 * updateCadenceHours    How often to send a status update if unresolved.
 */
export interface ResponseSLA {
  firstResponseHours: number;
  resolutionTargetHours: number | null;
  updateCadenceHours: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCALATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Condition that triggers an escalation step.
 *
 * sla-breach          The first-response or resolution SLA target has been missed.
 * no-diagnosis        Root cause cannot be identified within the response window.
 * client-impact-grows The incident's blast radius or client-visible impact has grown.
 * external-dependency Requires a third-party vendor (CMS, analytics, infra) to act.
 * repeat-occurrence   The same issue has occurred more than once in 30 days.
 * scope-unclear       Cannot determine ownership without senior clarification.
 */
export type EscalationTrigger =
  | "sla-breach"
  | "no-diagnosis"
  | "client-impact-grows"
  | "external-dependency"
  | "repeat-occurrence"
  | "scope-unclear";

/**
 * A single step in the escalation path.
 *
 * Describes who gets brought in, what action they take, and what triggers
 * this escalation.
 */
export interface EscalationStep {
  /** Sequential position in the escalation path (1 = first escalation). */
  step: number;

  /** The role being escalated to. */
  role: SupportOwnerRole;

  /** What this person does when escalated to. */
  action: string;

  /** Which conditions trigger this escalation step. */
  triggers: readonly EscalationTrigger[];

  /**
   * Whether this escalation step should be surfaced to the client.
   * True = notify client that escalation has occurred.
   */
  notifyClient: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE PATH TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single step in the expected response path for a support process.
 *
 * Response steps are ordered. They describe the standard flow from receipt
 * to resolution — not the exception path (see EscalationStep for that).
 */
export interface ResponseStep {
  /** Sequential position in the response path (1 = first step after receipt). */
  step: number;

  /** Short imperative label for checklists and runbooks. */
  label: string;

  /** What happens in this step and why it matters. 1–2 sentences. */
  description: string;

  /** Who is responsible for executing this step. */
  owner: SupportOwnerRole;

  /**
   * Whether this step requires a client-visible communication (email, Slack,
   * portal update). Steps with this flag must produce a written update.
   */
  clientFacing: boolean;
}

/**
 * The complete expected flow from receipt to resolution.
 */
export interface ResponsePath {
  /** Ordered steps from triage through to resolution and closure. */
  steps: readonly ResponseStep[];

  /**
   * Roles that must be notified at the moment the ticket is opened.
   * These are the immediate recipients before any triage happens.
   */
  initialNotification: readonly SupportOwnerRole[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete definition of a support process type.
 *
 * A process definition is a template — it describes how a category of support
 * event should be handled in general. Actual support events are instances of
 * a process, enriched with tenant-specific, time-specific, and severity-specific
 * detail.
 */
export interface SupportProcessDefinition {
  // ── Identity ────────────────────────────────────────────────────────────────

  /** Stable process type identifier. */
  id: SupportProcessTypeId;

  /** Short display name for dashboards and runbooks. */
  label: string;

  /**
   * What this process type covers and why it exists as a separate category.
   * 2–3 sentences written for account managers, not engineers.
   */
  description: string;

  // ── Severity ────────────────────────────────────────────────────────────────

  /**
   * Default severity for new events of this type before triage.
   * May be overridden per-event after diagnosis.
   */
  defaultSeverity: SupportSeverity;

  /**
   * Severity levels that are valid for this process type.
   * Not all severity levels apply to all process types.
   * E.g. "feature-request" can never be "critical".
   */
  applicableSeverities: readonly SupportSeverity[];

  /** SLA targets keyed by severity level. */
  slaByServerity: Partial<Record<SupportSeverity, ResponseSLA>>;

  // ── Ownership ───────────────────────────────────────────────────────────────

  /**
   * The role that owns this process type — first point of contact, triage
   * authority, and communication owner for client updates.
   */
  primaryOwner: SupportOwnerRole;

  /**
   * Additional roles that should be looped in for all events of this type,
   * regardless of severity.
   */
  defaultParticipants: readonly SupportOwnerRole[];

  // ── Intake ──────────────────────────────────────────────────────────────────

  /**
   * Channels through which this type of support event is typically reported.
   * Ordered from most to least common for this type.
   */
  typicalChannels: readonly SupportChannelId[];

  /**
   * Key information needed to triage this event type.
   * Used as a checklist when first acknowledging the event.
   */
  triageChecklist: readonly string[];

  // ── Response path ───────────────────────────────────────────────────────────

  /** The standard response path for a median-severity event of this type. */
  responsePath: ResponsePath;

  // ── Escalation path ─────────────────────────────────────────────────────────

  /** Ordered escalation steps, triggered by specific conditions. */
  escalationPath: readonly EscalationStep[];

  // ── Platform linkage ────────────────────────────────────────────────────────

  /**
   * Product modules that are typically implicated in this process type.
   * Informs routing and initial diagnosis scope.
   */
  linkedModules: readonly ProductModuleId[];

  /**
   * Service offerings under which this process type is typically handled.
   * Helps connect support events to commercial engagement scope.
   */
  linkedServices: readonly ServiceOfferingId[];

  // ── Tooling notes ───────────────────────────────────────────────────────────

  /**
   * Notes on how this process connects to or could connect to tooling.
   * Non-normative — describes intent, not current integration state.
   */
  toolingNotes: SupportToolingNotes;
}

/**
 * Notes on how a support process definition connects to external tooling.
 *
 * These are non-normative observations about future or potential integrations.
 * Stored on the definition so that tooling intent lives close to the type.
 */
export interface SupportToolingNotes {
  /**
   * How this process type maps to a Linear issue.
   * Includes suggested team, label, and priority mappings.
   */
  linear?: string;

  /**
   * How this process type maps to Slack workflows or channels.
   * Includes suggested channel routing and workflow trigger notes.
   */
  slack?: string;

  /**
   * Notes on client portal behaviour for this process type,
   * if/when a client-facing support portal is built.
   */
  clientPortal?: string;

  /**
   * Any automated detection or alerting that could surface this event type
   * without manual reporting (e.g. Sentry, uptime monitors, data pipeline alerts).
   */
  automation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete support process catalog — all six defined process types,
 * indexed by SupportProcessTypeId.
 *
 * @example
 *   import { SUPPORT_PROCESS_CATALOG } from "@/support";
 *   const incident = SUPPORT_PROCESS_CATALOG["incident"];
 */
export type SupportProcessCatalog = Record<
  SupportProcessTypeId,
  SupportProcessDefinition
>;
