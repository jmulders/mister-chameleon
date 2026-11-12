/**
 * Values inside a PostgREST `or(...)` filter string.
 *
 * `.eq("col", value)` is safe: the client sends the value as its own parameter.
 * `.or("a.eq.x,b.eq.y")` is one string, parsed by PostgREST, where a comma
 * starts the next condition and parentheses nest. A value pasted in as it came
 * from a URL can therefore add conditions of its own: a handle of
 * `x,status.eq.active` matched the first active lead of the tenant.
 *
 * PostgREST reads a double-quoted value literally, with backslash escapes for
 * `"` and `\`. Every value that goes into an `or` string passes through here.
 */
export function orValue(value: string | number): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** The same for an `ilike` pattern: `%` and `_` in the term match themselves. */
export function orLikeValue(term: string, wrap: "contains" | "exact" = "contains"): string {
  const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  return orValue(wrap === "contains" ? `%${escaped}%` : escaped);
}
