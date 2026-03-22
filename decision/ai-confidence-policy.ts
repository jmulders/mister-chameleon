/**
 * AI Confidence Policy
 *
 * A pure, side-effect-free module that decides whether an AI-generated
 * ExperiencePlan is trustworthy enough to serve to a visitor, or whether
 * the system should fall back to the rules engine.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 *   AI models can hallucinate, return structurally invalid plans, or output
 *   low-confidence guesses that are worse than the deterministic rules engine.
 *   Rather than letting each call site implement its own ad-hoc checks, this
 *   module provides a single, testable, configurable gate.
 *
 * ─── Gate evaluation model ────────────────────────────────────────────────────
 *
 *   Policy gates are evaluated in order.  Evaluation stops at the first
 *   failure.  All gates that were reached are reported in the result so
 *   operators can see exactly how far the AI output got before it was rejected.
 *
 *   Gate order (high-level → low-level):
 *
 *     1. context_richness      — does the visitor context carry enough signal?
 *                                (if not, AI has nothing useful to reason about)
 *
 *     2. confidence_present    — did the AI return a finite numeric confidence?
 *                                (absent, NaN, or non-finite → maximum uncertainty)
 *
 *     3. confidence_threshold  — is confidence >= policy.minConfidence?
 *                                (confidence is normalised to [0, 1] before this gate)
 *
 *     4. plan_fields_present   — do heroKey / proofKey / ctaKey all exist and
 *                                are they non-empty strings?
 *
 *     5. plan_keys_valid       — are all three keys members of the authoritative
 *                                allowed-key vocabulary from stored-rule.ts?
 *
 *   Gates 4 and 5 are deliberately separate: a missing field and an
 *   unrecognised key are different failure modes and benefit from distinct
 *   verdicts in dashboard diagnostics.
 *
 * ─── Verdict reference ────────────────────────────────────────────────────────
 *
 *   USE_AI                   — all gates passed; the AI plan may be served
 *   FALLBACK_CONTEXT_SPARSE  — context too sparse to trust AI
 *   FALLBACK_LOW_CONFIDENCE  — AI self-reported confidence below threshold
 *   FALLBACK_MISSING_FIELDS  — AI plan is structurally incomplete (null/empty key)
 *   FALLBACK_INVALID_KEYS    — AI plan keys are not in the allowed vocabulary
 *
 * ─── Confidence normalisation ─────────────────────────────────────────────────
 *
 *   Raw confidence values from AI models may be outside [0, 1] or non-finite.
 *   All confidence values are normalised before evaluation:
 *
 *     undefined / NaN / Infinity → treated as absent (Gate 2 fails)
 *     value > 1.0                → clamped to 1.0
 *     value < 0.0                → clamped to 0.0
 *
 *   This ensures Gate 3 always operates on a reliable [0, 1] score, and that
 *   pathological model outputs (e.g. confidence=99) cannot bypass gating.
 *
 * ─── Context richness scoring ─────────────────────────────────────────────────
 *
 *   Each resolved signal contributes to a richness score in [0, 1]:
 *
 *     source != "unknown"    +0.40  (the primary routing signal)
 *     any UTM param present  +0.20  (explicit campaign intent)
 *     visitType returning    +0.15  (behavioural continuity)
 *     referrerDomain != null +0.15  (supplementary source)
 *     userAgent != null      +0.10  (device context)
 *
 *   Scores above 1.0 are capped.  The default minContextRichness is 0.30,
 *   meaning at least one meaningful signal must be present before AI is tried.
 *
 * ─── Key vocabulary ───────────────────────────────────────────────────────────
 *
 *   Allowed variant keys are imported from `decision/rules/stored-rule.ts`,
 *   which is the single source of truth for this codebase.  The Sets built
 *   below are module-level constants — constructed once, O(1) lookup.
 *
 * ─── Extensibility ────────────────────────────────────────────────────────────
 *
 *   Add new gates by inserting a new block inside `evaluateConfidencePolicy`
 *   and exporting a new `PolicyVerdict` value.  Existing call sites that
 *   branch on specific verdict strings are unaffected by additions.
 *
 * ─── Pure / no I/O ────────────────────────────────────────────────────────────
 *
 *   This file has no imports from the data or network layer.
 *   Logging is the caller's responsibility (see AiDecisionProvider).
 */

import type { VisitorContext } from "@/context/types";
import type { ExperiencePlan } from "./types";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ── Allowed variant key sets ───────────────────────────────────────────────────
// Derived from the authoritative lists in stored-rule.ts.
// Sets provide O(1) membership testing; the source arrays remain the
// single source of truth.

const VALID_HERO_KEYS  = new Set<string>(ALLOWED_HERO_KEYS);
const VALID_PROOF_KEYS = new Set<string>(ALLOWED_PROOF_KEYS);
const VALID_CTA_KEYS   = new Set<string>(ALLOWED_CTA_KEYS);

// ── AI output type ─────────────────────────────────────────────────────────────

/**
 * The structured output from any AI decision model.
 *
 * `confidence` is a self-reported score in [0, 1] where 1.0 means the model
 * is fully certain about its recommendation.  Models that do not support
 * confidence scoring should leave this field undefined — the policy will
 * treat the absence as maximum uncertainty and fall back to rules.
 *
 * Raw values outside [0, 1] are accepted here; they are normalised by
 * `normaliseConfidence()` before policy evaluation.
 */
export interface AiDecisionOutput {
  /** The full experience plan the model is recommending. */
  plan: ExperiencePlan;

  /**
   * Model-reported decision confidence in [0, 1].
   * Undefined means the model did not produce a score.
   * Values outside [0, 1] are clamped during evaluation.
   */
  confidence: number | undefined;

  /**
   * Identifier of the model that produced this output.
   * e.g. "claude-3-5-sonnet-20241022" | "gpt-4o" | "mock-deterministic-v1"
   */
  modelId: string;

  /**
   * Optional chain-of-thought or explanation text from the model.
   * Useful for observability and debugging in the AI dashboard.
   */
  rawReasoning?: string;

  /** Wall-clock time for the AI inference call, in milliseconds. */
  latencyMs?: number;

  /** Tokens consumed in the prompt (for cost tracking). */
  inputTokens?: number;

  /** Tokens generated in the completion (for cost tracking). */
  outputTokens?: number;
}

// ── Policy configuration ───────────────────────────────────────────────────────

/**
 * Configuration for the confidence policy.
 *
 * All thresholds are tunable at the call site; this module defines the
 * recommended defaults that work well for the MVP data volumes.
 */
export interface ConfidencePolicyConfig {
  /**
   * Minimum confidence score required to use the AI plan.
   *
   * Range: 0.0 – 1.0.  Default: 0.70
   *
   * Raise this to require stronger model certainty before going live.
   * Lower this to give more latitude to the model in ambiguous contexts.
   */
  minConfidence: number;

  /**
   * Minimum context richness score required before asking the AI at all.
   *
   * Range: 0.0 – 1.0.  Default: 0.30
   *
   * When context richness is below this threshold the policy short-circuits
   * to FALLBACK_CONTEXT_SPARSE — the AI would be operating almost entirely
   * on priors and is unlikely to outperform the rules engine.
   */
  minContextRichness: number;

  /**
   * When true (default), the policy validates AI output keys against the
   * authoritative allowed-key vocabulary from stored-rule.ts.
   *
   * Disable only if you are running an experiment with custom variant keys
   * not yet registered in stored-rule.ts.
   */
  validateVariantKeys: boolean;
}

/** Recommended defaults for production use. */
export const DEFAULT_CONFIDENCE_POLICY: ConfidencePolicyConfig = {
  minConfidence:      0.70,
  minContextRichness: 0.30,
  validateVariantKeys: true,
} as const;

/**
 * A permissive policy for shadow / evaluation mode.
 *
 * Passes all structurally-valid AI output through regardless of confidence.
 * Use this when you want to observe raw model behaviour in the AI dashboard
 * without any safety gating — the shadow provider never changes what visitors
 * see regardless of verdict.
 */
export const PERMISSIVE_CONFIDENCE_POLICY: ConfidencePolicyConfig = {
  minConfidence:      0.0,
  minContextRichness: 0.0,
  validateVariantKeys: true,
} as const;

// ── Policy verdict ─────────────────────────────────────────────────────────────

/**
 * The actionable outcome of a policy evaluation.
 *
 *   USE_AI                   — all gates passed; the AI plan may be served
 *   FALLBACK_CONTEXT_SPARSE  — visitor context too sparse; rules are safer
 *   FALLBACK_LOW_CONFIDENCE  — AI confidence absent, non-finite, or below threshold
 *   FALLBACK_MISSING_FIELDS  — AI plan is structurally incomplete
 *   FALLBACK_INVALID_KEYS    — AI plan keys are not in the allowed vocabulary
 *
 * All FALLBACK_* verdicts mean the rules plan should be served.
 * In shadow mode the verdict is logged for analysis but does not affect
 * what the visitor sees.
 */
export type PolicyVerdict =
  | "USE_AI"
  | "FALLBACK_CONTEXT_SPARSE"
  | "FALLBACK_LOW_CONFIDENCE"
  | "FALLBACK_MISSING_FIELDS"
  | "FALLBACK_INVALID_KEYS";

// ── Gate result ────────────────────────────────────────────────────────────────

/**
 * Result of evaluating one named policy gate.
 *
 * All evaluated gates are included in `ConfidencePolicyResult.gates` so
 * observers can see exactly which check caused a fallback and what score
 * each gate measured.
 */
export interface PolicyGateResult {
  /**
   * Stable gate identifier, safe to store in analytics and logs.
   *
   * Current gate names:
   *   "context_richness"     "confidence_present"   "confidence_threshold"
   *   "plan_fields_present"  "plan_keys_valid"
   */
  gate: string;

  /** Whether this gate passed. */
  passed: boolean;

  /** Human-readable explanation suitable for logging and the AI dashboard. */
  reason: string;

  /**
   * Optional numeric detail for gates that measure a score.
   * e.g. context_richness and confidence_threshold include their scores.
   */
  score?: number;
}

// ── Full evaluation result ─────────────────────────────────────────────────────

/**
 * The complete, structured output of `evaluateConfidencePolicy()`.
 *
 * Consumers should branch on `verdict` for routing decisions and use `gates`
 * for detailed logging and dashboard display.
 *
 * @example
 * const result = evaluateConfidencePolicy(aiOutput, context);
 *
 * if (result.verdict === "USE_AI") {
 *   servedPlan = aiOutput.plan;
 * } else {
 *   servedPlan = fallbackPlan;
 *   logger.warn("[ai-policy] fallback", { verdict: result.verdict, summary: result.summary });
 * }
 */
export interface ConfidencePolicyResult {
  /** What to do: use the AI plan or fall back to rules. */
  verdict: PolicyVerdict;

  /**
   * All evaluated gates, in evaluation order.
   * Gates that were not reached (because a prior gate failed) are absent.
   * An empty array means evaluation short-circuited before the first gate.
   */
  gates: PolicyGateResult[];

  /**
   * Stable name of the first gate that failed, or null when all gates passed.
   * Useful for aggregation queries: "which gate causes most fallbacks?"
   */
  failedGate: string | null;

  /**
   * Computed context richness score in [0, 1].
   * Included even when verdict is USE_AI so dashboards can correlate
   * richness with agreement rate.
   */
  contextRichness: number;

  /**
   * One-line human-readable explanation of the verdict.
   * Written to structured logs and the AI dashboard summary column.
   */
  summary: string;
}

// ── Confidence normalisation ───────────────────────────────────────────────────

/**
 * Normalise a raw confidence value to a safe [0, 1] number, or undefined.
 *
 * Raw AI confidence values may be:
 *   • undefined  — model did not self-assess
 *   • NaN        — model returned a non-numeric value
 *   • Infinity   — pathological model output (e.g. log-probability overflow)
 *   • > 1.0      — model used a different scale (e.g. percentage)
 *   • < 0.0      — model returned a negative score
 *
 * This function maps all pathological cases to `undefined` (treated as absent
 * by Gate 2), and clamps in-range-but-out-of-bounds values to [0, 1].
 *
 * @example
 * normaliseConfidence(0.82)    // → 0.82
 * normaliseConfidence(1.5)     // → 1.0   (clamped)
 * normaliseConfidence(-0.1)    // → 0.0   (clamped)
 * normaliseConfidence(undefined) // → undefined
 * normaliseConfidence(NaN)     // → undefined
 * normaliseConfidence(Infinity) // → undefined
 */
export function normaliseConfidence(raw: number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!Number.isFinite(raw)) return undefined;  // catches NaN, ±Infinity
  return Math.max(0, Math.min(1, raw));
}

// ── Context richness ───────────────────────────────────────────────────────────

/**
 * Scores how information-rich the visitor context is on a [0, 1] scale.
 *
 * Higher score = more signals for the AI to reason about.
 * A score near 0 means nearly everything is unknown/null.
 *
 * This is an intentionally simple additive model — it is good enough for
 * routing decisions and requires no calibration data.
 */
export function measureContextRichness(context: VisitorContext): number {
  let score = 0;

  // Primary routing signal — the most informative single dimension.
  if (context.source !== "unknown") {
    score += 0.40;
  }

  // Campaign intent — explicit and trustworthy.
  const hasUtm = !!(context.utmSource || context.utmMedium || context.utmCampaign);
  if (hasUtm) {
    score += 0.20;
  }

  // Behavioural continuity.
  if (context.visitType === "returning") {
    score += 0.15;
  }

  // Supplementary source evidence.
  if (context.referrerDomain !== null) {
    score += 0.15;
  }

  // Device context — lower weight; device rarely changes the AI's choice.
  if (context.userAgent !== null) {
    score += 0.10;
  }

  return Math.min(score, 1.0);
}

// ── Core evaluator ─────────────────────────────────────────────────────────────

/**
 * Evaluate the confidence policy for one AI decision output.
 *
 * Runs up to five named gates in order.  Stops at the first failure and
 * sets the appropriate verdict.  All evaluated gates are returned so the
 * caller can log the full evaluation trail.
 *
 * Confidence is normalised to [0, 1] before evaluation — see
 * `normaliseConfidence()` for the normalisation contract.
 *
 * @param aiOutput  The structured output from the AI model.
 * @param context   The visitor context at decision time.
 * @param config    Policy thresholds (defaults to DEFAULT_CONFIDENCE_POLICY).
 * @returns         A ConfidencePolicyResult with verdict, gates, and summary.
 *
 * @example
 * const result = evaluateConfidencePolicy(
 *   { plan, confidence: 0.82, modelId: "claude-3-5-haiku" },
 *   visitorContext,
 * );
 * // result.verdict === "USE_AI"
 */
export function evaluateConfidencePolicy(
  aiOutput: AiDecisionOutput,
  context: VisitorContext,
  config: ConfidencePolicyConfig = DEFAULT_CONFIDENCE_POLICY,
): ConfidencePolicyResult {
  const gates: PolicyGateResult[] = [];
  const contextRichness = measureContextRichness(context);

  // Normalise confidence once — used across Gates 2 and 3.
  // Non-finite or undefined raw values become undefined here,
  // which causes Gate 2 to fail cleanly rather than letting
  // pathological values (e.g. Infinity) bypass the threshold check.
  const normalisedConfidence = normaliseConfidence(aiOutput.confidence);

  // ── Gate 1: context_richness ───────────────────────────────────────────────
  // Skip the AI call entirely when the visitor context carries too little
  // signal.  Below this threshold the AI would rely almost entirely on priors
  // and is unlikely to outperform a deterministic rule.

  const contextPassed = contextRichness >= config.minContextRichness;
  const contextGate: PolicyGateResult = {
    gate:   "context_richness",
    passed: contextPassed,
    reason: contextPassed
      ? `Context richness ${contextRichness.toFixed(2)} meets threshold ${config.minContextRichness}.`
      : `Context richness ${contextRichness.toFixed(2)} is below threshold ` +
        `${config.minContextRichness}. ` +
        `source="${context.source}", visitType="${context.visitType}", ` +
        `hasUtm=${hasUtmParams(context)}.`,
    score: contextRichness,
  };
  gates.push(contextGate);

  if (!contextGate.passed) {
    return {
      verdict:        "FALLBACK_CONTEXT_SPARSE",
      gates,
      failedGate:     contextGate.gate,
      contextRichness,
      summary:
        `Context too sparse for AI (richness=${contextRichness.toFixed(2)}, ` +
        `threshold=${config.minContextRichness}). Falling back to rules.`,
    };
  }

  // ── Gate 2: confidence_present ────────────────────────────────────────────
  // An absent, NaN, or non-finite confidence score means the model did not
  // self-assess reliably — treat it as maximum uncertainty and fall back
  // rather than guessing.

  const confidencePresent = normalisedConfidence !== undefined;

  const confidencePresentGate: PolicyGateResult = {
    gate:   "confidence_present",
    passed: confidencePresent,
    reason: confidencePresent
      ? `AI reported normalised confidence ${normalisedConfidence!.toFixed(3)} ` +
        `(raw: ${aiOutput.confidence}).`
      : `AI did not return a valid confidence score ` +
        `(raw: ${aiOutput.confidence}, model: ${aiOutput.modelId}). ` +
        `NaN, Infinity, and undefined are all treated as absent.`,
    score: normalisedConfidence,
  };
  gates.push(confidencePresentGate);

  if (!confidencePresentGate.passed) {
    return {
      verdict:        "FALLBACK_LOW_CONFIDENCE",
      gates,
      failedGate:     confidencePresentGate.gate,
      contextRichness,
      summary:
        `AI output has no valid confidence score (raw=${aiOutput.confidence}, ` +
        `model=${aiOutput.modelId}). Falling back to rules.`,
    };
  }

  // ── Gate 3: confidence_threshold ──────────────────────────────────────────
  // The model self-reported a score, but it is below the minimum required to
  // trust the plan.  Use the normalised value for the comparison so values
  // clamped from outside [0, 1] are handled consistently.

  const confidence = normalisedConfidence as number;
  const thresholdPassed = confidence >= config.minConfidence;
  const thresholdGate: PolicyGateResult = {
    gate:   "confidence_threshold",
    passed: thresholdPassed,
    reason: thresholdPassed
      ? `Confidence ${confidence.toFixed(3)} meets threshold ${config.minConfidence}.`
      : `Confidence ${confidence.toFixed(3)} is below threshold ` +
        `${config.minConfidence}. AI plan logged but not served ` +
        `(model: ${aiOutput.modelId}).`,
    score: confidence,
  };
  gates.push(thresholdGate);

  if (!thresholdGate.passed) {
    return {
      verdict:        "FALLBACK_LOW_CONFIDENCE",
      gates,
      failedGate:     thresholdGate.gate,
      contextRichness,
      summary:
        `AI confidence ${confidence.toFixed(3)} below threshold ` +
        `${config.minConfidence} (model=${aiOutput.modelId}). ` +
        `Plan logged but not served.`,
    };
  }

  // ── Gate 4: plan_fields_present ───────────────────────────────────────────
  // All three variant keys must be non-empty strings.  A missing field means
  // the model produced a structurally incomplete response — this is a hard
  // failure regardless of confidence.

  const missingFields = resolveMissingFields(aiOutput.plan);
  const fieldsPresentGate: PolicyGateResult = {
    gate:   "plan_fields_present",
    passed: missingFields.length === 0,
    reason: missingFields.length === 0
      ? `All required plan fields are present (heroKey, proofKey, ctaKey).`
      : `AI plan is missing required fields: ${missingFields.join(", ")}.`,
  };
  gates.push(fieldsPresentGate);

  if (!fieldsPresentGate.passed) {
    return {
      verdict:        "FALLBACK_MISSING_FIELDS",
      gates,
      failedGate:     fieldsPresentGate.gate,
      contextRichness,
      summary:
        `AI plan missing required fields: ${missingFields.join(", ")} ` +
        `(model=${aiOutput.modelId}). Falling back to rules.`,
    };
  }

  // ── Gate 5: plan_keys_valid ───────────────────────────────────────────────
  // All three keys must be members of the authoritative allowed-key vocabulary
  // from stored-rule.ts.  An unrecognised key would crash the CMS lookup and
  // cannot be rendered.
  //
  // This gate can be disabled via config.validateVariantKeys = false when
  // running experiments with custom keys not yet registered in stored-rule.ts.

  if (config.validateVariantKeys) {
    const invalidKeys = resolveInvalidKeys(aiOutput.plan);
    const keysValidGate: PolicyGateResult = {
      gate:   "plan_keys_valid",
      passed: invalidKeys.length === 0,
      reason: invalidKeys.length === 0
        ? `All plan keys are in the allowed vocabulary ` +
          `(hero="${aiOutput.plan.heroKey}", proof="${aiOutput.plan.proofKey}", ` +
          `cta="${aiOutput.plan.ctaKey}").`
        : `AI plan contains keys not in the allowed vocabulary: ` +
          `${invalidKeys.join(", ")}. These keys have no CMS content.`,
    };
    gates.push(keysValidGate);

    if (!keysValidGate.passed) {
      return {
        verdict:        "FALLBACK_INVALID_KEYS",
        gates,
        failedGate:     keysValidGate.gate,
        contextRichness,
        summary:
          `AI plan has invalid keys: ${invalidKeys.join(", ")} ` +
          `(model=${aiOutput.modelId}). Falling back to rules.`,
      };
    }
  }

  // ── All gates passed ───────────────────────────────────────────────────────

  return {
    verdict:        "USE_AI",
    gates,
    failedGate:     null,
    contextRichness,
    summary:
      `AI plan accepted (confidence=${confidence.toFixed(3)}, ` +
      `richness=${contextRichness.toFixed(2)}, model=${aiOutput.modelId}).`,
  };
}

// ── Serialisable log meta ──────────────────────────────────────────────────────

/**
 * Produces a flat plain-object snapshot of the policy result suitable for
 * `logger.info()` or the `shadow_plan` JSONB column in ai_decision_logs.
 *
 * Kept flat so it renders neatly in log aggregators like Axiom or Papertrail
 * without requiring JSON path queries.
 *
 * Confidence is normalised before inclusion — non-finite values become
 * undefined rather than polluting the log record.
 */
export function policyResultToLogMeta(
  result: ConfidencePolicyResult,
  aiOutput: AiDecisionOutput,
): Record<string, unknown> {
  return {
    policyVerdict:    result.verdict,
    policyFailedGate: result.failedGate,
    contextRichness:  result.contextRichness,
    aiConfidence:     normaliseConfidence(aiOutput.confidence),
    aiModelId:        aiOutput.modelId,
    aiLatencyMs:      aiOutput.latencyMs,
    aiInputTokens:    aiOutput.inputTokens,
    aiOutputTokens:   aiOutput.outputTokens,
    gateResults: result.gates.map((g) => ({
      gate:   g.gate,
      passed: g.passed,
      score:  g.score,
    })),
  };
}

// ── Private helpers ────────────────────────────────────────────────────────────

/** Returns the UTM presence flag used in gate-1 reason strings. */
function hasUtmParams(context: VisitorContext): boolean {
  return !!(context.utmSource || context.utmMedium || context.utmCampaign);
}

/**
 * Returns the names of any heroKey / proofKey / ctaKey that are absent
 * (undefined, null, or empty string) on the given plan.
 */
function resolveMissingFields(plan: ExperiencePlan): string[] {
  const missing: string[] = [];
  if (!plan.heroKey)  missing.push("heroKey");
  if (!plan.proofKey) missing.push("proofKey");
  if (!plan.ctaKey)   missing.push("ctaKey");
  return missing;
}

/**
 * Returns descriptor strings for any plan key that is not a member of the
 * authoritative allowed-key vocabulary.
 *
 * Callers must ensure all fields are present before calling this (gate 4
 * should have fired first).
 */
function resolveInvalidKeys(plan: ExperiencePlan): string[] {
  const invalid: string[] = [];
  if (!VALID_HERO_KEYS.has(plan.heroKey))   invalid.push(`heroKey="${plan.heroKey}"`);
  if (!VALID_PROOF_KEYS.has(plan.proofKey)) invalid.push(`proofKey="${plan.proofKey}"`);
  if (!VALID_CTA_KEYS.has(plan.ctaKey))     invalid.push(`ctaKey="${plan.ctaKey}"`);
  return invalid;
}
