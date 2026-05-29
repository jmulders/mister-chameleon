/**
 * Apply Scenario Override
 *
 * Merges scenario overrides into a real JourneyState to produce
 * a "scenario-modified" state for rendering + debug panel display.
 *
 * ─── Guarantees ───────────────────────────────────────────────────────────────
 *
 *   • The real JourneyState is never mutated.
 *   • Only explicitly set overrides are applied (partial merge).
 *   • Computed derived fields (confidence band from overallConfidence, etc.)
 *     are recalculated from the override values so the state is internally
 *     consistent.
 *   • This function is pure — no I/O, no side effects.
 *
 * ─── Confidence reconstruction ────────────────────────────────────────────────
 *
 *   When `confidenceBand` is provided in overrides, we reconstruct a synthetic
 *   BehaviorConfidence object with plausible per-dimension scores so downstream
 *   gating logic (gateAdaptiveDecisions) produces correct slot decisions.
 */

import type { JourneyState, BehaviorConfidence, ConfidenceBand } from "@/lib/journey/types";
import type { ScenarioOverrides } from "./scenario-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function bandToConfidence(band: ConfidenceBand): number {
  switch (band) {
    case "very_high": return 0.82;
    case "high":      return 0.65;
    case "medium":    return 0.45;
    case "low":
    default:          return 0.20;
  }
}

function buildSyntheticConfidence(
  overrides: ScenarioOverrides,
  base:      BehaviorConfidence,
): BehaviorConfidence {
  const band     = overrides.confidenceBand    ?? base.band;
  const overall  = overrides.overallConfidence ?? bandToConfidence(band);

  // Distribute overall across dimensions plausibly.
  // intent carries the most weight (0.45 weight in real model).
  const intentConf  = Math.min(1, overall * 1.20);
  const seqConf     = (overrides.matchedSequences?.length ?? 0) > 0
    ? Math.min(1, overall * 1.10)
    : Math.max(0.10, overall * 0.80);
  const funnelConf  = Math.min(1, overall * 1.05);

  const reasons: string[] = ["[SCENARIO OVERRIDE]"];
  if (overrides.confidenceBand) reasons.push(`forced band: ${overrides.confidenceBand}`);
  if (overrides.funnelStage)    reasons.push(`forced funnel stage: ${overrides.funnelStage}`);

  return {
    intentConfidence:      Math.round(intentConf * 100) / 100,
    sequenceConfidence:    Math.round(seqConf    * 100) / 100,
    funnelStageConfidence: Math.round(funnelConf * 100) / 100,
    overallConfidence:     Math.round(overall    * 100) / 100,
    band,
    reasons,
  };
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Applies scenario overrides to a real JourneyState.
 *
 * @param real      The actual journey state from the server / merge algorithm.
 * @param overrides The scenario overrides to apply on top.
 * @returns         A new JourneyState with overrides merged in.
 */
export function applyScenarioOverride(
  real:      JourneyState,
  overrides: ScenarioOverrides,
): JourneyState {
  // Start with the real state as the base.
  const merged: JourneyState = { ...real };

  // ── Funnel ────────────────────────────────────────────────────────────────
  if (overrides.funnelStage      !== undefined) merged.funnelStage      = overrides.funnelStage;
  if (overrides.funnelStage === "customer")     merged.hasSubmittedForm  = true;

  // ── Counts ────────────────────────────────────────────────────────────────
  // When a scenario preset defines pageViewCount (e.g. high_intent=6), apply it
  // so the Live State panel shows the preset-defined count rather than the real
  // session value (which starts at 1 on each page load).  This keeps the display
  // consistent with the other scenario-frozen fields (hasVisitedPricing etc.).
  // Real-session accumulation still works when no scenario is active.
  if (overrides.pageViewCount    !== undefined) merged.pageViewCount    = overrides.pageViewCount;

  // ── Scores ────────────────────────────────────────────────────────────────
  if (overrides.intentScore      !== undefined) merged.intentScore      = overrides.intentScore;
  if (overrides.engagementScore  !== undefined) merged.engagementScore  = overrides.engagementScore;
  if (overrides.frictionScore    !== undefined) merged.frictionScore    = overrides.frictionScore;
  if (overrides.sequenceScore    !== undefined) merged.sequenceScore    = overrides.sequenceScore;
  if (overrides.shortTermIntentScore  !== undefined) merged.shortTermIntentScore  = overrides.shortTermIntentScore;
  if (overrides.longTermAffinityScore !== undefined) merged.longTermAffinityScore = overrides.longTermAffinityScore;

  // ── Page flags ────────────────────────────────────────────────────────────
  if (overrides.hasVisitedPricing !== undefined) merged.hasVisitedPricing = overrides.hasVisitedPricing;
  if (overrides.hasVisitedAbout   !== undefined) merged.hasVisitedAbout   = overrides.hasVisitedAbout;
  if (overrides.hasVisitedCases   !== undefined) merged.hasVisitedCases   = overrides.hasVisitedCases;
  if (overrides.hasVisitedContact !== undefined) merged.hasVisitedContact = overrides.hasVisitedContact;
  if (overrides.hasClickedCta     !== undefined) merged.hasClickedCta     = overrides.hasClickedCta;
  if (overrides.hasStartedForm    !== undefined) {
    // journey.hasStartedForm is a derived flag: formStartCount > 0.
    // Set formStartCount so the field-registry resolver sees the correct value.
    if (overrides.hasStartedForm) {
      if ((merged.formStartCount ?? 0) === 0) merged.formStartCount = 1;
    } else {
      merged.formStartCount = 0;
    }
  }
  if (overrides.hasSubmittedForm  !== undefined) merged.hasSubmittedForm  = overrides.hasSubmittedForm;

  // ── Sequences ─────────────────────────────────────────────────────────────
  if (overrides.matchedSequences !== undefined)  merged.matchedSequences  = overrides.matchedSequences;

  // ── Funnel stage confidence ────────────────────────────────────────────────
  // Sync funnelStageConfidence from the override so gating logic is consistent.
  if (overrides.funnelStage === "customer")    merged.funnelStageConfidence = 1.0;
  else if (overrides.funnelStage === "high_intent") merged.funnelStageConfidence = 0.85;
  else if (overrides.funnelStage === "intent")      merged.funnelStageConfidence = 0.70;
  else if (overrides.funnelStage === "consideration") merged.funnelStageConfidence = 0.55;
  else if (overrides.funnelStage === "awareness")   merged.funnelStageConfidence = 0.50;

  // ── Confidence reconstruction ──────────────────────────────────────────────
  // Always rebuild when any confidence-affecting field is overridden.
  const needsConfidenceRebuild =
    overrides.confidenceBand      !== undefined ||
    overrides.overallConfidence   !== undefined ||
    overrides.funnelStage         !== undefined ||
    overrides.intentScore         !== undefined ||
    overrides.frictionScore       !== undefined ||
    overrides.matchedSequences    !== undefined;

  if (needsConfidenceRebuild) {
    merged.confidence = buildSyntheticConfidence(overrides, real.confidence);
  }

  return merged;
}
