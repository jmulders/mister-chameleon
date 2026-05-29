/**
 * Decision module — barrel export
 *
 * Public API for the decision layer.
 * Import from "@/decision" for types, the provider interface, and the
 * default MVP implementation.
 *
 * Internal module structure:
 *
 *   types.ts
 *     HeroVariantKey, ProofVariantKey, CTAVariantKey, ExperiencePlan
 *     DecisionInput, buildDecisionInput
 *
 *   rules/homepage-rules.ts
 *     HOMEPAGE_RULES, DEFAULT_HOMEPAGE_PLAN, HomepageRule
 *
 *   providers/decision-provider.ts
 *     DecisionProvider (interface)
 *
 *   providers/rules-decision-provider.ts
 *     RulesDecisionProvider (MVP implementation)
 *
 *   providers/experiment-decision-provider.ts
 *     ExperimentDecisionProvider (A/B test decorator)
 *
 *   providers/ai-decision-provider.ts
 *     AiDecisionProvider (abstract base for AI-powered providers)
 *
 *   ai-confidence-policy.ts
 *     evaluateConfidencePolicy, measureContextRichness, policyResultToLogMeta
 *     AiDecisionOutput, ConfidencePolicyConfig, ConfidencePolicyResult, PolicyVerdict
 *     DEFAULT_CONFIDENCE_POLICY, PERMISSIVE_CONFIDENCE_POLICY
 */

// Types
export type {
  HeroVariantKey,
  ProofVariantKey,
  CTAVariantKey,
  AnyVariantKey,
  ExperiencePlan,
  DecisionInput,
} from "./types";
export { buildDecisionInput } from "./types";

// ── Normalized DecisionContext ─────────────────────────────────────────────────
//
// The canonical runtime context object composed from all signal sources.
// Use buildDecisionContext() in RSC page components; pass the result to rules,
// AI providers, and the admin debug panel.

export type {
  DecisionContext,
  BuildDecisionContextOptions,
} from "./decision-context";

export {
  buildDecisionContext,
  extractAIContext,
  applyEnrichment,
} from "./decision-context";

// Provider interface
export type { DecisionProvider } from "./providers/decision-provider";

// MVP implementation
export { RulesDecisionProvider } from "./providers/rules-decision-provider";

// A/B experiment decorator — wraps any DecisionProvider with experiment logic
export { ExperimentDecisionProvider } from "./providers/experiment-decision-provider";

// AI provider abstract base class — subclass to add a real model
export { AiDecisionProvider } from "./providers/ai-decision-provider";

// Confidence policy — pure evaluation helper, usable standalone
export {
  evaluateConfidencePolicy,
  measureContextRichness,
  policyResultToLogMeta,
  DEFAULT_CONFIDENCE_POLICY,
  PERMISSIVE_CONFIDENCE_POLICY,
} from "./ai-confidence-policy";

export type {
  AiDecisionOutput,
  ConfidencePolicyConfig,
  ConfidencePolicyResult,
  PolicyGateResult,
  PolicyVerdict,
} from "./ai-confidence-policy";

// Rule data (exported for testing and future CMS migration)
export { HOMEPAGE_RULES, DEFAULT_HOMEPAGE_PLAN } from "./rules/homepage-rules";
export type { HomepageRule } from "./rules/homepage-rules";
