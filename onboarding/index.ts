/**
 * Onboarding Module — Public API
 *
 * The internal onboarding flow model for the Mister Chameleon platform.
 * Import from "@/onboarding" rather than from individual files.
 *
 * ─── What this module provides ───────────────────────────────────────────────
 *
 *   Tenant readiness (onboarding/readiness.ts)
 *     ReadinessCheck               — { id, label, passed, hint? } — one check result
 *     ReadinessResult              — { checks, passedCount, totalCount, allPassed }
 *     ReadinessOptions             — { websiteUrl? } — optional metadata for checks
 *     getTenantReadiness()         — TenantSettings → ReadinessResult (pure, no I/O)
 *
 *   Tenant setup (onboarding/tenant-setup.ts)
 *     OnboardingInput              — five-field intake shape (name, id, url, package, cms, theme)
 *     OnboardingValidationIssue    — a single validation message with field + blocking flag
 *     OnboardingValidationResult   — valid/invalid result with issues[]
 *     OnboardingInputError         — thrown when blocking issues prevent conversion
 *     DEFAULT_ONBOARDING_AI_SETTINGS  — { mode: "disabled" } applied to every new tenant
 *     validateOnboardingInput()    — validate without throwing; returns result object
 *     onboardingInputToTenantSettings()  — convert intake input → TenantSettings
 *     canonicalHostnameFromInput() — extract clean hostname from websiteUrl
 *
 *   Flow types (onboarding/types.ts)
 *     OnboardingStepId       — "intake" | "context-mapping" | ... (5 steps)
 *     OnboardingStepStatus   — lifecycle states for a step instance
 *     OnboardingOwnerRole    — who drives a step: internal-led / client-led / joint
 *     InputSource            — where a required input comes from
 *     ArtifactType           — what kind of artifact a step produces
 *     RequiredInput          — an input a step needs to complete
 *     OutputArtifact         — a deliverable a step produces
 *     ChecklistItem          — an atomic task within a step
 *     OnboardingStep         — a single onboarding phase definition
 *     OnboardingFlow         — ordered sequence of step definitions
 *     OnboardingStepIndex    — mapped type for O(1) step lookup
 *
 *   Flow data (onboarding/flow.ts)
 *     STANDARD_ONBOARDING_FLOW  — the five-phase standard flow definition
 *     ONBOARDING_STEP_INDEX     — O(1) step lookup map
 *
 *   Flow query helpers (onboarding/flow.ts)
 *     getStepServiceOffering()   — resolve a step's ServiceOffering from the product catalog
 *     getStepActivatedModules()  — resolve a step's activated ProductModules
 *     getBlockingArtifacts()     — artifacts that must exist before the next step starts
 *     getClientInputsForStep()   — inputs the client must supply for a step
 *     getClientChecklistItems()  — required checklist items owned by the client
 *     getPrerequisiteSteps()     — steps that must be complete before a step begins
 *     getSkippableSteps()        — steps with canBeSkipped: true
 *     getAllArtifacts()           — flat list of all artifacts, optionally filtered by type
 *
 *   Implementation template (onboarding/implementation-template.ts)
 *     ImplementationTemplate     — full internal setup specification (not for UI)
 *     createImplementationTemplate()  — factory with deep-merged defaults
 *     toTenantConfigInput()      — project template → TenantConfigInput
 *     getRequiredEnvVars()       — list env vars required by a template
 *     getImplementationChecklist()    — ordered task list for technical setup
 *
 * ─── Typical onboarding workflow ─────────────────────────────────────────────
 *
 *   1. Collect intake fields → build OnboardingInput
 *   2. Call validateOnboardingInput() → surface any warnings in UI
 *   3. Call onboardingInputToTenantSettings() → get TenantSettings
 *   4. Call saveTenant() (tenant/tenant-store.ts) → persist to store
 *   5. Build ImplementationTemplate for full technical setup spec
 *   6. Use toTenantConfigInput() + createTenantConfig() to wire the deployment
 *
 * ─── Usage examples ──────────────────────────────────────────────────────────
 *
 *   // Quick-start: intake → TenantSettings
 *   import { onboardingInputToTenantSettings, canonicalHostnameFromInput } from "@/onboarding";
 *   const settings = onboardingInputToTenantSettings({
 *     tenantId:    "acme-corp",
 *     tenantName:  "Acme Corp",
 *     websiteUrl:  "acme.com",
 *     packageKey:  "growth",
 *     cmsProvider: "sanity",
 *     themePreset: "minimal",
 *   });
 *   const hostname = canonicalHostnameFromInput({ websiteUrl: "https://acme.com" });
 *   // → "acme.com"
 *
 *   // Flow inspection:
 *   import { STANDARD_ONBOARDING_FLOW, getBlockingArtifacts } from "@/onboarding";
 *   STANDARD_ONBOARDING_FLOW.steps.forEach(s => console.log(s.name));
 *   const blockers = getBlockingArtifacts("technical-setup");
 *
 * ─── For admin tooling ───────────────────────────────────────────────────────
 *
 *   The types here are the schema for per-client OnboardingRecords.
 *   When admin tooling is built, it will create instances that hold:
 *     • A reference to STANDARD_ONBOARDING_FLOW (or a custom flow)
 *     • Per-step status: OnboardingStepStatus
 *     • Timestamps, notes, and skip reasons
 *   See the OnboardingRecord comment block in onboarding/types.ts.
 */

// ── Tenant readiness ──────────────────────────────────────────────────────────
//
// Lightweight checklist model that shows an admin what is and is not yet
// configured for a tenant to go live.  Pure function — no I/O, safe in any
// rendering context.
//
//   getTenantReadiness(tenant, { websiteUrl? })  → ReadinessResult
//   ReadinessCheck  — { id, label, passed, hint? }
//   ReadinessResult — { checks, passedCount, totalCount, allPassed }
//
export type { ReadinessCheck, ReadinessResult, ReadinessOptions } from "./readiness";
export { getTenantReadiness }                                      from "./readiness";

// ── Tenant setup ──────────────────────────────────────────────────────────────
export type {
  OnboardingInput,
  OnboardingValidationIssue,
  OnboardingValidationResult,
} from "./tenant-setup";

export {
  OnboardingInputError,
  DEFAULT_ONBOARDING_AI_SETTINGS,
  validateOnboardingInput,
  onboardingInputToTenantSettings,
  canonicalHostnameFromInput,
} from "./tenant-setup";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  OnboardingStepId,
  OnboardingStepStatus,
  OnboardingOwnerRole,
  InputSource,
  ArtifactType,
  RequiredInput,
  OutputArtifact,
  ChecklistItem,
  OnboardingStep,
  OnboardingFlow,
  OnboardingStepIndex,
} from "./types";

// ── Flow data ─────────────────────────────────────────────────────────────────
export {
  STANDARD_ONBOARDING_FLOW,
  ONBOARDING_STEP_INDEX,
} from "./flow";

// ── Query helpers ─────────────────────────────────────────────────────────────
export {
  getStepServiceOffering,
  getStepActivatedModules,
  getBlockingArtifacts,
  getClientInputsForStep,
  getClientChecklistItems,
  getPrerequisiteSteps,
  getSkippableSteps,
  getAllArtifacts,
} from "./flow";

// ── Implementation template ───────────────────────────────────────────────────
//
// Types, factory, and query helpers for the client implementation spec.
// Use createImplementationTemplate() + toTenantConfigInput() to go from
// client brief → TenantConfig in a single structured workflow.
//
export type {
  ImplementationTemplateStatus,
  AnalyticsProvider,
  EnvVarSecretType,
  ImplementationAnalyticsConfig,
  EnvironmentVariable,
  ImplementationTemplate,
  ImplementationTemplateInput,
} from "./implementation-template";

export {
  // Defaults and constants
  PLACEHOLDER_IMPLEMENTATION_THEME,
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_ESSENTIAL_MODULES,
  TEMPLATE_DEFAULTS,

  // Factory
  createImplementationTemplate,

  // Projection
  toTenantConfigInput,

  // Query helpers
  getRequiredEnvVars,
  getImplementationChecklist,
  isReadyToConfig,
  isLive,
  needsTheme,
} from "./implementation-template";
