/**
 * Priority Allocation + Duplicate Detection
 *
 * Safety helpers for adding a rule from a recipe (or any programmatic add).
 * Two hazards this guards against:
 *
 *   1. Duplicate priority. validateStoredConfig rejects the WHOLE config when
 *      two rules share a priority — a single collision breaks all
 *      personalisation. allocateUniquePriority() always returns a number no
 *      existing rule uses.
 *
 *   2. Duplicate rule. Re-adding the same recipe would stack identical rules.
 *      findDuplicateByCondition() finds an existing rule with the same
 *      condition so the UI can warn instead of silently duplicating.
 *
 * Pure module — types + data only. Safe to import from client components.
 */

import { PRECEDENCE_TIERS }        from "./rule-packs";
import type { PrecedenceLevel }    from "./rule-packs";
import type { RuleCondition, StoredRule } from "./stored-rule";

/** The minimum shape these helpers read from a rule. */
type PriorityRule  = Pick<StoredRule, "priority">;
type ConditionRule = Pick<StoredRule, "condition"> & Partial<Pick<StoredRule, "priority" | "enabled" | "label" | "id">>;

// ── Unique priority within a tier ──────────────────────────────────────────────

/**
 * Return a priority that (a) no existing rule uses and (b) sits inside the
 * given tier's range when there is room. When the tier is full, fall back to
 * appending above the current maximum, rounded up to the next multiple of 10 for
 * readability, then bumped until free. The result is always unique; when the
 * fallback fires it may sit outside the tier range (uniqueness wins over tier
 * tidiness, since a collision is fatal and an out-of-tier number is not).
 *
 * @param existing  All current rules (only their `priority` is read).
 * @param tier      The recipe's precedence tier.
 */
export function allocateUniquePriority(existing: readonly PriorityRule[], tier: PrecedenceLevel): number {
  const taken = new Set(existing.map((r) => r.priority));
  const [min, max] = PRECEDENCE_TIERS[tier].range;

  for (let p = min; p <= max; p++) {
    if (!taken.has(p)) return p;
  }

  // Tier full — append above the current maximum.
  const currentMax = existing.length > 0 ? Math.max(...existing.map((r) => r.priority)) : 0;
  let next = Math.ceil((currentMax + 1) / 10) * 10;
  while (taken.has(next)) next++;
  return next;
}

// ── Canonical condition comparison ─────────────────────────────────────────────

/**
 * Deterministic serialisation of a JSON-ish value with object keys sorted, so
 * two conditions that differ only in key order compare equal. Array order is
 * preserved and therefore significant — sufficient for catching a re-added
 * recipe (which always emits its leaves in the same order); it is not a full
 * semantic-equivalence check across arbitrarily reordered groups.
 */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalise(obj[k])}`).join(",")}}`;
}

/** True when two conditions are structurally identical (key order ignored). */
export function conditionsEqual(a: RuleCondition, b: RuleCondition): boolean {
  return canonicalise(a) === canonicalise(b);
}

/**
 * Find an existing rule whose condition matches `condition`. Used to warn before
 * adding a recipe that is already present. Returns the first match (checking all
 * rules regardless of `enabled`, so a disabled duplicate is still surfaced), or
 * undefined when the condition is new.
 */
export function findDuplicateByCondition<T extends ConditionRule>(
  existing: readonly T[],
  condition: RuleCondition,
): T | undefined {
  const target = canonicalise(condition);
  return existing.find((r) => canonicalise(r.condition) === target);
}
