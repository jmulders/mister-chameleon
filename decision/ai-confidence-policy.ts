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
 * ─── Composite confidence model ───────────────────────────────────────────────
 *
 *   The policy no longer gates on self-reported AI confidence alone.
 *   Three components are combined into a single `finalConfidence` score:
 *
 *     finalConfidence = (aiConfidence × 0.60)
 *                     + (validationScore × 0.20)
 *                     + (contextStrength × 0.20)
 *
 *   Component definitions:
 *
 *     aiConfidence    — self-reported model confidence, normalised to [0, 1].
 *                       Absent or non-finite values are treated as 0.
 *
 *     validationScore — structural quality of the AI plan: 1.0 when all three
 *                       required keys exist and are members of the authorised
 *                       vocabulary, 0.0 on any hard-validation failure.
 *                       A hard-validation failure always rejects the plan
 *                       regardless of finalConfidence.
 *
 *     contextStrength — how much information the current visitor context
 *                       provides for the AI to reason about.  Richer context
 *                       increases confidence that the AI's choice is grounded.
 *
 *   The threshold is now applied to `finalConfidence`, not raw `aiConfidence`.
 *   A model that self-reports 0.70 with perfect validation (1.0) and strong
 *   context (0.80) produces finalConfidence ≈ 0.60×0.70 + 0.20×1.0 + 0.20×0.80
 *   = 0.42 + 0.20 + 0.16 = 0.78, which clears the default 0.75 threshold.
 *
 * ─── Gate evaluation model ────────────────────────────────────────────────────
 *
 *   Policy gates are evaluated in order.  Evaluation stops at the first
 *   failure.  All gates that were reached are reported in the result so
 *   operators can see exactly how far the AI output got before it was rejected.
 *
 *   Gate order:
 *
 *     1. context_richness      — does the visitor context carry enough signal?
 *                                (if not, AI has nothing useful to reason about)
 *
 *     2. confidence_present    — did the AI return a finite numeric confidence?
 *                                (absent, NaN, or non-finite → maximum uncertainty)
 *
 *     3. plan_fields_present   — do heroKey / proofKey / ctaKey all exist and
 *                                are they non-empty strings?
 *
 *     4. plan_keys_valid       — are all three keys members of the authoritative
 *                                allowed-key vocabulary from stored-rule.ts?
 *
 *     5. final_confidence      — is finalConfidence >= policy.minConfidence?
 *                                Uses the composite score (aiConfidence ×0.60 +
 *                                validationScore ×0.20 + contextStrength ×0.20).
 *
 *   Gates 3 and 4 are hard gates — a failure rejects the plan regardless of
 *   finalConfidence.  They are kept separate because a missing field and an
 *   unrecognised key are different failure modes with distinct log verdicts.
 *
 * ─── Verdict reference ────────────────────────────────────────────────────────
 *
 *   USE_AI                   — all gates passed; the AI plan may be served
 *   FALLBACK_CONTEXT_SPARSE  — context too sparse to trust AI
 *   FALLBACK_LOW_CONFIDENCE  — finalConfidence below threshold
 *   FALLBACK_MISSING_FIELDS  — AI plan is structurally incomplete (null/empty key)
 *   FALLBACK_INVALID_KEYS    — AI plan keys are not in the allowed vocabulary
 *
 * ─── Context richness vs context strength ─────────────────────────────────────
 *
 *   `contextRichness` (Gate 1) is a pre-call gate: does the visitor context
 *   carry enough signal for it to be worth calling the AI at all?
 *
 *   `contextStrength` (composite component) is a post-call weight: given that
 *   the AI produced an output, how much do the available context signals support
 *   trusting it?  The two metrics use overlapping but differently weighted signal
 *   sets because they answer different questions.
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
 * ─── Key vocabulary ───────────────────────────────────────────────────────────
 *
 *   Allowed variant keys are imported from `decision/rules/stored-rule.ts`,
 *   which is the single source of truth for this codebase.  The Sets built
 *   below are module-level constants — constructed once, O(1) lookup.
 *
 * ─── Pure / no I/O ────────────────────────────────────────────────────────────
 *
 *   This file has no imports from the data or network layer.
 *   Logging is the caller's responsibility (see AiDecisionProvider).
 */

import type { VisitorContext } from "@/context/types";
import type { DecisionInput } from "@/decision/types";
import type { ExperiencePlan } from "./types";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";
import { ALLOWED_THEME_KEYS } from "@/ai/theme-meta";
import type { ThemePresetKey } from "@/design-system/theme/presets";

// ── Allowed variant key sets ───────────────────────────────────────────────────
// Derived from the authoritative lists in stored-rule.ts.
// Sets provide O(1) membership testing; the source arrays remain the
// single source of truth.

const VALID_HERO_KEYS  = new Set<string>(ALLOWED_HERO_KEYS);
const VALID_PROOF_KEYS = new Set<string>(ALLOWED_PROOF_KEYS);
const VALID_CTA_KEYS   = new Set<string>(ALLOWED_CTA_KEYS);

// ── Allowed theme key set ─────────────────────────────────────────────────────
// Derived from the authoritative list in ai/theme-meta.ts.
// Used for SOFT validation only — an invalid themeKey is silently cleared
// rather than causing a plan rejection.

const VALID_THEME_KEYS = new Set<string>(ALLOWED_THEME_KEYS);

// ── Composite confidence weights ───────────────────────────────────────────────

/** Weight applied to the model's self-reported confidence in finalConfidence. */
const WEIGHT_AI_CONFIDENCE   = 0.60;

/** Weight applied to the structural validation score in finalConfidence. */
const WEIGHT_VALIDATION_SCORE = 0.20;

/** Weight applied to the visitor context strength score in finalConfidence. */
const WEIGHT_CONTEXT_STRENGTH = 0.20;

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
   * Minimum FINAL confidence score required to use the AI plan.
   *
   * Range: 0.0 – 1.0.  Default: 0.75
   *
   * This threshold is now applied to the composite `finalConfidence` score
   * (aiConfidence ×0.60 + validationScore ×0.20 + contextStrength ×0.20),
   * not the raw self-reported AI confidence.
   *
   * Raise this to require stronger combined certainty before going live.
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
  minConfidence:      0.75,
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
 *   FALLBACK_LOW_CONFIDENCE  — finalConfidence absent, non-finite, or below threshold
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
   *   "context_richness"     "confidence_present"   "plan_fields_present"
   *   "plan_keys_valid"      "final_confidence"
   */
  gate: string;

  /** Whether this gate passed. */
  passed: boolean;

  /** Human-readable explanation suitable for logging and the AI dashboard. */
  reason: string;

  /**
   * Optional numeric detail for gates that measure a score.
   * e.g. context_richness, confidence_present, and final_confidence include scores.
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
 * const result = evaluateConfidencePolicy(aiOutput, decisionInput);
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
   * Structural validation score for the AI plan: 1.0 when all required
   * keys are present and in the authorised vocabulary, 0.0 on any hard fail.
   * Always present regardless of which gate failed (computed up-front).
   */
  validationScore: number;

  /**
   * Visitor context strength score in [0, 1].
   * Measures how information-rich the context is for AI confidence purposes —
   * distinct from contextRichness which gates the pre-call decision.
   * Always present regardless of which gate failed (computed up-front).
   */
  contextStrength: number;

  /**
   * Composite final confidence in [0, 1]:
   *   finalConfidence = aiConfidence×0.60 + validationScore×0.20 + contextStrength×0.20
   *
   * Uses normalised aiConfidence (0 when absent/invalid).
   * Always present regardless of which gate failed (computed up-front).
   */
  finalConfidence: number;

  /**
   * The configured minimum confidence threshold (policy.minConfidence).
   * Recorded alongside the gate results so dashboards can show the gap
   * between finalConfidence and the threshold without re-reading config.
   */
  configuredThreshold: number;

  /**
   * One-line human-readable explanation of the verdict.
   * Written to structured logs and the AI dashboard summary column.
   */
  summary: string;

  /**
   * The AI-suggested theme key after soft validation.
   *
   * - Present and valid → the ThemePresetKey the AI recommended.
   * - Missing in AI output → null (no suggestion; use rule-selected / default).
   * - Invalid key (not in ALLOWED_THEME_KEYS) → null (silently cleared; plan not rejected).
   *
   * This field is populated regardless of `verdict` — even when the plan is
   * rejected on confidence or validity grounds, it is useful for logging to
   * see what theme the model attempted to suggest.
   *
   * Callers MUST NOT use this field to serve a theme if verdict !== "USE_AI".
   * When verdict is any FALLBACK_*, the themeKey should be ignored (logged only).
   */
  sanitizedThemeKey: ThemePresetKey | null;

  /**
   * Whether the AI returned a themeKey and it was discarded due to validation.
   *
   * true  — AI provided a themeKey that was not in ALLOWED_THEME_KEYS.
   * false — AI either provided a valid key or omitted the field entirely.
   *
   * Useful for dashboard monitoring: a high rate of invalid theme keys
   * suggests the model is hallucinating theme names.
   */
  themeKeyInvalid: boolean;
}

// ── Confidence normalisation ───────────────────────────────────────────────────

/**
 * Normalise a raw confidence value to a safe [0, 1] number, or undefined.
 *
 * Raw AI confidence values may be:
 *   • undefined  — model did not self-assess
 *   • NaN        — model returned a non-numeric value
 *   • Infinity   — model returned a log-probability overflow
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
 * Used as a pre-call gate (Gate 1): if this score is below minContextRichness,
 * the AI is not called at all — it would be operating almost entirely on priors.
 *
 * Higher score = more signals available for the AI to reason about.
 * A score near 0 means nearly everything is unknown/null.
 *
 * Signal weights:
 *   source != "unknown"    +0.40  (the primary routing signal)
 *   any UTM param present  +0.20  (explicit campaign intent)
 *   visitType returning    +0.15  (behavioural continuity)
 *   referrerDomain != null +0.15  (supplementary source)
 *   userAgent != null      +0.10  (device context)
 */
export function measureContextRichness(context: VisitorContext): number {
  let score = 0;

  // Primary routing signal — the most informative single dimension.
  if (context.source !== "unknown") {
    score += 0.35;
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
    score += 0.10;
  }

  // Device context.
  if (context.userAgent !== null) {
    score += 0.05;
  }

  // Enrichment signals — optional because VisitorContext doesn't carry them,
  // but RuleEvaluationContext does.  Cast and check defensively.
  const rich = context as VisitorContext & { enrichment?: Record<string, unknown> | null };
  const e = rich.enrichment;
  if (e) {
    // Company identified via reverse-IP enrichment.
    if (e["companyName"]) score += 0.10;
    // CRM lifecycle stage — visitor is a known lead/customer.
    if (e["crmMatched"])  score += 0.10;
    // Geo resolved — gives the AI regional context.
    if (e["currentCity"] || e["city"]) score += 0.05;
  }

  return Math.min(score, 1.0);
}

// ── Context strength ───────────────────────────────────────────────────────────

/**
 * Scores how much the current visitor context supports trusting the AI's
 * output on a [0, 1] scale.
 *
 * Used as a component of `finalConfidence` (weight: 0.20).  Unlike
 * `measureContextRichness` (which is a binary gate), this score is continuous
 * and rewards deeper behavioural signals that make the AI's reasoning more
 * grounded.
 *
 * Signal weights:
 *   source: linkedin|google   +0.25  (strong, attributable source)
 *   source: direct            +0.10  (some signal, less attributable)
 *   visitType: returning      +0.20  (repeat engagement — higher intent)
 *   any UTM param             +0.15  (explicit campaign signal)
 *   referrerDomain present    +0.10  (supplementary source evidence)
 *   history.pageViewCount ≥ 3 +0.15  (highly engaged visitor)
 *   history.pageViewCount ≥ 1 +0.10  (some prior page view — lower tier)
 *   history.hasClickedCta     +0.10  (conversion intent demonstrated)
 *   history.fromDatabase      +0.05  (reliable history vs empty fallback)
 *
 * Only one pageViewCount tier fires (≥3 takes precedence over ≥1).
 * Max achievable score: 1.00 (capped).
 */
export function computeContextStrength(input: DecisionInput): number {
  let score = 0;

  // Cast to enriched type to access optional enrichment and derived fields.
  // These fields are present when `input` is actually a RuleEvaluationContext
  // (which extends DecisionInput).  The cast is safe — we only read optional
  // properties and treat absent values as non-contributing.
  const rich = input as DecisionInput & Partial<Pick<RuleEvaluationContext,
    "enrichment" | "derived" | "interestContext"
  >>;

  // ── Attribution strength (base signals) ────────────────────────────────────

  // Source attribution — strong sources give the AI clear intent signal.
  if (input.source === "linkedin" || input.source === "google") {
    score += 0.20;
  } else if (input.source === "direct") {
    score += 0.08;
  }
  // source === "unknown" contributes nothing.

  // Repeat visit — highest behavioural continuity signal.
  if (input.visitType === "returning") {
    score += 0.15;
  }

  // Explicit campaign parameters — advertiser-provided intent.
  if (input.utmSource || input.utmMedium || input.utmCampaign) {
    score += 0.12;
  }

  // Supplementary source evidence.
  if (input.referrerDomain !== null) {
    score += 0.08;
  }

  // ── Engagement depth from first-party history ──────────────────────────────
  // Only one tier fires — the higher threshold takes precedence.
  if (input.history.pageViewCount >= 3) {
    score += 0.12;
  } else if (input.history.pageViewCount >= 1) {
    score += 0.08;
  }

  // Demonstrated conversion intent.
  if (input.history.hasClickedCta) {
    score += 0.08;
  }

  // Reliable history flag — confirms signals came from DB, not zero-valued fallback.
  if (input.history.fromDatabase) {
    score += 0.05;
  }

  // ── Enrichment signals (adds substantial grounding for AI) ─────────────────
  const e = rich.enrichment as Record<string, unknown> | undefined;
  if (e) {
    // Company identified via reverse-IP — tells AI the visitor's organisation.
    if (e["companyName"]) {
      score += 0.12;
    }
    // CRM match — highest-value enrichment: confirms identity and lifecycle stage.
    if (e["crmMatched"]) {
      score += 0.15;
    }
    // ABM target account — critical signal for enterprise / outbound campaigns.
    if (e["targetAccountMatched"]) {
      score += 0.10;
    }
    // Geo resolved — gives the AI regional / market context.
    if (e["currentCity"] || e["city"]) {
      score += 0.05;
    }
  }

  // ── Derived signals ────────────────────────────────────────────────────────
  const d = rich.derived;
  if (d) {
    // Funnel stage beyond awareness — visitor has clear intent signal.
    if (d.funnelStage && d.funnelStage !== "awareness") {
      score += 0.08;
    }
    // High engagement score.
    if (d.engagementScore !== null && d.engagementScore !== undefined && d.engagementScore >= 0.5) {
      score += 0.05;
    }
  }

  // ── Interest signals ───────────────────────────────────────────────────────
  if (rich.interestContext && rich.interestContext.interestConfidence >= 0.5) {
    score += 0.07;
  }

  return Math.min(score, 1.0);
}

// ── Validation score ───────────────────────────────────────────────────────────

/**
 * Internal result of plan validation, combining a numeric score with a hard-fail flag.
 */
interface ValidationResult {
  /**
   * Structural quality score: 1.0 when all three required keys are present and
   * members of the authorised vocabulary; 0.0 on any hard-validation failure.
   */
  score: number;

  /** True when any validation check that requires an immediate plan reject fired. */
  hardFail: boolean;

  /**
   * Which structural check triggered the hard fail.
   * "fields" — one or more required keys are missing or empty.
   * "keys"   — one or more keys are not in the allowed vocabulary.
   * null     — no hard fail.
   */
  hardFailKind: "fields" | "keys" | null;
}

/**
 * Validates the structural integrity of an AI-produced ExperiencePlan and
 * converts the result into a numeric score component for `finalConfidence`.
 *
 * Validation checks (in order):
 *   (a) heroKey, proofKey, ctaKey must all be non-empty strings.
 *       Failure → score = 0.0, hardFail = true, hardFailKind = "fields".
 *   (b) All three keys must be members of the authorised variant vocabulary
 *       (ALLOWED_HERO_KEYS / PROOF / CTA from stored-rule.ts).
 *       Failure → score = 0.0, hardFail = true, hardFailKind = "keys".
 *   (c) All checks pass → score = 1.0, hardFail = false.
 */
function computeValidationScore(plan: ExperiencePlan): ValidationResult {
  // (a) Required fields must be non-empty.
  if (!plan.heroKey || !plan.proofKey || !plan.ctaKey) {
    return { score: 0.0, hardFail: true, hardFailKind: "fields" };
  }

  // (b) All keys must be in the authorised vocabulary.
  if (
    !VALID_HERO_KEYS.has(plan.heroKey) ||
    !VALID_PROOF_KEYS.has(plan.proofKey) ||
    !VALID_CTA_KEYS.has(plan.ctaKey)
  ) {
    return { score: 0.0, hardFail: true, hardFailKind: "keys" };
  }

  // (c) Plan is structurally valid.
  return { score: 1.0, hardFail: false, hardFailKind: null };
}

// ── Final confidence ───────────────────────────────────────────────────────────

/**
 * Combines the three confidence components into a single composite score.
 *
 * Formula:
 *   finalConfidence = (aiConfidence × 0.60)
 *                   + (validationScore × 0.20)
 *                   + (contextStrength × 0.20)
 *
 * All inputs must be in [0, 1].  The result is naturally in [0, 1] because
 * the weights sum to 1.0.
 *
 * `aiConfidence` should be the normalised value (pass 0 when absent, not
 * undefined — this function expects a number for all three components).
 *
 * @param aiConfidence    Normalised model self-confidence (0 when absent).
 * @param validationScore Structural validation score (0 or 1).
 * @param contextStrength Visitor context strength score (0..1).
 */
export function computeFinalConfidence(
  aiConfidence:    number,
  validationScore: number,
  contextStrength: number,
): number {
  return (
    aiConfidence    * WEIGHT_AI_CONFIDENCE   +
    validationScore * WEIGHT_VALIDATION_SCORE +
    contextStrength * WEIGHT_CONTEXT_STRENGTH
  );
}

// ── Theme key soft validation ─────────────────────────────────────────────────

/**
 * Validates an AI-supplied theme key against the authoritative allowed list.
 *
 * Returns the validated ThemePresetKey, or null when:
 *   - themeKey is absent or undefined (AI chose not to suggest a theme)
 *   - themeKey is not in VALID_THEME_KEYS (hallucinated or stale key)
 *
 * This is intentionally a soft gate — returning null never rejects the plan.
 * Callers should treat null as "no AI theme override; use rule-selected default".
 *
 * @example
 * const themeKey = sanitizeAiThemeKey(aiOutput.plan.themeKey);
 * // themeKey === "corporate-trust" | null
 */
export function sanitizeAiThemeKey(
  raw: string | undefined | null,
): ThemePresetKey | null {
  if (!raw) return null;
  return VALID_THEME_KEYS.has(raw) ? (raw as ThemePresetKey) : null;
}

// ── Core evaluator ─────────────────────────────────────────────────────────────

/**
 * Evaluate the confidence policy for one AI decision output.
 *
 * Runs up to five named gates in order.  Stops at the first failure and
 * sets the appropriate verdict.  All evaluated gates are returned so the
 * caller can log the full evaluation trail.
 *
 * All four composite scores (contextRichness, validationScore, contextStrength,
 * finalConfidence) are computed up-front and included in the result regardless
 * of which gate fired, so dashboards can display them even for early failures.
 *
 * @param aiOutput  The structured output from the AI model.
 * @param input     The full decision input (visitor context + history).
 * @param config    Policy thresholds (defaults to DEFAULT_CONFIDENCE_POLICY).
 * @returns         A ConfidencePolicyResult with verdict, gates, scores, and summary.
 *
 * @example
 * const result = evaluateConfidencePolicy(
 *   { plan, confidence: 0.82, modelId: "claude-3-5-haiku" },
 *   decisionInput,
 * );
 * // result.verdict === "USE_AI"
 * // result.finalConfidence ≈ 0.82×0.60 + 1.0×0.20 + 0.75×0.20 = 0.84
 */
export function evaluateConfidencePolicy(
  aiOutput: AiDecisionOutput,
  input: DecisionInput,
  config: ConfidencePolicyConfig = DEFAULT_CONFIDENCE_POLICY,
): ConfidencePolicyResult {
  const gates: PolicyGateResult[] = [];

  // ── Pre-compute all composite scores ──────────────────────────────────────
  // Compute up-front so the result always carries these fields regardless of
  // which gate fires first.

  const contextRichness      = measureContextRichness(input);
  const contextStrength      = computeContextStrength(input);
  const normalisedConfidence = normaliseConfidence(aiOutput.confidence);
  const validation           = computeValidationScore(aiOutput.plan);
  const validationScore      = validation.score;

  // For finalConfidence: treat absent confidence as 0 (not undefined) so the
  // formula produces a meaningful score even when Gate 2 fires.
  const aiConfForComposite = normalisedConfidence ?? 0;
  const finalConfidence    = computeFinalConfidence(aiConfForComposite, validationScore, contextStrength);
  const configuredThreshold = config.minConfidence;

  // ── Soft theme key validation ─────────────────────────────────────────────
  // Computed up-front and always included in the result — even when the plan
  // is rejected.  This is NOT a hard gate: invalid/absent themeKey never
  // rejects the plan.
  const rawThemeKey       = aiOutput.plan.themeKey as string | undefined | null;
  const sanitizedThemeKey = sanitizeAiThemeKey(rawThemeKey);
  const themeKeyInvalid   = !!rawThemeKey && sanitizedThemeKey === null;

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
        `source="${input.source}", visitType="${input.visitType}", ` +
        `hasUtm=${hasUtmParams(input)}.`,
    score: contextRichness,
  };
  gates.push(contextGate);

  if (!contextGate.passed) {
    return {
      verdict:          "FALLBACK_CONTEXT_SPARSE",
      gates,
      failedGate:       contextGate.gate,
      contextRichness,
      validationScore,
      contextStrength,
      finalConfidence,
      configuredThreshold,
      sanitizedThemeKey,
      themeKeyInvalid,
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
      verdict:          "FALLBACK_LOW_CONFIDENCE",
      gates,
      failedGate:       confidencePresentGate.gate,
      contextRichness,
      validationScore,
      contextStrength,
      finalConfidence,
      configuredThreshold,
      sanitizedThemeKey,
      themeKeyInvalid,
      summary:
        `AI output has no valid confidence score (raw=${aiOutput.confidence}, ` +
        `model=${aiOutput.modelId}). Falling back to rules.`,
    };
  }

  // ── Gate 3: plan_fields_present ───────────────────────────────────────────
  // All three variant keys must be non-empty strings.  A missing field means
  // the model produced a structurally incomplete response — this is a hard
  // failure regardless of confidence.

  if (validation.hardFail && validation.hardFailKind === "fields") {
    const missingFields = resolveMissingFields(aiOutput.plan);
    const fieldsPresentGate: PolicyGateResult = {
      gate:   "plan_fields_present",
      passed: false,
      reason: `AI plan is missing required fields: ${missingFields.join(", ")}.`,
    };
    gates.push(fieldsPresentGate);
    return {
      verdict:          "FALLBACK_MISSING_FIELDS",
      gates,
      failedGate:       fieldsPresentGate.gate,
      contextRichness,
      validationScore,
      contextStrength,
      finalConfidence,
      configuredThreshold,
      sanitizedThemeKey,
      themeKeyInvalid,
      summary:
        `AI plan missing required fields: ${missingFields.join(", ")} ` +
        `(model=${aiOutput.modelId}). Falling back to rules.`,
    };
  }

  const fieldsPresentGate: PolicyGateResult = {
    gate:   "plan_fields_present",
    passed: true,
    reason: `All required plan fields are present (heroKey, proofKey, ctaKey).`,
  };
  gates.push(fieldsPresentGate);

  // ── Gate 4: plan_keys_valid ───────────────────────────────────────────────
  // All three keys must be members of the authoritative allowed-key vocabulary
  // from stored-rule.ts.  An unrecognised key would crash the CMS lookup and
  // cannot be rendered.
  //
  // This gate can be disabled via config.validateVariantKeys = false when
  // running experiments with custom keys not yet registered in stored-rule.ts.

  if (config.validateVariantKeys) {
    if (validation.hardFail && validation.hardFailKind === "keys") {
      const invalidKeys = resolveInvalidKeys(aiOutput.plan);
      const keysValidGate: PolicyGateResult = {
        gate:   "plan_keys_valid",
        passed: false,
        reason: `AI plan contains keys not in the allowed vocabulary: ` +
                `${invalidKeys.join(", ")}. These keys have no CMS content.`,
      };
      gates.push(keysValidGate);
      return {
        verdict:          "FALLBACK_INVALID_KEYS",
        gates,
        failedGate:       keysValidGate.gate,
        contextRichness,
        validationScore,
        contextStrength,
        finalConfidence,
        configuredThreshold,
        sanitizedThemeKey,
        themeKeyInvalid,
        summary:
          `AI plan has invalid keys: ${invalidKeys.join(", ")} ` +
          `(model=${aiOutput.modelId}). Falling back to rules.`,
      };
    }

    const keysValidGate: PolicyGateResult = {
      gate:   "plan_keys_valid",
      passed: true,
      reason: `All plan keys are in the allowed vocabulary ` +
              `(hero="${aiOutput.plan.heroKey}", proof="${aiOutput.plan.proofKey}", ` +
              `cta="${aiOutput.plan.ctaKey}").`,
    };
    gates.push(keysValidGate);
  }

  // ── Gate 5: final_confidence ──────────────────────────────────────────────
  // The composite final confidence must meet or exceed the configured threshold.
  //
  // finalConfidence = aiConfidence×0.60 + validationScore×0.20 + contextStrength×0.20
  //
  // At this point validationScore = 1.0 (Gates 3 and 4 passed).
  // The formula rewards structurally valid plans with strong context signals,
  // even when the model's self-reported confidence is somewhat below the
  // raw threshold it would have needed under the old single-score gate.

  const confidence = normalisedConfidence as number;  // defined — Gate 2 passed
  const thresholdPassed = finalConfidence >= configuredThreshold;

  const finalConfidenceGate: PolicyGateResult = {
    gate:   "final_confidence",
    passed: thresholdPassed,
    reason: thresholdPassed
      ? `Final confidence ${finalConfidence.toFixed(3)} meets threshold ${configuredThreshold} ` +
        `(aiConf=${confidence.toFixed(3)}, validation=${validationScore.toFixed(2)}, ` +
        `contextStrength=${contextStrength.toFixed(2)}).`
      : `Final confidence ${finalConfidence.toFixed(3)} is below threshold ${configuredThreshold} ` +
        `(aiConf=${confidence.toFixed(3)}, validation=${validationScore.toFixed(2)}, ` +
        `contextStrength=${contextStrength.toFixed(2)}, model=${aiOutput.modelId}). ` +
        `AI plan logged but not served.`,
    score: finalConfidence,
  };
  gates.push(finalConfidenceGate);

  if (!finalConfidenceGate.passed) {
    return {
      verdict:          "FALLBACK_LOW_CONFIDENCE",
      gates,
      failedGate:       finalConfidenceGate.gate,
      contextRichness,
      validationScore,
      contextStrength,
      finalConfidence,
      configuredThreshold,
      sanitizedThemeKey,
      themeKeyInvalid,
      summary:
        `Final confidence ${finalConfidence.toFixed(3)} below threshold ` +
        `${configuredThreshold} (aiConf=${confidence.toFixed(3)}, ` +
        `contextStrength=${contextStrength.toFixed(2)}, model=${aiOutput.modelId}). ` +
        `Plan logged but not served.`,
    };
  }

  // ── All gates passed ───────────────────────────────────────────────────────

  const themeNote = sanitizedThemeKey
    ? `, themeKey="${sanitizedThemeKey}"`
    : themeKeyInvalid
      ? `, themeKey=INVALID(cleared)`
      : "";

  return {
    verdict:          "USE_AI",
    gates,
    failedGate:       null,
    contextRichness,
    validationScore,
    contextStrength,
    finalConfidence,
    configuredThreshold,
    sanitizedThemeKey,
    themeKeyInvalid,
    summary:
      `AI plan accepted (finalConfidence=${finalConfidence.toFixed(3)}, ` +
      `aiConf=${confidence.toFixed(3)}, validation=${validationScore.toFixed(2)}, ` +
      `contextStrength=${contextStrength.toFixed(2)}, ` +
      `threshold=${configuredThreshold}, model=${aiOutput.modelId}${themeNote}).`,
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
    policyVerdict:        result.verdict,
    policyFailedGate:     result.failedGate,
    contextRichness:      result.contextRichness,
    contextStrength:      result.contextStrength,
    validationScore:      result.validationScore,
    finalConfidence:      result.finalConfidence,
    configuredThreshold:  result.configuredThreshold,
    aiConfidence:         normaliseConfidence(aiOutput.confidence),
    aiModelId:            aiOutput.modelId,
    aiLatencyMs:          aiOutput.latencyMs,
    aiInputTokens:        aiOutput.inputTokens,
    aiOutputTokens:       aiOutput.outputTokens,
    // Theme key — soft gate (present regardless of plan verdict for log analysis)
    aiThemeKeyRaw:        aiOutput.plan.themeKey ?? null,
    aiThemeKeySanitized:  result.sanitizedThemeKey,
    aiThemeKeyInvalid:    result.themeKeyInvalid,
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
 * Callers must ensure all fields are present before calling this (Gate 3
 * should have fired first).
 */
function resolveInvalidKeys(plan: ExperiencePlan): string[] {
  const invalid: string[] = [];
  if (!VALID_HERO_KEYS.has(plan.heroKey))   invalid.push(`heroKey="${plan.heroKey}"`);
  if (!VALID_PROOF_KEYS.has(plan.proofKey)) invalid.push(`proofKey="${plan.proofKey}"`);
  if (!VALID_CTA_KEYS.has(plan.ctaKey))     invalid.push(`ctaKey="${plan.ctaKey}"`);
  return invalid;
}
