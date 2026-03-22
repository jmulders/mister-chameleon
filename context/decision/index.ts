/**
 * Decision Context
 *
 * The decision engine is the core of Mister Chameleon's adaptivity.
 * It takes a resolved VisitorContext and outputs an experience variant key.
 *
 * Architecture:
 *  - VisitorContext  — canonical signal set, defined in context/types.ts
 *  - DecisionRule    — a predicate that matches signals to an experience key
 *  - DecisionResult  — the engine's output, consumed by the experience layer
 *
 * TODO: Implement rule evaluation, priority ordering, and fallback logic.
 */

// Re-export the canonical VisitorContext from the types module so that
// consumers can import from either location without breaking the graph.
export type { VisitorContext, TrafficSource, DeviceType, VisitType } from "../types";

/** The output of a successful decision — references an experience by key. */
export interface DecisionResult {
  /** Identifies the CMS experience document to render */
  experienceKey: string;
  /** ID of the rule that produced this result, null for fallback */
  matchedRuleId: string | null;
  /** True when no rule matched and the default experience is used */
  isFallback: boolean;
}

/**
 * A single rule in the decision engine.
 * Rules are evaluated in ascending priority order (lower number = higher priority).
 *
 * TODO: Implement rule evaluation logic.
 */
export interface DecisionRule {
  id: string;
  priority: number;
  /** Human-readable label for the rule (shown in debug panel) */
  label: string;
  experienceKey: string;
}

export const FALLBACK_EXPERIENCE_KEY = "default" as const;
