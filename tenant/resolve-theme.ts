/**
 * Tenant Theme Resolver
 *
 * Converts a TenantSettings object into a flat set of CSS custom property
 * overrides that can be injected as an inline :root{…} block.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   The design system already generates a base :root block in theme.css (the
 *   "default" theme).  This resolver produces *override* vars only — the delta
 *   between the tenant's requested theme and the platform baseline.
 *
 * ─── Three levels of override (applied in order, highest wins) ───────────────
 *
 *   1. Preset — controlled by `design.theme` (ThemeKey).
 *      Maps to a radius personality ("sharp" / "balanced" / "soft") and
 *      determines the values of --radius-interactive, --radius-card, and
 *      --radius-popover.
 *
 *   2. Legacy token overrides — `design.primaryColor`, `design.primaryFont`,
 *      and the flat `design.tokenOverrides.radius*` fields.
 *
 *   3. Grouped token overrides — `design.tokenOverrides.color.*`,
 *      `design.tokenOverrides.typography.*`, etc.  Applied last; highest
 *      specificity in the CSS variable cascade.
 *
 * ─── CSS vars emitted ─────────────────────────────────────────────────────────
 *
 *   From preset / legacy:
 *     --primary, --ring, --text-brand    ← primaryColor
 *     --font-sans                        ← primaryFont
 *     --radius-interactive               ← radiusInteractive / radius.interactive
 *     --radius-card                      ← radiusCard / radius.card
 *     --radius-popover                   ← radiusPopover / radius.popover
 *
 *   From grouped token overrides (examples):
 *     color.*        → --primary/--ring/--text-brand (primary), --{key} (others)
 *     typography.*   → --font-sans/--font-mono/--font-serif (known keys),
 *                      --typography-{kebab-key} (others)
 *     radius.*       → --radius-{key} (all keys)
 *     spacing.*      → --spacing-{kebab-key}
 *     border.*       → --border-{kebab-key}
 *     shadow.*       → --shadow-{kebab-key}
 *     motion.*       → --motion-{kebab-key}
 *     component.*    → --component-{kebab-key}
 *
 * ─── Fallback ─────────────────────────────────────────────────────────────────
 *
 *   resolveThemeForTenant(null) — and any settings row where `design` is absent
 *   or partial — returns { key: "default", vars: {} } which emits no overrides,
 *   so the compiled theme.css baseline applies unchanged.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In a Server Component:
 *   const theme = resolveThemeForTenant(tenant);
 *   const css   = resolvedThemeToCSS(theme);
 *   // → ":root{--primary:#e63946;--radius-card:24px}"
 *
 *   // Inject inline in the page:
 *   {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
 */

import type { TenantSettings, ThemeKey, TenantTokenOverrides } from "./types";
import { THEME_PRESETS }           from "@/design-system/theme/presets";
import type { ThemePresetKey }      from "@/design-system/theme/presets";
import { tenantThemeToVarsRecord }  from "@/design-system/theme/tenant-theme";
import { isThemePresetKey }        from "@/design-system/theme/presets";

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * The result of resolving a tenant's design settings into concrete CSS vars.
 *
 * `key`  — the resolved ThemeKey (falls back to "default" when tenant is null)
 * `vars` — flat map of CSS custom property name → value.
 *          Empty when no overrides are needed (default theme, no token tweaks).
 */
export interface ResolvedTheme {
  readonly key:  ThemeKey;
  readonly vars: Record<string, string>;
}

// ── Curated theme → ThemePresetKey mapping ────────────────────────────────────
//
// Each new ThemeKey maps to its matching ThemePresetKey in THEME_PRESETS.
// resolveThemeForTenant() uses this to emit the FULL CSS var set for curated
// themes, rather than only a radius delta like the legacy preset keys.
// Resolution order: curated vars (if any) → legacy radius delta → token overrides

const CURATED_THEME_MAP: Partial<Record<ThemeKey, ThemePresetKey>> = {
  "corporate-blue":     "corporate-blue",
  "modern-green":       "modern-green",
  "minimal-neutral":    "minimal-neutral",
  "bold-dark":          "bold-dark",
  "tech-indigo":        "tech-indigo",
  "warm-professional":  "warm-professional",
  "recruitment-energy": "recruitment-energy",
  "healthcare-calm":    "healthcare-calm",
  "industrial-strong":  "industrial-strong",
  "premium-editorial":  "premium-editorial",
  "dark-contrast":      "dark-contrast",
  "editorial-classic":  "editorial-classic",
  "playful-startup":    "playful-startup",
  "startup-energy":     "startup-energy",
  "corporate-trust":    "corporate-trust",
  "modern-saas":        "modern-saas",
  "corporate-clean":    "corporate-clean",
  "bold-marketing":     "bold-marketing",
  "portfolio-showcase": "portfolio-showcase",
  "premium-luxury":     "premium-luxury",
  // ── Seasonal themes ──────────────────────────────────────────────────────
  "valentine-pink":     "valentine-pink",
  "dutch-orange":       "dutch-orange",
  // ── Careers / HR themes ──────────────────────────────────────────────────
  "careers-human":      "careers-human",
  // ── Premium families ─────────────────────────────────────────────────────
  // Dark AI and Clean Corporate use the new featured-family CSS var pipeline
  // (tenantThemeToCSS + familyTypographyToVars + familyStructuralToVars) and
  // do NOT need a CURATED_THEME_MAP entry — their vars come from THEME_PRESETS
  // directly.  Structured SaaS follows the same pattern.
} as const;

// Pre-computed full CSS var sets for each curated theme.
// Built once at module initialisation — pure, no I/O.
const CURATED_THEME_VARS: Partial<Record<ThemeKey, Record<string, string>>> =
  Object.fromEntries(
    (Object.entries(CURATED_THEME_MAP) as [ThemeKey, ThemePresetKey][]).map(
      ([themeKey, presetKey]) => [
        themeKey,
        tenantThemeToVarsRecord(THEME_PRESETS[presetKey]),
      ],
    ),
  );

// ── Preset radius tables ───────────────────────────────────────────────────────
//
// Values mirror RADIUS_PRESETS in design-system/theme/tenant-theme.ts:
//   sharp    → interactive 2px, card 4px, popover 2px
//   balanced → interactive 8px, card 16px, popover 12px  (platform default)
//   soft     → interactive 12px, card 24px, popover 16px
//
// Theme → radius personality mapping (legacy preset keys only):
//   default  → balanced (no-op; matches theme.css :root)
//   minimal  → sharp   (clean, technical aesthetic)
//   bold     → soft    (generous, expressive aesthetic)
//   custom   → balanced (only explicit token overrides apply)
//
// Curated theme keys map to {} here — their full vars come from CURATED_THEME_VARS.

const PRESET_RADIUS_VARS: Record<ThemeKey, Record<string, string>> = {
  // ── Legacy platform presets ────────────────────────────────────────────────
  default: {}, // Matches compiled theme.css baseline — emit nothing.
  minimal: {
    "--radius-interactive": "2px",
    "--radius-card":        "4px",
    "--radius-popover":     "2px",
  },
  bold: {
    "--radius-interactive": "12px",
    "--radius-card":        "24px",
    "--radius-popover":     "16px",
  },
  custom: {}, // No radius preset; only explicit overrides apply.
  // ── Curated themes — full vars handled by CURATED_THEME_VARS above ─────────
  "corporate-blue":     {},
  "modern-green":       {},
  "minimal-neutral":    {},
  "bold-dark":          {},
  "tech-indigo":        {},
  "warm-professional":  {},
  "recruitment-energy": {},
  "healthcare-calm":    {},
  "industrial-strong":  {},
  "premium-editorial":  {},
  "dark-contrast":      {},
  "editorial-classic":  {},
  "playful-startup":    {},
  "startup-energy":     {},
  "corporate-trust":    {},
  "modern-saas":        {},
  "corporate-clean":    {},
  "bold-marketing":     {},
  // ── Signature themes — full vars handled by CURATED_THEME_VARS ──────────────
  "portfolio-showcase": {},
  "premium-luxury":     {},
  // ── Seasonal themes — full vars handled by CURATED_THEME_VARS ───────────────
  "valentine-pink":     {},
  "dutch-orange":       {},
  // ── Careers / HR themes — full vars handled by CURATED_THEME_VARS ────────────
  "careers-human":      {},
  // ── Premium families — resolved via tenantThemeToCSS(resolveTheme(key)) ──────
  "dark-ai":            {},
  "clean-corporate":    {},
  "structured-saas":    {},
  // Blueprint presets — radius vars come from the base preset / CURATED_THEME_VARS.
  "werkenbij-blueprint":     {},
  "corporate-b2b-blueprint": {},
  "saas-blueprint":          {},
};

// ── Grouped token → CSS var mapping ──────────────────────────────────────────

/**
 * Converts a camelCase token key to a kebab-case CSS var suffix.
 * e.g. "fontSans" → "font-sans", "durationBase" → "duration-base"
 */
function toKebabCase(key: string): string {
  return key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Direct CSS var mappings for color group keys following the shadcn/ui
 * design token convention.  Keys not listed fall back to `--color-{kebab-key}`.
 *
 * "primary" is special: it sets three vars to match the legacy primaryColor
 * behaviour (--primary, --ring, --text-brand).
 */
const COLOR_CSS_VARS: Record<string, string[]> = {
  // Each token also writes the COMPONENT-facing var names (the blocks read
  // --btn-bg / --text / --bg / --card-bg / --card-border / --text-muted /
  // --bg-subtle, not the canonical --primary/--foreground/… names). Without
  // these aliases a custom token override only reached a few elements (the
  // header) while buttons, cards and section backgrounds kept the base theme.
  primary:               ["--primary", "--ring", "--text-brand", "--btn-bg", "--section-cta-bg"],
  primaryHover:          ["--primary-hover", "--primary-active", "--btn-hover-bg", "--btn-active-bg"],
  secondary:             ["--secondary", "--nav-link-hover"],
  accent:                ["--accent"],
  background:            ["--background", "--bg", "--text-inverse", "--ring-offset", "--hero-light-bg"],
  foreground:            ["--foreground", "--text", "--proof-quote-color", "--bg-inverse", "--section-hero-bg", "--hero-bg", "--hero-dark-bg"],
  muted:                 ["--muted", "--bg-subtle", "--section-subtle-bg", "--primary-subtle"],
  mutedForeground:       ["--muted-foreground", "--text-muted", "--text-subtle"],
  border:                ["--border", "--border-strong", "--card-border", "--section-subtle-border", "--proof-card-border"],
  input:                 ["--input"],
  ring:                  ["--ring"],
  destructive:           ["--destructive"],
  destructiveForeground: ["--destructive-foreground"],
  card:                  ["--card", "--card-bg"],
  cardForeground:        ["--card-foreground"],
  popover:               ["--popover"],
  popoverForeground:     ["--popover-foreground"],
  // ── Design-preset additions ────────────────────────────────────────────────
  // onPrimary = text/icon colour on a filled primary surface (buttons).
  onPrimary:             ["--primary-foreground", "--btn-text", "--primary-text", "--btn-primary-text"],
  link:                  ["--link"],
  success:               ["--success"],
  danger:                ["--danger", "--destructive"],
  // Gradients — full CSS gradient strings exposed as custom properties for use
  // in hero/section backgrounds and custom CSS (var(--gradient)).
  gradient:              ["--gradient"],
  gradientHero:          ["--gradient-hero"],
  gradientAccent:        ["--gradient-accent"],
};

/**
 * Direct CSS var mappings for typography group keys.
 * Keys not listed fall back to `--typography-{kebab-key}`.
 *
 * Two-tier layout:
 *   Base families — fontSans/fontMono/fontSerif → --font-sans etc.
 *   Role mappings — fontHeading/fontBody/fontUI/fontCode → --font-heading etc.
 *
 * Source keys (fontSansSource, fontHeadingSource, …) are UI-only metadata and
 * are intentionally absent from this map — they produce no CSS output.
 */
const TYPOGRAPHY_CSS_VARS: Record<string, string> = {
  // Base font families
  fontSans:       "--font-sans",
  fontMono:       "--font-mono",
  fontSerif:      "--font-serif",
  baseFontSize:   "--font-size-base",
  lineHeightBase: "--line-height-base",
  // Usage-role mappings
  fontHeading:    "--font-heading",
  fontBody:       "--font-body",
  fontUI:         "--font-ui",
  fontCode:       "--font-code",
  // ── Design-preset additions ────────────────────────────────────────────────
  scaleRatio:        "--type-scale-ratio",
  // Reuse the existing consumer var so heading weight renders with no CSS change.
  headingWeight:     "--font-heading-weight",
  navWeight:         "--nav-link-weight",
  letterSpacing:     "--letter-spacing",
  headingTransform:  "--heading-transform",
  eyebrowTransform:  "--eyebrow-transform",
  navTransform:      "--nav-link-transform",
  navTracking:       "--nav-link-tracking",
  linkUnderline:     "--link-underline",
  headingLineHeight: "--heading-line-height",
  bodyLineHeight:    "--line-height-base",
};

/**
 * Direct CSS var mappings for radius group keys.
 * Keys not listed fall back to `--radius-{kebab-key}`.
 */
const RADIUS_CSS_VARS: Record<string, string> = {
  interactive: "--radius-interactive",
  card:        "--radius-card",
  popover:     "--radius-popover",
};

/**
 * Direct CSS var mappings for layout group keys (header + footer shell tokens).
 * Keys not listed fall back to `--layout-{kebab-key}`.
 */
const LAYOUT_CSS_VARS: Record<string, string> = {
  // Header shell
  headerBg:         "--header-bg",
  headerBgScrolled: "--header-bg-scrolled",
  headerFg:         "--header-fg",
  headerBorder:     "--header-border",
  // Footer shell
  footerBg:         "--footer-bg",
  footerFg:         "--footer-fg",
  footerBorder:     "--footer-border",
  // Navigation typography
  navLinkSize:         "--nav-link-size",
  navLinkWeight:       "--nav-link-weight",
  navLinkTracking:     "--nav-link-tracking",
  navDropdownItemSize: "--nav-dropdown-item-size",
  footerNavSize:       "--footer-nav-size",
  // ── Design-preset additions ────────────────────────────────────────────────
  headerStyle:   "--header-style",
  navWeight:     "--nav-link-weight",
  navTracking:   "--nav-link-tracking",
  navTransform:  "--nav-link-transform",
  navHover:      "--nav-link-hover-style",
  footerStyle:   "--footer-style",
};

/**
 * Direct CSS var mappings for the design-preset token groups.
 * Keys not listed fall back to `--{group}-{kebab-key}`.
 */
const GRID_CSS_VARS: Record<string, string> = {
  columns:      "--grid-columns",
  gutter:       "--grid-gutter",
  contentWidth: "--content-width",
};

const RESPONSIVE_CSS_VARS: Record<string, string> = {
  sectionDesktop: "--section-py-desktop",
  sectionTablet:  "--section-py-tablet",
  sectionMobile:  "--section-py-mobile",
};

const ELEVATION_CSS_VARS: Record<string, string> = {
  mode:       "--elevation-mode",
  cardShadow: "--card-shadow",
};

const FOCUS_CSS_VARS: Record<string, string> = {
  ringWidth: "--focus-ring-width",
  ringColor: "--focus-ring-color",
};

/**
 * Button per-variant + geometry tokens. These map onto the existing --btn-*
 * custom properties already consumed by Button.tsx / theme.css.
 */
const BUTTON_CSS_VARS: Record<string, string> = {
  primaryFill:    "--btn-bg",
  primaryHover:   "--btn-hover-bg",
  primaryText:    "--btn-text",
  radius:         "--btn-radius",
  paddingX:       "--btn-px",
  paddingY:       "--btn-py",
  weight:         "--btn-font-weight",
  transform:      "--btn-text-transform",
  tracking:       "--btn-tracking",
  shadow:         "--btn-shadow",
  secondaryStyle: "--btn-secondary-style",
};

/**
 * Resolves all entries in one grouped token override into CSS var assignments,
 * writing them into the `vars` map.
 *
 * Applies named mappings for well-known keys; falls back to a
 * `--{group}-{kebab-key}` convention for any keys that have no explicit mapping.
 */
function resolveGroupVars(
  group:   string,
  entries: Readonly<Record<string, string>>,
  vars:    Record<string, string>,
): void {
  for (const [key, value] of Object.entries(entries)) {
    if (!value) continue;
    const kebab = toKebabCase(key);

    switch (group) {
      case "color": {
        const cssVarNames = COLOR_CSS_VARS[key];
        if (cssVarNames) {
          for (const v of cssVarNames) vars[v] = value;
        } else {
          vars[`--color-${kebab}`] = value;
        }
        break;
      }

      case "typography": {
        const cssVar = TYPOGRAPHY_CSS_VARS[key];
        vars[cssVar ?? `--typography-${kebab}`] = value;
        break;
      }

      case "radius": {
        const cssVar = RADIUS_CSS_VARS[key];
        vars[cssVar ?? `--radius-${kebab}`] = value;
        break;
      }

      case "spacing": {
        // Section-rhythm tokens get dedicated vars consumed by Section/Container;
        // everything else uses the generic --spacing-{kebab} convention.
        const special: Record<string, string> = {
          sectionPadding: "--section-py",
          container:      "--container",
          align:          "--content-align",
        };
        vars[special[key] ?? `--spacing-${kebab}`] = value;
        break;
      }
      case "border":    vars[`--border-${kebab}`]     = value; break;
      case "shadow":    vars[`--shadow-${kebab}`]     = value; break;
      case "motion":    vars[`--motion-${kebab}`]     = value; break;
      case "component": vars[`--component-${kebab}`]  = value; break;

      case "layout": {
        const cssVar = LAYOUT_CSS_VARS[key];
        vars[cssVar ?? `--layout-${kebab}`] = value;
        break;
      }

      // ── Design-preset token groups ──────────────────────────────────────────
      case "grid": {
        vars[GRID_CSS_VARS[key] ?? `--grid-${kebab}`] = value;
        break;
      }
      case "responsive": {
        vars[RESPONSIVE_CSS_VARS[key] ?? `--responsive-${kebab}`] = value;
        break;
      }
      case "elevation": {
        vars[ELEVATION_CSS_VARS[key] ?? `--elevation-${kebab}`] = value;
        break;
      }
      case "focus": {
        vars[FOCUS_CSS_VARS[key] ?? `--focus-${kebab}`] = value;
        break;
      }
      case "button": {
        vars[BUTTON_CSS_VARS[key] ?? `--button-${kebab}`] = value;
        break;
      }
    }
  }
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves a tenant's design settings into a flat set of CSS var overrides.
 *
 * Applies overrides in three passes (ascending priority):
 *   1. Preset radius table for the chosen ThemeKey.
 *   2. Legacy primaryColor / primaryFont / tokenOverrides.radius* fields.
 *   3. Grouped token overrides (color, typography, radius, spacing, …).
 *
 * Passing `null` — or a settings row where `design` is absent or partial —
 * produces `{ key: "default", vars: {} }` — no overrides.
 *
 * ─── Defensive reads ─────────────────────────────────────────────────────────
 *
 *   Every access into `settings.design.*` uses `?.` at each step because
 *   TenantSettings rows sourced from Supabase JSONB may omit the `design`
 *   object entirely (rows created before the field was added, or rows with
 *   partial writes).  The pattern `settings?.design.X` only guards against
 *   `settings` being null; it still crashes when `design` is undefined.
 *   All accesses are written as `settings?.design?.X` throughout this function.
 *
 * @param settings         The tenant's settings object, or null to use the defaults.
 * @param themeKeyOverride Optional ThemePresetKey resolved by the contextual theme
 *                         decision engine (resolveThemeDecision).  When provided,
 *                         this overrides `settings.design.theme` so contextual rules
 *                         (time-of-day, seasonal, campaign) can change the active
 *                         theme for a visitor's session without touching the DB.
 * @returns                A ResolvedTheme ready for `resolvedThemeToCSS()`.
 */
export function resolveThemeForTenant(
  settings:         TenantSettings | null,
  themeKeyOverride?: ThemePresetKey | null,
): ResolvedTheme {
  // Use the override when provided and valid — it comes from resolveThemeDecision()
  // and takes precedence over the tenant's stored design.theme.
  const overrideKey = themeKeyOverride && isThemePresetKey(themeKeyOverride)
    ? themeKeyOverride as unknown as ThemeKey
    : null;
  // Defensive: settings.design.theme must be a string.  It can be a non-string object
  // in the unlikely event that a data-write bug corrupted the DB (e.g. spreading a
  // string into numeric keys + a "preset" property).  Fall back to "default" in that
  // case so the homepage renders cleanly instead of throwing a React child error.
  const rawTheme = settings?.design?.theme;
  const storedKey: ThemeKey = typeof rawTheme === "string" ? rawTheme : "default";
  const key = overrideKey ?? storedKey;

  // ── 1. Base vars: full preset (curated themes) or radius delta (legacy) ──────
  //
  // For curated theme keys: emit all CSS vars from the full TenantTheme preset.
  // For legacy keys ("default", "minimal", "bold", "custom"): emit only the
  // radius delta — the CSS baseline from theme.css covers the rest, and legacy
  // token overrides (primaryColor, primaryFont) are applied in pass 2–3.
  const curatedVars = CURATED_THEME_VARS[key];
  const vars: Record<string, string> = curatedVars
    ? { ...curatedVars }
    : { ...PRESET_RADIUS_VARS[key] };

  // ── 2. Legacy primaryColor / primaryFont / flat tokenOverrides ─────────────
  //
  // primaryColor is a legacy single-value override that predates the curated
  // theme system.  For CURATED themes (dutch-orange, valentine-pink, etc.) the
  // full TenantTheme preset already defines all brand colours — including a
  // correct textBrand that is intentionally distinct from the primary button
  // colour.  Applying a stale primaryColor (e.g. the old indigo default that
  // was stored before the tenant switched theme) would overwrite --primary and
  // --text-brand back to purple, producing the unintended purple text bug.
  //
  // Rule: for curated themes, skip the legacy primaryColor override entirely.
  // The curated preset is the source of truth for all brand colours.
  // Operators who want to tweak individual tokens should use the grouped
  // tokenOverrides (level-3, applied below), not the legacy primaryColor field.

  if (settings?.design?.primaryColor && !curatedVars) {
    // Apply only for non-curated (legacy) themes.
    const c = settings.design.primaryColor;
    vars["--primary"]    = c;
    vars["--ring"]       = c;
    vars["--text-brand"] = c;
  }

  // Legacy primaryFont — only applied when typography override is explicitly enabled.
  // When override is off the active family's --font-sans wins, so injecting a stale
  // primaryFont here would silently mask the new family's body font.
  if (settings?.design?.primaryFont && settings?.design?.typographyOverrideEnabled === true) {
    vars["--font-sans"] = settings.design.primaryFont;
  }

  const to: TenantTokenOverrides | undefined = settings?.design?.tokenOverrides;

  if (to) {
    // Legacy flat radius overrides — applied before grouped radius so that
    // the grouped radius group (level 3) wins when both are present.
    if (to.radiusInteractive) vars["--radius-interactive"] = to.radiusInteractive;
    if (to.radiusCard)        vars["--radius-card"]        = to.radiusCard;
    if (to.radiusPopover)     vars["--radius-popover"]     = to.radiusPopover;

    // ── 3. Grouped token overrides (highest specificity) ──────────────────────
    //
    // Typography overrides are only applied when `typographyOverrideEnabled` is
    // explicitly `true`.  When the flag is absent or false the active theme
    // family's typography (already embedded in CURATED_THEME_VARS) wins, which
    // is what makes switching families produce visually distinct results.
    const typographyOverrideEnabled = settings?.design?.typographyOverrideEnabled === true;

    const GROUPS = [
      "color", "typography", "radius", "spacing",
      "border", "shadow", "motion", "component", "layout",
      // Design-preset token groups
      "grid", "responsive", "elevation", "focus", "button",
    ] as const;

    for (const group of GROUPS) {
      // Skip typography when the override toggle is off.
      if (group === "typography" && !typographyOverrideEnabled) continue;

      const groupOverrides = to[group as keyof TenantTokenOverrides] as
        | Readonly<Record<string, string>>
        | undefined;
      if (groupOverrides) {
        resolveGroupVars(group, groupOverrides, vars);
      }
    }

    // ── Hero gradient (applied last so it wins over the solid foreground→hero
    // mapping above). When a preset supplies color.gradientHero, the hero
    // section background becomes that gradient instead of a flat colour.
    // `background: var(--hero-bg)` accepts a full gradient string, so no
    // component change is needed.
    const heroGradient = (to.color as Readonly<Record<string, string>> | undefined)?.gradientHero;
    if (heroGradient) {
      vars["--hero-bg"]          = heroGradient;
      vars["--section-hero-bg"]  = heroGradient;
      vars["--hero-dark-bg"]     = heroGradient;
    }

    // When a preset overrides the header foreground, the top-level nav links must
    // follow it too. Layer A (tenantThemeToCSS) pins --nav-link DIRECTLY from the
    // BASE theme's headerFg, which beats theme.css's `--nav-link: var(--header-fg)`
    // cascade — so an overridden white headerFg would otherwise leave the nav
    // links on the base (dark) colour, invisible on a dark custom header.
    const layoutOv = to.layout as Readonly<Record<string, string>> | undefined;
    if (layoutOv?.headerFg) {
      vars["--nav-link"] = layoutOv.headerFg;
    }
    // Keep the SCROLLED header consistent with the solid header colour. Without
    // this, --header-bg-scrolled defaults to near-white, so a dark custom header
    // (dark headerBg + white headerFg) turns white-on-white after scrolling and
    // the nav becomes invisible. An explicit headerBgScrolled still wins.
    if (layoutOv?.headerBg && !layoutOv.headerBgScrolled) {
      vars["--header-bg-scrolled"] = layoutOv.headerBg;
    }
  }

  return { key, vars };
}

// ── CSS serialiser ─────────────────────────────────────────────────────────────

/**
 * Serialises a ResolvedTheme into an inline CSS `:root { … }` string.
 *
 * Returns an empty string when there are no overrides — safe to inject
 * unconditionally without emitting an empty `<style>` tag.
 *
 * @param theme  Output of resolveThemeForTenant().
 * @returns      A CSS string, e.g. ":root{--primary:#e63946;--radius-card:24px}"
 *               or "" when vars is empty.
 *
 * @example
 * const css = resolvedThemeToCSS(resolveThemeForTenant(tenant));
 * // In JSX:
 * {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
 */
export function resolvedThemeToCSS(theme: ResolvedTheme): string {
  const entries = Object.entries(theme.vars);
  if (entries.length === 0) return "";
  const body = entries.map(([k, v]) => `${k}:${v}`).join(";");
  return `:root{${body}}`;
}
