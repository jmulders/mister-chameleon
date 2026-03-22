/**
 * Onboarding Flow Types
 *
 * The internal model for standardising how new clients are onboarded onto
 * the Mister Chameleon platform. This file defines every type the flow
 * system uses — step definitions, required inputs, output artifacts, and
 * the flow wrapper itself.
 *
 * ─── What this is and what it is not ─────────────────────────────────────────
 *
 *   IS:   A static definition of the standard onboarding process — the steps,
 *         what each step needs, what it produces, and how they depend on each
 *         other. Think of it as the template for every client engagement.
 *
 *   IS NOT: A runtime record of a specific client's onboarding progress.
 *           That is an OnboardingRecord (future admin tooling) which will hold
 *           a reference to an OnboardingFlow + per-step status + timestamps.
 *           The types here are the schema; the records are the instances.
 *
 * ─── Five-phase model ────────────────────────────────────────────────────────
 *
 *   intake              Capture client context, goals, and package selection.
 *   context-mapping     Map traffic reality to platform decisioning vocabulary.
 *   content-mapping     Define variant strategy and produce CMS copy briefs.
 *   technical-setup     Configure tenant, connect CMS and n8n, validate pipeline.
 *   launch-optimisation Go live and establish the ongoing feedback loop.
 *
 * ─── How this connects to the product model ──────────────────────────────────
 *
 *   OnboardingStep.relatedServiceOffering → ServiceOfferingId (product/types.ts)
 *   OnboardingStep.activatedModules       → ProductModuleId[] (product/types.ts)
 *   OnboardingFlow.packageId              → PackageId (product/module-registry.ts)
 *
 *   This means a future admin tool can:
 *   • Cross-reference each step with the service offering it implements.
 *   • Know which modules are activated at each stage.
 *   • Generate the right tenant feature flags for each package at step 4.
 *
 * ─── Admin tooling hooks ─────────────────────────────────────────────────────
 *
 *   OnboardingStep.validStatuses      Controls which status transitions are legal.
 *   OnboardingStep.canBeSkipped       Guards against accidentally skipping a step.
 *   RequiredInput.required            Separates blockers from nice-to-haves.
 *   OutputArtifact.blocksNextStep     Identifies the hard gate between phases.
 *   OnboardingStep.ownerRole          Drives responsibility assignment in a PM tool.
 *   OnboardingStep.checklistItems     Ready-to-render checklist for admin UI.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   onboarding/types.ts    ← YOU ARE HERE — all type definitions
 *   onboarding/flow.ts     ← step definitions, STANDARD_ONBOARDING_FLOW, helpers
 *   onboarding/index.ts    ← barrel re-export
 */

import type { ProductModuleId, ServiceOfferingId } from "@/product/types";
import type { PackageId } from "@/product/module-registry";

// Re-export for consumers who import from "@/onboarding" only.
export type { PackageId, ProductModuleId, ServiceOfferingId };

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for each onboarding step.
 *
 * intake               Capture business context, goals, and package selection.
 * context-mapping      Map traffic sources and visitor intent to platform vocabulary.
 * content-mapping      Define variant strategy and write CMS copy briefs.
 * technical-setup      Configure, connect, and validate the full platform pipeline.
 * launch-optimisation  Go live, baseline, and establish the iteration rhythm.
 */
export type OnboardingStepId =
  | "intake"
  | "context-mapping"
  | "content-mapping"
  | "technical-setup"
  | "launch-optimisation";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMERATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle states for a single onboarding step.
 *
 * These are the states a specific client's step instance can be in.
 * The static OnboardingStep definition declares which states are valid
 * via the validStatuses field.
 *
 * not-started       Default. The step has not been initiated.
 * in-progress       Active work is underway on this step.
 * awaiting-client   Blocked: waiting for the client to supply a required input.
 * awaiting-review   MC has produced outputs; waiting for client sign-off.
 * complete          All outputs produced, reviewed, and accepted.
 * skipped           Intentionally bypassed. Only valid when canBeSkipped is true.
 *                   A skip reason must be recorded in the instance.
 */
export type OnboardingStepStatus =
  | "not-started"
  | "in-progress"
  | "awaiting-client"
  | "awaiting-review"
  | "complete"
  | "skipped";

/**
 * Who drives the work in a given step.
 *
 * internal-led   Mister Chameleon owns the work; client responds to requests.
 * client-led     Client owns the work; MC reviews and accepts outputs.
 * joint          Both parties are active participants; neither can finish alone.
 */
export type OnboardingOwnerRole = "internal-led" | "client-led" | "joint";

/**
 * Who is the origin of a required input.
 *
 * client     The client must supply this. It cannot be inferred or created by MC.
 * internal   MC produces this from their own work or tools.
 * joint      Requires collaborative production — e.g. output of a workshop.
 */
export type InputSource = "client" | "internal" | "joint";

/**
 * The kind of output artifact a step produces.
 *
 * document         Written deliverable: brief, spec, matrix, report, handover note.
 * config           Typed configuration: tenant config file, feature flag set.
 * cms-content      Content entered into the client's CMS against variant keys.
 * workflow         An external workflow configured: n8n, CRM automation, Slack.
 * validated-state  A live platform state confirmed correct via the diagnostics bar.
 * data-export      Data extracted from an external tool: analytics, GA export, CRM.
 */
export type ArtifactType =
  | "document"
  | "config"
  | "cms-content"
  | "workflow"
  | "validated-state"
  | "data-export";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A specific input that a step requires before its work can be completed.
 *
 * Inputs are not always blocking — required:false marks something as a
 * nice-to-have that improves quality but doesn't prevent completion.
 */
export interface RequiredInput {
  /** Stable slug within the step, e.g. "analytics-export". */
  id: string;

  /** Short display label for admin UI and checklists. */
  label: string;

  /** What exactly is needed and why. Written for the account manager. */
  description: string;

  /** Where this input comes from. */
  source: InputSource;

  /**
   * Whether this input must be present before the step can be marked complete.
   * false inputs are "helpful if available" — quality improves but work proceeds.
   */
  required: boolean;

  /**
   * The expected format or medium for this input.
   * Descriptive, not machine-parsed. Used in client-facing request emails.
   * Examples: "Google Doc", "CSV export", "Zoom call recording", "access credentials".
   */
  format?: string;
}

/**
 * A concrete, deliverable output produced by completing a step.
 *
 * Every step must produce at least one artifact. Artifacts marked
 * blocksNextStep:true must exist before the next step can begin.
 */
export interface OutputArtifact {
  /** Stable slug within the step, e.g. "tenant-config-file". */
  id: string;

  /** Short display label. */
  label: string;

  /**
   * What this artifact contains and why it matters.
   * Written for the account manager; honest about what "done" looks like.
   */
  description: string;

  /** The kind of artifact this is. */
  artifactType: ArtifactType;

  /**
   * Whether this artifact must exist before the next step can begin.
   * At least one artifact per step should be true — otherwise the step
   * has no hard exit criteria.
   */
  blocksNextStep: boolean;

  /**
   * Reference to a template, example file, or docs path.
   * Relative to the project root. Used by admin tooling to surface
   * "see X as a starting point" guidance when creating the artifact.
   *
   * Examples:
   *   "tenant/templates/acme-growth-config.ts"
   *   "docs/new-tenant-setup.md"
   */
  templateReference?: string;
}

/**
 * A single checklist item in a step — a specific, actionable task.
 *
 * Checklist items are more granular than required inputs and output artifacts.
 * They are the atomic tasks that, when all checked, result in a step being
 * complete. Admin tooling renders these as a checkbox list within a step card.
 */
export interface ChecklistItem {
  /** Stable slug, unique within the step. */
  id: string;

  /** Imperative task statement. Example: "Share GA access with MC team". */
  label: string;

  /**
   * Who is responsible for completing this item.
   * Drives task assignment in a PM tool or admin interface.
   *
   * "joint" items require active participation from both parties
   * (e.g. a prioritisation call, a sign-off that needs live discussion).
   */
  owner: "internal" | "client" | "joint";

  /**
   * Whether this item must be checked before the step can be marked complete.
   * false items are tracked but not gating.
   */
  required: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE STEP INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single phase in the standard onboarding flow.
 *
 * OnboardingStep is a DEFINITION — a template for how this phase should run.
 * It does not hold state (current status, timestamps, notes). Those belong
 * in an OnboardingRecord instance created per client.
 *
 * ─── For admin tooling ───────────────────────────────────────────────────────
 *
 *   Render steps as cards in a Kanban board or linear checklist.
 *   Use validStatuses to constrain which transitions the UI allows.
 *   Use blocksNextStep to show/hide the "start next step" button.
 *   Use ownerRole to assign tasks to internal team vs client contact.
 *   Use checklistItems to render an actionable checklist within the card.
 */
export interface OnboardingStep {
  /** Stable identifier. Must match an OnboardingStepId value. */
  id: OnboardingStepId;

  /** Customer-facing step name. Used in client communications and admin UI. */
  name: string;

  /**
   * Two-to-three sentence description of what this step does and why it exists.
   * Written to be understandable by a non-technical account manager.
   */
  description: string;

  /**
   * The single success criterion for this step.
   * One sentence. "This step is done when: [objective]."
   * Used as the acceptance criteria in admin tooling.
   */
  objective: string;

  /** Who drives this step's work. */
  ownerRole: OnboardingOwnerRole;

  /**
   * Which status transitions are valid for this step.
   * Used by admin tooling to prevent illegal state changes.
   *
   * All steps include: not-started, in-progress, awaiting-client,
   * awaiting-review, complete. Only steps where canBeSkipped is true
   * include "skipped".
   */
  validStatuses: readonly OnboardingStepStatus[];

  /**
   * Whether this step may be bypassed for a specific client.
   *
   * When true, admin tooling may set status to "skipped" with a recorded reason.
   * When false, the step cannot be skipped — attempting to do so is a validation
   * error in the admin tool.
   *
   * Intake is never skippable. Context and content mapping may be skippable
   * for clients who arrive with mature positioning already done.
   */
  canBeSkipped: boolean;

  /**
   * Inputs this step requires to proceed.
   * Inputs with required:true block completion; false inputs improve quality.
   */
  requiredInputs: readonly RequiredInput[];

  /**
   * Artifacts this step produces upon completion.
   * Artifacts with blocksNextStep:true must exist before the following step starts.
   */
  outputArtifacts: readonly OutputArtifact[];

  /**
   * Granular checklist items for admin UI rendering.
   * Items with required:true must be checked before the step can be completed.
   * Ordered to reflect the natural work sequence within the step.
   */
  checklistItems: readonly ChecklistItem[];

  /**
   * Steps that must reach "complete" status before this step can begin.
   * Empty for the first step. Used by admin tooling to enforce sequencing.
   */
  prerequisiteSteps: readonly OnboardingStepId[];

  /**
   * The service offering from the product catalog that this step implements.
   * Links the process model back to the commercial model.
   * Absent for steps (launch-optimisation) that span ongoing service engagement.
   */
  relatedServiceOffering?: ServiceOfferingId;

  /**
   * Platform modules this step activates or validates.
   * Primarily relevant for technical-setup (all modules) and launch-optimisation
   * (confirms activation). Used by admin tooling to show progress toward a
   * complete module footprint.
   */
  activatedModules?: readonly ProductModuleId[];

  /**
   * Indicative time to complete this step, assuming client responsiveness.
   * Non-binding. Used for timeline planning during intake.
   */
  estimatedDuration: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOW INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complete onboarding flow definition — an ordered sequence of steps
 * that delivers a client from signed contract to live platform.
 *
 * The standard flow is package-agnostic in step structure; the package
 * affects which modules are activated in technical-setup and which
 * capabilities are validated at launch.
 */
export interface OnboardingFlow {
  /** Stable identifier for this flow definition. */
  id: string;

  /** Display name. */
  name: string;

  /**
   * What this flow delivers end-to-end, in one sentence.
   * Used as a summary in proposals and admin dashboards.
   */
  summary: string;

  /**
   * Ordered step definitions. Ordered = prerequisite ordering is implicit
   * in the array. Do not reorder without updating prerequisiteSteps.
   */
  steps: readonly OnboardingStep[];

  /**
   * Indicative total duration from kick-off to live platform.
   * Sum of step durations assuming sequential completion and client
   * responsiveness. In practice, steps overlap and client lag extends this.
   */
  estimatedTotalDuration: string;

  /**
   * The minimum package this flow is designed to deliver.
   * "essential" covers the standard flow. Growth and scale variants
   * extend technical-setup and launch validation but use the same step structure.
   */
  minimumPackage: PackageId;
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX TYPE
// ─────────────────────────────────────────────────────────────────────────────

/** Mapped type for O(1) step lookup by ID. */
export type OnboardingStepIndex = Readonly<Record<OnboardingStepId, OnboardingStep>>;

// ─────────────────────────────────────────────────────────────────────────────
// FUTURE: INSTANCE TYPES (not yet implemented)
// ─────────────────────────────────────────────────────────────────────────────
//
// When admin tooling is built, a per-client onboarding instance will need:
//
//   interface OnboardingStepInstance {
//     stepId:       OnboardingStepId;
//     status:       OnboardingStepStatus;
//     startedAt?:   string;   // ISO 8601
//     completedAt?: string;   // ISO 8601
//     skipReason?:  string;   // required when status === "skipped"
//     notes?:       string;   // freeform internal notes
//     completedChecklist: string[];  // IDs of checked ChecklistItems
//   }
//
//   interface OnboardingRecord {
//     id:         string;          // unique per client
//     tenantId:   string;          // links to TenantConfig.tenantId
//     flowId:     string;          // links to OnboardingFlow.id
//     packageId:  PackageId;       // which package this client is on
//     steps:      OnboardingStepInstance[];
//     createdAt:  string;
//     updatedAt:  string;
//   }
//
// These are left as comments intentionally — they require DB tables and
// server actions not yet in scope.
