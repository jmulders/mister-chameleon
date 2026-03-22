/**
 * Releases Module — Barrel Export
 *
 * Re-exports all public types and runtime values from the release management layer.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   import type { ReleaseDefinition, RollbackPlan, TenantRolloutTarget } from "@/releases";
 *   import { RELEASE_LOG, getRelease, getReleasesForTenant }             from "@/releases";
 *   import { getReleasesByStatus, validateReleaseForScheduling }         from "@/releases";
 *
 * ─── Module map ───────────────────────────────────────────────────────────────
 *
 *   releases/types.ts  — all type definitions
 *   releases/model.ts  — release log, example releases, query helpers
 *   releases/index.ts  ← YOU ARE HERE — barrel re-export
 */

// ── Type exports ─────────────────────────────────────────────────────────────

export type {
  // Identifier
  ReleaseId,

  // Enumerations
  Environment,
  ReleaseStatus,
  ChangeType,
  RolloutScope,
  RolloutPattern,

  // Change item
  ReleaseChange,

  // Feature flags
  FeatureFlagDelta,

  // Rollout targeting
  TenantRolloutTarget,

  // Validation
  ValidationCheckItem,

  // Rollback
  RollbackPlan,

  // Staging record
  StagingValidationRecord,

  // Root definition
  ReleaseDefinition,

  // Log
  ReleaseLog,
} from "./types";

// ── Runtime exports ───────────────────────────────────────────────────────────

export {
  // ── Example release definitions ───────────────────────────────────────────
  /** Platform-wide code + CMS schema, staged-promotion. */
  RELEASE_2026_03_001,
  /** AI decision provider flag activation for a single tenant, flag-gated. */
  RELEASE_2026_03_002,
  /** Emergency hotfix for Sanity API version mismatch, immediate. */
  RELEASE_HOTFIX_2026_03_15,

  // ── Release log ───────────────────────────────────────────────────────────
  /** All platform releases, most recent first. */
  RELEASE_LOG,

  // ── Query helpers ─────────────────────────────────────────────────────────
  /** Get a release by ID. */
  getRelease,
  /** All releases with the given status. */
  getReleasesByStatus,
  /** All releases with validation checklist items for the given environment. */
  getReleasesByEnvironment,
  /** All releases that affect a specific tenant (direct target or all-tenants). */
  getReleasesForTenant,
  /** All releases that include a feature flag change. */
  getReleasesWithFlagChange,
  /** Cumulative flag changes scheduled for a tenant across all active releases. */
  getPlannedFlagChangesForTenant,
  /** Releases requiring client notification that are not yet released or cancelled. */
  getPendingClientNotifications,
  /** All releases associated with a specific service offering. */
  getReleasesByService,

  // ── Validation ────────────────────────────────────────────────────────────
  /** Structural validation for a release before scheduling. */
  validateReleaseForScheduling,
} from "./model";
