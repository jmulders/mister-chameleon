/**
 * Behavioral Confidence Model — Journey Engine v3
 *
 * Computes multi-dimensional confidence scores that gate how aggressively the
 * system personalizes the visitor experience.
 *
 * v3 adds an anti-false-positive layer on top of the v2 model:
 *
 *   • Friction penalty:    high frictionScore (repetition, no-progression,
 *                          burst) directly suppresses intentConfidence.
 *   • Burst penalty:       applied after all additive factors.
 *   • Signal diversity:    low-diversity visitors (one signal type, high volume)
 *                          receive no diversity bonus and hit the single-event
 *                          type cap earlier.
 *   • Anti-spike floor:    intentConfidence cannot exceed a ceiling that shrinks
 *                          as frictionScore rises (MAX_INTENT_CONF_WITH_FRICTION).
 *
 * ─── Confidence dimensions ────────────────────────────────────────────────────
 *
 *   intentConfidence      — how certain we are about the visitor's intent
 *   sequenceConfidence    — how certain we are about matched behavioral sequences
 *   funnelStageConfidence — how certain we are about the funnel stage assignment
 *   overallConfidence     — weighted composite of the three above
 *
 * ─── Band thresholds ──────────────────────────────────────────────────────────
 *
 *   low       < 0.35   — keep all defaults, no personalization
 *   medium    0.35–0.55 — CTA text + proof block adjustments only
 *   high      0.55–0.75 — hero + proof + CTA changes
 *   very_high ≥ 0.75   — full experience changes including theme
 *
 * ─── v3 intentConfidence factors (8 total) ───────────────────────────────────
 *
 *   1. Overall intent score strength   (0–0.25)   reduced from v2's 0.30
 *   2. Short-term intent freshness     (0–0.12)   active in-session research
 *   3. Long-term affinity              (0–0.08)   returning visitor
 *   4. Interaction depth               (0–0.15)   total events
 *   5. High-value signal mix           (0–0.12)   4 milestone signals
 *   6. Signal diversity bonus          (0–0.10)   distinct signal types
 *   7. Recency bonus                   (0–0.04)
 *   8. Repeat-session bonus            (0–0.04)
 *
 *   Sum cap at 1.0, then apply two multipliers:
 *     × frictionMultiplier = max(MIN_FLOOR, 1 – (frictionScore/100) × 0.85)
 *     × burstMultiplier    = 1 – burstPenalty × 0.60
 *
 *   Additionally: intentConfidence cannot exceed the anti-spike ceiling:
 *     MAX_INTENT_CONF = max(MIN_FLOOR, 1 – (frictionScore / 100))
 *
 * ─── Pure function — no I/O ──────────────────────────────────────────────────
 */

import type {
  JourneyState,
  BehaviorConfidence,
  AdaptiveGating,
  ConfidenceBand,
} from "./types";
import { eventAgeDays } from "./apply-decay";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum total events before theme changes are stable enough to apply. */
const MIN_THEME_EVENTS = 5;

/** Band thresholds (inclusive lower bound). */
const BAND_THRESHOLDS: Record<ConfidenceBand, number> = {
  low:       0,
  medium:    0.35,
  high:      0.55,
  very_high: 0.75,
};

/**
 * Absolute floor for confidence after all penalties.
 * Even a maximally noisy visitor retains this minimum (avoids division-by-zero
 * style pathologies downstream).
 */
const MIN_CONFIDENCE_FLOOR = 0.05;

/**
 * When signalDiversityScore < this threshold AND intentScore is driven by
 * a single signal type, cap intentConfidence to prevent single-type spam
 * from producing high confidence.
 */
const LOW_DIVERSITY_CAP = 0.30;

/**
 * Minimum diversity score before the diversity cap is applied.
 * Visitors with diversityScore >= this threshold are NOT capped.
 */
const MIN_DIVERSITY_FOR_FULL_CONFIDENCE = 0.20; // 2+ of 10 slots

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function toBand(overall: number): ConfidenceBand {
  if (overall >= BAND_THRESHOLDS.very_high) return "very_high";
  if (overall >= BAND_THRESHOLDS.high)      return "high";
  if (overall >= BAND_THRESHOLDS.medium)    return "medium";
  return "low";
}

// ── Intent confidence — v3 ────────────────────────────────────────────────────

function computeIntentConfidence(
  journey: JourneyState,
): { score: number; reasons: string[] } {
  let score   = 0;
  const reasons: string[] = [];

  // Factor 1: Overall intent score strength (0–0.25)
  const intentFactor = clamp01(journey.intentScore / 100) * 0.25;
  score += intentFactor;
  if (intentFactor > 0) {
    reasons.push(`intent_score=${journey.intentScore} → +${round2(intentFactor * 100)}%`);
  }

  // Factor 2: Short-term intent freshness (0–0.12)
  const shortTermFactor = clamp01(journey.shortTermIntentScore / 80) * 0.12;
  score += shortTermFactor;
  if (journey.shortTermIntentScore > 0) {
    reasons.push(
      `short_term_intent=${journey.shortTermIntentScore} → +${round2(shortTermFactor * 100)}%`,
    );
  }

  // Factor 3: Long-term affinity signal (0–0.08)
  const longTermFactor = clamp01(journey.longTermAffinityScore / 60) * 0.08;
  score += longTermFactor;
  if (journey.longTermAffinityScore > 0) {
    reasons.push(
      `long_term_affinity=${journey.longTermAffinityScore} → +${round2(longTermFactor * 100)}%`,
    );
  }

  // Factor 4: Interaction depth (0–0.15)
  const totalEvents = journey.pageViewCount + journey.ctaClickCount
    + journey.formStartCount + journey.downloadCount;
  const depthFactor = clamp01(totalEvents / 10) * 0.15;
  score += depthFactor;
  if (totalEvents > 0) {
    reasons.push(`${totalEvents} total events → +${round2(depthFactor * 100)}%`);
  }

  // Factor 5: High-value signal mix (0–0.12)
  let signalCount = 0;
  const signalLabels: string[] = [];
  if (journey.hasVisitedPricing)  { signalCount++; signalLabels.push("pricing visit"); }
  if (journey.hasVisitedContact)  { signalCount++; signalLabels.push("contact visit"); }
  if (journey.hasClickedCta)      { signalCount++; signalLabels.push("CTA click"); }
  if (journey.formStartCount > 0) { signalCount++; signalLabels.push("form start"); }
  const mixFactor = clamp01(signalCount / 4) * 0.12;
  score += mixFactor;
  if (signalLabels.length > 0) {
    reasons.push(`high-value signals: ${signalLabels.join(", ")} → +${round2(mixFactor * 100)}%`);
  }

  // Factor 6: Signal diversity bonus (0–0.10)
  // Rewards breadth of distinct signal types, not volume of a single type.
  const diversityFactor = clamp01(journey.signalDiversityScore / 0.40) * 0.10;
  score += diversityFactor;
  if (journey.signalDiversityScore > 0) {
    reasons.push(
      `signal_diversity=${journey.uniqueSignalCount}/10 types → +${round2(diversityFactor * 100)}%`,
    );
  }

  // Factor 7: Recency bonus (0–0.04)
  const recencyFactor = clamp01(journey.recencyScore / 100) * 0.04;
  score += recencyFactor;
  if (recencyFactor > 0.01) {
    reasons.push(`recency_score=${journey.recencyScore} → +${round2(recencyFactor * 100)}%`);
  }

  // Factor 8: Repeat-session bonus (0–0.04)
  const repeatFactor = clamp01(journey.repeatSessionBonus) * 0.04;
  score += repeatFactor;
  if (journey.repeatSessionBonus > 0) {
    reasons.push(
      `repeat_session=${journey.repeatSessionBonus} → +${round2(repeatFactor * 100)}%`,
    );
  }

  // ── Repeated behavior stability bonus (+0.04) ──────────────────────────
  const repeatActionCount =
    (journey.hasVisitedPricing  ? 1 : 0) +
    (journey.ctaClickCount >= 2 ? 1 : 0) +
    (journey.formStartCount >= 1? 1 : 0) +
    (journey.pageViewCount >= 5 ? 1 : 0);

  if (repeatActionCount >= 3 && journey.signalDiversityScore >= MIN_DIVERSITY_FOR_FULL_CONFIDENCE) {
    const stabilityBonus = 0.04;
    score += stabilityBonus;
    reasons.push(`repeated high-value behavior (×${repeatActionCount}) → +${round2(stabilityBonus * 100)}%`);
  }

  // ── v3: Low diversity cap ──────────────────────────────────────────────────
  //
  // If the visitor has very low signal diversity (e.g. only the pricing page),
  // cap intentConfidence at LOW_DIVERSITY_CAP to prevent a single repeated
  // signal from producing high confidence.
  //
  const isDiverse = journey.signalDiversityScore >= MIN_DIVERSITY_FOR_FULL_CONFIDENCE
    || journey.matchedSequences.length > 0;

  if (!isDiverse && score > LOW_DIVERSITY_CAP) {
    reasons.push(
      `low signal diversity (${journey.uniqueSignalCount} of 10 types) — capped at ${round2(LOW_DIVERSITY_CAP * 100)}%` +
      ` (need ≥2 distinct signal types or a sequence match)`,
    );
    score = LOW_DIVERSITY_CAP;
  }

  // ── v3: Friction penalty ───────────────────────────────────────────────────
  //
  // frictionScore 0–100 → multiplier max(MIN_FLOOR, 1 – score × 0.85)
  //
  // Examples:
  //   frictionScore = 0  → multiplier = 1.00 (no change)
  //   frictionScore = 40 → multiplier = 0.66 (-34%)
  //   frictionScore = 70 → multiplier = max(0.05, 0.405) = 0.41 (-60%)
  //   frictionScore = 90 → multiplier = max(0.05, 0.235) = 0.24 (-76%)
  //
  if (journey.frictionScore > 0) {
    const frictionMultiplier = Math.max(
      MIN_CONFIDENCE_FLOOR,
      1 - (journey.frictionScore / 100) * 0.85,
    );
    const before = score;
    score = clamp01(score * frictionMultiplier);
    reasons.push(
      `friction_score=${journey.frictionScore} → multiplier ${round2(frictionMultiplier)} ` +
      `(${round2(before * 100)}% → ${round2(score * 100)}%)`,
    );
  }

  // ── v3: Burst penalty ─────────────────────────────────────────────────────
  //
  // burstPenalty 0–0.5 → confidence reduced by up to 60% of its value.
  //
  if (journey.burstPenalty > 0) {
    const burstMultiplier = Math.max(MIN_CONFIDENCE_FLOOR, 1 - journey.burstPenalty * 0.60);
    const before = score;
    score = clamp01(score * burstMultiplier);
    reasons.push(
      `burst_penalty=${journey.burstPenalty} → multiplier ${round2(burstMultiplier)} ` +
      `(${round2(before * 100)}% → ${round2(score * 100)}%)`,
    );
  }

  // ── v3: Anti-spike ceiling ─────────────────────────────────────────────────
  //
  // intentConfidence cannot exceed max(MIN_FLOOR, 1 – frictionScore/100).
  // This is a hard ceiling independent of all additive factors.
  //
  // Examples:
  //   frictionScore = 71 → ceiling = max(0.05, 0.29) = 0.29
  //   frictionScore = 50 → ceiling = max(0.05, 0.50) = 0.50
  //   frictionScore = 0  → ceiling = 1.00 (no constraint)
  //
  const antiSpikeCeiling = Math.max(MIN_CONFIDENCE_FLOOR, 1 - journey.frictionScore / 100);
  if (score > antiSpikeCeiling) {
    reasons.push(
      `anti-spike ceiling at ${round2(antiSpikeCeiling * 100)}% (friction_score=${journey.frictionScore})`,
    );
    score = antiSpikeCeiling;
  }

  return { score: round2(clamp01(score)), reasons };
}

// ── Sequence confidence — v3 (with per-pattern confidence_contribution) ───────

/**
 * Computes sequenceConfidence from JourneyState.
 *
 * ─── confidence_contribution awareness ────────────────────────────────────────
 *
 *   When `journey.sequenceConfidenceContribution` > 0 (meaning patterns define
 *   explicit contribution weights), the base score is anchored to the sum of
 *   those contributions rather than the flat per-sequence formula.
 *
 *   Flat formula (legacy / all patterns use default 0.10):
 *     base = 0.65 + (count – 1) × 0.10
 *
 *   Contribution-aware formula:
 *     base = min(1.0, 0.50 + totalContribution)
 *     where totalContribution = sum(pattern.confidence_contribution)
 *
 *   The contribution-aware path is used when sequenceConfidenceContribution > 0.
 *   Both paths then apply the same recency and friction adjustments.
 *
 * ─── Example ──────────────────────────────────────────────────────────────────
 *
 *   Pattern "pricing_journey" has confidence_contribution: 0.35.
 *   Pattern "case_to_pricing"  has confidence_contribution: 0.20.
 *   Both matched → sequenceConfidenceContribution = 0.55
 *   Base = min(1.0, 0.50 + 0.55) = 1.0 → fresh (<24h) → stays 1.0
 *   vs flat formula: 0.65 + (2–1)×0.10 = 0.75
 */
function computeSequenceConfidence(
  journey: JourneyState,
): { score: number; reasons: string[] } {
  const count   = journey.matchedSequences.length;
  const reasons: string[] = [];

  if (count === 0) {
    reasons.push("no sequences matched yet");
    return { score: 0.10, reasons };
  }

  // ── Base score: contribution-aware or flat ──────────────────────────────
  let score: number;
  const totalContrib = journey.sequenceConfidenceContribution ?? 0;

  if (totalContrib > 0) {
    // Contribution-aware: anchor to sum of pattern-defined weights.
    score = clamp01(0.50 + totalContrib);
    reasons.push(
      `${count} sequence${count > 1 ? "s" : ""} matched` +
      ` (contribution-weighted base: ${round2(score * 100)}% from Σcontribution=${round2(totalContrib * 100)}%)`,
    );
  } else {
    // Flat formula (legacy / all default contribution patterns).
    score = clamp01(0.65 + (count - 1) * 0.10);
    reasons.push(
      `${count} sequence${count > 1 ? "s" : ""} matched: ${journey.matchedSequences.join(", ")}`,
    );
  }

  if (journey.sequenceScore > 0) {
    reasons.push(`sequence_score=${journey.sequenceScore}`);
  }

  // ── Recency of most recent match ─────────────────────────────────────────
  if (journey.sequenceMatchedAt) {
    const ageDays = eventAgeDays(journey.sequenceMatchedAt);
    if (ageDays < 1) {
      const freshBonus = 0.07;
      score = clamp01(score + freshBonus);
      reasons.push(`latest sequence completed <24h ago → +${round2(freshBonus * 100)}%`);
    } else if (ageDays > 30) {
      const stalePenalty = 0.15;
      score = clamp01(score - stalePenalty);
      reasons.push(`latest sequence completed ${Math.round(ageDays)}d ago → -${round2(stalePenalty * 100)}%`);
    } else {
      reasons.push(`latest sequence completed ${Math.round(ageDays)}d ago`);
    }
  }

  // ── v3: friction dampens sequence confidence (less aggressively than intent) ──
  if (journey.frictionScore > 50) {
    const seqFrictionMultiplier = Math.max(0.50, 1 - (journey.frictionScore - 50) / 100);
    const before = score;
    score = clamp01(score * seqFrictionMultiplier);
    reasons.push(
      `high friction (${journey.frictionScore}) reduces sequence confidence: ` +
      `${round2(before * 100)}% → ${round2(score * 100)}%`,
    );
  }

  return { score: round2(score), reasons };
}

// ── Overall confidence — v3 ───────────────────────────────────────────────────

/**
 * Computes multi-dimensional behavioral confidence from a JourneyState.
 *
 * Weights (unchanged from v2):
 *   intentConfidence      × 0.45
 *   sequenceConfidence    × 0.25
 *   funnelStageConfidence × 0.30
 *
 * Hard overrides:
 *   hasSubmittedForm → very_high (confirmed conversion)
 *
 * v3 additions:
 *   intentConfidence is now suppressed by frictionScore + burstPenalty
 *   sequenceConfidence partially suppressed by very high friction
 *   The overall band reflects all penalties
 */
export function computeBehaviorConfidence(journey: JourneyState): BehaviorConfidence {
  if (journey.hasSubmittedForm) {
    return {
      intentConfidence:      1.0,
      sequenceConfidence:    1.0,
      funnelStageConfidence: 1.0,
      overallConfidence:     1.0,
      band:                  "very_high",
      reasons:               ["Form submitted — conversion confirmed. Maximum confidence."],
    };
  }

  const intent   = computeIntentConfidence(journey);
  const sequence = computeSequenceConfidence(journey);

  const intentConf = intent.score;
  const seqConf    = sequence.score;
  const funnelConf = clamp01(journey.funnelStageConfidence);

  const overall = round2(
    intentConf * 0.45 +
    seqConf    * 0.25 +
    funnelConf * 0.30,
  );

  const band    = toBand(overall);
  const reasons = [
    ...intent.reasons,
    ...sequence.reasons,
    `funnel_stage_confidence=${round2(funnelConf * 100)}%`,
    `overall=${round2(overall * 100)}% → band: ${band}`,
  ];

  // Append friction/burst summary when they are active suppressors
  if (journey.frictionScore >= 40) {
    reasons.push(
      `⚠ friction_score=${journey.frictionScore}/100 — confidence actively suppressed`,
    );
  }
  if (journey.burstPenalty > 0) {
    reasons.push(
      `⚠ burst_penalty=${journey.burstPenalty} — rapid repetitive navigation detected`,
    );
  }

  return {
    intentConfidence:      intentConf,
    sequenceConfidence:    seqConf,
    funnelStageConfidence: funnelConf,
    overallConfidence:     overall,
    band,
    reasons,
  };
}

// ── Adaptive gating ───────────────────────────────────────────────────────────

/**
 * Returns which adaptive experience outputs are unlocked at the current
 * confidence band.
 *
 * v3 addition: if frictionScore >= FRICTION_PROOF_THRESHOLD, the system
 * additionally recommends reassurance/FAQ content (rather than aggressive
 * conversion treatment) by setting frictionSuggestsReassurance = true.
 * This is informational — the actual swap is handled by the rule engine
 * using the journey.frictionScore field.
 */
export const FRICTION_PROOF_THRESHOLD   = 50;  // High friction → reassurance content
export const FRICTION_BLOCK_THRESHOLD   = 70;  // Very high friction → block hero/theme too
const MIN_THEME_EVENTS_CONST = MIN_THEME_EVENTS;

export function gateAdaptiveDecisions(
  confidence: BehaviorConfidence,
  journey:    Pick<JourneyState,
    "pageViewCount" | "ctaClickCount" | "formStartCount" | "downloadCount" |
    "frictionScore" | "burstPenalty"
  >,
): AdaptiveGating {
  const { band } = confidence;
  const blockedReasons: string[] = [];

  const totalEvents = journey.pageViewCount + journey.ctaClickCount
    + journey.formStartCount + journey.downloadCount;

  let cta   = false;
  let proof = false;
  let hero  = false;
  let theme = false;

  switch (band) {
    case "very_high":
      cta   = true;
      proof = true;
      hero  = true;
      if (totalEvents >= MIN_THEME_EVENTS_CONST) {
        theme = true;
      } else {
        blockedReasons.push(
          `theme: very_high confidence reached but only ${totalEvents}/${MIN_THEME_EVENTS_CONST} events`,
        );
      }
      break;
    case "high":
      cta   = true;
      proof = true;
      hero  = true;
      blockedReasons.push(`theme: requires very_high confidence (current: high, overall=${round2(confidence.overallConfidence * 100)}%)`);
      break;
    case "medium":
      cta   = true;
      proof = true;
      blockedReasons.push(`hero: requires high confidence (current: medium, overall=${round2(confidence.overallConfidence * 100)}%)`);
      blockedReasons.push(`theme: requires very_high confidence (current: medium)`);
      break;
    case "low":
    default:
      blockedReasons.push(`all adaptive changes blocked — confidence too low (overall=${round2(confidence.overallConfidence * 100)}%, band=low)`);
      blockedReasons.push(`need: more events, pricing/contact visits, CTA interactions, or sequence matches`);
      break;
  }

  // ── v3: Extra friction gates ───────────────────────────────────────────────
  //
  // When friction is very high, downgrade allowed slots even if the confidence
  // band would permit them.  This prevents a visitor with spam-level repetition
  // (high intentScore from raw volume) from receiving aggressive personalization
  // that the noise-adjusted confidence should have blocked.
  //
  if (journey.frictionScore >= FRICTION_BLOCK_THRESHOLD) {
    // Very high friction: lock hero and theme even if confidence says "high"
    if (hero) {
      hero = false;
      blockedReasons.push(
        `hero: blocked by high friction_score=${journey.frictionScore} (threshold=${FRICTION_BLOCK_THRESHOLD}) — consider reassurance content instead`,
      );
    }
    if (theme) {
      theme = false;
      blockedReasons.push(`theme: blocked by high friction_score=${journey.frictionScore}`);
    }
  }

  if (journey.burstPenalty >= 0.30) {
    if (hero) {
      hero = false;
      blockedReasons.push(`hero: blocked by burst_penalty=${journey.burstPenalty} — rapid-fire navigation detected`);
    }
  }

  return { cta, proof, hero, theme, blockedReasons };
}

// ── Rule engine support ───────────────────────────────────────────────────────

export function meetsConfidenceThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.confidence.overallConfidence >= threshold;
}

export function meetsSequenceConfidenceThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.confidence.sequenceConfidence >= threshold;
}

export function meetsIntentConfidenceThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.confidence.intentConfidence >= threshold;
}

export function hasMatchedSequence(journey: JourneyState, slug: string): boolean {
  return journey.matchedSequences.includes(slug);
}

export function meetsShortTermIntentThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.shortTermIntentScore >= threshold;
}

export function meetsLongTermAffinityThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.longTermAffinityScore >= threshold;
}

export function meetsIntentFreshnessThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.intentFreshness >= threshold;
}

/**
 * Returns true when frictionScore is below the given threshold.
 * Use to gate rules that should only trigger for clean-signal visitors.
 *   { field: "journey.frictionScore", op: "lt", value: 40 }
 */
export function hasFrictionBelow(journey: JourneyState, threshold: number): boolean {
  return journey.frictionScore < threshold;
}

/**
 * Returns true when signalDiversityScore meets or exceeds the threshold.
 * Use to require breadth of engagement before triggering strong personalization.
 *   { field: "journey.signalDiversityScore", op: "gte", value: 0.3 }
 */
export function meetsDiversityThreshold(journey: JourneyState, threshold: number): boolean {
  return journey.signalDiversityScore >= threshold;
}
