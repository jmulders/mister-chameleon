/**
 * Design Token Upload Validator
 *
 * Pure validation function for the JSON token files that designers upload on
 * the admin tenant detail page.  No server-only imports — safe to use in both
 * Server Actions (for authoritative validation) and Client Components (for
 * pre-submit feedback before the round-trip).
 *
 * ─── Accepted token file formats ─────────────────────────────────────────────
 *
 * FORMAT A — Legacy flat format (all fields optional):
 *
 *   {
 *     "theme":             "custom",
 *     "primaryColor":      "#e63946",
 *     "primaryFont":       "'Poppins', sans-serif",
 *     "radiusInteractive": "4px",
 *     "radiusCard":        "8px",
 *     "radiusPopover":     "6px"
 *   }
 *
 * FORMAT B — Grouped format (groups and their fields are all optional):
 *
 *   {
 *     "theme": "custom",
 *     "color": {
 *       "primary": "#e63946",
 *       "secondary": "#4a90e2"
 *     },
 *     "typography": {
 *       "fontSans": "'Poppins', sans-serif"
 *     },
 *     "radius": {
 *       "interactive": "4px",
 *       "card": "8px",
 *       "popover": "6px"
 *     },
 *     "spacing":   { "sm": "8px", "md": "16px" },
 *     "border":    { "width": "1px" },
 *     "shadow":    { "sm": "0 1px 2px rgba(0,0,0,0.05)" },
 *     "motion":    { "durationBase": "200ms" },
 *     "component": { "buttonRadius": "4px" },
 *     "layout":    { "navLinkSize": "0.875rem", "headerBg": "#ffffff" }
 *   }
 *
 *   The two formats must not be mixed: a file may not contain both grouped
 *   keys (color, typography, …) and legacy flat keys (primaryColor, primaryFont, …).
 *   "theme" is valid in both formats and does not count as mixing.
 *
 * ─── What the tokens map to ───────────────────────────────────────────────────
 *
 *   Legacy format:
 *     theme             → TenantDesignSettings.theme      (ThemeKey)
 *     primaryColor      → TenantDesignSettings.primaryColor
 *     primaryFont       → TenantDesignSettings.primaryFont
 *     radiusInteractive → TenantDesignSettings.tokenOverrides.radiusInteractive
 *     radiusCard        → TenantDesignSettings.tokenOverrides.radiusCard
 *     radiusPopover     → TenantDesignSettings.tokenOverrides.radiusPopover
 *
 *   Grouped format:
 *     theme             → TenantDesignSettings.theme      (ThemeKey)
 *     color.*           → TenantDesignSettings.tokenOverrides.color.*
 *     typography.*      → TenantDesignSettings.tokenOverrides.typography.*
 *     radius.*          → TenantDesignSettings.tokenOverrides.radius.*
 *     spacing.*         → TenantDesignSettings.tokenOverrides.spacing.*
 *     border.*          → TenantDesignSettings.tokenOverrides.border.*
 *     shadow.*          → TenantDesignSettings.tokenOverrides.shadow.*
 *     motion.*          → TenantDesignSettings.tokenOverrides.motion.*
 *     component.*       → TenantDesignSettings.tokenOverrides.component.*
 *     layout.*          → TenantDesignSettings.tokenOverrides.layout.*
 *                          header/footer shell colors + navigation typography
 *                          → --header-bg, --header-fg, --nav-link-size, etc.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Top-level key whitelist — unknown top-level keys are rejected.
 *   Per-group key whitelist — unknown keys within a group are rejected.
 *   Value sanitisation — values containing CSS injection chars (; { } < > \)
 *   are rejected.  CSS functions like rgb(), hsl(), oklch(), cubic-bezier()
 *   are allowed.  Arbitrary CSS upload is not possible via this path.
 *   The file size limit (64 KB) is enforced in the client component before
 *   this function is called.
 */

import type { ThemeKey } from "./types";
import { DESIGN_PRESETS }  from "./design-theme";
import { looksLikeDtcg, convertDtcgToGroupedTokens } from "./dtcg-token-adapter";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * The parsed, validated token payload ready to be merged into TenantDesignSettings.
 *
 * All fields are optional — only the tokens present in the uploaded file
 * and confirmed as valid are included.
 *
 * Top-level flat fields (primaryColor, primaryFont, radius*) come from the
 * legacy format.  Group fields (color, typography, radius, …) come from the
 * grouped format.  Both formats may include `theme`.
 */
export interface DesignTokenUploadInput {
  // ── Top-level (both formats) ─────────────────────────────────────────────────
  theme?: ThemeKey;

  // ── Legacy flat fields ────────────────────────────────────────────────────────
  primaryColor?:      string;
  primaryFont?:       string;
  radiusInteractive?: string;
  radiusCard?:        string;
  radiusPopover?:     string;

  // ── Grouped token fields (new) ────────────────────────────────────────────────
  color?:      Record<string, string>;
  typography?: Record<string, string>;
  radius?:     Record<string, string>;
  spacing?:    Record<string, string>;
  border?:     Record<string, string>;
  shadow?:     Record<string, string>;
  motion?:     Record<string, string>;
  component?:  Record<string, string>;
  // layout: header/footer shell colors + navigation typography overrides.
  // Maps to --header-*, --footer-*, --nav-link-* CSS custom properties.
  layout?:     Record<string, string>;
  // Design-preset token groups (Builder / Gallery).
  grid?:       Record<string, string>;
  responsive?: Record<string, string>;
  elevation?:  Record<string, string>;
  focus?:      Record<string, string>;
  button?:     Record<string, string>;
}

// ── Token key definitions ──────────────────────────────────────────────────────

/**
 * All accepted top-level keys in the legacy flat token format, in
 * user-facing display order.
 */
export const DESIGN_TOKEN_KEYS = [
  "theme",
  "primaryColor",
  "primaryFont",
  "radiusInteractive",
  "radiusCard",
  "radiusPopover",
] as const;

export type DesignTokenKey = (typeof DESIGN_TOKEN_KEYS)[number];

/**
 * Supported token group names for the grouped token format.
 * These are the only valid top-level group keys in a grouped token file.
 */
export const GROUPED_TOKEN_GROUPS = [
  "color",
  "typography",
  "radius",
  "spacing",
  "border",
  "shadow",
  "motion",
  "component",
  // layout: structural chrome layer — header/footer shell colors and
  // navigation typography.  Maps to LAYOUT_CSS_VARS in resolve-theme.ts.
  "layout",
  // Design-preset token groups (Builder / Gallery).
  "grid",
  "responsive",
  "elevation",
  "focus",
  "button",
] as const;

export type GroupedTokenGroup = (typeof GROUPED_TOKEN_GROUPS)[number];

/**
 * Allowed keys within each token group.
 *
 * This is the per-group allowlist that prevents arbitrary CSS variable
 * injection.  Keys outside this list are rejected with a descriptive error.
 * Each key maps to a CSS custom property; see resolve-theme.ts for the
 * exact mapping.
 */
export const GROUP_TOKEN_KEYS: Record<GroupedTokenGroup, readonly string[]> = {
  color: [
    "primary", "secondary", "accent",
    "background", "foreground",
    "muted", "mutedForeground",
    "border", "input", "ring",
    "destructive", "destructiveForeground",
    "card", "cardForeground",
    "popover", "popoverForeground",
    // Design-preset additions
    "primaryHover", "onPrimary", "link", "success", "danger",
    // Gradients — full CSS gradient strings (validated as "string" → injection
    // guard only, since no fixed type fits linear/radial/conic-gradient()).
    "gradient", "gradientHero", "gradientAccent",
  ],
  typography: [
    // Base font families
    "fontSans", "fontMono", "fontSerif",
    "baseFontSize", "lineHeightBase",
    "fontSansSource", "fontSerifSource", "fontMonoSource",
    // Usage-role mappings
    "fontHeading", "fontBody", "fontUI", "fontCode",
    "fontHeadingSource",
    // Design-preset additions
    "scaleRatio", "headingWeight", "navWeight",
    "letterSpacing", "headingTransform", "eyebrowTransform",
    "navTransform", "navTracking", "linkUnderline",
    "headingLineHeight", "bodyLineHeight",
  ],
  radius: [
    "interactive", "card", "popover",
    "sm", "md", "lg", "full",
    // Design-preset additions
    "button", "input",
  ],
  spacing: [
    "base", "xs", "sm", "md", "lg", "xl", "2xl",
    // Design-preset additions
    "sectionPadding", "container", "align",
  ],
  border: [
    "width", "widthSm", "widthLg", "color",
  ],
  shadow: [
    "sm", "md", "lg", "xl", "none",
  ],
  motion: [
    "durationFast", "durationBase", "durationSlow",
    "easingDefault", "easingIn", "easingOut", "easingInOut",
    // Design-preset additions
    "hoverLift", "cardHoverShadow", "speed", "revealOnScroll",
  ],
  component: [
    "buttonRadius", "buttonPaddingX", "buttonPaddingY",
    "cardPadding", "cardRadius",
    "inputRadius", "inputHeight",
    "badgeRadius",
  ],
  // ── layout — structural chrome layer ─────────────────────────────────────
  // Header/footer shell color tokens + navigation typography tokens.
  // Each key maps to a specific CSS custom property via LAYOUT_CSS_VARS in
  // resolve-theme.ts (e.g. navLinkSize → --nav-link-size).
  // Unknown keys fall back to --layout-{kebab-key} as a safety net.
  layout: [
    // Header shell
    "headerBg",
    "headerBgScrolled",
    "headerFg",
    "headerBorder",
    // Footer shell
    "footerBg",
    "footerFg",
    "footerBorder",
    // Navigation typography
    "navLinkSize",
    "navLinkWeight",
    "navLinkTracking",
    "navDropdownItemSize",
    "footerNavSize",
    // Design-preset additions
    "headerStyle",
    "navWeight",
    "navTracking",
    "navTransform",
    "navHover",
    "footerStyle",
  ],
  // ── Design-preset token groups ───────────────────────────────────────────
  grid: [
    "columns", "gutter", "contentWidth",
  ],
  responsive: [
    "sectionDesktop", "sectionTablet", "sectionMobile",
  ],
  elevation: [
    "mode", "cardShadow",
  ],
  focus: [
    "ringWidth", "ringColor",
  ],
  button: [
    "primaryFill", "primaryHover", "primaryText",
    "secondaryStyle", "radius", "paddingX", "paddingY",
    "weight", "transform", "tracking", "shadow",
  ],
} as const;

/**
 * Result of validating a token file.
 *
 *   ok: true  — `tokens` is the validated payload; `appliedKeys` lists the
 *               top-level keys that will be written (group names for grouped
 *               format, individual key names for legacy format); `warnings`
 *               carries non-fatal notes; `format` identifies which format
 *               was detected.
 *
 *   ok: false — `errors` lists all validation failures; nothing is applied.
 */
export type DesignTokenValidationResult =
  | {
      ok:          true;
      tokens:      DesignTokenUploadInput;
      appliedKeys: string[];
      warnings:    string[];
      format:      "legacy" | "grouped";
    }
  | {
      ok:     false;
      errors: string[];
    };

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Valid theme keys derived from DESIGN_PRESETS — the platform's single source
 * of truth for available themes.  Adding a new theme to DESIGN_PRESETS
 * automatically makes it valid here without a separate manual update.
 */
const VALID_THEME_KEYS = new Set<ThemeKey>(
  Object.keys(DESIGN_PRESETS) as ThemeKey[],
);

/**
 * Characters that indicate a CSS injection attempt when they appear in a
 * token value.  Semicolons, curly braces, angle brackets, and backslashes
 * are never valid in the CSS values this validator accepts.
 *
 * Parentheses are NOT in this list — they are required by CSS functions
 * like rgb(), hsl(), oklch(), cubic-bezier(), and font-family stacks.
 */
const CSS_INJECTION_RE = /[;{}<>\\]/;

function hasCssInjectionRisk(value: string): boolean {
  return CSS_INJECTION_RE.test(value);
}

/**
 * Accepts any non-empty string that does not contain injection-risk characters.
 *
 * Deliberately permissive — CSS color syntax is extremely varied (hex, rgb,
 * rgba, hsl, hsla, oklch, named colors, CSS variables, etc.).  We rely on
 * the injection-character reject list for safety and let the browser be the
 * final arbiter of whether the value actually renders.
 *
 * An optional stricter check warns when the value looks syntactically unusual.
 */
function validateCssColor(
  value: string,
): { ok: true; warning?: string } | { ok: false; reason: string } {
  if (!value.trim()) return { ok: false, reason: "must not be empty." };
  if (hasCssInjectionRisk(value)) {
    return {
      ok:     false,
      reason: `contains disallowed characters (; { } < > \\). Values must be valid CSS color syntax.`,
    };
  }
  const trimmed = value.trim();
  const looksLikeColor =
    /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ||                // hex
    /^(rgb|rgba|hsl|hsla|oklch|lch|lab|color)\s*\(/.test(trimmed) || // function
    /^[a-zA-Z][a-zA-Z-]*$/.test(trimmed) ||               // named color
    /^(transparent|currentcolor|inherit|initial|unset)$/i.test(trimmed);
  return looksLikeColor
    ? { ok: true }
    : { ok: true, warning: `"${trimmed}" doesn't match a recognized CSS color syntax — verify it renders correctly.` };
}

/**
 * Validates a CSS length value (border-radius, spacing, border-width, etc.).
 *
 * Accepts standard length units: px, rem, em, %, vw, vh, vmin, vmax,
 * dvh, dvw, ch, ex.  Also accepts "0" (unitless zero) and CSS globals
 * like "inherit", "initial", "unset".
 */
function validateCssLength(
  value: string,
): { ok: true } | { ok: false; reason: string } {
  if (!value.trim()) return { ok: false, reason: "must not be empty." };
  if (hasCssInjectionRisk(value)) {
    return {
      ok:     false,
      reason: `contains disallowed characters (; { } < > \\).`,
    };
  }
  const trimmed  = value.trim();
  const lengthRe = /^(\d+(\.\d+)?)(px|rem|em|%|vw|vh|vmin|vmax|dvh|dvw|ch|ex)$/;
  const cssGlobals = /^(inherit|initial|unset|revert|revert-layer)$/i;
  if (trimmed === "0" || lengthRe.test(trimmed) || cssGlobals.test(trimmed)) {
    return { ok: true };
  }
  return {
    ok:     false,
    reason: `"${trimmed}" is not a recognised CSS length. Expected formats: "4px", "0.5rem", "2em", "10%", or "0".`,
  };
}

/**
 * Validates a CSS font-family stack.
 *
 * Accepts any non-empty string without injection-risk characters.
 * Font stacks can be very varied, so we rely on the injection guard only.
 */
function validateCssFontFamily(
  value: string,
): { ok: true } | { ok: false; reason: string } {
  if (!value.trim()) return { ok: false, reason: "must not be empty." };
  if (hasCssInjectionRisk(value)) {
    return {
      ok:     false,
      reason: `contains disallowed characters (; { } < > \\).`,
    };
  }
  return { ok: true };
}

/**
 * Validates a general CSS string value (box shadows, motion durations/easings,
 * line-height values, etc.).
 *
 * Accepts any non-empty string without injection-risk characters.
 * These value types are too syntactically diverse for strict structural
 * validation — the injection-character reject list is the security boundary.
 */
function validateCssString(
  value: string,
): { ok: true } | { ok: false; reason: string } {
  if (!value.trim()) return { ok: false, reason: "must not be empty." };
  if (hasCssInjectionRisk(value)) {
    return {
      ok:     false,
      reason: `contains disallowed characters (; { } < > \\).`,
    };
  }
  return { ok: true };
}

// ── Group-level value type dispatch ───────────────────────────────────────────

/** CSS value type — determines which validator is applied to a group token. */
type CssValueType = "color" | "length" | "font-family" | "string";

/**
 * Maps each (group, key) pair to the CSS value type expected for validation.
 *
 * Keys not present in a group's map default to "string" (injection-only check).
 */
const GROUP_VALUE_TYPES: Record<GroupedTokenGroup, Partial<Record<string, CssValueType>>> = {
  color: {
    primary: "color", secondary: "color", accent: "color",
    background: "color", foreground: "color",
    muted: "color", mutedForeground: "color",
    border: "color", input: "color", ring: "color",
    destructive: "color", destructiveForeground: "color",
    card: "color", cardForeground: "color",
    popover: "color", popoverForeground: "color",
    primaryHover: "color", onPrimary: "color", link: "color", success: "color", danger: "color",
  },
  typography: {
    // Base families
    fontSans:       "font-family",
    fontMono:       "font-family",
    fontSerif:      "font-family",
    baseFontSize:   "length",
    lineHeightBase: "string",     // accepts unitless (1.5), percentage (150%), or length
    fontSansSource: "string",     // Google Fonts / Fontsource URL or identifier
    fontSerifSource:"string",
    fontMonoSource: "string",
    // Usage-role mappings
    fontHeading:       "font-family",
    fontBody:          "font-family",
    fontUI:            "font-family",
    fontCode:          "font-family",
    fontHeadingSource: "string",
  },
  radius: {
    interactive: "length", card: "length", popover: "length",
    sm: "length", md: "length", lg: "length", full: "length",
    button: "length", input: "length",
  },
  spacing: {
    base: "length", xs: "length", sm: "length", md: "length",
    lg: "length", xl: "length", "2xl": "length",
    sectionPadding: "length", container: "length", // align → string (default)
  },
  border: {
    width: "length", widthSm: "length", widthLg: "length",
    color: "color",
  },
  shadow: {
    // box-shadow values are too complex for structural validation
    sm: "string", md: "string", lg: "string", xl: "string", none: "string",
  },
  motion: {
    // durations ("200ms", "0.3s") and easing functions ("cubic-bezier(…)", "ease-in-out")
    durationFast: "string", durationBase: "string", durationSlow: "string",
    easingDefault: "string", easingIn: "string", easingOut: "string", easingInOut: "string",
  },
  component: {
    buttonRadius: "length", buttonPaddingX: "length", buttonPaddingY: "length",
    cardPadding: "length", cardRadius: "length",
    inputRadius: "length", inputHeight: "length",
    badgeRadius: "length",
  },
  // layout — header/footer shell colors are CSS colors; typography tokens are
  // CSS lengths (font-size) or strings (font-weight, letter-spacing).
  layout: {
    // Shell colors
    headerBg:         "color",
    headerBgScrolled: "color",
    headerFg:         "color",
    headerBorder:     "color",
    footerBg:         "color",
    footerFg:         "color",
    footerBorder:     "color",
    // Navigation typography — font sizes are lengths; weight/tracking are strings
    // because font-weight accepts numeric values (400, 500, 700) and letter-spacing
    // may be "normal", "0", or a length with units.
    navLinkSize:         "length",
    navLinkWeight:       "string",
    navLinkTracking:     "string",
    navDropdownItemSize: "length",
    footerNavSize:       "length",
    // headerStyle / navWeight / navTracking / navTransform / navHover / footerStyle → string (default)
  },
  // ── Design-preset token groups ───────────────────────────────────────────
  grid: {
    gutter: "length", contentWidth: "length", // columns → string (default)
  },
  responsive: {
    sectionDesktop: "length", sectionTablet: "length", sectionMobile: "length",
  },
  elevation: {
    cardShadow: "string", // mode → string (default)
  },
  focus: {
    ringWidth: "length", ringColor: "color",
  },
  button: {
    primaryFill: "color", primaryHover: "color", primaryText: "color",
    radius: "length", paddingX: "length", paddingY: "length",
    // secondaryStyle / weight / transform / tracking / shadow → string (default)
  },
};

function validateGroupValue(
  group: GroupedTokenGroup,
  key:   string,
  value: unknown,
): { ok: true; warning?: string } | { ok: false; reason: string } {
  if (typeof value !== "string") {
    return { ok: false, reason: `must be a string. Got ${typeof value}.` };
  }
  const type: CssValueType = GROUP_VALUE_TYPES[group]?.[key] ?? "string";
  switch (type) {
    case "color":       return validateCssColor(value);
    case "length":      return validateCssLength(value);
    case "font-family": return validateCssFontFamily(value);
    case "string":
    default:            return validateCssString(value);
  }
}

// ── Validator ─────────────────────────────────────────────────────────────────

/**
 * Validates a parsed (but untyped) JSON token object.
 *
 * Accepts both the legacy flat format and the newer grouped format.
 * Returns a discriminated union — check `result.ok` before using the payload.
 *
 * @param raw  The value to validate — typically the result of `JSON.parse()`.
 *
 * @example
 * const result = validateDesignTokenUpload(JSON.parse(fileContent));
 * if (!result.ok) { showErrors(result.errors); return; }
 * await applyDesignTokensAction(tenantId, result.tokens);
 */
export function validateDesignTokenUpload(raw: unknown): DesignTokenValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  // ── Top-level shape ─────────────────────────────────────────────────────────
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ["Token file must be a JSON object (not an array or primitive)."] };
  }

  // ── DTCG / Tokens Studio (Figma) auto-conversion ────────────────────────────
  // Accept a raw Design Tokens (DTCG) / Tokens Studio export anywhere a token
  // upload is accepted: detect it and convert to the grouped format up front, so
  // EVERY import path (Builder, Advanced editor, …) handles Figma exports the
  // same way — no per-surface wiring.
  let source = raw as Record<string, unknown>;
  let isDtcg = false;
  try {
    isDtcg = looksLikeDtcg(raw);
  } catch {
    isDtcg = false;
  }
  if (isDtcg) {
    try {
      const conv = convertDtcgToGroupedTokens(raw);
      if (conv.mapped === 0) {
        return { ok: false, errors: ["No recognisable design tokens found in this DTCG / Figma export."] };
      }
      source = conv.tokens as Record<string, unknown>;
      warnings.push(...conv.warnings);
    } catch (err) {
      return { ok: false, errors: [`Could not read this DTCG / Figma export: ${String(err)}`] };
    }
  }

  // Ignore common metadata keys so our exported preset files (which carry a
  // `meta` + `swatch` block) and DTCG files (`$schema`/`$description`) import
  // cleanly instead of failing the unknown-key check below.
  const META_KEYS = new Set(["meta", "swatch", "$schema", "$description", "$type", "$value"]);
  const input: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (!META_KEYS.has(k)) input[k] = v;
  }

  // ── Format detection ────────────────────────────────────────────────────────
  // Determine whether this is the legacy flat format or the grouped format,
  // and reject any keys that belong to neither.

  const LEGACY_FIELD_KEYS  = new Set(["primaryColor", "primaryFont", "radiusInteractive", "radiusCard", "radiusPopover"]);
  const GROUP_KEY_SET       = new Set<string>(GROUPED_TOKEN_GROUPS);
  const ALL_TOP_LEVEL_KEYS  = new Set<string>(["theme", ...Array.from(LEGACY_FIELD_KEYS), ...Array.from(GROUP_KEY_SET)]);

  const inputKeys   = Object.keys(input);
  const unknownKeys = inputKeys.filter((k) => !ALL_TOP_LEVEL_KEYS.has(k));

  if (unknownKeys.length > 0) {
    return {
      ok:     false,
      errors: [
        `Unknown top-level key${unknownKeys.length > 1 ? "s" : ""}: ${unknownKeys.map((k) => `"${k}"`).join(", ")}.`,
        `Legacy format accepts: ${DESIGN_TOKEN_KEYS.join(", ")}.`,
        `Grouped format accepts: theme, ${GROUPED_TOKEN_GROUPS.join(", ")}.`,
      ],
    };
  }

  const hasLegacyKeys = inputKeys.some((k) => LEGACY_FIELD_KEYS.has(k));
  const hasGroupKeys  = inputKeys.some((k) => GROUP_KEY_SET.has(k));

  if (hasLegacyKeys && hasGroupKeys) {
    return {
      ok:     false,
      errors: [
        `Cannot mix legacy flat keys (${[...LEGACY_FIELD_KEYS].join(", ")}) with grouped keys (${GROUPED_TOKEN_GROUPS.join(", ")}).`,
        `Use either the legacy flat format or the grouped format — not both in the same file.`,
        `"theme" is valid in both formats and may appear alongside either.`,
      ],
    };
  }

  const format: "legacy" | "grouped" = hasGroupKeys ? "grouped" : "legacy";

  // ── Parse theme (valid in both formats) ─────────────────────────────────────
  const tokens:      DesignTokenUploadInput = {};
  const appliedKeys: string[]               = [];

  if (input.theme !== undefined) {
    if (!VALID_THEME_KEYS.has(input.theme as ThemeKey)) {
      errors.push(
        `"theme": invalid value "${input.theme}". ` +
        `Accepted values: ${[...VALID_THEME_KEYS].join(", ")}.`,
      );
    } else {
      tokens.theme = input.theme as ThemeKey;
      appliedKeys.push("theme");
    }
  }

  // ── Legacy format validation ─────────────────────────────────────────────────
  if (format === "legacy") {

    // primaryColor
    if (input.primaryColor !== undefined) {
      if (typeof input.primaryColor !== "string") {
        errors.push(`"primaryColor": must be a string. Got ${typeof input.primaryColor}.`);
      } else {
        const check = validateCssColor(input.primaryColor);
        if (!check.ok) {
          errors.push(`"primaryColor": ${check.reason}`);
        } else {
          tokens.primaryColor = input.primaryColor;
          appliedKeys.push("primaryColor");
          if (check.warning) warnings.push(`primaryColor — ${check.warning}`);
        }
      }
    }

    // primaryFont
    if (input.primaryFont !== undefined) {
      if (typeof input.primaryFont !== "string") {
        errors.push(`"primaryFont": must be a string. Got ${typeof input.primaryFont}.`);
      } else {
        const check = validateCssFontFamily(input.primaryFont);
        if (!check.ok) {
          errors.push(`"primaryFont": ${check.reason}`);
        } else {
          tokens.primaryFont = input.primaryFont;
          appliedKeys.push("primaryFont");
        }
      }
    }

    // Radius tokens
    const radiusFields = [
      ["radiusInteractive", "--radius-interactive (buttons, inputs, badges)"],
      ["radiusCard",        "--radius-card (cards, panels, modals)"],
      ["radiusPopover",     "--radius-popover (dropdowns, tooltips)"],
    ] as const;

    for (const [field, cssVar] of radiusFields) {
      if (input[field] !== undefined) {
        if (typeof input[field] !== "string") {
          errors.push(`"${field}": must be a string. Got ${typeof input[field]}.`);
        } else {
          const check = validateCssLength(input[field] as string);
          if (!check.ok) {
            errors.push(`"${field}" (${cssVar}): ${check.reason}`);
          } else {
            tokens[field] = input[field] as string;
            appliedKeys.push(field);
          }
        }
      }
    }
  }

  // ── Grouped format validation ────────────────────────────────────────────────
  if (format === "grouped") {
    for (const group of GROUPED_TOKEN_GROUPS) {
      if (input[group] === undefined) continue;

      if (
        typeof input[group] !== "object" ||
        input[group] === null ||
        Array.isArray(input[group])
      ) {
        errors.push(`"${group}": must be a JSON object (a map of token keys to CSS values).`);
        continue;
      }

      const groupInput   = input[group] as Record<string, unknown>;
      const allowedKeys  = new Set(GROUP_TOKEN_KEYS[group]);
      const unknownGroup = Object.keys(groupInput).filter((k) => !allowedKeys.has(k));

      if (unknownGroup.length > 0) {
        errors.push(
          `"${group}": unknown key${unknownGroup.length > 1 ? "s" : ""}: ${unknownGroup.map((k) => `"${k}"`).join(", ")}.`,
        );
        errors.push(
          `  Accepted keys for "${group}": ${GROUP_TOKEN_KEYS[group].join(", ")}.`,
        );
        continue;
      }

      const validatedGroup: Record<string, string> = {};
      let   groupHasValues = false;

      for (const key of Object.keys(groupInput)) {
        const check = validateGroupValue(group, key, groupInput[key]);
        if (!check.ok) {
          errors.push(`"${group}.${key}": ${check.reason}`);
        } else {
          validatedGroup[key] = groupInput[key] as string;
          groupHasValues = true;
          if ("warning" in check && check.warning) {
            warnings.push(`${group}.${key} — ${check.warning}`);
          }
        }
      }

      if (groupHasValues) {
        (tokens as Record<string, unknown>)[group] = validatedGroup;
        appliedKeys.push(group);
      }
    }
  }

  // ── Require at least one token ──────────────────────────────────────────────
  if (errors.length === 0 && appliedKeys.length === 0) {
    return {
      ok:     false,
      errors: [
        "Token file contains no recognised token fields.",
        format === "legacy"
          ? `Add at least one of: ${DESIGN_TOKEN_KEYS.join(", ")}.`
          : `Add at least one group: ${GROUPED_TOKEN_GROUPS.join(", ")}.`,
      ],
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, tokens, appliedKeys, warnings, format };
}
