/**
 * Context Library — Matcher
 *
 * context/library/match.ts
 *
 * Converts a RuleEvaluationContext into a flat ContextEvalInput and evaluates
 * every active ContextDefinition's criteria against it.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   1. buildContextEvalInput(ctx) — one-time flattening pass.
 *      Maps nested context layers into a single Record<string, primitive>.
 *      Unknown / absent fields resolve to undefined (no match on "present").
 *
 *   2. evaluateCriterion(criterion, input) — single predicate evaluator.
 *      Pure function; no I/O.
 *
 *   3. matchContextDefinitions(ctx) — main entry point.
 *      Iterates CONTEXT_DEFINITIONS, skips drafts, evaluates required criteria.
 *      Returns all matched definitions with per-criterion results and a
 *      confidence ratio (passed required / total required).
 *
 * ─── Performance ──────────────────────────────────────────────────────────────
 *
 *   Called once per debug render (server-side only).  With ~65 definitions each
 *   having 1–3 criteria, the entire match pass is O(n*m) with n ≈ 65, m ≤ 3.
 *   No indexing or caching required.
 *
 * ─── Optional criteria ────────────────────────────────────────────────────────
 *
 *   Criteria with `optional: true` are evaluated and included in criteriaResults
 *   but do NOT gate the overall match.  They improve the confidence score when
 *   they pass but do not cause a miss when they fail.
 */

import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import {
  CONTEXT_DEFINITIONS,
} from "./definitions";
import type {
  ContextCriterion,
  ContextCriterionResult,
  ContextEvalInput,
  ContextMatch,
} from "./types";

// ── Input builder ──────────────────────────────────────────────────────────────

/**
 * Flatten a RuleEvaluationContext into a single-level Record of primitives.
 *
 * Key mapping covers:
 *   - top-level VisitorContext fields (source, visitType, utmMedium, utmSource, …)
 *   - journey / history fields (funnelStage, intentScore, frictionScore,
 *     hasVisitedPricing, hasSubmittedForm, formStartCount, sessionCount,
 *     pageViewCount, matchedSequenceCount, overallConfidence)
 *   - enrichment fields (companyName, companySize, crmLifecycleStage,
 *     crmIsCustomer, targetAccountMatched, countryCode, isRaining, isCloudProvider)
 *   - interest fields (interestPrimary, interestSecondary, interestConfidence)
 *   - time fields (currentHour, isWeekend, timeOfDay, month, dayOfWeek, seasonalEvent)
 *   - commerce/catalog helpers (hasActiveCart, hasCompletedCheckout, purchaseCount)
 *     — sourced from ctx.history when available; gracefully absent otherwise
 */
export function buildContextEvalInput(ctx: RuleEvaluationContext): ContextEvalInput {
  const ctxAny        = ctx as unknown as Record<string, unknown>;
  const history       = (ctx.history ?? {}) as unknown as Record<string, unknown>;
  const enrichment    = (
    (ctx as unknown as { enrichment?: Record<string, unknown> }).enrichment ?? {}
  ) as Record<string, unknown>;
  const interestCtx   = (
    (ctx as unknown as { interestContext?: Record<string, unknown> }).interestContext ?? {}
  ) as Record<string, unknown>;
  const journey       = (history["journey"] ?? {}) as Record<string, unknown>;
  const journeyConf   = (journey["confidence"] ?? {}) as Record<string, unknown>;

  function prim(v: unknown): string | number | boolean | null | undefined {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
    return undefined;
  }

  return {
    // ── Request / session ───────────────────────────────────────────────────
    source:           prim(ctxAny["source"]),
    visitType:        prim(ctxAny["visitType"]),
    utmMedium:        prim(ctxAny["utmMedium"]),
    utmSource:        prim(ctxAny["utmSource"]),
    utmCampaign:      prim(ctxAny["utmCampaign"]),
    referrer:         prim(ctxAny["referrer"]),
    locale:           prim(ctxAny["locale"]),
    sessionCount:     prim(history["sessionCount"]),
    pageViewCount:    prim(history["pageViewCount"]),

    // ── Journey state ────────────────────────────────────────────────────────
    funnelStage:          prim(journey["funnelStage"]),
    intentScore:          prim(journey["intentScore"]),
    frictionScore:        prim(journey["frictionScore"]),
    hasVisitedPricing:    prim(journey["hasVisitedPricing"]),
    hasSubmittedForm:     prim(journey["hasSubmittedForm"]),
    formStartCount:       prim(journey["formStartCount"]),
    matchedSequenceCount: Array.isArray(journey["matchedSequences"])
      ? (journey["matchedSequences"] as unknown[]).length
      : prim(journey["matchedSequenceCount"]),

    // ── Confidence ───────────────────────────────────────────────────────────
    overallConfidence: prim(journeyConf["overallConfidence"]),

    // ── Enrichment ───────────────────────────────────────────────────────────
    companyName:          prim(enrichment["companyName"]),
    companySize:          prim(enrichment["companySize"]),
    crmLifecycleStage:    prim(enrichment["crmLifecycleStage"]),
    crmIsCustomer:        prim(enrichment["crmIsCustomer"]),
    targetAccountMatched: prim(enrichment["targetAccountMatched"]),
    countryCode:          prim(enrichment["countryCode"])
                          ?? prim(ctxAny["countryCode"]),
    isRaining:            prim(enrichment["isRaining"]),
    isCloudProvider:      prim(enrichment["isCloudProvider"]),

    // ── Interest profiles ────────────────────────────────────────────────────
    interestPrimary:    prim(interestCtx["interestPrimary"]),
    interestSecondary:  prim(interestCtx["interestSecondary"]),
    interestConfidence: prim(interestCtx["interestConfidence"]),

    // ── Time ─────────────────────────────────────────────────────────────────
    currentHour:    prim(ctxAny["currentHour"]),
    isWeekend:      prim(ctxAny["isWeekend"]),
    timeOfDay:      prim(ctxAny["timeOfDay"]),
    month:          prim(ctxAny["month"]),
    dayOfWeek:      prim(ctxAny["dayOfWeek"]),
    seasonalEvent:  prim(ctxAny["seasonalEvent"]),

    // ── Commerce / catalog helpers ────────────────────────────────────────────
    // These live in journey or history when the site model populates them.
    hasActiveCart:        prim(journey["hasActiveCart"]),
    hasCompletedCheckout: prim(journey["hasCompletedCheckout"]),
    purchaseCount:        prim(journey["purchaseCount"]),
  };
}

// ── Criterion evaluator ────────────────────────────────────────────────────────

function evaluateCriterion(
  criterion: ContextCriterion,
  input: ContextEvalInput,
): boolean {
  const { field, op } = criterion;
  const v = input[field];

  switch (op) {
    case "eq":
      return v === criterion.value;
    case "not_eq":
      return v !== criterion.value;
    case "in":
      return v !== undefined && v !== null && (criterion.value as ReadonlyArray<string | number>).includes(v as string | number);
    case "not_in":
      return v === undefined || v === null || !(criterion.value as ReadonlyArray<string | number>).includes(v as string | number);
    case "gte":
      return typeof v === "number" && v >= criterion.value;
    case "lte":
      return typeof v === "number" && v <= criterion.value;
    case "gt":
      return typeof v === "number" && v > criterion.value;
    case "lt":
      return typeof v === "number" && v < criterion.value;
    case "present":
      return v !== undefined && v !== null && v !== "";
    case "absent":
      return v === undefined || v === null || v === "";
    case "truthy":
      return !!v;
    case "falsy":
      return !v;
    default:
      return false;
  }
}

// ── Main matcher ───────────────────────────────────────────────────────────────

/**
 * Evaluate all active (non-draft) context definitions against the provided
 * RuleEvaluationContext.
 *
 * Returns matched definitions only — definitions where all required criteria pass.
 * Sorted by family order then definition order within each family.
 *
 * @param ctx      The fully-populated evaluation context.
 * @param options  Optional filter to restrict which definitions are evaluated.
 */
export function matchContextDefinitions(
  ctx: RuleEvaluationContext,
  options?: {
    /** Only evaluate definitions with these statuses. Defaults to ["active", "suggested"]. */
    statuses?: ReadonlyArray<"active" | "draft" | "suggested">;
    /** Only evaluate definitions in these families. Defaults to all families. */
    families?: ReadonlyArray<string>;
  },
): ContextMatch[] {
  const input     = buildContextEvalInput(ctx);
  const statuses  = options?.statuses ?? ["active", "suggested"];
  const families  = options?.families;

  const matches: ContextMatch[] = [];

  for (const def of CONTEXT_DEFINITIONS) {
    // Status gate — always skip drafts unless explicitly requested.
    if (!statuses.includes(def.status)) continue;

    // Family filter (optional).
    if (families && !families.includes(def.family)) continue;

    const criteriaResults: ContextCriterionResult[] = [];
    let requiredPassed = 0;
    let requiredTotal  = 0;
    let optionalPassed = 0;
    let optionalTotal  = 0;

    for (const criterion of def.criteria) {
      const optional = criterion.optional === true;
      const passed   = evaluateCriterion(criterion, input);

      criteriaResults.push({
        field:         criterion.field,
        op:            criterion.op,
        passed,
        optional,
        resolvedValue: input[criterion.field],
      });

      if (optional) {
        optionalTotal++;
        if (passed) optionalPassed++;
      } else {
        requiredTotal++;
        if (passed) requiredPassed++;
      }
    }

    // All required criteria must pass.
    if (requiredTotal > 0 && requiredPassed < requiredTotal) continue;

    // Confidence = (required passed + optional passed) / (required total + optional total)
    // When there are no criteria (edge case), confidence = 1.
    const totalCriteria = requiredTotal + optionalTotal;
    const totalPassed   = requiredPassed + optionalPassed;
    const confidence    = totalCriteria === 0 ? 1 : totalPassed / totalCriteria;

    matches.push({ definition: def, confidence, criteriaResults });
  }

  return matches;
}
