/**
 * Slot Eligibility Filter
 *
 * Filters variant candidates to those eligible for AI selection given the
 * current visitor context.
 *
 * This runs AFTER filterAiReady() (which gates on decisionMeta completeness)
 * and BEFORE the AI prompt is built — or after the AI call when the eligibility
 * check is used for debug trace counts.
 *
 * ─── Eligibility gates ───────────────────────────────────────────────────────
 *
 *   1. Source restriction
 *      When a variant's `bestForSources` is non-empty and does not include
 *      the wildcard "*", the visitor's source must match one of the listed
 *      values.  Variants without source restrictions are always eligible.
 *
 *   2. Intent-level guard
 *      Variants with `intentLevel === "decision"` (highest intent tier) require
 *      evidence of genuine purchase intent before they are offered to the AI:
 *        • journey intentScore ≥ 50, OR
 *        • visitType is "returning" or "high_intent"
 *      Without this evidence the decision-intent variant is withheld to avoid
 *      premature high-pressure messaging for low-intent visitors.
 *
 * ─── Fail-open safety ────────────────────────────────────────────────────────
 *
 *   When ALL candidates are filtered out, the function returns the full
 *   unfiltered list.  This prevents a misconfigured eligibility gate from
 *   completely blocking AI selection and guarantees the AI always receives
 *   at least one candidate to choose from.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   The eligibility filter is called by assembleSlotPlan() in ai-selector.ts
 *   for each core slot.  Its primary purpose is populating the debug trace
 *   (candidateCount / eligibleCount).  The prompt builder may additionally
 *   filter using this function before constructing the AI system prompt.
 */

import type { VariantCandidate }  from "@/ai/variant-meta";
import type { DecisionInput }     from "@/decision/types";

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * Result of filterEligibleCandidates().
 *
 * Carries both the filtered list and diagnostic information used to populate
 * the per-slot SlotDecisionTrace (candidateCount, eligibleCount, gatesFired).
 */
export interface EligibilityResult {
  /**
   * The candidates that passed all eligibility gates.
   *
   * May equal `all` when no gates fired or when the fail-open safety triggered
   * (i.e. every candidate would otherwise have been removed).
   */
  eligible:     VariantCandidate[];

  /** The full unfiltered input list, retained for comparison. */
  all:          VariantCandidate[];

  /** Number of candidates removed by eligibility gates (0 when fail-open). */
  removedCount: number;

  /**
   * Which gates fired on at least one candidate.
   * Each gate fires at most once regardless of how many candidates it removed.
   *
   *   "source_restriction"      — visitor source not in variant's bestForSources
   *   "intent_level_decision"   — decision-intent variant, but visitor has low intent
   *   "fail_open_safety"        — all candidates would be removed; returning full list
   */
  gatesFired: string[];
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Filter `candidates` to those eligible given the current visitor context.
 *
 * Never returns an empty list — when all candidates fail the gates, the full
 * unfiltered list is returned with "fail_open_safety" in `gatesFired`.
 *
 * @param candidates  AI-ready candidates for one slot (output of filterAiReady).
 * @param input       The full visitor decision input.
 */
export function filterEligibleCandidates(
  candidates: VariantCandidate[],
  input:       DecisionInput,
): EligibilityResult {
  if (candidates.length === 0) {
    return { eligible: [], all: [], removedCount: 0, gatesFired: [] };
  }

  const gatesFired  = new Set<string>();
  const visitorSource = (input.source as string | null) ?? "direct";

  // Derive intent evidence once, outside the loop.
  const intentScore = input.history.journey?.intentScore ?? 0;
  const visitType   = (input.visitType as string | null) ?? "first_visit";
  const hasIntentEvidence =
    intentScore >= 50 ||
    visitType === "returning" ||
    visitType === "high_intent";

  const eligible = candidates.filter((c) => {
    const meta = c.decisionMeta;
    if (!meta) return true; // aiReady=false should have been filtered upstream, but guard

    // ── Gate 1: source restriction ──────────────────────────────────────────
    // Cast to string[] to allow wildcard "*" check — VisitorSource union doesn't
    // include "*" as a literal, but CMS meta may set it as a pass-through signal.
    const sources = meta.bestForSources as string[];
    if (sources.length > 0 && !sources.includes("*")) {
      if (!sources.includes(visitorSource)) {
        gatesFired.add("source_restriction");
        return false;
      }
    }

    // ── Gate 2: intent-level guard ──────────────────────────────────────────
    if (meta.intentLevel === "decision" && !hasIntentEvidence) {
      gatesFired.add("intent_level_decision");
      return false;
    }

    return true;
  });

  // Fail-open: never return an empty list
  if (eligible.length === 0) {
    gatesFired.add("fail_open_safety");
    return {
      eligible:     candidates,
      all:          candidates,
      removedCount: 0,
      gatesFired:   Array.from(gatesFired),
    };
  }

  return {
    eligible,
    all:          candidates,
    removedCount: candidates.length - eligible.length,
    gatesFired:   Array.from(gatesFired),
  };
}
