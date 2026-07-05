/**
 * token-import-detect.ts
 *
 * Shared helper for the design JSON import boxes. Detects which of the three
 * design-JSON shapes the user pasted, so each importer can either accept it or
 * point the user to the right place instead of showing a generic error.
 *
 *   • "array"   → a Block token sets list: [{ key, name, tokens }]
 *   • "preset"  → a full design preset: { theme, color:{…}, typography:{…}, meta? }
 *   • "tokens"  → a single Site design tokens object: { primary:"#…", … } (flat)
 *   • "unknown" → none of the above
 */

export type TokenPayloadKind = "array" | "preset" | "tokens" | "unknown";

export function detectTokenPayloadKind(parsed: unknown): TokenPayloadKind {
  if (Array.isArray(parsed)) return "array";
  if (!parsed || typeof parsed !== "object") return "unknown";

  const obj = parsed as Record<string, unknown>;

  // A preset has a `meta` block or NESTED group objects (color:{…}, typography:{…}),
  // whereas a flat tokens object has only string values.
  if ("meta" in obj || "theme" in obj) return "preset";
  const hasNestedGroup = Object.values(obj).some(
    (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  );
  if (hasNestedGroup) return "preset";

  const hasStringValue = Object.values(obj).some((v) => typeof v === "string");
  if (hasStringValue) return "tokens";

  return "unknown";
}

/** Human-readable redirect message for a payload that landed in the wrong box. */
export function wrongBoxMessage(kind: TokenPayloadKind, expected: "array" | "tokens"): string | null {
  if (expected === "array") {
    if (kind === "preset") {
      return "This looks like a design preset (theme + color/typography groups). Import it via Design → Style → “Importeer JSON”, or just apply it from the Preset gallery — not here. This box expects an array of named block token sets.";
    }
    if (kind === "tokens") {
      return "This looks like a single Site design tokens object. Paste it in the “Site design tokens” panel above. This box expects an array of named sets: [{ key, name, tokens }].";
    }
  }
  if (expected === "tokens") {
    if (kind === "array") {
      return "This looks like a Block token sets list (an array). Paste it in the “Block token sets (overrides)” panel below. This box expects a single tokens object: { primary: \"#…\", … }.";
    }
    if (kind === "preset") {
      return "This looks like a design preset. Import it via Design → Style → “Importeer JSON”, or apply it from the Preset gallery. This box expects a single flat tokens object, not grouped preset sections.";
    }
  }
  return null;
}
