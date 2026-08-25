/**
 * Human-readable one-line summary of a rule's condition tree, for the read-only
 * Webhooks overview. Pure + dependency-light so it can be unit-tested and shared.
 *
 * This is a display helper only — it never drives evaluation (that stays in
 * evaluateCondition). Unknown shapes degrade to a short placeholder rather than
 * throwing, so a malformed stored condition can never break the overview page.
 */

import type { RuleCondition } from "@/decision/rules/stored-rule";

const OPERATOR_LABELS: Record<string, string> = {
  equals:                   "=",
  not_equals:               "≠",
  contains:                 "contains",
  not_contains:             "does not contain",
  in:                       "in",
  not_in:                   "not in",
  greater_than:             ">",
  greater_than_or_equal:    "≥",
  less_than:                "<",
  less_than_or_equal:       "≤",
  exists:                   "is set",
  not_exists:               "is not set",
};

function op(operator: string | undefined): string {
  return OPERATOR_LABELS[operator ?? "equals"] ?? (operator ?? "=");
}

function val(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return String(value);
}

/** One clause, e.g. `source = google` or `massa ≥ 2000`. */
function clause(name: string, operator: string | undefined, value: unknown): string {
  const o = op(operator);
  if (o === "is set" || o === "is not set") return `${name} ${o}`;
  const v = val(value);
  return v === "" ? `${name} ${o}` : `${name} ${o} ${v}`;
}

/**
 * Summarize a condition tree to a single line. `maxDepth` guards against
 * pathological nesting; anything deeper renders as `…`.
 */
export function summarizeCondition(condition: RuleCondition | null | undefined, maxDepth = 4): string {
  if (!condition || typeof condition !== "object") return "always";
  if (maxDepth <= 0) return "…";

  const c = condition as RuleCondition;
  switch (c.type) {
    case "field":
      return clause(c.field, c.operator, c.value);
    case "flag":
      return clause(c.name, c.operator, c.value);
    case "attribute":
      return clause(c.name, c.operator, c.value);
    case "named":
      return `named: ${c.name}`;
    case "context":
      return `context: ${c.contextId}`;
    case "context_library": {
      const ids = c.contextIds.join(" / ");
      return c.minConfidence ? `audience: ${ids} (≥${c.minConfidence})` : `audience: ${ids}`;
    }
    case "group": {
      const joiner = c.logic === "or" ? " OR " : " AND ";
      const parts = c.conditions.map((child) => summarizeCondition(child, maxDepth - 1));
      return parts.length === 1 ? parts[0] : `(${parts.join(joiner)})`;
    }
    default:
      return "condition";
  }
}
