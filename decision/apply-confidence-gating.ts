/**
 * Confidence-Gated Plan
 *
 * Applies the AdaptiveGating rules from the confidence model to an
 * ExperiencePlan before it is served to the visitor.
 *
 * ─── Why this is needed ───────────────────────────────────────────────────────
 *
 *   The rules engine resolves a plan based on rule matching alone.  Without
 *   confidence gating, a single page view from a new visitor can trigger a
 *   high-personalisation rule and completely override the hero, proof, CTA and
 *   theme — even when the underlying signal is very weak.
 *
 *   This layer sits between the rules engine output and the renderer.  It
 *   replaces slots in the plan with their defaults when the current confidence
 *   band is too low to trust them.
 *
 * ─── Gating rules (from compute-confidence.ts) ───────────────────────────────
 *
 *   low:       cta=✗  proof=✗  hero=✗  theme=✗  → full default experience
 *   medium:    cta=✓  proof=✓  hero=✗  theme=✗  → CTA + proof may change
 *   high:      cta=✓  proof=✓  hero=✓  theme=✗  → hero may also change
 *   very_high: cta=✓  proof=✓  hero=✓  theme=✓  → full personalised experience
 *
 * ─── How theme gating interacts with the session lock ─────────────────────────
 *
 *   Theme is already session-locked via the mc_theme cookie in
 *   resolveThemeDecision().  Confidence gating adds a second guard: the theme
 *   can ONLY enter the session lock in the first place if confidence ≥ very_high
 *   AND totalEvents ≥ MIN_THEME_EVENTS.
 *
 * ─── Pure function — no I/O ───────────────────────────────────────────────────
 *
 *   Safe to call in both server and client contexts.
 */

import type { ExperiencePlan } from "./types";
import type { JourneyState }   from "@/lib/journey/types";
import {
  computeBehaviorConfidence,
  gateAdaptiveDecisions,
} from "@/lib/journey/compute-confidence";

// ── Default plan (production-safe baseline) ───────────────────────────────────

/** Minimal safe default for any missing slot. */
const SLOT_DEFAULTS = {
  heroKey:  "hero_default",
  proofKey: "proof_default",
  ctaKey:   "cta_default",
} as const;

// ── Main export ───────────────────────────────────────────────────────────────

export interface GatedPlanResult {
  /** The plan after confidence gating has been applied. */
  plan:              ExperiencePlan;
  /** Which adaptive slots were allowed at the current confidence band. */
  gating:            ReturnType<typeof gateAdaptiveDecisions>;
  /** Whether any slot was replaced due to insufficient confidence. */
  anySlotGated:      boolean;
  /** Human-readable explanation (shown in debug panel). */
  gatingSummary:     string;
}

/**
 * Apply confidence gating to an ExperiencePlan.
 *
 * When the journey's confidence band is too low for a given slot, that slot
 * falls back to the corresponding key in `defaults`.  The `defaults` argument
 * is typically the tenant's default plan (from StoredRulesConfig.defaultPlan)
 * so the fallback is always a valid, CMS-backed key.
 *
 * @param plan      The rules engine output (may be fully personalised).
 * @param journey   The visitor's current journey state.
 * @param defaults  The baseline plan to fall back to per slot.
 */
export function applyConfidenceGating(
  plan:     ExperiencePlan,
  journey:  JourneyState,
  defaults: Pick<ExperiencePlan, "heroKey" | "proofKey" | "ctaKey">,
): GatedPlanResult {

  const confidence = computeBehaviorConfidence(journey);
  const gating     = gateAdaptiveDecisions(confidence, journey);

  let gated    = { ...plan };
  let modified = false;
  const blocked: string[] = [];

  // ── Hero slot ─────────────────────────────────────────────────────────────
  if (!gating.hero && gated.heroKey !== defaults.heroKey) {
    blocked.push(
      `hero: replaced '${gated.heroKey}' → '${defaults.heroKey}' (confidence=${Math.round(confidence.overallConfidence * 100)}%, band=${confidence.band})`,
    );
    gated = { ...gated, heroKey: defaults.heroKey };
    modified = true;
  }

  // ── Proof slot ────────────────────────────────────────────────────────────
  if (!gating.proof && gated.proofKey !== defaults.proofKey) {
    blocked.push(
      `proof: replaced '${gated.proofKey}' → '${defaults.proofKey}' (needs medium confidence)`,
    );
    gated = { ...gated, proofKey: defaults.proofKey };
    modified = true;
  }

  // ── CTA slot ──────────────────────────────────────────────────────────────
  if (!gating.cta && gated.ctaKey !== defaults.ctaKey) {
    blocked.push(
      `cta: replaced '${gated.ctaKey}' → '${defaults.ctaKey}' (needs medium confidence)`,
    );
    gated = { ...gated, ctaKey: defaults.ctaKey };
    modified = true;
  }

  // ── Theme slot ────────────────────────────────────────────────────────────
  // Gated separately: theme changes also require session stability, which is
  // enforced by the mc_theme cookie lock in resolveThemeDecision().
  // Here we simply remove themeKey from the plan when confidence is too low
  // to prevent it from entering the session lock.
  if (!gating.theme && gated.themeKey) {
    blocked.push(
      `theme: removed '${gated.themeKey}' from plan (needs very_high confidence)`,
    );
    gated = { ...gated, themeKey: undefined };
    modified = true;
  }

  const gatingSummary = modified
    ? `Confidence gate applied (band=${confidence.band}, ${Math.round(confidence.overallConfidence * 100)}%):\n  • ${blocked.join("\n  • ")}`
    : `No slots gated — confidence band '${confidence.band}' (${Math.round(confidence.overallConfidence * 100)}%) allows all active slots.`;

  return {
    plan:          gated,
    gating,
    anySlotGated:  modified,
    gatingSummary,
  };
}
