/**
 * Collision-proof unique id for a freshly-created editor rule.
 *
 * `homepage.rule_${Date.now()}` alone collided when two rules were created within
 * the same millisecond (a rapid or double-clicked "Add rule"): both rules got the
 * SAME id, so they rendered with duplicate React keys AND updateRule (which patches
 * every rule whose `id === id`) patched BOTH at once — making one rule's "Rule
 * name" field appear un-editable (typing seemed to do nothing / reverted).
 *
 * crypto.randomUUID() guarantees uniqueness; the Date.now + Math.random fallback
 * covers any non-secure context where randomUUID is unavailable.
 */
export function freshRuleId(prefix: string): string {
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uid}`;
}
