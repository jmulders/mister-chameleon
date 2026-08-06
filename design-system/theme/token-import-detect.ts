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

/** Which of the three import boxes the file was dropped into. */
export type ExpectedBox = "array" | "tokens" | "preset";

/** Plain-language name for a detected payload, for use in messages. */
const KIND_LABEL: Record<TokenPayloadKind, string> = {
  array:   "a block token sets list (a JSON array)",
  preset:  "a theme preset (theme plus color/typography groups)",
  tokens:  "a single site design tokens object (flat key/value)",
  unknown: "an unrecognised JSON shape",
};

/** Where each box lives, so a wrong-box message can point the right way. */
const BOX_HOME: Record<ExpectedBox, string> = {
  tokens: "the Advanced tab (Site design tokens)",
  array:  "the Blocks tab (Block token sets)",
  preset: "the Builder tab (Import theme preset)",
};

/** What each box expects, for the tail of a wrong-box message. */
const BOX_EXPECTS: Record<ExpectedBox, string> = {
  tokens: "a single flat tokens object: { \"primary\": \"#...\", ... }",
  array:  "an array of named sets: [{ \"key\", \"name\", \"tokens\" }]",
  preset: "a full theme preset with color/typography groups (our preset JSON or a Figma/DTCG export)",
};

/**
 * Human-readable redirect message for a payload that landed in the wrong box.
 * Returns null when the detected kind already matches the expected box (or is
 * unrecognised), so the caller can fall through to its own validation. Admin
 * copy: English, no em-dashes.
 */
export function wrongBoxMessage(kind: TokenPayloadKind, expected: ExpectedBox): string | null {
  if (kind === "unknown" || kind === expected) return null;
  const rightHome = BOX_HOME[kind as ExpectedBox];
  return (
    `This looks like ${KIND_LABEL[kind]}. Import it in ${rightHome}. ` +
    `This box expects ${BOX_EXPECTS[expected]}.`
  );
}
