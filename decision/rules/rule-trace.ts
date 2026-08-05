/**
 * Rule Evaluation Trace
 *
 * Companion diagnostics for the rules engine.  Produces a structured,
 * JSON-serialisable trace of every condition evaluated for a given rule:
 * field key, operator, expected vs actual value, and per-leaf match result.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   evaluateConditionTrace() walks the condition tree independently of the
 *   hot-path evaluateCondition().  The critical match result always comes from
 *   evaluateCondition() (resilient, tested); the trace provides the diagnostic
 *   overlay and is never on the critical path.
 *
 *   To avoid double tree walks in production the trace function should only be
 *   called when process.env.NODE_ENV !== "production" — callers are responsible
 *   for this guard.  logger.debug() already suppresses in production, but the
 *   guard prevents CPU work even when the logger is replaced with a prod-capable
 *   transport.
 *
 * ─── Group trace semantics ────────────────────────────────────────────────────
 *
 *   Unlike the main evaluateCondition(), the trace walk does NOT short-circuit
 *   AND / OR groups.  All children are always evaluated so the trace shows the
 *   complete picture (e.g. which second condition in an AND group also failed).
 *   The group's matched result is then computed from the collected child results.
 *
 * ─── Privacy ──────────────────────────────────────────────────────────────────
 *
 *   Actual field values are only populated when INCLUDE_ACTUAL is true
 *   (i.e. process.env.NODE_ENV !== "production").  This protects against
 *   accidental exfiltration of visitor-context data if a third-party log
 *   transport is later added to production.  Fields that are coarse category
 *   signals (source, device, visitType) are safe to log in any environment;
 *   fields with open-ended user-supplied strings (UTM params, pathname) are
 *   the ones we want to gate behind this flag.
 *
 * ─── Consumers ────────────────────────────────────────────────────────────────
 *
 *   RulesDecisionProvider   — generates per-request traces; emits via logger.debug.
 *   Future dashboard API    — can call generateRuleTrace() directly and store
 *                             the result as JSONB for the admin diagnostics view.
 */

import { evaluateCondition } from "./stored-rule";
import {
  FIELD_REGISTRY,
  resolveFieldValue,
  type RuleEvaluationContext,
  type RuleFieldKey,
  type FieldOperator,
  type FieldRuntimeValue,
} from "./field-registry";
import {
  NAMED_CONDITIONS,
  type RuleCondition,
  type FieldCondition,
  type NamedCondition,
  type ContextCondition,
  type GroupCondition,
  type NamedConditionId,
  type FieldConditionValue,
} from "./stored-rule";
import { CONTEXT_REGISTRY } from "./context-library";

// ── Privacy flag ──────────────────────────────────────────────────────────────

/**
 * Actual runtime field values are included in traces only when this is true.
 * Belt-and-suspenders: logger.debug() is already a no-op in production, but
 * this gate prevents CPU work and eliminates the value from the trace object
 * itself so it cannot leak via any future transport change.
 */
const INCLUDE_ACTUAL = process.env.NODE_ENV !== "production";

// ── Trace types ───────────────────────────────────────────────────────────────

/**
 * Trace of a single FieldCondition evaluation.
 *
 * `actual` is only present when INCLUDE_ACTUAL is true.  It contains the
 * value resolved from the visitor context — the runtime answer to "what is
 * field X for this request?"
 *
 * `error` is set (and `actual` is absent) when the field resolver threw.
 */
export interface FieldConditionTrace {
  kind:       "field";
  field:      RuleFieldKey;
  /** Human-readable label from FIELD_REGISTRY (e.g. "Traffic source"). */
  fieldLabel: string;
  operator:   FieldOperator;
  /** The expected value stored in the rule descriptor. */
  expected:   FieldConditionValue | undefined;
  /**
   * The actual runtime value resolved from the visitor context.
   * Only populated in non-production; undefined otherwise.
   */
  actual?:    FieldRuntimeValue;
  matched:    boolean;
  /** Set when the field resolver threw an exception. */
  error?:     string;
}

/** Trace of a NamedCondition evaluation. */
export interface NamedConditionTrace {
  kind:    "named";
  name:    NamedConditionId;
  /** Human-readable label from NAMED_CONDITIONS (e.g. "Returning visitor — CTA previously clicked"). */
  label:   string;
  matched: boolean;
}

/**
 * Trace of a ContextCondition evaluation.
 *
 * Shows which context was referenced, its label, and whether it matched.
 * The underlying condition of the context definition is NOT re-traced here
 * (tracing the inner condition would produce a duplicate trace subtree in
 * every rule that references the same context).  The context library panel
 * in the admin UI shows the full context definition separately.
 */
export interface ContextConditionTrace {
  kind:       "context";
  contextId:  string;
  /** Human-readable label from CONTEXT_REGISTRY, or the raw ID if not found. */
  label:      string;
  matched:    boolean;
  /** Set when the contextId was not found in CONTEXT_REGISTRY. */
  error?:     "unknown-context";
}

/**
 * Trace of a GroupCondition evaluation.
 *
 * All children are always present (no short-circuit in the trace walk) so the
 * trace shows the complete picture for every AND / OR group.
 */
export interface GroupConditionTrace {
  kind:     "group";
  logic:    "and" | "or";
  children: ConditionTrace[];
  matched:  boolean;
}

/**
 * Fallback trace for unrecognised condition types or unexpected errors at the
 * top level of a trace walk.  Should never appear for validated rules.
 */
export interface UnknownConditionTrace {
  kind:           "unknown";
  conditionType?: string;
  matched:        false;
  error?:         string;
}

/** Union of all concrete trace node kinds. */
export type ConditionTrace =
  | FieldConditionTrace
  | NamedConditionTrace
  | ContextConditionTrace
  | GroupConditionTrace
  | UnknownConditionTrace;

/**
 * Complete diagnostic record for one rule evaluation.
 *
 * `matched` mirrors what evaluateCondition() returned for the rule's condition.
 * `condition` is the root of the trace tree.
 * `matchedContextIds` lists all ContextCondition IDs that matched for this rule.
 */
export interface RuleEvalTrace {
  ruleId:            string;
  ruleLabel:         string;
  priority:          number;
  packId?:           string;
  precedenceLevel?:  string;
  matched:           boolean;
  condition:         ConditionTrace;
  /** IDs of context conditions that were referenced and matched in this rule. */
  matchedContextIds: string[];
}

// ── Core trace walker ─────────────────────────────────────────────────────────

/**
 * Walk a RuleCondition tree and produce a ConditionTrace alongside the match
 * result.  This is a pure diagnostic companion to evaluateCondition() — it does
 * not replace the hot-path evaluator.
 *
 * Resilience: if any part of the trace walk throws the caller receives an
 * UnknownConditionTrace with matched = false and the error message.  This can
 * never crash the rules engine because the caller (RulesDecisionProvider) holds
 * the real match result from evaluateCondition() separately.
 *
 * @param condition - The condition node to trace.
 * @param ctx       - The full evaluation context for this request.
 * @returns An object with the match result and the populated trace node.
 */
export function evaluateConditionTrace(
  condition: RuleCondition,
  ctx:       RuleEvaluationContext,
): { matched: boolean; trace: ConditionTrace } {
  try {
    return traceNode(condition, ctx);
  } catch (err) {
    return {
      matched: false,
      trace:   {
        kind:          "unknown",
        conditionType: (condition as unknown as Record<string, unknown>).type as string | undefined,
        matched:       false,
        error:         err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Walk a ConditionTrace tree and collect all matched ContextCondition IDs.
 *
 * Used by generateRuleTrace() to populate RuleEvalTrace.matchedContextIds,
 * which gives the debug panel a flat list of "which named contexts fired".
 */
export function collectMatchedContextIds(trace: ConditionTrace): string[] {
  const ids: string[] = [];

  function walk(node: ConditionTrace): void {
    if (node.kind === "context" && node.matched) {
      ids.push(node.contextId);
    } else if (node.kind === "group") {
      for (const child of node.children) walk(child);
    }
  }

  walk(trace);
  return ids;
}

/**
 * Build a full RuleEvalTrace for a given stored rule and evaluation context.
 * This is the entry point for the RulesDecisionProvider trace machinery.
 *
 * Includes packId, precedenceLevel, and matchedContextIds in the trace so
 * the debug panel can display the complete picture without additional lookups.
 *
 * @param stored   The raw StoredRule (for metadata: packId, precedenceLevel).
 * @param matched  The authoritative match result from evaluateCondition().
 * @param condition The rule's condition descriptor.
 * @param ctx      The full visitor evaluation context for this request.
 */
export function generateRuleTrace(
  stored:    { id: string; label: string; priority: number; packId?: string; precedenceLevel?: string },
  matched:   boolean,
  condition: RuleCondition,
  ctx:       RuleEvaluationContext,
): RuleEvalTrace {
  const { matched: _ignored, trace } = evaluateConditionTrace(condition, ctx);
  void _ignored; // match result comes from the caller (authoritative)

  return {
    ruleId:            stored.id,
    ruleLabel:         stored.label,
    priority:          stored.priority,
    packId:            stored.packId,
    precedenceLevel:   stored.precedenceLevel,
    matched,
    condition:         trace,
    matchedContextIds: collectMatchedContextIds(trace),
  };
}

// ── Internal walk helpers ─────────────────────────────────────────────────────

function traceNode(
  condition: RuleCondition,
  ctx:       RuleEvaluationContext,
): { matched: boolean; trace: ConditionTrace } {
  if (condition.type === "field")   return traceField(condition, ctx);
  if (condition.type === "named")   return traceNamed(condition, ctx);
  if (condition.type === "context") return traceContext(condition, ctx);
  if (condition.type === "group")   return traceGroup(condition, ctx);
  // Unreachable for valid condition trees.
  return {
    matched: false,
    trace:   { kind: "unknown", conditionType: (condition as unknown as Record<string, unknown>).type as string | undefined, matched: false },
  };
}

function traceField(
  condition: FieldCondition,
  ctx:       RuleEvaluationContext,
): { matched: boolean; trace: FieldConditionTrace } {
  const { field, operator = "equals", value } = condition;
  const def = (FIELD_REGISTRY as Record<string, typeof FIELD_REGISTRY[RuleFieldKey] | undefined>)[field];

  if (!def) {
    return {
      matched: false,
      trace:   {
        kind:       "field",
        field:      field as RuleFieldKey,
        fieldLabel: field,
        operator,
        expected:   value,
        matched:    false,
        error:      "unknown-field",
      },
    };
  }

  // Resolve the actual runtime value separately — captured for the trace only.
  let actual: FieldRuntimeValue | undefined;
  let resolveError: string | undefined;

  if (INCLUDE_ACTUAL) {
    try {
      // Mirror the engine: honour a rule-written override from ctx.ruleContext
      // so the trace's "actual" matches what evaluateCondition() saw (§4).
      actual = resolveFieldValue(field, def, ctx);
    } catch (err) {
      resolveError = err instanceof Error ? err.message : String(err);
    }
  }

  // The authoritative match result comes from evaluateCondition() so the trace
  // never diverges from the real engine outcome even if resolver semantics
  // change.
  const matched = evaluateCondition(condition, ctx);

  return {
    matched,
    trace: {
      kind:       "field",
      field:      field as RuleFieldKey,
      fieldLabel: def.label,
      operator,
      expected:   value,
      // Only include actual in dev; omit entirely (not just undefined) in prod.
      ...(INCLUDE_ACTUAL ? { actual } : {}),
      matched,
      ...(resolveError ? { error: resolveError } : {}),
    },
  };
}

function traceNamed(
  condition: NamedCondition,
  ctx:       RuleEvaluationContext,
): { matched: boolean; trace: NamedConditionTrace } {
  const matched = evaluateCondition(condition, ctx);
  const meta    = NAMED_CONDITIONS[condition.name as NamedConditionId];
  return {
    matched,
    trace: {
      kind:    "named",
      name:    condition.name as NamedConditionId,
      label:   meta?.label ?? condition.name,
      matched,
    },
  };
}

function traceContext(
  condition: ContextCondition,
  ctx:       RuleEvaluationContext,
): { matched: boolean; trace: ContextConditionTrace } {
  const def     = CONTEXT_REGISTRY[condition.contextId];
  const matched = evaluateCondition(condition, ctx);

  if (!def) {
    return {
      matched: false,
      trace: {
        kind:      "context",
        contextId: condition.contextId,
        label:     condition.contextId,
        matched:   false,
        error:     "unknown-context",
      },
    };
  }

  return {
    matched,
    trace: {
      kind:      "context",
      contextId: condition.contextId,
      label:     def.label,
      matched,
    },
  };
}

function traceGroup(
  condition: GroupCondition,
  ctx:       RuleEvaluationContext,
): { matched: boolean; trace: GroupConditionTrace } {
  // Trace ALL children without short-circuiting so the full picture is
  // captured (e.g. which second condition in an AND also failed).
  const childResults = condition.conditions.map((child) => traceNode(child, ctx));
  const children     = childResults.map((r) => r.trace);

  const matched =
    condition.logic === "and"
      ? childResults.every((r) => r.matched)
      : childResults.some((r) => r.matched);

  return {
    matched,
    trace: { kind: "group", logic: condition.logic, children, matched },
  };
}

// ── Log formatting helpers ─────────────────────────────────────────────────────

/**
 * Convert a RuleEvalTrace into a flat structure for logger.debug() metadata.
 *
 * Top-level fields are kept shallow for easy scanning in terminal output.
 * A `conditionSummary` string gives a quick one-liner; a `conditionDetail`
 * object carries the full structured trace for log aggregation / parsing.
 *
 * @example output for a matched context-based rule:
 *   {
 *     ruleId: "homepage.google",
 *     ruleLabel: "Google traffic",
 *     priority: 10,
 *     packId: "pack_traffic_source",
 *     precedenceLevel: "high_intent",
 *     matched: true,
 *     matchedContextIds: ["ctx_google_traffic"],
 *     conditionSummary: "ctx: Google traffic → ✓",
 *     conditionDetail: { kind: "context", contextId: "ctx_google_traffic", ... }
 *   }
 */
export function ruleTraceToLogMeta(trace: RuleEvalTrace): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    ruleId:           trace.ruleId,
    ruleLabel:        trace.ruleLabel,
    priority:         trace.priority,
    matched:          trace.matched,
    conditionSummary: summariseTrace(trace.condition),
    conditionDetail:  serialiseTrace(trace.condition),
  };

  if (trace.packId)            meta.packId            = trace.packId;
  if (trace.precedenceLevel)   meta.precedenceLevel   = trace.precedenceLevel;
  if (trace.matchedContextIds.length > 0) {
    meta.matchedContextIds = trace.matchedContextIds;
  }

  return meta;
}

/**
 * Compact one-liner summary for a single condition trace node.
 * Used for the `conditionSummary` field in log meta and for per-rule
 * "skipped" log entries where full detail would be too noisy.
 */
export function summariseTrace(trace: ConditionTrace): string {
  const tick = trace.matched ? "✓" : "✗";

  switch (trace.kind) {
    case "field": {
      const expected = formatExpected(trace.expected);
      const actual   = INCLUDE_ACTUAL && "actual" in trace && trace.actual !== undefined
        ? ` (actual: ${String(trace.actual)})`
        : "";
      return `${trace.fieldLabel} ${trace.operator} ${expected}${actual} → ${tick}`;
    }
    case "named":
      return `${trace.label} → ${tick}`;

    case "context":
      return `ctx: ${trace.label} → ${tick}`;

    case "group": {
      const sep   = ` ${trace.logic.toUpperCase()} `;
      const inner = trace.children.map(summariseTrace).join(sep);
      return `(${inner}) → ${tick}`;
    }

    case "unknown":
      return `(unknown condition${trace.conditionType ? `: ${trace.conditionType}` : ""}) → ${tick}`;
  }
}

/** Deep-serialisable form of a ConditionTrace for structured log fields. */
function serialiseTrace(trace: ConditionTrace): Record<string, unknown> {
  switch (trace.kind) {
    case "field": {
      const base: Record<string, unknown> = {
        kind:       trace.kind,
        field:      trace.field,
        fieldLabel: trace.fieldLabel,
        operator:   trace.operator,
        expected:   formatExpected(trace.expected),
        matched:    trace.matched,
      };
      if (INCLUDE_ACTUAL && "actual" in trace) base.actual = trace.actual ?? null;
      if (trace.error)                          base.error  = trace.error;
      return base;
    }

    case "named":
      return {
        kind:    trace.kind,
        name:    trace.name,
        label:   trace.label,
        matched: trace.matched,
      };

    case "context": {
      const base: Record<string, unknown> = {
        kind:      trace.kind,
        contextId: trace.contextId,
        label:     trace.label,
        matched:   trace.matched,
      };
      if (trace.error) base.error = trace.error;
      return base;
    }

    case "group":
      return {
        kind:     trace.kind,
        logic:    trace.logic,
        matched:  trace.matched,
        children: trace.children.map(serialiseTrace),
      };

    case "unknown":
      return {
        kind:          trace.kind,
        conditionType: trace.conditionType,
        matched:       false,
        ...(trace.error ? { error: trace.error } : {}),
      };
  }
}

// ── Small utilities ────────────────────────────────────────────────────────────

function formatExpected(expected: FieldConditionValue | undefined): string {
  if (expected === undefined) return "(none)";
  if (Array.isArray(expected)) return `[${(expected as (string | number)[]).join(", ")}]`;
  return String(expected);
}
