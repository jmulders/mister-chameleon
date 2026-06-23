/**
 * DTCG / Tokens Studio → grouped token adapter
 *
 * Converts a W3C Design Tokens (DTCG) or Tokens Studio JSON export — the shape
 * Figma Variables and the Tokens Studio plugin produce — into the platform's
 * grouped token-upload shape ({ theme?, color, typography, radius, … }) that
 * `validateDesignTokenUpload` accepts.
 *
 * ─── What it understands ──────────────────────────────────────────────────────
 *
 *   • DTCG tokens: `{ "$value": …, "$type": … }`, nested in groups, with group
 *     `$type` inheritance and `{alias.references}` in values.
 *   • Tokens Studio tokens: `{ "value": …, "type": … }` (no `$`).
 *   • Value kinds: color (hex/rgb string), dimension ("8px" or { value, unit }),
 *     fontFamily (string or array → CSS stack), fontWeight (number or named),
 *     shadow (object/array → CSS box-shadow string).
 *
 * ─── Best-effort mapping ──────────────────────────────────────────────────────
 *
 *   Token NAMES vary between design systems, so the mapping is heuristic: tokens
 *   are classified by `$type` + name (primary, background, text, border, radius,
 *   shadow, heading/body font, …). Anything it can't confidently place is left
 *   out and reported in `warnings`. Always review the result in the Builder
 *   preview before saving — this is a convenience, not a guaranteed 1:1 import.
 */

export interface DtcgConversionResult {
  /** Grouped token-upload payload (theme + token groups). */
  tokens:   Record<string, unknown>;
  /** Number of source tokens successfully mapped. */
  mapped:   number;
  /** Human-readable notes (unmapped tokens, ambiguous values). */
  warnings: string[];
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A leaf token collected from the tree, with its resolved path + type. */
interface Leaf {
  path:  string[];
  value: unknown;
  type?: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A node is a token when it carries a value (DTCG `$value` or Studio `value`). */
function tokenValue(node: Record<string, unknown>): { value: unknown; type?: string } | null {
  if ("$value" in node) {
    return { value: node.$value, type: typeof node.$type === "string" ? node.$type : undefined };
  }
  if ("value" in node && "type" in node) {
    return { value: node.value, type: typeof node.type === "string" ? node.type : undefined };
  }
  if ("value" in node) {
    return { value: node.value, type: undefined };
  }
  return null;
}

/** True when the input looks like a DTCG / Tokens Studio export. */
export function looksLikeDtcg(input: unknown): boolean {
  let found = false;
  const walk = (node: unknown, depth: number) => {
    if (found || depth > 8 || !isRecord(node)) return;
    if ("$value" in node) { found = true; return; }
    if ("value" in node && "type" in node) { found = true; return; }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      walk(v, depth + 1);
    }
  };
  walk(input, 0);
  return found;
}

// ── Flatten + alias resolution ────────────────────────────────────────────────

function collectLeaves(input: unknown): Leaf[] {
  const leaves: Leaf[] = [];
  const walk = (node: unknown, path: string[], inheritedType: string | undefined) => {
    if (!isRecord(node)) return;
    const groupType = typeof node.$type === "string" ? node.$type
                    : typeof node.type === "string" && !("value" in node) ? node.type
                    : inheritedType;
    const tv = tokenValue(node);
    if (tv) {
      leaves.push({ path, value: tv.value, type: tv.type ?? inheritedType });
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith("$")) continue;
      if (k === "type" || k === "value" || k === "description") continue;
      walk(v, [...path, k], groupType);
    }
  };
  walk(input, [], undefined);
  return leaves;
}

/** Resolve `{a.b.c}` aliases against the flat path→value map (cycle-guarded). */
function resolveAlias(
  value: unknown,
  byPath: Map<string, Leaf>,
  seen: Set<string>,
): unknown {
  if (typeof value !== "string") return value;
  const m = value.match(/^\{([^}]+)\}$/);
  if (!m) return value;
  const ref = norm(m[1]);
  if (seen.has(ref)) return undefined;
  seen.add(ref);
  const target = byPath.get(ref);
  if (!target) return undefined;
  return resolveAlias(target.value, byPath, seen);
}

// ── Value coercion ─────────────────────────────────────────────────────────────

const WEIGHT_NAMES: Record<string, string> = {
  thin: "100", extralight: "200", ultralight: "200", light: "300",
  regular: "400", normal: "400", book: "400", medium: "500",
  semibold: "600", demibold: "600", bold: "700", extrabold: "800",
  ultrabold: "800", black: "900", heavy: "900",
};

function coerceDimension(value: unknown): string | null {
  if (typeof value === "number") return `${value}px`;
  if (typeof value === "string") return value.trim() || null;
  if (isRecord(value) && typeof value.value === "number") {
    const unit = typeof value.unit === "string" ? value.unit : "px";
    return `${value.value}${unit}`;
  }
  return null;
}

function coerceFontFamily(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const fams = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (!fams.length) return null;
    return fams.map((f) => (/\s/.test(f) && !/['"]/.test(f) ? `'${f}'` : f)).join(", ");
  }
  return null;
}

function coerceWeight(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const n = norm(value);
    return WEIGHT_NAMES[n] ?? (/^\d+$/.test(value.trim()) ? value.trim() : null);
  }
  return null;
}

function coerceShadow(value: unknown): string | null {
  const one = (s: Record<string, unknown>): string | null => {
    const x = coerceDimension(s.offsetX ?? s.x);
    const y = coerceDimension(s.offsetY ?? s.y);
    const blur = coerceDimension(s.blur) ?? "0";
    const spread = coerceDimension(s.spread) ?? "0";
    const color = typeof s.color === "string" ? s.color : null;
    if (!x || !y || !color) return null;
    const inset = s.type === "innerShadow" || s.inset === true ? "inset " : "";
    return `${inset}${x} ${y} ${blur} ${spread} ${color}`;
  };
  if (Array.isArray(value)) {
    const parts = value.filter(isRecord).map(one).filter((p): p is string => !!p);
    return parts.length ? parts.join(", ") : null;
  }
  if (isRecord(value)) return one(value);
  if (typeof value === "string") return value.trim() || null;
  return null;
}

// ── Classification ─────────────────────────────────────────────────────────────

/** [test against normalised name/path, target key]. Order = priority. */
const COLOR_RULES: [RegExp, string][] = [
  [/primaryhover|hoverprimary/,                                  "primaryHover"],
  [/onprimary|primaryforeground|primarycontrast|textonprimary/,  "onPrimary"],
  [/mutedforeground|textmuted|textsecondary|subtletext/,         "mutedForeground"],
  [/cardforeground|oncard|cardtext/,                             "cardForeground"],
  [/textprimary|bodytext|textbody|inkprimary|^text$|foreground|^fg$|oncanvas/, "foreground"],
  [/brandprimary|colorprimary|^primary$|^brand$/,                "primary"],
  [/secondary/,                                                  "secondary"],
  [/accent/,                                                     "accent"],
  [/background|^bg$|surface|canvas|^base$/,                      "background"],
  [/muted|subtle/,                                               "muted"],
  [/border|outline|divider|stroke/,                              "border"],
  [/card/,                                                       "card"],
  [/link/,                                                       "link"],
  [/success|positive/,                                           "success"],
  [/danger|error|negative|destructive/,                         "danger"],
];

function classifyColor(leafNorm: string, lastTwoNorm: string): string | null {
  for (const [re, key] of COLOR_RULES) {
    if (re.test(lastTwoNorm) || re.test(leafNorm)) return key;
  }
  return null;
}

/**
 * Convert a DTCG / Tokens Studio export to the grouped token-upload payload.
 */
export function convertDtcgToGroupedTokens(input: unknown): DtcgConversionResult {
  const warnings: string[] = [];
  const leaves = collectLeaves(input);
  const byPath = new Map<string, Leaf>();
  for (const l of leaves) byPath.set(norm(l.path.join(".")), l);

  const out: Record<string, Record<string, string>> = {};
  const put = (group: string, key: string, value: string) => {
    (out[group] ??= {})[key] = value;
  };

  let mapped = 0;

  for (const leaf of leaves) {
    const resolved = resolveAlias(leaf.value, byPath, new Set());
    if (resolved === undefined) { warnings.push(`Niet-opgeloste alias: ${leaf.path.join(".")}`); continue; }

    const leafName = norm(leaf.path[leaf.path.length - 1] ?? "");
    const lastTwo  = norm(leaf.path.slice(-2).join(""));
    const type     = (leaf.type ?? "").toLowerCase();

    // ── Colour ──────────────────────────────────────────────────────────────
    if (type === "color" || /(^|[^a-z])colors?([^a-z]|$)/.test(norm(leaf.path.join("."))) || (typeof resolved === "string" && /^#|^rgb|^hsl|^oklch/.test(resolved.trim()))) {
      if (typeof resolved !== "string") continue;
      const key = classifyColor(leafName, lastTwo);
      if (key) { put("color", key, resolved.trim()); mapped++; }
      else warnings.push(`Kleur niet herkend → overgeslagen: ${leaf.path.join(".")}`);
      continue;
    }

    // ── Typography ──────────────────────────────────────────────────────────
    if (type === "fontfamily" || type === "fontfamilies" || /font(family|families)?$/.test(lastTwo)) {
      const css = coerceFontFamily(resolved);
      if (!css) continue;
      const isHeading = /head|display|title/.test(lastTwo) || /head|display|title/.test(leafName);
      put("typography", isHeading ? "fontHeading" : "fontBody", css); mapped++;
      continue;
    }
    if (type === "fontweight" || type === "fontweights" || /weight/.test(lastTwo)) {
      const w = coerceWeight(resolved);
      if (w) { put("typography", "headingWeight", w); mapped++; }
      continue;
    }
    if (type === "letterspacing" || /letterspacing|tracking/.test(lastTwo)) {
      const d = coerceDimension(resolved);
      if (d) { put("typography", "letterSpacing", d); mapped++; }
      continue;
    }
    if (type === "lineheight" || type === "lineheights" || /lineheight/.test(lastTwo)) {
      if (typeof resolved === "string" || typeof resolved === "number") {
        put("typography", "headingLineHeight", String(resolved)); mapped++;
      }
      continue;
    }
    if ((type === "fontsize" || type === "fontsizes" || type === "dimension") && /font|text|size|body/.test(lastTwo) && !/radius|space|gap/.test(lastTwo)) {
      const d = coerceDimension(resolved);
      if (d) { put("typography", "baseFontSize", d); mapped++; }
      continue;
    }

    // ── Radius ──────────────────────────────────────────────────────────────
    if (type === "borderradius" || /radius|rounding|corner/.test(lastTwo)) {
      const d = coerceDimension(resolved);
      if (!d) continue;
      const key = /card|large|lg|panel/.test(lastTwo) ? "card"
                : /button|interactive|control|sm|small/.test(lastTwo) ? "interactive"
                : "interactive";
      put("radius", key, d); mapped++;
      continue;
    }

    // ── Shadow / elevation ──────────────────────────────────────────────────
    if (type === "boxshadow" || type === "shadow" || /shadow|elevation/.test(lastTwo)) {
      const css = coerceShadow(resolved);
      if (!css) continue;
      const key = /lg|large/.test(lastTwo) ? "lg" : /sm|small/.test(lastTwo) ? "sm" : "md";
      put("shadow", key, css); mapped++;
      continue;
    }

    // ── Spacing ─────────────────────────────────────────────────────────────
    if (type === "spacing" || /spacing|space|gap/.test(lastTwo)) {
      const d = coerceDimension(resolved);
      if (d && /section|sectionpadding/.test(lastTwo)) { put("spacing", "sectionPadding", d); mapped++; }
      continue;
    }
  }

  const tokens: Record<string, unknown> = { theme: "custom", ...out };
  if (mapped === 0) warnings.push("Geen herkenbare design-tokens gevonden in dit bestand.");

  return { tokens, mapped, warnings };
}
