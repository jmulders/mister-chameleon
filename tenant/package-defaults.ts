/**
 * Package Seed Defaults
 *
 * Derives the conservative initial TenantSettings values for a newly created
 * tenant on a given package tier.
 *
 * ─── "Allowed" vs. "Enabled" ──────────────────────────────────────────────────
 *
 *   PackageDefinition expresses the ceiling: which features and blocks a tenant
 *   on this tier is permitted to use.  PackageSeedDefaults expresses the floor:
 *   the sensible starting state for a brand-new tenant before any post-creation
 *   configuration has been done.
 *
 *   The two are intentionally different for features that require additional
 *   set-up work before they can be safely or meaningfully activated:
 *
 *     experiments
 *       The ExperimentDecisionProvider decorator queries the experiments table
 *       on every adaptive page request.  There is no value in enabling this
 *       flag until at least one active experiment record exists — doing so
 *       earlier only adds a pointless database round-trip.  Starts: false.
 *
 *     ai
 *       The AI decision layer requires a configured provider identifier, a
 *       wired AiDecisionProvider subclass, and a confidence policy before it
 *       can safely handle production traffic in shadow or live mode.  Enabling
 *       the feature flag before those prerequisites are met produces errors or
 *       silent fallbacks, degrading observability.  Starts: false.
 *
 *     analytics
 *       Fundamental observability with no prerequisites — it just works once
 *       the tenant is live.  Starts: true (if the package allows it).
 *
 *   Nothing is removed from the operator's control.  The conservative default
 *   only affects the initial persisted state; the operator can enable any
 *   feature the package allows via the admin settings page.
 *
 * ─── Blocks ───────────────────────────────────────────────────────────────────
 *
 *   Both context and content block sets start fully populated — all blocks the
 *   package allows are enabled by default.  This is intentional: an operator
 *   should not need to configure blocks manually just to get the homepage
 *   adaptive pipeline working.  They remove blocks their design does not
 *   include.  The package ceiling is still enforced at runtime by
 *   runtime-helpers.ts regardless of what is stored.
 *
 * ─── AI mode ──────────────────────────────────────────────────────────────────
 *
 *   ai.mode is always "disabled" at creation.  Even on Pro — where shadow and
 *   live modes are available — the AI layer must be explicitly activated after
 *   technical onboarding is complete.  Shadow mode (runs AI in parallel, logs
 *   results, does not affect visitors) is the recommended next step, but that
 *   decision belongs to the operator, not the onboarding form.
 *
 * ─── Source of truth ──────────────────────────────────────────────────────────
 *
 *   All values are derived from PackageDefinition (tenant/packages.ts).
 *   No hard-coded tier logic lives here — adding or modifying a package tier
 *   in packages.ts updates the defaults automatically.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In the onboarding factory (onboarding/tenant-setup.ts):
 *   const { features, blocks, ai } = getPackageSeedDefaults(input.packageKey);
 *
 *   // To inspect what a new tenant on Growth will start with:
 *   const defaults = getPackageSeedDefaults("growth");
 *   defaults.features.analytics    // true
 *   defaults.features.experiments  // false — off until an experiment exists
 *   defaults.features.ai           // false — not available on Growth
 *   defaults.blocks.context        // ["hero", "proof", "cta"]
 *   defaults.blocks.content        // ["textSection", "featureGrid", "faqSection"]
 *   defaults.ai.mode               // "disabled"
 */

import type {
  PackageKey,
  TenantFeatures,
  TenantBlocks,
  TenantAiSettings,
} from "./types";
import { getPackageDefinition } from "./packages";

// ─────────────────────────────────────────────────────────────────────────────
// TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The initial TenantSettings field values for a newly created tenant.
 *
 * Contains only the fields whose starting values are determined by the package
 * tier.  Fields driven by operator input at onboarding — `tenantId`,
 * `packageKey`, `cms.provider`, `design.theme` — are not included here; they
 * come from OnboardingInput directly.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   features
 *     Conservative initial feature flags.  `analytics` is enabled immediately
 *     on packages that include it.  `experiments` and `ai` start disabled on
 *     all tiers — see module-level comment for the rationale.
 *
 *     Invariant: features.* ≤ pkg.allowedFeatures.* (always within ceiling)
 *
 *   blocks
 *     Initial block entitlement.  Both `context` and `content` start with the
 *     full set the package allows — the operator removes what they don't need.
 *
 *     Invariant: blocks.context ⊆ pkg.allowedBlocks.context (at equality)
 *                blocks.content ⊆ pkg.allowedBlocks.content (at equality)
 *
 *   ai
 *     Initial AI decision layer settings.  Always `{ mode: "disabled" }`.
 *     `provider` and `confidenceThreshold` are absent — set by the operator
 *     during technical onboarding when the AI layer is ready to activate.
 */
export interface PackageSeedDefaults {
  readonly features: TenantFeatures;
  readonly blocks:   TenantBlocks;
  readonly ai:       TenantAiSettings;
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the conservative initial TenantSettings values for a new tenant on
 * the given package tier.
 *
 * All returned values are within the package's limits and allow-lists:
 *
 *   features.experiments  ≤  pkg.allowedFeatures.experiments  (always false)
 *   features.ai           ≤  pkg.allowedFeatures.ai           (always false)
 *   features.analytics    =  pkg.allowedFeatures.analytics    (on if allowed)
 *   blocks.context        ⊆  pkg.allowedBlocks.context        (full set)
 *   blocks.content        ⊆  pkg.allowedBlocks.content        (full set)
 *   ai.mode               =  "disabled"                       (always)
 *
 * No I/O, no async, no server-only imports.  Safe in any rendering context.
 *
 * @param packageKey  The subscription tier for which to compute defaults.
 * @returns           PackageSeedDefaults within the package's limits.
 *
 * @example
 * const defaults = getPackageSeedDefaults("starter");
 *
 * defaults.features.analytics    // true  — on immediately
 * defaults.features.experiments  // false — not available on Starter
 * defaults.features.ai           // false — not available on Starter
 * defaults.blocks.context        // ["hero", "proof", "cta"]
 * defaults.blocks.content        // ["textSection"]
 * defaults.ai.mode               // "disabled"
 *
 * @example
 * const defaults = getPackageSeedDefaults("growth");
 *
 * defaults.features.analytics    // true  — on immediately
 * defaults.features.experiments  // false — off; operator enables when ready
 * defaults.features.ai           // false — not available on Growth
 * defaults.blocks.content        // ["textSection", "featureGrid", "faqSection"]
 *
 * @example
 * const defaults = getPackageSeedDefaults("pro");
 *
 * defaults.features.ai           // false — off; requires provider + policy setup
 * defaults.blocks.content        // all five content block types
 * defaults.ai.mode               // "disabled" — operator activates after setup
 */
export function getPackageSeedDefaults(packageKey: PackageKey): PackageSeedDefaults {
  const pkg = getPackageDefinition(packageKey);

  return {
    features: {
      // Analytics: on immediately for all packages that include it.
      //
      // This is the core observability signal — it requires no extra setup
      // and gives the operator served-variant logs from the first request.
      analytics: pkg.allowedFeatures.analytics,

      // Experiments: always starts disabled, regardless of package tier.
      //
      // The ExperimentDecisionProvider decorator runs a DB query on every
      // adaptive page request when this flag is true.  Until at least one
      // active experiment record exists, that query returns nothing useful
      // and only adds latency.  The operator enables this flag when creating
      // their first experiment.  The package ceiling (allowedFeatures.experiments)
      // still governs whether the flag can ever be set to true.
      experiments: false,

      // AI: always starts disabled, regardless of package tier.
      //
      // The AI decision layer requires: (1) a configured provider identifier
      // (e.g. "claude-sonnet"), (2) a wired AiDecisionProvider subclass, and
      // (3) a confidence policy before it can safely handle production traffic.
      // Enabling this flag before those prerequisites are met would produce
      // errors or silent fallbacks.  The package ceiling (allowedFeatures.ai)
      // still governs whether the flag can ever be set to true.
      ai: false,
    },

    blocks: {
      // Context blocks (adaptive slots): start with the full set the package
      // allows.  All current packages allow hero, proof, and cta — enabling
      // all of them by default ensures the homepage adaptive pipeline is
      // fully operational immediately after creation.
      context: pkg.allowedBlocks.context,

      // Content blocks (CMS section types): start with the full set the
      // package allows.  This varies meaningfully by tier — Starter gets
      // textSection only; Growth adds featureGrid and faqSection; Pro adds
      // testimonialSection and ctaSection.  Starting with all allowed types
      // gives editors the full editorial palette from day one without
      // requiring additional block configuration.
      content: pkg.allowedBlocks.content,
    },

    ai: {
      // AI mode: always "disabled" at creation, even on Pro.
      //
      // Shadow mode (AI runs in parallel, results logged, visitors unaffected)
      // is the recommended first step when activating the AI layer — but the
      // operator makes that choice after completing technical onboarding.
      // Starting in shadow would incur API cost and produce meaningless logs
      // until the provider is wired and the confidence policy is tuned.
      mode: "disabled",
    },
  };
}
