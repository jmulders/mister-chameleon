/**
 * Block Variant Resolver
 *
 * Implements the 3-layer fallback hierarchy for adaptive block variants.
 *
 * ─── Resolution algorithm ─────────────────────────────────────────────────────
 *
 *   Input: variants[] (sorted by priority within each type), context
 *
 *   Step 1 — Personalized layer:
 *     For each PersonalizedVariant (ascending priority):
 *       • Check if variant.ruleId is in context.firedRuleIds.
 *       • Check if context.confidence.overallConfidence ≥ minConfidence.
 *       • If both pass → return this variant as winner.
 *       • Else → record skip reason.
 *
 *   Step 2 — Segmented layer:
 *     For each SegmentedVariant (ascending priority):
 *       • Check if context matches segment criteria (AND logic).
 *       • If all match → return this variant as winner.
 *       • Else → record skip reason.
 *
 *   Step 3 — Default:
 *     Return the DefaultVariant.  There MUST always be exactly one.
 *     If missing, a guard throws to prevent a silent null return.
 *
 * ─── Invariants ────────────────────────────────────────────────────────────────
 *
 *   • Exactly ONE variant is always returned.
 *   • The default variant must be present — validateBlockVariants() enforces this.
 *   • A missing default is a programming error (throws, not silently degrades).
 *   • Confidence gating only applies to the personalized layer.
 *
 * ─── Pure function — no I/O ───────────────────────────────────────────────────
 *
 *   Safe to call in both server and client contexts.
 */

import type {
  BlockVariant,
  BlockVariantContext,
  PersonalizedVariant,
  SegmentedVariant,
  DefaultVariant,
  VariantResolutionTrace,
  SkipReason,
  VariantSegment,
} from "./variant-hierarchy-types";

// ── Default confidence threshold ──────────────────────────────────────────────

/** Minimum overall confidence for personalized variants (unless overridden). */
export const DEFAULT_MIN_CONFIDENCE = 0.35;

// ── Core resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve the winning block variant from a list of candidates.
 *
 * @param variants  All variant specs for a block (must include ≥1 DefaultVariant).
 * @param context   Runtime evaluation context.
 * @returns         { variantKey, trace } — always returns a variant.
 * @throws          If no DefaultVariant is present (programming error).
 */
export function resolveBlockVariant<TKey extends string>(
  variants: BlockVariant<TKey>[],
  context:  BlockVariantContext,
): { variantKey: TKey; trace: VariantResolutionTrace } {

  const confidence = context.confidence.overallConfidence;
  const skipped:   SkipReason[] = [];

  // ── Layer A: Personalized ──────────────────────────────────────────────────

  const personalized = variants
    .filter((v): v is PersonalizedVariant<TKey> => v.type === "personalized")
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const v of personalized) {
    const ruleFired     = context.firedRuleIds.has(v.ruleId);
    const minConf       = v.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const confMet       = confidence >= minConf;

    if (ruleFired && confMet) {
      return {
        variantKey: v.variantKey,
        trace: {
          winner:     v.variantKey,
          layer:      "personalized",
          ruleId:     v.ruleId,
          skipped,
          confidence,
        },
      };
    }

    if (!ruleFired) {
      skipped.push({
        variantKey: v.variantKey,
        type:       "personalized",
        reason:     `Rule '${v.ruleId}' did not fire.`,
      });
    } else {
      skipped.push({
        variantKey: v.variantKey,
        type:       "personalized",
        reason:     `Confidence ${(confidence * 100).toFixed(0)}% < minimum ${(minConf * 100).toFixed(0)}% — falling back to segmented.`,
      });
    }
  }

  // ── Layer B: Segmented ────────────────────────────────────────────────────

  const segmented = variants
    .filter((v): v is SegmentedVariant<TKey> => v.type === "segmented")
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const v of segmented) {
    const { matched, failReason } = matchSegment(v.segment, context);

    if (matched) {
      return {
        variantKey: v.variantKey,
        trace: {
          winner:     v.variantKey,
          layer:      "segmented",
          segment:    v.segment,
          skipped,
          confidence,
        },
      };
    }

    skipped.push({
      variantKey: v.variantKey,
      type:       "segmented",
      reason:     failReason,
    });
  }

  // ── Layer C: Default ──────────────────────────────────────────────────────

  const defaultVariant = variants.find((v): v is DefaultVariant<TKey> => v.type === "default");

  if (!defaultVariant) {
    throw new Error(
      "[resolveBlockVariant] No DefaultVariant found in variants array. " +
      "Every adaptive block MUST include exactly one { type: 'default' } variant."
    );
  }

  return {
    variantKey: defaultVariant.variantKey,
    trace: {
      winner:     defaultVariant.variantKey,
      layer:      "default",
      skipped,
      confidence,
    },
  };
}

// ── Segment matching ──────────────────────────────────────────────────────────

/**
 * Check whether a visitor context matches a segment descriptor.
 * All specified criteria must pass (AND logic).
 */
function matchSegment(
  segment: VariantSegment,
  context: BlockVariantContext,
): { matched: boolean; failReason: string } {

  // funnelStage match
  if (segment.funnelStage != null && segment.funnelStage !== context.funnelStage) {
    return {
      matched:    false,
      failReason: `funnelStage '${context.funnelStage}' ≠ required '${segment.funnelStage}'.`,
    };
  }

  // visitorType match
  if (segment.visitorType && segment.visitorType !== "any") {
    const vt = context.visitorType;
    if (segment.visitorType === "new" && vt !== "new") {
      return { matched: false, failReason: `visitorType is '${vt}', expected 'new'.` };
    }
    if (segment.visitorType === "returning" && vt !== "returning") {
      return { matched: false, failReason: `visitorType is '${vt}', expected 'returning'.` };
    }
  }

  // interest match
  if (segment.interest != null) {
    if (!context.interests.includes(segment.interest)) {
      return {
        matched:    false,
        failReason: `Interest '${segment.interest}' not in visitor interests [${context.interests.join(", ")}].`,
      };
    }
  }

  return { matched: true, failReason: "" };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface VariantValidationError {
  index:   number;
  message: string;
}

/**
 * Validate a variants array before runtime use.
 *
 * Checks:
 *   • Exactly one DefaultVariant exists.
 *   • No empty variantKey.
 *   • PersonalizedVariants have a non-empty ruleId.
 *   • SegmentedVariants have a non-empty segment object.
 *
 * Returns [] if valid, or an array of errors.
 */
export function validateBlockVariants<TKey extends string>(
  variants: BlockVariant<TKey>[],
): VariantValidationError[] {
  const errors: VariantValidationError[] = [];

  const defaultCount = variants.filter((v) => v.type === "default").length;
  if (defaultCount === 0) {
    errors.push({ index: -1, message: "No DefaultVariant found. Every block MUST include one." });
  }
  if (defaultCount > 1) {
    errors.push({ index: -1, message: `${defaultCount} DefaultVariants found. Only one is allowed.` });
  }

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];

    if (!v.variantKey) {
      errors.push({ index: i, message: "variantKey is empty." });
    }

    if (v.type === "personalized" && !v.ruleId) {
      errors.push({ index: i, message: "PersonalizedVariant missing ruleId." });
    }

    if (v.type === "segmented") {
      const seg = v.segment;
      if (!seg || typeof seg !== "object") {
        errors.push({ index: i, message: "SegmentedVariant missing segment object." });
      }
    }
  }

  return errors;
}

// ── Context builder ───────────────────────────────────────────────────────────

/**
 * Build a BlockVariantContext from a matched rule ID and journey state.
 * Convenience function used in server-side request handlers.
 */
export function buildVariantContext(
  firedRuleId:      string | null | undefined,
  journey: {
    confidence:   { overallConfidence: number; intentConfidence: number; sequenceConfidence: number; funnelStageConfidence: number; band: string; reasons: string[] };
    funnelStage:  string;
    viewedCategories: string[];
  },
  visitType:        "new" | "returning" | "unknown" = "unknown",
): BlockVariantContext {
  const firedIds = new Set<string>();
  if (firedRuleId) firedIds.add(firedRuleId);

  return {
    firedRuleIds: firedIds,
    confidence:   journey.confidence as never,
    funnelStage:  journey.funnelStage as never,
    visitorType:  visitType,
    interests:    journey.viewedCategories ?? [],
  };
}
