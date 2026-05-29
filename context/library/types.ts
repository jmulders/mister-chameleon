/**
 * Context Library — Type Definitions
 *
 * context/library/types.ts
 *
 * Defines the type layer for the Context Library: a catalog of named,
 * reusable audience profiles that sit ABOVE individual context variables.
 *
 * ─── Relationship to context/registry.ts ──────────────────────────────────────
 *
 *   context/registry.ts   — individual *signals* (visitType, funnelStage, …)
 *   context/library/      — named *audience profiles* composed of those signals
 *
 *   A ContextDefinition is not a rule — it cannot trigger a personalisation.
 *   It is a readable label ("High-Intent SaaS Evaluator") with a set of
 *   criteria that are evaluated at debug time to tell operators which audience
 *   profiles the current visitor matches.
 *
 * ─── Matching ─────────────────────────────────────────────────────────────────
 *
 *   matchContextDefinitions(ctx: RuleEvaluationContext) evaluates every
 *   ContextDefinition against a flat eval input built from ctx and returns
 *   an array of ContextMatch objects (matched definitions + per-criterion
 *   results).
 *
 *   Matching is purely additive — all matched definitions are returned.
 *   Definitions with overlapping criteria can and will both match.
 *
 * ─── Status ───────────────────────────────────────────────────────────────────
 *
 *   active    — high-confidence, broad signal definitions shown by default
 *               in the debug panel and admin library
 *   draft     — work-in-progress; hidden from debug panel, visible in admin
 *   suggested — domain-specific or low-coverage definitions (careers, commerce,
 *               real-estate) that are opt-in for operators
 */

// ── Taxonomy ───────────────────────────────────────────────────────────────────

/** The 12 top-level audience families. */
export type ContextFamilyKey =
  | "acquisition"
  | "intent"
  | "lifecycle"
  | "account"
  | "behavior"
  | "confidence"
  | "temporal"
  | "geo"
  | "content"
  | "careers"
  | "commerce"
  | "realestate";

/** Display metadata for a family. */
export interface ContextFamily {
  key:         ContextFamilyKey;
  label:       string;
  description: string;
  /** Tailwind-safe color class for the badge, e.g. "bg-blue-100 text-blue-700". */
  color:       string;
}

// ── Site model scope ───────────────────────────────────────────────────────────

/**
 * Which site models a context definition is relevant to.
 * Mirrors SiteModelKey from blueprints/site-models/types.ts.
 */
export type ContextSiteModel =
  | "service"
  | "product-saas"
  | "careers"
  | "catalog"
  | "commerce"
  | "all";

// ── Status ─────────────────────────────────────────────────────────────────────

export type ContextDefinitionStatus = "active" | "draft" | "suggested";

// ── Criteria ───────────────────────────────────────────────────────────────────

/**
 * A single matching criterion for a ContextDefinition.
 *
 * Each criterion tests one flat key from the ContextEvalInput against a
 * typed comparator.  All criteria in a definition use AND logic (all must
 * pass for the definition to match).
 *
 * Use `optional: true` to mark criteria that contribute to confidence scoring
 * but are not required for the overall match.
 */
export type ContextCriterion =
  | { field: string; op: "eq";        value: string | number | boolean; optional?: boolean }
  | { field: string; op: "not_eq";    value: string | number | boolean; optional?: boolean }
  | { field: string; op: "in";        value: ReadonlyArray<string | number>; optional?: boolean }
  | { field: string; op: "not_in";    value: ReadonlyArray<string | number>; optional?: boolean }
  | { field: string; op: "gte";       value: number; optional?: boolean }
  | { field: string; op: "lte";       value: number; optional?: boolean }
  | { field: string; op: "gt";        value: number; optional?: boolean }
  | { field: string; op: "lt";        value: number; optional?: boolean }
  | { field: string; op: "present";   optional?: boolean }
  | { field: string; op: "absent";    optional?: boolean }
  | { field: string; op: "truthy";    optional?: boolean }
  | { field: string; op: "falsy";     optional?: boolean };

// ── Definition ─────────────────────────────────────────────────────────────────

/** A named, reusable audience profile. */
export interface ContextDefinition {
  /** Stable kebab-case identifier, unique within the library. */
  id:          string;
  /** Human-readable name shown in the admin UI and debug panel. */
  label:       string;
  /** One-sentence description of who this audience is. */
  description: string;
  /** Parent family. */
  family:      ContextFamilyKey;
  /** Site models where this definition is meaningful. */
  siteModels:  ReadonlyArray<ContextSiteModel>;
  /** Lifecycle status. */
  status:      ContextDefinitionStatus;
  /**
   * Required criteria — ALL must pass for the definition to match.
   * Optional criteria (optional: true) are evaluated for confidence scoring
   * but do not gate the match.
   */
  criteria:    ReadonlyArray<ContextCriterion>;
  /**
   * Short human-readable explanation of why this context was matched,
   * shown in the debug panel.  May reference criterion values.
   *
   * Example: "Visitor arrived via paid search with high intent score."
   */
  matchReason: string;
  /**
   * A note visible in the admin library describing when to use this
   * definition in rules (editorial guidance, not machine-readable).
   */
  usageNote?:  string;
}

// ── Matching output ────────────────────────────────────────────────────────────

/** Per-criterion evaluation result. */
export interface ContextCriterionResult {
  field:   string;
  op:      ContextCriterion["op"];
  passed:  boolean;
  optional: boolean;
  /** The resolved value from the eval input at match time. */
  resolvedValue: unknown;
}

/** A matched context definition with per-criterion detail. */
export interface ContextMatch {
  definition:  ContextDefinition;
  /** Ratio of passed required criteria / total required criteria (0–1). */
  confidence:  number;
  criteriaResults: ContextCriterionResult[];
}

// ── Flat eval input ────────────────────────────────────────────────────────────

/**
 * Flat record built from RuleEvaluationContext used by the matcher.
 *
 * All values are primitives (string | number | boolean | null | undefined).
 * The key space is deliberately wider than the criterion field names —
 * unknown keys just resolve to undefined (no match on "present"/"truthy").
 */
export type ContextEvalInput = Record<string, string | number | boolean | null | undefined>;
