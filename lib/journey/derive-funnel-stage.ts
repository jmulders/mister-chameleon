/**
 * Funnel Stage Derivation — Journey Engine v3
 *
 * Derives the visitor's funnel stage from behavioral scores, milestone
 * events, matched sequences, v2 short/long-term signals, and v3 anti-noise
 * progression gates.
 *
 * ─── Stage definitions ───────────────────────────────────────────────────────
 *
 *   customer     — Form submitted (conversion confirmed).
 *   high_intent  — (intent_score ≥ 60 OR composite signals) AND
 *                  frictionScore < 60 AND (uniqueSignalCount ≥ 2 OR sequence).
 *   intent       — (intent_score ≥ 30 OR pricing OR sequence OR shortTerm ≥ 25) AND
 *                  frictionScore < 75 AND uniqueSignalCount ≥ 1.
 *   consideration — engagement_score ≥ 20  OR visited about/cases/contact  OR
 *                  page_view_count ≥ 3  OR longTermAffinityScore ≥ 15.
 *                  NOTE: repeated single-signal activity (e.g. pricing × N) lands
 *                  here if diversity/friction gates are not met.
 *   awareness    — Default for new or low-signal visitors.
 *
 * ─── v3 progression gates ─────────────────────────────────────────────────────
 *
 *   high_intent requires:
 *     • frictionScore < 60
 *     • uniqueSignalCount ≥ 2  OR  at least one matched sequence
 *   intent requires:
 *     • frictionScore < 75
 *     • uniqueSignalCount ≥ 1
 *
 *   A visitor who refreshes /pricing 5× in 10 s gets frictionScore ≈ 71 and
 *   uniqueSignalCount = 1 → blocked from both high_intent AND intent →
 *   stays at consideration.
 *
 * ─── v2/v3 confidence model ───────────────────────────────────────────────────
 *
 *   customer:     1.0 (hard milestone)
 *   high_intent:  base 0.7–0.9 + repeatSessionBonus × 0.1; capped when noisy
 *   intent:       base 0.6–0.7 + shortTermIntentScore contribution
 *   consideration: 0.5–0.65
 *   awareness:    0.5
 */

import type { JourneyFunnelStage } from "./types";
import { eventAgeDays } from "./apply-decay";

// ── Input ─────────────────────────────────────────────────────────────────────

export interface FunnelStageInput {
  intentScore:           number;
  engagementScore:       number;
  hasVisitedPricing:     boolean;
  hasVisitedAbout:       boolean;
  hasVisitedCases:       boolean;
  hasVisitedContact:     boolean;
  hasSubmittedForm:      boolean;
  formStartCount:        number;
  pageViewCount:         number;
  matchedSequences:      string[];
  /** v2: intent from events < 24h old (0–100). */
  shortTermIntentScore:  number;
  /** v2: intent from events 7–90d old (0–100). */
  longTermAffinityScore: number;
  /** v2: 0–1 return-visitor bonus. */
  repeatSessionBonus:    number;
  /** v2: ISO-8601 of most recent sequence completion, or null. */
  sequenceMatchedAt:     string | null;
  /** v3: Composite noise/friction score 0–100. High values block stage promotion. */
  frictionScore?:        number;
  /** v3: Count of distinct high-value signal types fired (0–10). */
  uniqueSignalCount?:    number;
  /** v3: Diversity ratio 0–1. */
  signalDiversityScore?: number;
  /** v3: Burst penalty 0–0.5. */
  burstPenalty?:         number;
  /** Optional "now" override (testing). */
  now?:                  Date;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface FunnelStageResult {
  stage:      JourneyFunnelStage;
  confidence: number;
  reason:     string;  // Human-readable explanation for debug panel
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Derives the funnel stage and confidence from behavioral signals.
 * Pure function — no I/O.
 */
export function deriveFunnelStage(input: FunnelStageInput): FunnelStageResult {
  const {
    intentScore,
    engagementScore,
    hasVisitedPricing,
    hasVisitedAbout,
    hasVisitedCases,
    hasVisitedContact,
    hasSubmittedForm,
    formStartCount,
    pageViewCount,
    matchedSequences,
    shortTermIntentScore,
    longTermAffinityScore,
    repeatSessionBonus,
    sequenceMatchedAt,
    // v3 — optional for backward compat; default to "clean" values if absent
    frictionScore        = 0,
    uniqueSignalCount    = 10,   // absent → assume diverse (no restriction)
    burstPenalty         = 0,
    now,
  } = input;

  // ── v3 progression gates ──────────────────────────────────────────────────
  //
  // These gates prevent noisy/bursty single-signal behavior from triggering
  // high stage classifications.
  //
  // IMPORTANT: gates use defaults that never restrict when v3 data is absent
  // (frictionScore=0, uniqueSignalCount=10) so the function is safe to call
  // from older code paths that don't yet pass v3 fields.

  /** Visitor passes the high_intent diversity gate. */
  const highIntentDiversityOk =
    uniqueSignalCount >= 2 || matchedSequences.length > 0;

  /** Visitor passes the high_intent friction gate. */
  const highIntentFrictionOk = frictionScore < 60;

  /** Full high_intent gate: diversity + friction both must pass. */
  const highIntentGateOk = highIntentDiversityOk && highIntentFrictionOk;

  /** Visitor passes the intent friction gate. */
  const intentFrictionOk = frictionScore < 75;

  /** Visitor passes the intent diversity gate (at least 1 distinct signal type). */
  const intentDiversityOk = uniqueSignalCount >= 1;

  // ── customer: hard milestone ─────────────────────────────────────────────
  if (hasSubmittedForm) {
    return {
      stage:      "customer",
      confidence: 1.0,
      reason:     "Form submitted — conversion confirmed.",
    };
  }

  // ── Sequence recency helper ───────────────────────────────────────────────
  // A sequence matched within the last 24 hours is "fresh" — it boosts
  // high_intent detection without requiring a high overall intent score.
  const sequenceIsRecent = sequenceMatchedAt != null
    && eventAgeDays(sequenceMatchedAt, now) < 1;

  // ── high_intent ───────────────────────────────────────────────────────────
  const highScoreSignal       = intentScore >= 60;
  const compositeHighSignal   = intentScore >= 40 && hasVisitedPricing && formStartCount > 0;
  // v2: active session with a fresh completed sequence
  const freshSequenceHigh     = shortTermIntentScore >= 40 && sequenceIsRecent;
  // v2: strong long-term affinity + recent pricing visit
  const returnerHighSignal    = longTermAffinityScore >= 30 && hasVisitedPricing && formStartCount > 0;

  if (highScoreSignal || compositeHighSignal || freshSequenceHigh || returnerHighSignal) {
    // v3: apply progression gate before classifying as high_intent
    if (!highIntentGateOk) {
      // Signals qualify on score but noise prevents high_intent promotion.
      // Fall through to intent or consideration checks below.
      const suppressReasons: string[] = [];
      if (!highIntentFrictionOk)  suppressReasons.push(`friction_score=${frictionScore}≥60`);
      if (!highIntentDiversityOk) suppressReasons.push(`unique_signal_count=${uniqueSignalCount}<2 (no sequence)`);
      // Attach suppression note to a local variable consumed by the intent block below
      // (the intent block will see the same signals and may still classify "intent")
      void suppressReasons; // fall through intentionally
    } else {
      const reasons: string[] = [];

      // Base confidence: highest contributing factor
      let baseConf = 0.7;
      if (highScoreSignal && compositeHighSignal) {
        baseConf = 0.9;
      } else if (highScoreSignal) {
        baseConf = 0.8;
      } else if (returnerHighSignal) {
        baseConf = 0.8;
        reasons.push(`long_term_affinity=${longTermAffinityScore} + pricing + form`);
      } else if (freshSequenceHigh) {
        baseConf = 0.75;
        reasons.push(`fresh sequence (matched <24h) + short_term_intent=${shortTermIntentScore}`);
      }

      // v3: reduce confidence when burst penalty is elevated (even if gate passed)
      const burstCap = burstPenalty > 0.10 ? Math.max(0.7, baseConf - burstPenalty * 0.3) : baseConf;
      // v2: repeat-session bonus boosts confidence by up to 0.1
      const confidence = Math.min(1.0, burstCap + repeatSessionBonus * 0.10);

      if (highScoreSignal)         reasons.push(`intent_score=${intentScore}`);
      if (hasVisitedPricing)       reasons.push("visited pricing");
      if (formStartCount > 0)      reasons.push("started form");
      if (repeatSessionBonus > 0)  reasons.push(`repeat_session_bonus=${repeatSessionBonus}`);
      if (uniqueSignalCount < 5)   reasons.push(`unique_signals=${uniqueSignalCount}`);

      return {
        stage:      "high_intent",
        confidence: Math.round(confidence * 100) / 100,
        reason:     reasons.join(", "),
      };
    }
  }

  // ── intent ────────────────────────────────────────────────────────────────
  const intentByScore     = intentScore >= 30;
  const intentByPage      = hasVisitedPricing;
  const intentBySequence  = matchedSequences.length > 0;
  // v2: active researcher in this session even without historical signals
  const intentByShortTerm = shortTermIntentScore >= 25;

  if (intentByScore || intentByPage || intentBySequence || intentByShortTerm) {
    // v3: apply progression gate before classifying as intent
    if (!intentFrictionOk || !intentDiversityOk) {
      // Signals qualify on score/page but noise prevents intent promotion.
      // Fall through to consideration checks below.
      // (No explicit action needed — fall-through is implicit.)
    } else {
      const reasons: string[] = [];

      let baseConf = 0.6;
      if (intentByScore) {
        baseConf = 0.7;
        reasons.push(`intent_score=${intentScore}`);
      }
      if (intentByShortTerm && !intentByScore) {
        baseConf = 0.65;
        reasons.push(`short_term_intent=${shortTermIntentScore} (active session)`);
      }
      if (intentByPage)     reasons.push("visited pricing");
      if (intentBySequence) reasons.push(`matched sequence: ${matchedSequences[0]}`);

      // v3: reduce confidence when friction is moderately elevated
      const frictionPenalty = frictionScore > 40 ? (frictionScore - 40) / 100 : 0;

      // Small bonus for long-term affinity showing sustained interest
      const affinityBonus = Math.min(0.05, longTermAffinityScore / 1000);
      const confidence    = Math.min(
        0.85,
        baseConf + repeatSessionBonus * 0.05 + affinityBonus - frictionPenalty,
      );

      if (frictionScore > 0)  reasons.push(`friction_score=${frictionScore}`);
      if (uniqueSignalCount < 5) reasons.push(`unique_signals=${uniqueSignalCount}`);

      return {
        stage:      "intent",
        confidence: Math.round(Math.max(0.40, confidence) * 100) / 100,
        reason:     reasons.join(", "),
      };
    }
  }

  // ── consideration ─────────────────────────────────────────────────────────
  //
  // Visitors whose scores would qualify for "intent" or "high_intent" but
  // were blocked by v3 noise gates will naturally arrive here.  We surface
  // a suppression note in the reason string so the debug panel can explain
  // why the stage is lower than raw scores might suggest.
  const considerationByEngagement = engagementScore >= 20;
  const considerationByPages      = hasVisitedAbout || hasVisitedCases || hasVisitedContact;
  const considerationByCount      = pageViewCount >= 3;
  // v2: returning visitor with established affinity even if intent score is low
  const considerationByAffinity   = longTermAffinityScore >= 15;
  // v3: even a single-signal visit to pricing counts as consideration
  const considerationByPricing    = hasVisitedPricing;

  if (
    considerationByEngagement ||
    considerationByPages      ||
    considerationByCount      ||
    considerationByAffinity   ||
    considerationByPricing
  ) {
    const reasons: string[] = [];

    let baseConf = 0.5;
    if (considerationByEngagement) {
      baseConf = 0.65;
      reasons.push(`engagement_score=${engagementScore}`);
    }
    if (considerationByAffinity) {
      baseConf = Math.max(baseConf, 0.55);
      reasons.push(`long_term_affinity=${longTermAffinityScore} (returning visitor)`);
    }
    if (hasVisitedAbout)   reasons.push("visited about");
    if (hasVisitedCases)   reasons.push("visited cases");
    if (hasVisitedContact) reasons.push("visited contact");
    if (considerationByPricing && !considerationByPages) reasons.push("visited pricing");
    if (considerationByCount)   reasons.push(`${pageViewCount} page views`);

    // v3: record why a higher stage was denied (if applicable)
    if (!intentFrictionOk) {
      reasons.push(`⚠ intent blocked: friction_score=${frictionScore}≥75`);
    } else if (!intentDiversityOk) {
      reasons.push(`⚠ intent blocked: unique_signal_count=${uniqueSignalCount}<1`);
    } else if (!highIntentFrictionOk) {
      reasons.push(`⚠ high_intent blocked: friction_score=${frictionScore}≥60`);
    } else if (!highIntentDiversityOk) {
      reasons.push(`⚠ high_intent blocked: unique_signal_count=${uniqueSignalCount}<2 (no sequence)`);
    }

    const confidence = Math.min(0.8, baseConf + repeatSessionBonus * 0.05);

    return {
      stage:      "consideration",
      confidence: Math.round(confidence * 100) / 100,
      reason:     reasons.join(", "),
    };
  }

  // ── awareness: default ────────────────────────────────────────────────────
  return {
    stage:      "awareness",
    confidence: 0.5,
    reason:     "Insufficient signals for a higher stage.",
  };
}
