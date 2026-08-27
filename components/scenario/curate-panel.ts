/**
 * Per-tenant Scenario Control panel curation.
 *
 * Order-preserving, fail-open filter shared by the Context "Quick presets", the
 * Demo "Who are you?" roles, and the Demo "Simulate time" options.
 *
 *   - `keys` absent/empty → return the full source list unchanged (current default).
 *   - Otherwise → keep only items whose key is allowed, in the SOURCE list's order
 *     (the config array's order is irrelevant).
 *   - Unknown keys simply never match; if NOTHING matches → return the full list
 *     (never render an empty section by misconfiguration).
 */
export function curateByKey<T>(
  list: readonly T[],
  keyOf: (item: T) => string,
  keys?: readonly string[] | null,
): T[] {
  if (!keys || keys.length === 0) return [...list];
  const allow = new Set(keys);
  const filtered = list.filter((item) => allow.has(keyOf(item)));
  return filtered.length > 0 ? filtered : [...list];
}
