/**
 * Release Management Types
 *
 * The operational model for how platform changes move from development
 * through staging to production across one or more tenants.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   Without a structured release model, the platform has no language for:
 *   - What is "in" a release vs. what is live
 *   - Which tenants are affected by a given change
 *   - How to roll back safely if something goes wrong
 *   - How feature flags are progressed from internal to client-visible
 *
 *   This module creates a shared vocabulary between the platform engineer,
 *   account manager, and any future tooling (CI/CD, deployment dashboard).
 *   It is architecture and process documentation, not CI/CD automation.
 *
 * ─── Release anatomy ──────────────────────────────────────────────────────────
 *
 *   A release bundles one or more Changes, each with a specific ChangeType.
 *   Changes are applied to one or more Environments, in a specific order,
 *   against a defined TenantRolloutScope (all tenants, specific tenants, or
 *   platform-only). Each release carries a RollbackPlan describing how to
 *   undo the changes if the release is harmful.
 *
 * ─── Four rollout patterns ────────────────────────────────────────────────────
 *
 *   platform-wide          Code change applied to all tenants simultaneously.
 *   tenant-targeted        Change applied to a specific tenant or ordered list
 *                          of tenants — used for feature flag progressions.
 *   staged-flag-rollout    Flag disabled → staging only → one tenant →
 *                          all tenants. The standard feature progression path.
 *   hotfix                 Expedited release for a confirmed production incident.
 *                          Bypasses standard staging validation window.
 *
 * ─── Connection map ───────────────────────────────────────────────────────────
 *
 *   ReleaseDefinition.featureFlagChanges → TenantFeatureFlags (tenant/types.ts)
 *   TenantRolloutTarget.tenantId         → TenantConfig.tenantId (tenant/types.ts)
 *   ReleaseChange.linkedCapabilities     → CapabilityId (product/features.ts)
 *   ReleaseDefinition.linkedSupportId    → SupportProcessTypeId (support/types.ts)
 *   ReleaseDefinition.linkedServiceId    → ServiceOfferingId (product/types.ts)
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   releases/types.ts ← YOU ARE HERE — all type definitions
 *   releases/model.ts ← release catalog, example rollout structures, helpers
 *   releases/index.ts ← barrel re-export
 */

import type { TenantFeatureFlags } from "@/tenant/types";
import type { CapabilityId }       from "@/product/features";
import type { ServiceOfferingId }  from "@/product/types";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable, human-readable release identifier.
 *
 * Convention: YYYY-MM-NNN for scheduled releases, "hotfix-YYYY-MM-DD[-N]"
 * for emergency fixes, "rollback-<original-id>" for rollback releases.
 *
 * Examples:
 *   "2026-03-001"       First release of March 2026.
 *   "2026-03-002"       Second release of March 2026.
 *   "hotfix-2026-03-15" Emergency fix on 15 March 2026.
 *   "rollback-2026-03-001" Rollback of 2026-03-001.
 */
export type ReleaseId = string;

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The deployment target for a release or validation step.
 *
 * staging     The pre-production environment. Mirrors production infrastructure
 *             but receives changes first. Tenant traffic is internal-only.
 *             Hostname convention: staging.misterchameleon.com or localhost.
 *
 * production  Live environment. Real tenant traffic. Changes validated in
 *             staging before promotion. Feature flags may differ per tenant.
 */
export type Environment = "staging" | "production";

// ─────────────────────────────────────────────────────────────────────────────
// RELEASE STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle state of a release.
 *
 * draft          Being authored. No deployment yet.
 * scheduled      Release window confirmed. Awaiting deployment.
 * in-progress    Actively being deployed to the target environment.
 * staged         Deployed to staging. Validation in progress.
 * released       Successfully deployed to production and verified.
 * rolled-back    A rollback was executed. Changes have been reverted.
 * cancelled      Release was abandoned before reaching production.
 */
export type ReleaseStatus =
  | "draft"
  | "scheduled"
  | "in-progress"
  | "staged"
  | "released"
  | "rolled-back"
  | "cancelled";

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The category of change included in a release.
 *
 * platform-code        Next.js application code — components, API routes,
 *                      serving logic, decision engine. Requires a full deploy.
 *
 * tenant-config        Changes to a TenantConfig object — adding a new tenant,
 *                      updating CMS or decision provider, updating hostnames.
 *                      Requires a code deploy (configs are code, not data).
 *
 * feature-flag         Changes to TenantFeatureFlags values. Gate new behaviour
 *                      behind flags before broader rollout. Requires a deploy
 *                      unless flags are backed by a runtime store.
 *
 * cms-schema           New or modified CMS content types, field additions,
 *                      or schema migrations. Applied in the CMS, not the app.
 *                      May require coordinated platform-code change.
 *
 * decision-rules       Updates to the rules-based decision engine configuration —
 *                      new rules, reordered rules, updated signal thresholds.
 *                      May be runtime-updatable without a full deploy.
 *
 * data-pipeline        Changes to analytics event schemas, KPI calculations,
 *                      or database migrations. Requires careful ordering
 *                      to avoid data integrity gaps.
 *
 * dependency           Third-party package upgrade or integration update
 *                      (e.g. Sanity SDK, Next.js version, Supabase client).
 *                      May require staging validation before production.
 *
 * documentation        Docs, runbooks, or decision logs only. No code change.
 *                      Tracked for audit trail purposes.
 */
export type ChangeType =
  | "platform-code"
  | "tenant-config"
  | "feature-flag"
  | "cms-schema"
  | "decision-rules"
  | "data-pipeline"
  | "dependency"
  | "documentation";

// ─────────────────────────────────────────────────────────────────────────────
// ROLLOUT SCOPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which tenants are affected by this release.
 *
 * all-tenants      Every active tenant receives this change. Used for
 *                  platform-code, dependency, and data-pipeline changes.
 *
 * tenant-targeted  A specific set of tenants receives this change. Used for
 *                  feature flag progressions, tenant-specific config changes,
 *                  and staged rollouts where one client gets the change first.
 *
 * platform-only    No tenant-visible change — infrastructure, documentation,
 *                  or internal tooling only. No tenant validation required.
 */
export type RolloutScope =
  | "all-tenants"
  | "tenant-targeted"
  | "platform-only";

// ─────────────────────────────────────────────────────────────────────────────
// ROLLOUT PATTERN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The strategy used to progress this release from staging to full production.
 *
 * immediate          Deploy to all targets simultaneously. Used for small,
 *                    low-risk changes and hotfixes. Shortest time to production.
 *
 * staged-promotion   Deploy to staging first, validate, then promote to
 *                    production. The standard pattern for non-hotfix releases.
 *
 * tenant-progressive Deploy to one tenant in production first, monitor for
 *                    a defined validation window, then expand to remaining
 *                    tenants. Used for higher-risk feature changes.
 *
 * flag-gated         Feature is deployed in an off state. The flag is enabled
 *                    per-tenant on a separate schedule after the code is live.
 *                    Separates code deployment from feature activation.
 */
export type RolloutPattern =
  | "immediate"
  | "staged-promotion"
  | "tenant-progressive"
  | "flag-gated";

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE ITEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single discrete change bundled into a release.
 *
 * A release may contain multiple changes of different types.
 * Each change describes what changed, why, and what it affects.
 */
export interface ReleaseChange {
  /** Stable ID within this release. Used to reference changes in rollback plans. */
  id: string;

  /** What category of change this is. */
  type: ChangeType;

  /** Short imperative description for changelogs and deployment notes. */
  summary: string;

  /**
   * Why this change is being made. The "so that" rationale.
   * 1–2 sentences. Written for non-engineers.
   */
  rationale: string;

  /**
   * Files, components, or platform areas affected by this change.
   * Used for impact assessment and reviewer scoping.
   */
  affectedAreas: readonly string[];

  /**
   * Platform capabilities that are introduced, modified, or removed
   * by this change. Empty array if the change is infrastructure-only.
   */
  linkedCapabilities: readonly CapabilityId[];

  /**
   * Whether this change is independently reversible without a full rollback.
   *
   * true  = This change can be undone (e.g. flag revert, config restore)
   *         without reverting the entire release.
   * false = Rolling back requires reverting the full deployment.
   */
  independentlyReversible: boolean;

  /**
   * Notes on how to reverse this specific change, if independently reversible.
   */
  reversalNotes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE FLAG CHANGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A set of feature flag mutations applied to a specific tenant as part of
 * a release. Expresses the delta — only changed flags need to be listed.
 *
 * @example
 *   // Enable AI decision provider for a tenant
 *   const delta: FeatureFlagDelta = {
 *     aiDecisionProvider: true,
 *     abTesting: true,
 *   };
 */
export type FeatureFlagDelta = Partial<TenantFeatureFlags>;

// ─────────────────────────────────────────────────────────────────────────────
// TENANT ROLLOUT TARGET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A specific tenant included in a tenant-targeted rollout.
 *
 * When a release uses RolloutScope "tenant-targeted", it carries an ordered
 * list of TenantRolloutTarget entries. The order determines deployment sequence
 * for tenant-progressive rollouts (first entry = first to receive the change).
 */
export interface TenantRolloutTarget {
  /** The tenantId from TenantConfig. Must match a registered tenant. */
  tenantId: string;

  /**
   * Feature flag changes to apply to this tenant as part of this release.
   * Only the flags that are changing need to be specified.
   */
  flagChanges?: FeatureFlagDelta;

  /**
   * Whether this tenant serves as the canary for a tenant-progressive rollout.
   * The first-in-sequence canary tenant is monitored before others proceed.
   */
  isCanary?: boolean;

  /**
   * How long (in hours) to monitor this tenant's production metrics before
   * proceeding to the next tenant in a tenant-progressive rollout.
   * Only relevant when rolloutPattern is "tenant-progressive".
   */
  validationWindowHours?: number;

  /**
   * Notes specific to this tenant's inclusion in this release.
   * E.g. "AI feature requested by client in March QBR."
   */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single item in the pre-release or post-deployment validation checklist.
 */
export interface ValidationCheckItem {
  /** Short imperative label for the check. */
  label: string;

  /** Who is responsible for executing this check. */
  owner: "platform-engineer" | "account-manager" | "content-strategist" | "automated";

  /**
   * The environment in which this check is performed.
   * staging = must pass before production promotion.
   * production = post-deployment verification step.
   */
  environment: Environment;

  /**
   * Whether this check must pass before the release can proceed.
   * Blocking checks halt the release if they fail.
   */
  blocking: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLBACK PLAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The strategy for reverting a release if it causes harm in production.
 *
 * Rollback plans must be defined before a release is deployed — not after
 * a problem is discovered. The discipline of writing the plan before deployment
 * forces the team to reason about reversibility early.
 */
export interface RollbackPlan {
  /**
   * The primary method for reverting this release.
   *
   * revert-deploy        Re-deploy the previous Git ref. Fastest for code changes.
   *                      Requires the previous build artifact to be available.
   *
   * config-restore       Restore the previous tenant config file from Git.
   *                      Used for tenant-config and decision-rules changes.
   *
   * flag-revert          Set the changed feature flags back to their prior values.
   *                      Fastest and safest for flag-gated releases.
   *
   * cms-schema-rollback  Revert CMS content type changes via the CMS dashboard.
   *                      Use only when the schema change is backward-compatible
   *                      or no production content was migrated.
   *
   * data-migration-down  Run the database migration down script.
   *                      Only available if the migration includes a reversible
   *                      down step. High-risk — requires DBA sign-off.
   *
   * manual               The rollback requires manual steps that cannot be
   *                      automated or scripted. Document steps fully below.
   */
  strategy:
    | "revert-deploy"
    | "config-restore"
    | "flag-revert"
    | "cms-schema-rollback"
    | "data-migration-down"
    | "manual";

  /**
   * How long the rollback is expected to take from decision to confirmed revert.
   * Used to set client and team expectations during an incident.
   */
  estimatedRollbackMinutes: number;

  /**
   * Ordered list of steps to execute a rollback of this release.
   * Written as unambiguous imperatives — no assumed knowledge.
   * Must be written before the release is deployed.
   */
  steps: readonly string[];

  /**
   * Criteria that should trigger a rollback decision.
   * E.g. "Error rate on /api/experience exceeds 5% for more than 10 minutes."
   */
  rollbackTriggers: readonly string[];

  /**
   * Criteria that confirm the rollback was successful.
   * E.g. "Variant serving logs show the prior decision pattern restored."
   */
  successCriteria: readonly string[];

  /**
   * Any data loss or state that cannot be recovered if the rollback is executed.
   * Must be explicitly acknowledged — leave empty only if there is truly no risk.
   */
  dataLossRisk: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGING VALIDATION RECORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evidence that a release was validated in staging before production promotion.
 * Filled in by the platform engineer after staging deployment.
 */
export interface StagingValidationRecord {
  /** ISO 8601 timestamp when staging deployment completed. */
  deployedAt: string;

  /** ISO 8601 timestamp when staging validation was signed off. */
  validatedAt: string;

  /** Who performed the staging validation. */
  validatedBy: string;

  /**
   * Summary of what was checked and confirmed in staging.
   * Referenced during production post-deployment review.
   */
  validationSummary: string;

  /**
   * Any issues found in staging and how they were resolved before promotion.
   * Empty array if staging validation was clean.
   */
  issuesFoundAndResolved: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// RELEASE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete definition of a platform release.
 *
 * A release definition serves as both a deployment plan (before the release)
 * and an audit record (after the release). The same structure is used
 * throughout the lifecycle — status and timestamp fields are filled in
 * as the release progresses.
 */
export interface ReleaseDefinition {
  // ── Identity ─────────────────────────────────────────────────────────────────

  /** Stable, human-readable release identifier. */
  id: ReleaseId;

  /**
   * Human-readable release title for changelogs and notifications.
   * Example: "AI Decision Provider — Phase 1 Flag Rollout"
   */
  title: string;

  /**
   * What this release delivers and why. 2–4 sentences.
   * Written for account managers, not engineers.
   */
  description: string;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /** Current lifecycle state. */
  status: ReleaseStatus;

  /**
   * ISO 8601 date of the planned production deployment window.
   * Example: "2026-03-20"
   */
  targetDate: string;

  /**
   * ISO 8601 timestamp when the release was successfully deployed to production.
   * Populated after deployment.
   */
  releasedAt?: string;

  /**
   * ISO 8601 timestamp when a rollback was executed, if applicable.
   */
  rolledBackAt?: string;

  // ── Rollout configuration ─────────────────────────────────────────────────

  /** Which tenants this release targets. */
  rolloutScope: RolloutScope;

  /** The strategy for progressing this release through environments. */
  rolloutPattern: RolloutPattern;

  /**
   * The ordered list of tenant targets for tenant-targeted rollouts.
   * Empty for platform-only and all-tenants releases.
   */
  tenantTargets: readonly TenantRolloutTarget[];

  // ── Changes ───────────────────────────────────────────────────────────────

  /**
   * All discrete changes included in this release.
   * At least one change is required.
   */
  changes: readonly ReleaseChange[];

  // ── Validation ────────────────────────────────────────────────────────────

  /**
   * Pre-deployment checklist items to verify in staging.
   */
  validationChecklist: readonly ValidationCheckItem[];

  /**
   * Evidence of staging validation, filled in before production promotion.
   * Required for staged-promotion and tenant-progressive patterns.
   */
  stagingValidation?: StagingValidationRecord;

  // ── Rollback ─────────────────────────────────────────────────────────────

  /**
   * How to undo this release if it causes harm.
   * Must be completed before the release is moved to "scheduled".
   */
  rollbackPlan: RollbackPlan;

  // ── Communication ────────────────────────────────────────────────────────

  /**
   * Whether this release requires a client communication before deployment.
   * True for any release that changes client-visible behaviour.
   */
  requiresClientNotification: boolean;

  /**
   * Template or notes for the client communication, if required.
   */
  clientNotificationTemplate?: string;

  // ── Platform linkage ─────────────────────────────────────────────────────

  /**
   * Service offering this release falls under, for commercial scoping.
   */
  linkedService?: ServiceOfferingId;

  /**
   * If this release was triggered by or resolves a support event,
   * link to the support process type.
   */
  linkedSupportProcessType?: string;

  /**
   * Git commit SHA or tag associated with this release.
   * Populated at deployment time. Used for rollback reference.
   */
  gitRef?: string;

  // ── Authorship ───────────────────────────────────────────────────────────

  /**
   * The platform engineer responsible for this release.
   */
  author: string;

  /**
   * Who reviewed and approved this release plan before scheduling.
   */
  approvedBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RELEASE CATALOG TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An ordered log of release definitions, most recent first.
 *
 * @example
 *   import { RELEASE_LOG } from "@/releases";
 *   const latest = RELEASE_LOG[0];
 *   const released = RELEASE_LOG.filter(r => r.status === "released");
 */
export type ReleaseLog = readonly ReleaseDefinition[];
