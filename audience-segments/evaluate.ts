/**
 * Audience Segment Evaluator
 *
 * Runtime evaluation of audience segments against the current DecisionContext.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   1. Load active audience segments for the tenant from the DB.
 *   2. For each segment, evaluate its criteria tree against the DecisionContext
 *      using evaluateCondition() — the same evaluator used by the rules engine.
 *   3. Return the keys of all matching segments as a comma-joined string
 *      (or null when no segments match).
 *
 * ─── Integration point ────────────────────────────────────────────────────────
 *
 *   Call evaluateAudienceSegments() AFTER buildDecisionContext() has been run
 *   (so interest scores, journey state, enrichment etc. are all available):
 *
 *     const ctx        = buildDecisionContext({ ... });
 *     const segmentIds = await evaluateAudienceSegments(ctx, tenantId);
 *     const finalCtx   = applyAudienceSegments(ctx, segmentIds);
 *
 *   applyAudienceSegments() is a thin helper exported from decision-context.ts.
 *
 * ─── Performance notes ────────────────────────────────────────────────────────
 *
 *   Active segments are fetched with a single indexed query.
 *   evaluateCondition() is a synchronous in-memory tree walk — no I/O.
 *   The entire evaluation is typically < 1 ms for < 50 segments.
 *
 * ─── Error handling ───────────────────────────────────────────────────────────
 *
 *   Never throws.  DB errors or malformed criteria produce an empty match list.
 *   evaluateCondition() catches its own errors internally.
 */

import "server-only";

import { listActiveAudienceSegments } from "./repository";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { evaluateCondition }          from "@/decision/rules/stored-rule";
import type { RuleCondition }         from "@/decision/rules/stored-rule";

/**
 * Evaluate all active audience segments for the tenant against the given context.
 *
 * @param ctx      Fully assembled DecisionContext (post-enrichment, post-interest).
 * @param tenantId Tenant to load segments for.
 * @returns        Comma-joined keys of matching segments, or null if none match.
 *                 Empty string is never returned — null is used for "no match".
 */
export async function evaluateAudienceSegments(
  ctx:      RuleEvaluationContext,
  tenantId: string,
): Promise<string | null> {
  if (!tenantId) return null;

  try {
    const result = await listActiveAudienceSegments(tenantId);
    if (!result.ok || result.data.length === 0) return null;

    const matched: string[] = [];

    for (const segment of result.data) {
      // Skip segments with empty or missing criteria — they would match everything.
      if (!segment.criteria || Object.keys(segment.criteria).length === 0) continue;

      try {
        const matches = evaluateCondition(
          segment.criteria as unknown as RuleCondition,
          ctx,
        );
        if (matches) {
          matched.push(segment.key);
        }
      } catch {
        // Individual segment evaluation failure — skip this segment.
        // evaluateCondition handles most errors internally; this is a safety net.
      }
    }

    return matched.length > 0 ? matched.join(",") : null;
  } catch {
    // DB error or unexpected failure — return null (no segments).
    return null;
  }
}
