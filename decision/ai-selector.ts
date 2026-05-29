/**
 * AI Slot Selector
 *
 * Explicit per-slot AI selection layer — Phase 1 of production-ready AI
 * variant selection.
 *
 * ─── Responsibility ───────────────────────────────────────────────────────────
 *
 *   Takes the global AI plan and the rules plan, then assembles the final
 *   ExperiencePlan by selecting each core slot (hero / proof / cta) according
 *   to its configured SlotSelectionMode.  This makes the AI selection layer
 *   explicit, traceable, and independently configurable per slot.
 *
 * ─── Selection order per slot ────────────────────────────────────────────────
 *
 *   1. mode === "static"
 *      → serve config.staticKey.  Neither AI nor rules key is used.
 *      → if staticKey is absent, falls back to rules key (safety fallback).
 *
 *   2. mode === "rules-only"
 *      → serve rulesPlan key for this slot unconditionally.
 *      → AI key is recorded in the trace but never served.
 *
 *   3. mode === "ai-assisted" (default)
 *      → serve aiPlan key when aiUsed=true (AI passed global confidence gates).
 *      → otherwise serve rulesPlan key for this slot.
 *
 * ─── Guaranteed fallback ─────────────────────────────────────────────────────
 *
 *   Every slot always resolves to a non-empty variant key.  The rules plan
 *   provides the guaranteed baseline — RulesDecisionProvider applies its own
 *   4-tier fallback so rulesPlan keys are always valid strings.
 *
 * ─── Trace output ────────────────────────────────────────────────────────────
 *
 *   assembleSlotPlan() returns a SlotPlanAssembly that carries both the final
 *   ExperiencePlan and a per-slot SlotDecisionTrace for every core slot.  The
 *   traces are stored on AiDecisionProvider.lastSlotAssembly and surfaced in
 *   DecisionTrace.perSlot for the debug panel and admin explainability views.
 *
 * ─── Eligibility counts ──────────────────────────────────────────────────────
 *
 *   For each slot, filterEligibleCandidates() is called to derive
 *   candidateCount (aiReady variants) and eligibleCount (after context gates).
 *   These counts appear in SlotDecisionTrace for admin debug and for the
 *   buildSlotExplanation() helper in explain.ts.
 */

import type {
  ExperiencePlan,
  HeroVariantKey,
  ProofVariantKey,
  CTAVariantKey,
} from "@/decision/types";
import type { SlotCandidates }         from "@/ai/variant-meta";
import type { DecisionInput }          from "@/decision/types";
import type { CoreSlotId, SlotModeRegistry, SlotSelectionMode } from "./slot-selection-mode";
import { getSlotConfig }               from "./slot-selection-mode";
import { filterAiReady }               from "@/ai/resolve-variant-candidates";
import { filterEligibleCandidates }    from "./slot-eligibility";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Per-slot decision trace recorded by assembleSlotPlan().
 *
 * Attached to AiDecisionProvider.lastSlotAssembly and propagated into
 * DecisionTrace.perSlot after buildDecisionTrace() is called.
 */
export interface SlotDecisionTrace {
  /** Slot identifier. */
  slotId: CoreSlotId;

  /**
   * The selection mode that was active for this slot.
   * Reflects the operator-configured mode (or "ai-assisted" by default).
   */
  mode: SlotSelectionMode;

  /** The final variant key chosen for this slot. */
  chosenKey: string;

  /**
   * How the chosen key was sourced:
   *   "static"   — served from AdaptiveSlotConfig.staticKey directly.
   *   "rules"    — taken from the rules plan (mode is rules-only, or AI not used).
   *   "ai"       — taken from the AI plan (mode is ai-assisted and aiUsed=true).
   *   "fallback" — static mode with missing staticKey; rules plan key used instead.
   */
  source: "static" | "rules" | "ai" | "fallback";

  /**
   * The key the AI plan proposed for this slot.
   *
   * Recorded even when source !== "ai" — this lets the debug panel show
   * "AI would have chosen X, but rules-only mode was active" explanations.
   * null when AI was not called (context too sparse or AI disabled).
   */
  aiProposedKey: string | null;

  /**
   * Total number of aiReady candidates available for this slot.
   * Used in admin debug to show "AI chose from N candidates".
   */
  candidateCount: number;

  /**
   * Number of candidates that passed the context eligibility gates
   * (source restriction, intent-level guard).
   * Always ≤ candidateCount.
   */
  eligibleCount: number;

  /**
   * Why the AI key was not used, when source !== "ai".
   *
   * Examples:
   *   "rules_only_mode"    — slot configured as rules-only; AI bypassed.
   *   "static_key_absent"  — static mode, staticKey missing; fell back to rules.
   *   "ai_not_used"        — ai-assisted slot, but AI failed confidence gates.
   *   null                 — AI was used, or AI was not involved in this slot.
   */
  overriddenBy: string | null;
}

// Re-export for callers that import SlotDecisionTrace and need SlotSelectionMode together.
export type { SlotSelectionMode };
export type { CoreSlotId };

/**
 * Full result of assembleSlotPlan().
 *
 * Carries both the final merged ExperiencePlan and the per-slot decision
 * traces that are propagated into the DecisionTrace and admin debug views.
 */
export interface SlotPlanAssembly {
  /**
   * The final assembled ExperiencePlan.
   *
   * Each core slot key (heroKey, proofKey, ctaKey) reflects the mode-based
   * selection.  All non-core fields (themeKey, pricingEmphasis, pricingCtaMode,
   * featureKey, conversionKey, reason) are inherited from rulesPlan so that
   * the rules layer's pricing and extended-slot decisions are always preserved.
   */
  plan: ExperiencePlan;

  /** Per-slot decision traces for all three core slots. */
  perSlot: Record<CoreSlotId, SlotDecisionTrace>;
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Assemble the final ExperiencePlan by selecting each core slot's key
 * according to its configured SlotSelectionMode.
 *
 * @param aiPlan      The plan produced by the AI provider.
 *                    Pass null when AI was not called (context sparse, AI disabled).
 * @param rulesPlan   The plan produced by the rules/fallback provider.
 *                    Always present; serves as the guaranteed baseline.
 * @param aiUsed      Whether the AI passed the global confidence policy gate.
 *                    When false, "ai-assisted" slots fall back to the rules key.
 * @param registry    Per-slot mode configuration.
 *                    null/undefined → all slots default to "ai-assisted".
 * @param candidates  Variant candidates per slot (for eligibility counts).
 *                    When absent, candidateCount and eligibleCount are 0.
 * @param input       Visitor decision input (for eligibility gate evaluation).
 */
export function assembleSlotPlan(
  aiPlan:     ExperiencePlan | null,
  rulesPlan:  ExperiencePlan,
  aiUsed:     boolean,
  registry:   SlotModeRegistry | undefined | null,
  candidates: SlotCandidates   | undefined,
  input:      DecisionInput,
): SlotPlanAssembly {
  const heroTrace  = selectSlot("hero",  aiPlan, rulesPlan, aiUsed, registry, candidates, input);
  const proofTrace = selectSlot("proof", aiPlan, rulesPlan, aiUsed, registry, candidates, input);
  const ctaTrace   = selectSlot("cta",   aiPlan, rulesPlan, aiUsed, registry, candidates, input);

  const plan: ExperiencePlan = {
    // Inherit all fields from rulesPlan — preserves themeKey, pricingEmphasis,
    // pricingCtaMode, featureKey, conversionKey, etc.
    ...rulesPlan,
    // Override the three core keys with per-slot selections.
    heroKey:  heroTrace.chosenKey  as HeroVariantKey,
    proofKey: proofTrace.chosenKey as ProofVariantKey,
    ctaKey:   ctaTrace.chosenKey   as CTAVariantKey,
    reason:   buildReason(heroTrace, proofTrace, ctaTrace, rulesPlan.reason),
  };

  return {
    plan,
    perSlot: {
      hero:  heroTrace,
      proof: proofTrace,
      cta:   ctaTrace,
    },
  };
}

// ── Per-slot selection ────────────────────────────────────────────────────────

function selectSlot(
  slotId:     CoreSlotId,
  aiPlan:     ExperiencePlan | null,
  rulesPlan:  ExperiencePlan,
  aiUsed:     boolean,
  registry:   SlotModeRegistry | undefined | null,
  candidates: SlotCandidates   | undefined,
  input:      DecisionInput,
): SlotDecisionTrace {
  const cfg           = getSlotConfig(registry, slotId);
  const rulesKey      = getKey(rulesPlan, slotId);
  const aiProposedKey = aiPlan ? getKey(aiPlan, slotId) : null;

  // ── Candidate counts for debug trace ────────────────────────────────────────
  // Always compute these regardless of mode so the trace is always populated.
  const slotCandidates    = candidates?.[slotId] ?? [];
  const aiReadyCandidates = filterAiReady(slotCandidates);
  const eligibilityResult = filterEligibleCandidates(aiReadyCandidates, input);
  const candidateCount    = aiReadyCandidates.length;
  const eligibleCount     = eligibilityResult.eligible.length;

  // ── Mode-based selection ────────────────────────────────────────────────────
  switch (cfg.mode) {
    // ── Static: serve the locked key ─────────────────────────────────────────
    case "static": {
      if (cfg.staticKey) {
        return {
          slotId,
          mode:         "static",
          chosenKey:    cfg.staticKey,
          source:       "static",
          aiProposedKey,
          candidateCount,
          eligibleCount,
          overriddenBy: null,
        };
      }
      // staticKey absent → safety fallback to rules key
      return {
        slotId,
        mode:         "static",
        chosenKey:    rulesKey,
        source:       "fallback",
        aiProposedKey,
        candidateCount,
        eligibleCount,
        overriddenBy: "static_key_absent",
      };
    }

    // ── Rules-only: rules plan always wins ───────────────────────────────────
    case "rules-only": {
      const wasOverridden =
        aiProposedKey !== null && aiUsed && aiProposedKey !== rulesKey;
      return {
        slotId,
        mode:         "rules-only",
        chosenKey:    rulesKey,
        source:       "rules",
        aiProposedKey,
        candidateCount,
        eligibleCount,
        overriddenBy: wasOverridden ? "rules_only_mode" : null,
      };
    }

    // ── AI-assisted: AI wins when it passed the global confidence gates ───────
    case "ai-assisted":
    default: {
      if (aiUsed && aiProposedKey) {
        return {
          slotId,
          mode:         "ai-assisted",
          chosenKey:    aiProposedKey,
          source:       "ai",
          aiProposedKey,
          candidateCount,
          eligibleCount,
          overriddenBy: null,
        };
      }
      return {
        slotId,
        mode:         "ai-assisted",
        chosenKey:    rulesKey,
        source:       "rules",
        aiProposedKey,
        candidateCount,
        eligibleCount,
        overriddenBy: "ai_not_used",
      };
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract the variant key for a slot from an ExperiencePlan. */
function getKey(plan: ExperiencePlan, slotId: CoreSlotId): string {
  switch (slotId) {
    case "hero":  return plan.heroKey;
    case "proof": return plan.proofKey;
    case "cta":   return plan.ctaKey;
  }
}

/**
 * Build the `reason` string for the assembled plan.
 *
 * Summarises which slots were served by AI vs rules in a single line.
 * The rulesPlan reason is carried through when all slots are rules-driven.
 */
function buildReason(
  hero:          SlotDecisionTrace,
  proof:         SlotDecisionTrace,
  cta:           SlotDecisionTrace,
  fallbackReason: string,
): string {
  const aiSlots    = [hero, proof, cta].filter((s) => s.source === "ai").map((s) => s.slotId);
  const rulesSlots = [hero, proof, cta].filter((s) => s.source !== "ai").map((s) => s.slotId);

  if (aiSlots.length === 3) {
    return `[ai:all] ${fallbackReason}`;
  }
  if (aiSlots.length > 0) {
    return `[mixed] AI→${aiSlots.join(",")} rules→${rulesSlots.join(",")}: ${fallbackReason}`;
  }
  return fallbackReason;
}
