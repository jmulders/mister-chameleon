/**
 * Stored Rule Types
 *
 * JSON-serialisable representation of a homepage decision rule.
 * Used by the internal rules editor to persist and load rule configurations
 * without editing TypeScript source directly.
 *
 * ─── Relationship to HomepageRule ─────────────────────────────────────────────
 *
 *   HomepageRule (runtime)      — contains a `match` function; used by the
 *                                  RulesDecisionProvider at request time.
 *
 *   StoredRule (serialisable)   — contains a `condition` descriptor; used by
 *                                  the rules editor, written to runtime-rules.json.
 *
 *   compileStoredRule()         — converts StoredRule → HomepageRule by
 *                                  wrapping the condition descriptor in a
 *                                  evaluateCondition() call.
 *
 * ─── Condition model ──────────────────────────────────────────────────────────
 *
 *   Three condition kinds are supported:
 *
 *   1. FieldCondition  — evaluates a single field against a value using an
 *                         operator. Field metadata (kind, valid operators,
 *                         allowed values) lives in field-registry.ts.
 *                         e.g. { type: "field", field: "source",
 *                                operator: "equals", value: "google" }
 *                         Legacy shape without `operator` defaults to "equals"
 *                         for backwards compatibility.
 *
 *   2. NamedCondition  — a named compound predicate with a fixed implementation.
 *                         e.g. { type: "named", name: "returning_cta_clicked" }
 *                         Named conditions exist for predicates that reference
 *                         ctx.history.* in ways that cannot be expressed as a
 *                         single field check without a full DSL.
 *
 *   3. GroupCondition  — a logical group combining child conditions with AND or
 *                         OR.  Groups may be nested; the tree stays
 *                         JSON-serialisable because it contains only plain data.
 *                         e.g. { type: "group", logic: "and", conditions: [...] }
 *
 * ─── JSON-safety guarantee ────────────────────────────────────────────────────
 *
 *   The condition tree is a plain data structure — no functions, no class
 *   instances, no symbols.  It serialises to JSON and back without loss.
 *   compileStoredRule() is the only place where descriptors become predicates,
 *   and it only ever produces pure `(input: DecisionInput) => boolean` closures
 *   that delegate to evaluateCondition().
 *   Arbitrary code execution via the editor is structurally impossible.
 *
 * ─── Runtime evaluation ────────────────────────────────────────────────────────
 *
 *   evaluateCondition(condition, ctx) is the canonical runtime interpreter for
 *   condition trees.  It provides:
 *
 *   - Recursive group evaluation with correct AND / OR short-circuiting.
 *   - Per-leaf error containment: if a field resolver throws (e.g. bad data),
 *     that single leaf returns false and logs a warning — sibling OR branches
 *     are still evaluated, and no exception propagates to the caller.
 *   - Safe unknown-field handling in case a stored rule slips past validation.
 */

import type { DecisionInput, HeroVariantKey, ProofVariantKey, CTAVariantKey } from "../types";
import type { HomepageRule } from "./homepage-rules";
import {
  FIELD_REGISTRY,
  FIELD_OPERATORS,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
  STRING_ONLY_OPERATORS,
  ALL_FIELD_KEYS,
} from "./field-registry";
import type {
  RuleFieldKey,
  FieldOperator,
  RuleEvaluationContext,
  FieldRuntimeValue,
} from "./field-registry";
import { logger } from "@/lib/logger";

// ── Re-exports for consumers that import from stored-rule ──────────────────────
// These re-exports preserve backwards-compatibility for importers that
// previously pulled FieldOperator / FIELD_OPERATORS from this module.

export type {
  RuleFieldKey,
  FieldOperator,
  RuleEvaluationContext,
  FieldGroup,
  FieldKind,
} from "./field-registry";

export {
  FIELD_OPERATORS,
  FIELD_REGISTRY,
  FIELD_KEYS_BY_GROUP,
  ALL_FIELD_KEYS,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
  STRING_ONLY_OPERATORS,
  getFieldDefinition,
} from "./field-registry";

// ── Condition field vocabulary ─────────────────────────────────────────────────

/**
 * The set of VisitorContext / VisitorHistory / page-context fields that a
 * FieldCondition can reference.  Alias for RuleFieldKey; exported as
 * ConditionField for backwards compatibility with existing consumers.
 *
 * The full metadata for each field (label, kind, valid operators, allowed
 * values, runtime resolver) lives in FIELD_REGISTRY (field-registry.ts).
 */
export type ConditionField = RuleFieldKey;

// ── Named conditions ───────────────────────────────────────────────────────────

/**
 * Named compound predicates that cannot be expressed as simple field checks.
 * Each name maps to a fixed, hardcoded match function in evaluateCondition().
 */
export const NAMED_CONDITIONS = {
  returning_cta_clicked: {
    label:       "Returning visitor — CTA previously clicked",
    description: "Fires when the visitor's DB history shows hasClickedCta = true. Requires history to be loaded from the database.",
  },
  high_engagement: {
    label:       "High-engagement visitor (3+ page views)",
    description: "Fires when the visitor's DB history shows pageViewCount ≥ 3. Requires history to be loaded from the database.",
  },
} as const satisfies Record<string, { label: string; description: string }>;

export type NamedConditionId = keyof typeof NAMED_CONDITIONS;

// ── Condition types ────────────────────────────────────────────────────────────

/**
 * The value type for a FieldCondition.
 * Exact requirements depend on the operator:
 *   exists / not_exists              → value must be omitted
 *   in / not_in                      → non-empty array of strings or numbers
 *   gt / gte / lt / lte              → number
 *   contains / not_contains          → string
 *   equals / not_equals              → type must match the field's kind
 */
export type FieldConditionValue = string | number | boolean | readonly (string | number)[];

/**
 * A condition that evaluates a single field against a value using an operator.
 *
 * `operator` is optional for backwards compatibility with the pre-R1 MVP shape
 * `{ type: "field", field, value }` where equality was the only operator.
 * A missing `operator` is treated as `"equals"` by both the compiler and the
 * validation helper.
 */
export interface FieldCondition {
  type:  "field";
  field: ConditionField;

  /**
   * Comparison operator.
   * @default "equals"
   * Omit to remain compatible with pre-R1 stored rules.
   */
  operator?: FieldOperator;

  /**
   * The value to compare against.
   * Must be omitted (or undefined) for "exists" / "not_exists".
   * Must be an array for "in" / "not_in".
   * Must be a number for ordering operators.
   * Must be a string for "contains" / "not_contains".
   */
  value?: FieldConditionValue;
}

/** A named compound predicate with a fixed hardcoded implementation. */
export interface NamedCondition {
  type: "named";
  name: NamedConditionId;
}

/**
 * A logical group of conditions combined with AND or OR.
 *
 * Groups may be nested (validation caps depth at 5).
 * The tree is JSON-serialisable because it contains only plain data.
 *
 * Examples:
 *   // Returning visitor from Google
 *   { type: "group", logic: "and", conditions: [
 *       { type: "field", field: "visitType", operator: "equals", value: "returning" },
 *       { type: "field", field: "source",    operator: "equals", value: "google"    },
 *   ]}
 *
 *   // Google or LinkedIn
 *   { type: "group", logic: "or", conditions: [
 *       { type: "field", field: "source", operator: "equals", value: "google"   },
 *       { type: "field", field: "source", operator: "equals", value: "linkedin" },
 *   ]}
 */
export interface GroupCondition {
  type:       "group";
  logic:      "and" | "or";
  /** Must contain at least one child condition. */
  conditions: readonly RuleCondition[];
}

/** Any condition that can appear in a StoredRule or as a GroupCondition child. */
export type RuleCondition = FieldCondition | NamedCondition | GroupCondition;

// ── Stored plan ────────────────────────────────────────────────────────────────

/** The variant key triple stored inside a rule or the default plan. */
export interface StoredPlan {
  heroKey:  HeroVariantKey;
  proofKey: ProofVariantKey;
  ctaKey:   CTAVariantKey;
}

// ── Stored rule ────────────────────────────────────────────────────────────────

/**
 * A JSON-serialisable decision rule.
 * Mirrors HomepageRule but replaces the `match` function with a `condition`
 * descriptor that can be stored, validated, and edited without executing code.
 */
export interface StoredRule {
  /** Stable ID — safe to reference in analytics events. */
  id: string;

  /**
   * Evaluation precedence (lower = higher priority).
   * Rules with lower priority numbers are evaluated first.
   */
  priority: number;

  /** Human-readable label shown in the rules editor and debug panel. */
  label: string;

  /** Declarative condition that replaces the `match` function. */
  condition: RuleCondition;

  /** Variant keys to apply when this rule fires. */
  plan: StoredPlan;

  /** Explanation shown in debug output and analytics. */
  reason: string;
}

// ── Default plan ───────────────────────────────────────────────────────────────

/** The fallback plan applied when no rule matches. */
export interface StoredDefaultPlan extends StoredPlan {
  reason: string;
}

// ── Rules config ───────────────────────────────────────────────────────────────

/**
 * The complete serialisable rules configuration written to runtime-rules.json.
 * `schemaVersion` is intentionally literal so readers can handle migrations.
 */
export interface StoredRulesConfig {
  schemaVersion: 1;
  updatedAt:     string;
  rules:         StoredRule[];
  defaultPlan:   StoredDefaultPlan;
}

// ── Allowed variant key sets ───────────────────────────────────────────────────

export const ALLOWED_HERO_KEYS: readonly HeroVariantKey[] = [
  "hero_google_problem",
  "hero_linkedin_vision",
  "hero_direct_brand",
] as const;

export const ALLOWED_PROOF_KEYS: readonly ProofVariantKey[] = [
  "proof_cases",
  "proof_vision",
  "proof_platform",
] as const;

export const ALLOWED_CTA_KEYS: readonly CTAVariantKey[] = [
  "cta_guide",
  "cta_platform",
  "cta_meeting",
] as const;

// ── Validation ─────────────────────────────────────────────────────────────────

export interface ValidationError {
  ruleId?: string;
  field:   string;
  message: string;
}

/**
 * Validate a StoredRulesConfig against the field registry and allowed key
 * vocabulary.  Returns an array of errors; empty array = valid.
 *
 * Deliberately strict — rejects any value not in the explicit allow-lists
 * to prevent injection of unexpected content via the editor API.
 * Condition trees are validated recursively with a depth cap of 5.
 */
export function validateStoredConfig(config: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!config || typeof config !== "object") {
    return [{ field: "root", message: "Config must be an object." }];
  }

  const c = config as Record<string, unknown>;

  // Schema version
  if (c.schemaVersion !== 1) {
    errors.push({ field: "schemaVersion", message: "schemaVersion must be 1." });
  }

  // Default plan
  const dp = c.defaultPlan as Record<string, unknown> | undefined;
  if (!dp) {
    errors.push({ field: "defaultPlan", message: "defaultPlan is required." });
  } else {
    validatePlan(dp, "defaultPlan", undefined, errors);
    if (typeof dp.reason !== "string" || dp.reason.trim() === "") {
      errors.push({ field: "defaultPlan.reason", message: "reason must be a non-empty string." });
    }
  }

  // Rules array
  if (!Array.isArray(c.rules)) {
    errors.push({ field: "rules", message: "rules must be an array." });
    return errors;
  }

  const rules    = c.rules as unknown[];
  const seenIds   = new Set<string>();
  const seenPrios = new Set<number>();

  for (let i = 0; i < rules.length; i++) {
    const r   = rules[i] as Record<string, unknown>;
    const idx = `rules[${i}]`;

    // id
    if (typeof r.id !== "string" || r.id.trim() === "") {
      errors.push({ field: `${idx}.id`, message: "id must be a non-empty string." });
    } else if (seenIds.has(r.id)) {
      errors.push({ ruleId: r.id as string, field: `${idx}.id`, message: `Duplicate rule id "${r.id}".` });
    } else {
      seenIds.add(r.id as string);
    }

    // priority
    if (typeof r.priority !== "number" || !Number.isInteger(r.priority) || r.priority < 0) {
      errors.push({ ruleId: r.id as string, field: `${idx}.priority`, message: "priority must be a non-negative integer." });
    } else if (seenPrios.has(r.priority)) {
      errors.push({ ruleId: r.id as string, field: `${idx}.priority`, message: `Duplicate priority ${r.priority}.` });
    } else {
      seenPrios.add(r.priority as number);
    }

    // label
    if (typeof r.label !== "string" || r.label.trim() === "") {
      errors.push({ ruleId: r.id as string, field: `${idx}.label`, message: "label must be a non-empty string." });
    }

    // reason
    if (typeof r.reason !== "string" || r.reason.trim() === "") {
      errors.push({ ruleId: r.id as string, field: `${idx}.reason`, message: "reason must be a non-empty string." });
    }

    // condition
    validateCondition(r.condition, idx, r.id as string | undefined, errors, 0);

    // plan
    validatePlan(r.plan as Record<string, unknown>, idx, r.id as string | undefined, errors);
  }

  return errors;
}

function validatePlan(
  plan:   Record<string, unknown> | undefined,
  idx:    string,
  ruleId: string | undefined,
  errors: ValidationError[],
): void {
  if (!plan || typeof plan !== "object") {
    errors.push({ ruleId, field: `${idx}.plan`, message: "plan is required." });
    return;
  }

  if (!ALLOWED_HERO_KEYS.includes(plan.heroKey as HeroVariantKey)) {
    errors.push({ ruleId, field: `${idx}.plan.heroKey`, message: `Invalid heroKey "${plan.heroKey}". Allowed: ${ALLOWED_HERO_KEYS.join(", ")}` });
  }
  if (!ALLOWED_PROOF_KEYS.includes(plan.proofKey as ProofVariantKey)) {
    errors.push({ ruleId, field: `${idx}.plan.proofKey`, message: `Invalid proofKey "${plan.proofKey}". Allowed: ${ALLOWED_PROOF_KEYS.join(", ")}` });
  }
  if (!ALLOWED_CTA_KEYS.includes(plan.ctaKey as CTAVariantKey)) {
    errors.push({ ruleId, field: `${idx}.plan.ctaKey`, message: `Invalid ctaKey "${plan.ctaKey}". Allowed: ${ALLOWED_CTA_KEYS.join(", ")}` });
  }
}

/** Maximum nesting depth for GroupCondition trees. */
const MAX_CONDITION_DEPTH = 5;

function validateCondition(
  condition: unknown,
  idx:       string,
  ruleId:    string | undefined,
  errors:    ValidationError[],
  depth:     number,
): void {
  if (!condition || typeof condition !== "object") {
    errors.push({ ruleId, field: `${idx}.condition`, message: "condition is required." });
    return;
  }

  const c = condition as Record<string, unknown>;

  if (c.type === "field") {
    validateFieldCondition(c, idx, ruleId, errors);
    return;
  }

  if (c.type === "named") {
    const validNames = Object.keys(NAMED_CONDITIONS) as NamedConditionId[];
    if (!validNames.includes(c.name as NamedConditionId)) {
      errors.push({ ruleId, field: `${idx}.condition.name`, message: `Invalid named condition "${c.name}". Allowed: ${validNames.join(", ")}` });
    }
    return;
  }

  if (c.type === "group") {
    if (depth >= MAX_CONDITION_DEPTH) {
      errors.push({ ruleId, field: `${idx}.condition`, message: `Group condition nesting exceeds maximum depth of ${MAX_CONDITION_DEPTH}.` });
      return;
    }
    if (c.logic !== "and" && c.logic !== "or") {
      errors.push({ ruleId, field: `${idx}.condition.logic`, message: `Group logic must be "and" or "or", got "${c.logic}".` });
    }
    if (!Array.isArray(c.conditions)) {
      errors.push({ ruleId, field: `${idx}.condition.conditions`, message: "Group conditions must be an array." });
      return;
    }
    if ((c.conditions as unknown[]).length === 0) {
      errors.push({ ruleId, field: `${idx}.condition.conditions`, message: "Group conditions must contain at least one condition." });
      return;
    }
    const children = c.conditions as unknown[];
    for (let i = 0; i < children.length; i++) {
      validateCondition(children[i], `${idx}[group[${i}]]`, ruleId, errors, depth + 1);
    }
    return;
  }

  errors.push({ ruleId, field: `${idx}.condition.type`, message: `Unknown condition type "${c.type}". Must be "field", "named", or "group".` });
}

function validateFieldCondition(
  c:      Record<string, unknown>,
  idx:    string,
  ruleId: string | undefined,
  errors: ValidationError[],
): void {
  // ── Field key ────────────────────────────────────────────────────────────────
  const allKeys = ALL_FIELD_KEYS as string[];
  if (!allKeys.includes(c.field as string)) {
    errors.push({
      ruleId,
      field:   `${idx}.condition.field`,
      message: `Invalid field "${c.field}". Allowed: ${allKeys.join(", ")}`,
    });
    return;
  }

  const field    = c.field as RuleFieldKey;
  const fieldDef = FIELD_REGISTRY[field];

  // ── Operator ─────────────────────────────────────────────────────────────────
  // Backwards compat: missing operator defaults to "equals".
  const operatorRaw = c.operator ?? "equals";

  if (!(FIELD_OPERATORS as readonly string[]).includes(operatorRaw as string)) {
    errors.push({
      ruleId,
      field:   `${idx}.condition.operator`,
      message: `Invalid operator "${operatorRaw}". Allowed: ${FIELD_OPERATORS.join(", ")}`,
    });
    return;
  }

  const operator = operatorRaw as FieldOperator;

  if (!fieldDef.operators.includes(operator)) {
    errors.push({
      ruleId,
      field:   `${idx}.condition.operator`,
      message: `Operator "${operator}" is not valid for field "${field}". Allowed for this field: ${fieldDef.operators.join(", ")}`,
    });
    return;
  }

  // ── Value ─────────────────────────────────────────────────────────────────────

  // Existence operators require no value
  if (NO_VALUE_OPERATORS.has(operator)) {
    if (c.value !== undefined && c.value !== null) {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" must not have a value.` });
    }
    return;
  }

  // All remaining operators require a value
  if (c.value === undefined || c.value === null) {
    errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a value.` });
    return;
  }

  // Array operators: non-empty array of strings or numbers
  if (ARRAY_VALUE_OPERATORS.has(operator)) {
    if (!Array.isArray(c.value) || (c.value as unknown[]).length === 0) {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a non-empty array value.` });
      return;
    }
    const allPrimitive = (c.value as unknown[]).every(
      (v) => typeof v === "string" || typeof v === "number",
    );
    if (!allPrimitive) {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" array elements must be strings or numbers.` });
      return;
    }
    // Categorical fields: each element must be in the allowed set
    if (fieldDef.kind === "categorical" && fieldDef.allowedValues) {
      for (const v of c.value as (string | number)[]) {
        if (!fieldDef.allowedValues.includes(String(v))) {
          errors.push({
            ruleId,
            field:   `${idx}.condition.value`,
            message: `Value "${v}" is not allowed for field "${field}". Allowed: ${fieldDef.allowedValues.join(", ")}`,
          });
        }
      }
    }
    return;
  }

  // Numeric ordering operators: value must be a number
  if (NUMERIC_OPERATORS.has(operator)) {
    if (typeof c.value !== "number") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a numeric value.` });
    }
    return;
  }

  // String-content operators: value must be a string
  if (STRING_ONLY_OPERATORS.has(operator)) {
    if (typeof c.value !== "string") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Operator "${operator}" requires a string value.` });
    }
    return;
  }

  // equals / not_equals: value type must match field kind
  if (fieldDef.kind === "number") {
    if (typeof c.value !== "number") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Field "${field}" is numeric; value must be a number.` });
    }
    return;
  }

  if (fieldDef.kind === "boolean") {
    if (typeof c.value !== "boolean") {
      errors.push({ ruleId, field: `${idx}.condition.value`, message: `Field "${field}" is boolean; value must be true or false.` });
    }
    return;
  }

  // categorical / nullable_string: value must be a string
  if (typeof c.value !== "string") {
    errors.push({ ruleId, field: `${idx}.condition.value`, message: `Field "${field}" expects a string value.` });
    return;
  }

  // Categorical: value must be in the allowed set
  if (fieldDef.kind === "categorical" && fieldDef.allowedValues) {
    if (!fieldDef.allowedValues.includes(c.value as string)) {
      errors.push({
        ruleId,
        field:   `${idx}.condition.value`,
        message: `Invalid value "${c.value}" for field "${field}". Allowed: ${fieldDef.allowedValues.join(", ")}`,
      });
    }
  }
}

// ── Runtime condition evaluator ────────────────────────────────────────────────

/**
 * Evaluate a RuleCondition against a live evaluation context.
 *
 * This is the runtime heart of the rules engine.  It walks the condition tree
 * recursively, applying each leaf to the resolved field value and combining
 * groups with the correct AND / OR short-circuit semantics.
 *
 * ─── Resilience contract ──────────────────────────────────────────────────────
 *
 *   Field resolver throws
 *     → the affected leaf returns false; a warning is logged with the field
 *       key.  Sibling OR branches are still evaluated — a broken UTM resolver
 *       does not prevent a source-based OR branch from matching.
 *
 *   Unknown field key (corrupt rule that slipped past validation)
 *     → returns false with a warning; no exception propagates.
 *
 *   Unknown condition type (corrupt serialised tree)
 *     → returns false; the outer catch also logs unexpectedly shaped nodes.
 *
 *   Unexpected error at any level
 *     → outer catch returns false and logs a warning; the caller never sees
 *       an exception from evaluateCondition.
 *
 * ─── Group semantics ──────────────────────────────────────────────────────────
 *
 *   AND  — every() — first false short-circuits; a broken leaf returns false
 *          and therefore short-circuits the AND group as well (safe degrada-
 *          tion: the rule is not matched when a required condition is broken).
 *
 *   OR   — some() — first true short-circuits; a broken leaf returns false,
 *          allowing remaining branches to be tried before giving up.
 *
 *   Empty group → false (vacuously unsatisfiable; should not appear in
 *   validated rules but is handled defensively).
 *
 * @param condition - The condition node to evaluate.
 * @param ctx       - Full evaluation context for this request (DecisionInput
 *                    extended with optional page-level fields).
 * @returns true if the condition is satisfied; false otherwise (including
 *          on any internal error).
 */
export function evaluateCondition(
  condition: RuleCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  try {
    return evalNode(condition, ctx);
  } catch (err) {
    // Unexpected error that was not caught by the inner handlers — log and
    // degrade safely so the caller never sees an exception.
    logger.warn("[decision] Unexpected error evaluating condition", {
      conditionType: (condition as { type?: string }).type,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ── Internal evaluator nodes ───────────────────────────────────────────────────

/**
 * Inner dispatcher — no try/catch so errors propagate to evaluateCondition's
 * outer catch.  evaluateCondition is called recursively for group children so
 * that each child gets independent error containment.
 */
function evalNode(condition: RuleCondition, ctx: RuleEvaluationContext): boolean {
  if (condition.type === "field") {
    return evalFieldCondition(condition, ctx);
  }
  if (condition.type === "named") {
    return evalNamedCondition(condition, ctx);
  }
  if (condition.type === "group") {
    return evalGroupCondition(condition, ctx);
  }
  // Unreachable in a well-formed tree — TypeScript exhaustiveness guard.
  return false;
}

function evalFieldCondition(
  condition: FieldCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  const { field, operator = "equals", value } = condition;

  // Defensive lookup — should always succeed for rules that passed validation.
  const def = (FIELD_REGISTRY as Record<string, (typeof FIELD_REGISTRY)[RuleFieldKey] | undefined>)[field];
  if (!def) {
    logger.warn("[decision] Unknown rule field encountered at runtime — returning false", { field });
    return false;
  }

  // Resolve the live field value.  Wrap separately so a resolver bug surfaces
  // with the field name, not just an opaque runtime error.
  let actual: FieldRuntimeValue;
  try {
    actual = def.resolve(ctx);
  } catch (resolveErr) {
    logger.warn("[decision] Field resolver threw — treating field as absent", {
      field,
      operator,
      error: resolveErr instanceof Error ? resolveErr.message : String(resolveErr),
    });
    return false;
  }

  return applyOperator(actual, operator, value);
}

function evalNamedCondition(
  condition: NamedCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  switch (condition.name) {
    case "returning_cta_clicked":
      return ctx.history.fromDatabase === true && ctx.history.hasClickedCta === true;

    case "high_engagement":
      return ctx.history.fromDatabase === true && ctx.history.pageViewCount >= 3;
  }
}

function evalGroupCondition(
  condition: GroupCondition,
  ctx:       RuleEvaluationContext,
): boolean {
  const { logic, conditions } = condition;

  // An empty group is vacuously false — should not appear in validated rules.
  if (conditions.length === 0) return false;

  if (logic === "and") {
    // Use evaluateCondition (not evalNode) for each child so every child gets
    // its own error containment.  A broken child returns false, short-circuiting
    // the AND — the rule does not match when a required condition is broken.
    return conditions.every((child) => evaluateCondition(child, ctx));
  }

  // OR: a broken child returns false, allowing remaining branches to be tried.
  return conditions.some((child) => evaluateCondition(child, ctx));
}

// ── Operator application ───────────────────────────────────────────────────────

/**
 * Apply a FieldOperator to a resolved field value and an expected stored value.
 *
 * Returns false (rather than throwing) on type mismatches — this is the last
 * safety net for corrupt rules that somehow slipped past both validation and the
 * field-resolver try/catch in evalFieldCondition.
 *
 * All 12 operators are handled exhaustively; TypeScript will report an error
 * if a new operator is added to FieldOperator without a matching case here.
 */
function applyOperator(
  actual:   unknown,
  operator: FieldOperator,
  expected: FieldConditionValue | undefined,
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;

    case "not_equals":
      return actual !== expected;

    case "in":
      return Array.isArray(expected) &&
        (expected as (string | number)[]).includes(actual as string | number);

    case "not_in":
      return Array.isArray(expected) &&
        !(expected as (string | number)[]).includes(actual as string | number);

    case "greater_than":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;

    case "greater_than_or_equal":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;

    case "less_than":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;

    case "less_than_or_equal":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;

    case "contains":
      return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);

    case "not_contains":
      return typeof actual === "string" && typeof expected === "string" && !actual.includes(expected);

    case "exists":
      return actual !== null && actual !== undefined;

    case "not_exists":
      return actual === null || actual === undefined;
  }
}

// ── Compiler ───────────────────────────────────────────────────────────────────

/**
 * Compile a StoredRule into a runtime HomepageRule by wrapping its condition
 * descriptor in an evaluateCondition() call.
 *
 * The produced `match` function is a pure closure over the condition literal.
 * All evaluation — including recursive group traversal, field resolution, and
 * operator application — is delegated to evaluateCondition(), which provides
 * its own per-condition error containment.
 *
 * The RulesDecisionProvider adds an outer per-rule try/catch as a belt-and-
 * suspenders safety net (e.g. for hardcoded HomepageRule predicates that bypass
 * this path), but under normal operation evaluateCondition never throws.
 */
export function compileStoredRule(stored: StoredRule): HomepageRule {
  return {
    id:       stored.id,
    priority: stored.priority,
    label:    stored.label,
    match:    buildMatchPredicate(stored.condition),
    plan:     stored.plan,
    reason:   stored.reason,
  };
}

/**
 * Build a `(input: DecisionInput) => boolean` predicate that delegates to
 * evaluateCondition.  The cast to RuleEvaluationContext is safe because all
 * fields added by that type are optional, and every resolve() implementation
 * handles null / undefined gracefully.
 */
function buildMatchPredicate(condition: RuleCondition): (input: DecisionInput) => boolean {
  return (input: DecisionInput): boolean =>
    evaluateCondition(condition, input as RuleEvaluationContext);
}

// ── Seed config ────────────────────────────────────────────────────────────────

/**
 * The initial StoredRulesConfig that mirrors the hard-coded HOMEPAGE_RULES.
 * Used when runtime-rules.json does not yet exist.
 */
export const SEED_RULES_CONFIG: StoredRulesConfig = {
  schemaVersion: 1,
  updatedAt: new Date(0).toISOString(),
  rules: [
    {
      id:       "homepage.returning_cta_clicked",
      priority: 5,
      label:    "Returning visitor — CTA previously clicked",
      condition: { type: "named", name: "returning_cta_clicked" },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_cases",
        ctaKey:   "cta_meeting",
      },
      reason: "Returning visitor who previously clicked CTA — escalated to meeting intent.",
    },
    {
      id:       "homepage.high_engagement",
      priority: 7,
      label:    "High-engagement returning visitor (3+ page views)",
      condition: { type: "named", name: "high_engagement" },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_vision",
        ctaKey:   "cta_meeting",
      },
      reason: "Highly engaged returning visitor (3+ page views) — platform-confidence experience.",
    },
    {
      id:       "homepage.google",
      priority: 10,
      label:    "Google traffic",
      condition: { type: "field", field: "source", operator: "equals", value: "google" },
      plan: {
        heroKey:  "hero_google_problem",
        proofKey: "proof_cases",
        ctaKey:   "cta_guide",
      },
      reason: "Traffic source indicates search/problem intent.",
    },
    {
      id:       "homepage.linkedin",
      priority: 20,
      label:    "LinkedIn traffic",
      condition: { type: "field", field: "source", operator: "equals", value: "linkedin" },
      plan: {
        heroKey:  "hero_linkedin_vision",
        proofKey: "proof_vision",
        ctaKey:   "cta_platform",
      },
      reason: "Traffic source indicates thought-leadership/social intent.",
    },
  ],
  defaultPlan: {
    heroKey:  "hero_direct_brand",
    proofKey: "proof_platform",
    ctaKey:   "cta_meeting",
    reason:   "Default/direct traffic gets brand-led experience.",
  },
};

// ── Human-readable helpers ─────────────────────────────────────────────────────

/**
 * Format a RuleCondition as a short human-readable string for list views.
 * Uses field labels from FIELD_REGISTRY rather than raw key names.
 * Groups render as parenthesised AND/OR expressions.
 */
export function formatCondition(condition: RuleCondition): string {
  if (condition.type === "field") {
    const fieldLabel = FIELD_REGISTRY[condition.field]?.label ?? condition.field;
    const op = condition.operator ?? "equals";

    if (op === "exists" || op === "not_exists") {
      return `${fieldLabel} ${op}`;
    }
    if (op === "in" || op === "not_in") {
      const list = Array.isArray(condition.value)
        ? (condition.value as (string | number)[]).join(", ")
        : String(condition.value ?? "");
      return `${fieldLabel} ${op} [${list}]`;
    }
    return `${fieldLabel} ${op} ${condition.value}`;
  }

  if (condition.type === "named") {
    return NAMED_CONDITIONS[condition.name].label;
  }

  if (condition.type === "group") {
    const sep   = ` ${condition.logic.toUpperCase()} `;
    const parts = condition.conditions.map(formatCondition);
    return parts.length === 1 ? parts[0] : `(${parts.join(sep)})`;
  }

  return "(unknown condition)";
}
