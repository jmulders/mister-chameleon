/**
 * Content Readiness Types
 *
 * The type system for the content readiness checklist — a structured,
 * evaluatable set of checks that verify whether a tenant has sufficient
 * content coverage and quality to be launched on the platform.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   A tenant can be technically configured (valid TenantConfig, CMS connected,
 *   n8n wired up) while still having content gaps that will cause the adaptive
 *   pipeline to fall back to default content or serve empty variants. Content
 *   readiness catches these gaps before they reach production visitors.
 *
 *   Examples of what this catches:
 *     • A variant key is registered in tenant.variants.hero but no CMS entry
 *       has been written for it — the decision engine selects the key but the
 *       CMS returns null, causing a fallback.
 *     • A CTA button href is still "/TODO" from the copy template.
 *     • A proof block has only one item when three are expected for layout.
 *     • A/B testing is enabled but only one hero variant exists — no real test.
 *
 * ─── Architecture: pure checks, async context ────────────────────────────────
 *
 *   Each ContentReadinessCheck is a pure function: (context) → CheckResult.
 *   No async, no side effects. This makes checks trivially testable.
 *
 *   The async work — fetching CMS content for every configured variant key —
 *   happens once in buildContentReadinessContext() (checklist.ts). The result
 *   is a ContentReadinessContext that all checks receive.
 *
 * ─── Severity model ──────────────────────────────────────────────────────────
 *
 *   error    Launch blocker. The platform will behave incorrectly in production.
 *            Example: a configured variant key has no CMS content → fallback.
 *
 *   warning  Should be fixed before launch but won't break anything immediately.
 *            Example: only 1 hero variant exists → no personalisation benefit.
 *
 *   info     Best practice. The platform works without it but performs better.
 *            Example: hero eyebrow tags are missing → slightly less polish.
 *
 * ─── File map ─────────────────────────────────────────────────────────────────
 *
 *   content-readiness/types.ts      ← YOU ARE HERE — all type definitions
 *   content-readiness/checklist.ts  ← check definitions, evaluation helpers
 *   content-readiness/index.ts      ← barrel re-export
 */

import type { HeroBlockData, ProofBlockData, CTABlockData } from "@/cms/types";
import type { TenantConfig } from "@/tenant/types";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable identifiers for every content readiness check.
 *
 * Grouped by category:
 *
 *   Coverage     How many variants are configured and populated.
 *   Completeness Whether every configured key has actual CMS content.
 *   Quality      Whether the content itself is well-formed and non-placeholder.
 *   Metadata     Whether CMS entries have correct IDs and required metadata fields.
 *   Features     Feature-flag-specific requirements (A/B testing, contact, etc.)
 */
export type ContentReadinessCheckId =
  // ── Coverage ────────────────────────────────────────────────────────────────
  | "hero-minimum-variants"         // At least 1 hero key configured + has content
  | "proof-minimum-variants"        // At least 1 proof key configured + has content
  | "cta-minimum-variants"          // At least 1 CTA key configured + has content
  | "hero-recommended-variants"     // At least 2 hero variants (personalisation value)
  | "all-blocks-have-coverage"      // Every enabled block has at least one live variant
  // ── Completeness ────────────────────────────────────────────────────────────
  | "hero-all-keys-have-content"    // Every tenant.variants.hero key returns CMS content
  | "proof-all-keys-have-content"   // Same for proof
  | "cta-all-keys-have-content"     // Same for CTA
  | "proof-items-minimum"           // Each proof variant has at least 2 proof items
  // ── Quality ─────────────────────────────────────────────────────────────────
  | "hero-titles-non-empty"         // No hero variants with empty title fields
  | "hero-subtitles-non-empty"      // No hero variants with empty subtitle fields
  | "cta-labels-non-placeholder"    // No placeholder CTA button labels
  | "cta-hrefs-non-placeholder"     // No placeholder or default hrefs in CTAs
  | "hero-tags-present"             // Hero variants have eyebrow tag fields populated
  // ── Metadata ────────────────────────────────────────────────────────────────
  | "hero-ids-match-keys"           // HeroBlockData.id matches its variant key
  | "proof-ids-match-keys"          // ProofBlockData.id matches its variant key
  | "cta-ids-match-keys"            // CTABlockData.id matches its variant key
  // ── Feature-specific ────────────────────────────────────────────────────────
  | "ab-testing-has-multiple-variants"   // If A/B testing enabled, 2+ variants per dimension
  | "contact-cta-has-booking-link";      // If contact enabled, at least one CTA links to contact

// ─────────────────────────────────────────────────────────────────────────────
// ENUMERATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Category grouping for a content readiness check.
 *
 * Drives how checks are grouped in admin readiness views.
 *
 * coverage      How many variants exist across each decision dimension.
 * completeness  Whether every declared variant key has real CMS content behind it.
 * quality       Whether the content fields are well-formed and non-placeholder.
 * metadata      Whether CMS IDs and structural metadata are consistent.
 * features      Requirements driven by specific enabled features (A/B, contact).
 */
export type CheckCategory =
  | "coverage"
  | "completeness"
  | "quality"
  | "metadata"
  | "features";

/**
 * Severity of a content readiness check.
 *
 * error    Launch blocker. isLaunchReady() returns false if any error check fails.
 * warning  Should be resolved before launch but will not break the platform.
 * info     Best practice. Informational only — does not affect launch readiness.
 */
export type CheckSeverity = "error" | "warning" | "info";

/**
 * Outcome status of an evaluated check.
 *
 * pass     The check passed. All conditions were met.
 * fail     The check failed at its declared severity level.
 * skipped  The check does not apply to this tenant config.
 *          Example: "ab-testing-has-multiple-variants" is skipped when
 *          features.abTesting is false.
 */
export type CheckStatus = "pass" | "fail" | "skipped";

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT SNAPSHOT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A fetch error recorded when a CMS request for a specific key fails.
 *
 * Distinguishes between:
 *   not-found   The CMS returned null — the entry doesn't exist.
 *   fetch-error A network or authentication error prevented the fetch.
 */
export interface ContentFetchError {
  /** The variant key that failed to fetch. */
  key: string;

  /** The block type that was being fetched. */
  blockType: "hero" | "proof" | "cta";

  /**
   * The kind of failure.
   * "not-found"   → CMS returned null. Content must be created.
   * "fetch-error" → Network or auth failure. May be transient or config issue.
   */
  errorType: "not-found" | "fetch-error";

  /** Human-readable message for the admin readiness view. */
  message: string;
}

/**
 * A point-in-time snapshot of all CMS content for a tenant's configured
 * variant keys.
 *
 * Built by buildContentReadinessContext() by fetching each key in
 * tenant.variants.hero / .proof / .cta from the CMS provider.
 *
 * Null values in the records mean the CMS returned nothing for that key —
 * the key is configured in the tenant but has no content yet.
 */
export interface ContentSnapshot {
  /**
   * CMS content for each configured hero variant key.
   * Key: HeroVariantKey string. Value: fetched content or null if missing.
   */
  hero: Record<string, HeroBlockData | null>;

  /**
   * CMS content for each configured proof variant key.
   * Key: ProofVariantKey string. Value: fetched content or null if missing.
   */
  proof: Record<string, ProofBlockData | null>;

  /**
   * CMS content for each configured CTA variant key.
   * Key: CTAVariantKey string. Value: fetched content or null if missing.
   */
  cta: Record<string, CTABlockData | null>;

  /**
   * ISO 8601 timestamp when the snapshot was fetched.
   * Included in the readiness report so stale snapshots are visible.
   */
  fetchedAt: string;

  /**
   * Any fetch errors encountered while building the snapshot.
   * A check can inspect these to distinguish missing content (not-found) from
   * transient infrastructure issues (fetch-error).
   */
  errors: ContentFetchError[];
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete input to every content readiness check evaluation.
 *
 * Checks receive this struct and return a CheckResult. They must not
 * perform async operations — all data resolution happens before evaluation.
 *
 * The tenant config provides:
 *   • Which variants are declared (tenant.variants)
 *   • Which blocks are enabled (tenant.blocks)
 *   • Which pages are active (tenant.pages)
 *   • Which features are on (tenant.features)
 *   • Which contact settings apply (tenant.contact)
 *
 * The snapshot provides the actual fetched CMS content for each key,
 * including null entries where content is missing.
 */
export interface ContentReadinessContext {
  /** The resolved tenant configuration to evaluate against. */
  tenant: TenantConfig;

  /** The fetched CMS content for all configured variant keys. */
  snapshot: ContentSnapshot;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK RESULT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The outcome of evaluating a single content readiness check.
 *
 * status        Whether the check passed, failed, or was skipped.
 * message       One-sentence summary. Displayed in the readiness view.
 *               Pass messages should be affirmative ("All hero variants have titles").
 *               Fail messages should name the specific problem ("2 hero keys missing content").
 * details       Optional extended explanation. Why this matters, or what to do.
 * affectedKeys  The specific variant keys that caused the check to fail.
 *               Displayed as a list in the readiness view so the content team
 *               knows exactly which CMS entries to create or fix.
 */
export interface CheckResult {
  /** Outcome of this check evaluation. */
  status: CheckStatus;

  /**
   * Human-readable single-sentence outcome message.
   * Write in the past tense for clarity:
   *   Pass:    "All 3 hero variant keys have content."
   *   Fail:    "2 hero keys are missing CMS content: hero_linkedin_vision, hero_direct_brand"
   *   Skipped: "Skipped — A/B testing is not enabled for this tenant."
   */
  message: string;

  /**
   * Extended explanation displayed in the readiness view detail panel.
   * For fail results: what specifically needs to be fixed.
   * For skipped results: what condition would activate this check.
   * May be omitted for simple pass results.
   */
  details?: string;

  /**
   * Specific variant keys implicated in a failure.
   * Rendered as a pill list in the admin readiness view.
   * Only relevant on fail results — omit for pass/skipped.
   */
  affectedKeys?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single content readiness check definition.
 *
 * The evaluate() function is a pure synchronous function — no async, no side
 * effects. All data has been pre-fetched into the ContentReadinessContext.
 *
 * evaluate() must handle all tenant configurations gracefully:
 *   • Return { status: "skipped" } when the check doesn't apply.
 *   • Never throw — check failures are expected and should return "fail".
 */
export interface ContentReadinessCheck {
  /** Stable identifier for this check. */
  id: ContentReadinessCheckId;

  /**
   * Short display label for the readiness view.
   * 3–6 words. Written as a condition, not a question.
   * Example: "Hero variants have content"
   */
  label: string;

  /**
   * Two-to-three sentence description of what this check verifies and why.
   * Written for a content manager or account manager, not a developer.
   */
  description: string;

  /**
   * The severity level if this check fails.
   * error   → launch blocker (isLaunchReady returns false)
   * warning → should be fixed, but platform will work
   * info    → best practice recommendation
   */
  severity: CheckSeverity;

  /**
   * Category for grouping in the readiness view.
   */
  category: CheckCategory;

  /**
   * Pure evaluation function. Called once per check per evaluation run.
   *
   * Must be synchronous and side-effect-free.
   * Must return "skipped" when the check doesn't apply to the tenant config.
   * Must never throw — wrap risky logic in try/catch and return a fail result.
   */
  evaluate: (context: ContentReadinessContext) => CheckResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A check definition paired with its evaluation result.
 * Used in the ReadinessReport to carry both the check metadata and its outcome.
 */
export interface CheckResultEntry {
  /** The check that was evaluated. */
  check: ContentReadinessCheck;

  /** The outcome of evaluating the check. */
  result: CheckResult;
}

/**
 * Aggregated counts across all evaluated checks.
 * Displayed as a summary banner in the readiness view.
 */
export interface ReadinessSummary {
  /** Number of checks evaluated (not counting skipped). */
  total: number;

  /** Checks that passed. */
  passed: number;

  /** Checks that failed at "error" severity — launch blockers. */
  errors: number;

  /** Checks that failed at "warning" severity. */
  warnings: number;

  /** Checks that failed at "info" severity. */
  infos: number;

  /** Checks that were skipped (not applicable for this tenant). */
  skipped: number;
}

/**
 * The complete result of a content readiness evaluation for a single tenant.
 *
 * Produced by evaluateReadiness(). Contains all check results, a summary,
 * and the top-level launch readiness flag.
 *
 * isLaunchReady is true only when no checks with severity "error" have failed.
 * Warnings and infos do not block launch readiness.
 */
export interface ReadinessReport {
  /** The tenant this report was generated for. */
  tenantId: string;

  /** ISO 8601 timestamp when the evaluation was run. */
  evaluatedAt: string;

  /**
   * All check results in evaluation order.
   * Includes passed, failed, and skipped checks — the admin view
   * can filter by status and category.
   */
  results: CheckResultEntry[];

  /** Aggregated counts. */
  summary: ReadinessSummary;

  /**
   * Whether this tenant is ready to launch.
   *
   * true  — No "error" severity checks have failed. Warnings and infos may exist.
   * false — At least one "error" severity check has failed. Launch is blocked.
   *
   * Note: isLaunchReady:true does not guarantee perfection — it means the
   * platform will function correctly. Warnings should still be reviewed.
   */
  isLaunchReady: boolean;
}
