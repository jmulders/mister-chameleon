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

  /** Predicate — return true to apply this rule */
  match: (input: DecisionInput) => boolean;

  /** The three variant keys selected when this rule fires */
  plan: {
    heroKey: HeroVariantKey;
    proofKey: ProofVariantKey;
    ctaKey: CTAVariantKey;
  };

  /** Explanation surfaced in debug output and analytics */
  reason: string;
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
 *
 * New rules are inserted here without touching the provider implementation.
 */
export const HOMEPAGE_RULES: readonly HomepageRule[] = [
  RETURNING_CTA_CLICKED_RULE,
  HIGH_ENGAGEMENT_RULE,
  GOOGLE_RULE,
  LINKEDIN_RULE,
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
