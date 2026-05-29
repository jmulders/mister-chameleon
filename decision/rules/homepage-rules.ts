/**
 * Homepage Decision Rules
 *
 * The authoritative mapping from visitor context signals to homepage
 * experience plans. Keeping this data separated from the provider
 * implementation means:
 *
 *  - Rules can be loaded from a CMS or database later without changing
 *    the provider interface.
 *  - Rules can be unit-tested directly, in isolation from HTTP concerns.
 *  - Multiple providers (rules-based, ML-based, A/B test) can consume
 *    the same rule data.
 *
 * Rule evaluation order
 * ─────────────────────
 * Rules are evaluated in array order. The first rule whose `match`
 * predicate returns true wins. If no rule matches, the provider falls
 * back to DEFAULT_HOMEPAGE_PLAN.
 *
 * Adding a rule
 * ─────────────
 * 1. Push a new HomepageRule object into HOMEPAGE_RULES.
 * 2. Assign it a priority that reflects its position in the array.
 * 3. Add new variant keys to types.ts if new content variants are needed.
 */

import type { DecisionInput } from "../types";
import type { ExperiencePlan, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "../types";
import type { RuleEvaluationContext } from "./field-registry";

// ── Rule shape ────────────────────────────────────────────────────────────────

/**
 * A single homepage decision rule.
 *
 * `match`  — pure predicate evaluated against VisitorContext; must be side-effect free.
 * `plan`   — the variant keys to apply when the rule fires.
 * `reason` — surfaced in debug output and analytics events.
 */
export interface HomepageRule {
  /** Unique, stable identifier — safe to store in analytics events */
  id: string;

  /**
   * Evaluation precedence — lower number = higher priority.
   * Must be unique across all rules in this array.
   * Gaps are intentional to allow future rules to be inserted.
   */
  priority: number;

  /** Human-readable label for the debug panel */
  label: string;

  /**
   * Predicate — return true to apply this rule.
   *
   * The input is typed as `RuleEvaluationContext` (a superset of DecisionInput)
   * so predicates can access enrichment, interest scores, and client context in
   * addition to the base visitor + history signals.  Existing predicates that
   * only read `ctx.source` or `ctx.history.*` compile unchanged.
   */
  match: (input: RuleEvaluationContext) => boolean;

  /** The variant keys selected when this rule fires */
  plan: {
    heroKey:        HeroVariantKey;
    proofKey:       ProofVariantKey;
    ctaKey:         CTAVariantKey;
    /**
     * Visitor-adaptive compact banner key for inner CMS pages.
     * See StoredPlan.pageBannerKey for full documentation.
     * Only used by cms-page-decision.ts; ignored by the homepage pipeline.
     */
    pageBannerKey?: string;
  };

  /** Explanation surfaced in debug output and analytics */
  reason: string;

  /**
   * Whether this rule is active.
   * When false the engine skips this rule during evaluation.
   * Absent for hard-coded HomepageRule constants (always enabled).
   * Set by compileStoredRule() when StoredRule.enabled === false.
   */
  enabled?: boolean;
}

// ── Named rules ───────────────────────────────────────────────────────────────

const GOOGLE_RULE: HomepageRule = {
  id: "homepage.google",
  priority: 10,
  label: "Google traffic",
  match: (ctx) => ctx.source === "google",
  plan: {
    heroKey: "hero_google_problem",
    proofKey: "proof_cases",
    ctaKey: "cta_guide",
  },
  reason: "Traffic source indicates search/problem intent.",
};

const LINKEDIN_RULE: HomepageRule = {
  id: "homepage.linkedin",
  priority: 20,
  label: "LinkedIn traffic",
  match: (ctx) => ctx.source === "linkedin",
  plan: {
    heroKey: "hero_linkedin_vision",
    proofKey: "proof_vision",
    ctaKey: "cta_platform",
  },
  reason: "Traffic source indicates thought-leadership/social intent.",
};

/**
 * Returning visitor who has already clicked a CTA in a prior session window.
 *
 * Intent signal: this visitor has shown purchase/evaluation intent before —
 * escalate directly to a meeting invite rather than a nurture offer.
 *
 * History guard: `fromDatabase` check prevents false-positive escalation
 * when the DB query failed and history is an empty zero-value struct.
 *
 * Priority 5 — fires before source-based rules so an engaged returning
 * visitor is never downgraded to the generic nurture flow.
 */
const RETURNING_CTA_CLICKED_RULE: HomepageRule = {
  id: "homepage.returning_cta_clicked",
  priority: 5,
  label: "Returning visitor — CTA previously clicked",
  match: (ctx) =>
    ctx.history.fromDatabase === true && ctx.history.hasClickedCta === true,
  plan: {
    heroKey: "hero_direct_brand",
    proofKey: "proof_cases",
    ctaKey: "cta_meeting",
  },
  reason: "Returning visitor who previously clicked CTA — escalated to meeting intent.",
};

/**
 * Highly engaged returning visitor (3 or more prior page views).
 *
 * Intent signal: this visitor keeps coming back, indicating genuine interest.
 * Show commitment-oriented social proof and the highest-intent CTA.
 *
 * Priority 7 — fires before source-based rules but after the CTA-clicked rule,
 * which is a stronger signal of intent.
 *
 * History guard: `fromDatabase` check ensures pageViewCount of 0 (from an
 * empty history fallback) is never misread as a returning visitor signal.
 */
const HIGH_ENGAGEMENT_RULE: HomepageRule = {
  id: "homepage.high_engagement",
  priority: 7,
  label: "High-engagement returning visitor (3+ page views)",
  match: (ctx) =>
    ctx.history.fromDatabase === true && ctx.history.pageViewCount >= 3,
  plan: {
    heroKey: "hero_direct_brand",
    proofKey: "proof_vision",
    ctaKey: "cta_meeting",
  },
  reason: "Highly engaged returning visitor (3+ page views) — platform-confidence experience.",
};

// ── Interest-profile rules (medium_segmentation tier: 30–37) ─────────────────
//
// These rules fire when the visitor's computed interest profile scores indicate
// a clear topical preference.  They sit in the medium_segmentation tier so
// hard_state (1–9) and high_intent (10–19) rules always take precedence.
//
// Confidence threshold: 0.3 — requires at least 30 % confidence to avoid
// personalising visitors with only one or two tangentially-matching keyword hits.
//
// All eight rules resolve from ctx.interestContext which is populated by
// buildDecisionContext() after scoreInterests() / buildInterestContextVars() run.

const MIN_INTEREST_CONFIDENCE = 0.3;

/** Helper: returns true when interestContext primary equals `key` with sufficient confidence. */
function isInterestPrimary(ctx: RuleEvaluationContext, key: string): boolean {
  return (
    ctx.interestContext?.interestPrimary === key &&
    (ctx.interestContext?.interestConfidence ?? 0) >= MIN_INTEREST_CONFIDENCE
  );
}

const INTEREST_PRICING_RULE: HomepageRule = {
  id:       "homepage.interest_pricing",
  priority: 30,
  label:    "Interest: Pricing",
  match:    (ctx) => isInterestPrimary(ctx, "pricing"),
  plan: {
    heroKey:  "hero_intent_direct",
    proofKey: "proof_stats",
    ctaKey:   "cta_meeting",
  },
  reason: "Visitor's primary interest profile is 'pricing' — show intent-direct hero with ROI proof.",
};

const INTEREST_PRODUCT_RULE: HomepageRule = {
  id:       "homepage.interest_product",
  priority: 31,
  label:    "Interest: Product",
  match:    (ctx) => isInterestPrimary(ctx, "product"),
  plan: {
    heroKey:  "hero_consideration",
    proofKey: "proof_cases",
    ctaKey:   "cta_platform",
  },
  reason: "Visitor's primary interest is 'product' — show consideration hero with case-study proof.",
};

const INTEREST_USE_CASE_RULE: HomepageRule = {
  id:       "homepage.interest_use_case",
  priority: 32,
  label:    "Interest: Use case",
  match:    (ctx) => isInterestPrimary(ctx, "use-case"),
  plan: {
    heroKey:  "hero_consideration",
    proofKey: "proof_cases",
    ctaKey:   "cta_guide",
  },
  reason: "Visitor's primary interest is 'use-case' — show consideration hero with case-study proof and guide CTA.",
};

const INTEREST_TRUST_RULE: HomepageRule = {
  id:       "homepage.interest_trust",
  priority: 33,
  label:    "Interest: Trust & security",
  match:    (ctx) => isInterestPrimary(ctx, "trust"),
  plan: {
    heroKey:  "hero_direct_brand",
    proofKey: "proof_vision",
    ctaKey:   "cta_guide",
  },
  reason: "Visitor's primary interest is 'trust' — show brand credibility with vision-level proof.",
};

const INTEREST_TECHNICAL_RULE: HomepageRule = {
  id:       "homepage.interest_technical",
  priority: 34,
  label:    "Interest: Technical / developer",
  match:    (ctx) => isInterestPrimary(ctx, "technical"),
  plan: {
    heroKey:  "hero_google_problem",
    proofKey: "proof_platform",
    ctaKey:   "cta_platform",
  },
  reason: "Visitor's primary interest is 'technical' — lead with problem-solution and platform proof.",
};

const INTEREST_CANDIDATE_RULE: HomepageRule = {
  id:       "homepage.interest_candidate",
  priority: 35,
  label:    "Interest: Candidate / careers",
  match:    (ctx) => isInterestPrimary(ctx, "candidate"),
  plan: {
    heroKey:  "hero_careers_default",
    proofKey: "proof_careers_default",
    ctaKey:   "cta_careers_browse",
  },
  reason: "Visitor's primary interest is 'candidate' — activate careers experience.",
};

const INTEREST_COMMERCE_PRODUCT_RULE: HomepageRule = {
  id:       "homepage.interest_commerce_product",
  priority: 36,
  label:    "Interest: Commerce product",
  match:    (ctx) => isInterestPrimary(ctx, "commerce-product"),
  plan: {
    heroKey:  "hero_consideration",
    proofKey: "proof_cases",
    ctaKey:   "cta_demo",
  },
  reason: "Visitor's primary interest is 'commerce-product' — show product-consideration experience.",
};

const INTEREST_PROPERTY_RULE: HomepageRule = {
  id:       "homepage.interest_property",
  priority: 37,
  label:    "Interest: Property / real estate",
  match:    (ctx) => isInterestPrimary(ctx, "property"),
  plan: {
    heroKey:  "hero_consideration",
    proofKey: "proof_platform",
    ctaKey:   "cta_demo",
  },
  reason: "Visitor's primary interest is 'property' — show platform-consideration experience.",
};

// ── Ordered rule set ──────────────────────────────────────────────────────────

/**
 * The complete set of homepage rules, ordered by evaluation priority.
 * The array order is the source of truth — `priority` is metadata only.
 *
 * Priority order (lower = higher priority):
 *   5  — returning visitor who already clicked CTA   (RETURNING_CTA_CLICKED_RULE)
 *   7  — high-engagement returning visitor (3+ views) (HIGH_ENGAGEMENT_RULE)
 *  10  — Google / search traffic                       (GOOGLE_RULE)
 *  20  — LinkedIn / social traffic                     (LINKEDIN_RULE)
 *  30  — Interest: Pricing                             (INTEREST_PRICING_RULE)
 *  31  — Interest: Product                             (INTEREST_PRODUCT_RULE)
 *  32  — Interest: Use case                            (INTEREST_USE_CASE_RULE)
 *  33  — Interest: Trust & security                    (INTEREST_TRUST_RULE)
 *  34  — Interest: Technical / developer               (INTEREST_TECHNICAL_RULE)
 *  35  — Interest: Candidate / careers                 (INTEREST_CANDIDATE_RULE)
 *  36  — Interest: Commerce product                    (INTEREST_COMMERCE_PRODUCT_RULE)
 *  37  — Interest: Property / real estate              (INTEREST_PROPERTY_RULE)
 *
 * New rules are inserted here without touching the provider implementation.
 */
export const HOMEPAGE_RULES: readonly HomepageRule[] = [
  RETURNING_CTA_CLICKED_RULE,
  HIGH_ENGAGEMENT_RULE,
  GOOGLE_RULE,
  LINKEDIN_RULE,
  INTEREST_PRICING_RULE,
  INTEREST_PRODUCT_RULE,
  INTEREST_USE_CASE_RULE,
  INTEREST_TRUST_RULE,
  INTEREST_TECHNICAL_RULE,
  INTEREST_CANDIDATE_RULE,
  INTEREST_COMMERCE_PRODUCT_RULE,
  INTEREST_PROPERTY_RULE,
] as const;

// ── Default plan ──────────────────────────────────────────────────────────────

/**
 * Fallback plan used when no rule matches.
 * Direct traffic, unknown sources, and any future unhandled context
 * all receive this brand-led experience.
 */
export const DEFAULT_HOMEPAGE_PLAN: ExperiencePlan = {
  heroKey: "hero_direct_brand",
  proofKey: "proof_platform",
  ctaKey: "cta_meeting",
  reason: "Default/direct traffic gets brand-led experience.",
} as const;
