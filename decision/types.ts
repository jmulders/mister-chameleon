/**
 * Decision Layer Types
 *
 * Defines the output vocabulary of the decision engine and the input type
 * that all decision providers receive.
 *
 * ─── Input → Output flow ──────────────────────────────────────────────────────
 *
 *   DecisionInput  →  DecisionProvider.getHomepagePlan()  →  ExperiencePlan
 *        ↑                                                          ↓
 *   VisitorContext                                    block components receive
 *   + VisitorHistory                                  typed variant keys and
 *   (from context layer)                              fetch matching CMS content
 *
 * ─── Key naming convention ────────────────────────────────────────────────────
 *
 *   {block}_{intent}
 *     block  — the page section this key controls  (hero, proof, cta)
 *     intent — the visitor intent it speaks to     (problem, vision, brand, …)
 */

import type { VisitorContext } from "@/context/types";
import type { VisitorHistory } from "@/context/visitor-history";

// ── Hero variant keys ─────────────────────────────────────────────────────────

/**
 * Controls the headline, subheadline, and CTA copy inside HeroBlock.
 *
 * hero_google_problem   — speaks to a visitor searching for a solution
 *                         ("Are you leaving conversion on the table?")
 * hero_linkedin_vision  — speaks to a visitor browsing thought leadership
 *                         ("The future of website personalisation is here.")
 * hero_direct_brand     — speaks to an unattributed visitor; leads with brand
 *                         ("Your website, tailored to every visitor.")
 */
export type HeroVariantKey =
  | "hero_google_problem"
  | "hero_linkedin_vision"
  | "hero_direct_brand";

/**
 * Runtime tuple of all valid hero variant key strings.
 * Mirrors the HeroVariantKey union — keep in sync when adding new keys.
 * Used by the admin page builder for slot vocabulary validation.
 */
export const HERO_VARIANT_KEYS: readonly HeroVariantKey[] = [
  "hero_google_problem",
  "hero_linkedin_vision",
  "hero_direct_brand",
] as const;

// ── Proof variant keys ────────────────────────────────────────────────────────

/**
 * Controls which social proof angle the ProofBlock surfaces.
 *
 * proof_cases     — concrete case studies and ROI numbers (problem-solver audience)
 * proof_vision    — analyst quotes, industry recognition (thought-leader audience)
 * proof_platform  — platform scale and reliability stats (evaluator audience)
 */
export type ProofVariantKey =
  | "proof_cases"
  | "proof_vision"
  | "proof_platform";

/**
 * Runtime tuple of all valid proof variant key strings.
 * Mirrors the ProofVariantKey union — keep in sync when adding new keys.
 * Used by the admin page builder for slot vocabulary validation.
 */
export const PROOF_VARIANT_KEYS: readonly ProofVariantKey[] = [
  "proof_cases",
  "proof_vision",
  "proof_platform",
] as const;

// ── CTA variant keys ──────────────────────────────────────────────────────────

/**
 * Controls the primary call-to-action in CTABlock.
 *
 * cta_guide     — "Get the free personalisation guide"  (nurture/educate intent)
 * cta_platform  — "Start building for free"             (product-led intent)
 * cta_meeting   — "Book a 20-minute intro call"         (sales-led/brand intent)
 */
export type CTAVariantKey =
  | "cta_guide"
  | "cta_platform"
  | "cta_meeting";

/**
 * Runtime tuple of all valid CTA variant key strings.
 * Mirrors the CTAVariantKey union — keep in sync when adding new keys.
 * Used by the admin page builder for slot vocabulary validation.
 */
export const CTA_VARIANT_KEYS: readonly CTAVariantKey[] = [
  "cta_guide",
  "cta_platform",
  "cta_meeting",
] as const;

// ── Slot vocabulary map ───────────────────────────────────────────────────────

/**
 * The complete variant key vocabulary, keyed by context slot ID.
 *
 * Used by the admin page builder to populate slot editors with the correct
 * allowed-variant checkboxes and fallback-variant selects.  Not consumed by
 * the runtime decision engine — the engine always works from its full type
 * vocabulary; `allowedVariantKeys` on EditableContextSlot is an operator
 * configuration hint for future engine constraint support.
 */
export const SLOT_VOCABULARY = {
  hero:  HERO_VARIANT_KEYS  as readonly string[],
  proof: PROOF_VARIANT_KEYS as readonly string[],
  cta:   CTA_VARIANT_KEYS   as readonly string[],
} as const;

// ── Experience plan ───────────────────────────────────────────────────────────

/**
 * The complete adaptive page plan produced by the decision engine
 * for a single visitor context.
 *
 * Each key selects one content variant per page section.
 * `reason` is a human-readable string explaining which rule fired —
 * surfaced in the debug panel and analytics events.
 */
export interface ExperiencePlan {
  /** Selected hero variant key */
  heroKey: HeroVariantKey;

  /** Selected proof variant key */
  proofKey: ProofVariantKey;

  /** Selected CTA variant key */
  ctaKey: CTAVariantKey;

  /**
   * Human-readable explanation of why this plan was selected.
   * Used in the debug panel and for analytics event properties.
   */
  reason: string;
}

// ── Convenience union ─────────────────────────────────────────────────────────

/** Any variant key from any block section */
export type AnyVariantKey = HeroVariantKey | ProofVariantKey | CTAVariantKey;

// ── Decision input ─────────────────────────────────────────────────────────────

/**
 * The full input payload fed to every decision provider.
 *
 * Extends VisitorContext with a first-party `history` struct so that rules
 * and AI providers can personalise based on prior behaviour as well as the
 * current request.
 *
 * Because `DecisionInput extends VisitorContext`, all existing rule predicates
 * that reference `ctx.source`, `ctx.device`, etc. compile unchanged — they
 * simply ignore the new `history` field.  History-aware rules opt in by
 * destructuring or reading `ctx.history.*`.
 *
 * Build via `buildDecisionInput(context, history)` in the page/route; never
 * construct inline.
 */
export interface DecisionInput extends VisitorContext {
  /**
   * First-party behavioural history for this session.
   *
   * Derived from the `events` and `served_variants` tables — no
   * fingerprinting, no cross-session stitching beyond the first-party
   * mc_session_id cookie.
   *
   * Always present; `history.fromDatabase` is false when the DB query failed
   * or the visitor is brand-new (safe zero-values throughout).
   */
  history: VisitorHistory;
}

/**
 * Merge a fully resolved VisitorContext with its first-party VisitorHistory
 * into a DecisionInput ready for the decision pipeline.
 *
 * @example
 * const history = await fetchVisitorHistory(sessionId);
 * const input   = buildDecisionInput(context, history);
 * const plan    = await decisionProvider.getHomepagePlan(input);
 */
export function buildDecisionInput(
  context: VisitorContext,
  history: VisitorHistory,
): DecisionInput {
  return { ...context, history };
}
