/**
 * Variant Hierarchy Types
 *
 * Defines the 3-layer adaptive content fallback model:
 *
 *   Layer A — Personalized  (exact rule match + confidence gate)
 *   Layer B — Segmented     (broad funnelStage / interest / visitor type match)
 *   Layer C — Default       (always available; safe fallback)
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   1. Try all Personalized variants in priority order.
 *      → Accept the first whose rule fires AND confidence threshold is met.
 *   2. If none accepted, try Segmented variants.
 *      → Accept the first whose segment matches the current visitor.
 *   3. If none accepted, use the Default variant (always present, always wins).
 *
 * ─── Confidence gating ────────────────────────────────────────────────────────
 *
 *   Personalized variants are gated by confidence.  If the engine is not
 *   confident enough in the rule match, it falls back to the segmented layer
 *   to avoid a high-friction experience based on weak signals.
 *
 *   Default threshold: 0.35 (ConfidenceBand "medium").
 *   Per-variant override via `minConfidence`.
 *
 * ─── Integration ──────────────────────────────────────────────────────────────
 *
 *   This model extends the existing rule engine — it does not replace it.
 *   Blocks that want fine-grained fallback control define `variants` in their
 *   block data.  The `resolveBlockVariant()` function evaluates the spec at
 *   request time and returns the winning variant key + resolution trace.
 */

import type { JourneyFunnelStage, BehaviorConfidence } from "@/lib/journey/types";

// ── Segment definition ────────────────────────────────────────────────────────

/** A visitor segment for Layer B matching. */
export interface VariantSegment {
  /** Funnel stage to match, e.g. "intent". Null = any stage. */
  funnelStage?:   JourneyFunnelStage | null;
  /** Visitor type to match: "new", "returning", "any". */
  visitorType?:   "new" | "returning" | "any";
  /** Interest category to match, e.g. "sustainability". Null = any. */
  interest?:      string | null;
}

// ── Layer A — Personalized variant ────────────────────────────────────────────

export interface PersonalizedVariant<TKey extends string = string> {
  type:            "personalized";
  /** Variant key to use when this layer wins. */
  variantKey:      TKey;
  /** Priority within the personalized layer (lower = evaluated first). */
  priority?:       number;
  /** The rule ID (from StoredRule.id) that must fire for this variant. */
  ruleId:          string;
  /**
   * Minimum overall confidence required for this variant to be selected.
   * Defaults to 0.35 (medium band threshold).
   * Use 0 to disable confidence gating for this variant.
   */
  minConfidence?:  number;
  /** Human-readable label for debug output. */
  label?:          string;
}

// ── Layer B — Segmented variant ───────────────────────────────────────────────

export interface SegmentedVariant<TKey extends string = string> {
  type:            "segmented";
  variantKey:      TKey;
  priority?:       number;
  /** Segment criteria — all specified fields must match. */
  segment:         VariantSegment;
  label?:          string;
}

// ── Layer C — Default variant ─────────────────────────────────────────────────

export interface DefaultVariant<TKey extends string = string> {
  type:            "default";
  variantKey:      TKey;
  label?:          string;
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type BlockVariant<TKey extends string = string> =
  | PersonalizedVariant<TKey>
  | SegmentedVariant<TKey>
  | DefaultVariant<TKey>;

// ── Resolution result ─────────────────────────────────────────────────────────

/** Which layer won. */
export type ResolutionLayer = "personalized" | "segmented" | "default";

/** Why a variant was skipped during resolution. */
export interface SkipReason {
  variantKey:  string;
  type:        ResolutionLayer;
  reason:      string;
}

/** Full resolution trace — useful for debug and analytics. */
export interface VariantResolutionTrace {
  /** The winning variant key. */
  winner:      string;
  /** Which layer produced the winner. */
  layer:       ResolutionLayer;
  /** The rule ID that fired (personalized layer only). */
  ruleId?:     string;
  /** The segment matched (segmented layer only). */
  segment?:    VariantSegment;
  /** Why each skipped variant was not chosen. */
  skipped:     SkipReason[];
  /** Overall confidence at time of resolution (0–1). */
  confidence:  number;
}

// ── Evaluation context ────────────────────────────────────────────────────────

/** Input to the block variant resolver. */
export interface BlockVariantContext {
  /** IDs of rules that fired for this request. */
  firedRuleIds:    Set<string>;
  /** Current behavioral confidence. */
  confidence:      BehaviorConfidence;
  /** Current funnel stage. */
  funnelStage:     JourneyFunnelStage;
  /** Visitor type. */
  visitorType:     "new" | "returning" | "unknown";
  /** Interest categories the visitor has signaled. */
  interests:       string[];
}
