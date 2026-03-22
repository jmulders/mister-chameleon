/**
 * Tenant Design Theme — Structured Runtime Theme Resolution
 *
 * Turns a tenant's `TenantDesignSettings` into a fully resolved, structured
 * `ResolvedDesignTheme` object covering colors, typography, radius, spacing,
 * and button style.  This is the runtime counterpart to `resolve-theme.ts`,
 * which produces only a CSS-delta (`ResolvedTheme`) for quick variable
 * injection.  Use `getResolvedTenantTheme` when you need strongly typed
 * design values in component logic, not just CSS overrides.
 *
 * ─── Preset keys ──────────────────────────────────────────────────────────────
 *
 *   default  — "Marketing Default": indigo brand, balanced radius, standard button
 *   minimal  — "Enterprise Clean": neutral/slate palette, sharp radius, uppercase button
 *   bold     — "Bold Brand": deep indigo, soft radius, heavy font weight
 *   custom   — same base as "default"; primaryColor / primaryFont overrides expected
 *
 * ─── Override application ─────────────────────────────────────────────────────
 *
 *   getResolvedTenantTheme() applies overrides from TenantDesignSettings on top
 *   of the resolved preset:
 *
 *     primaryColor → colors.primary, colors.ring, colors.textBrand
 *     primaryFont  → typography.fontFamilySans
 *
 * ─── Fallback behaviour ───────────────────────────────────────────────────────
 *
 *   - When tenant is null → "default" preset, no overrides.
 *   - When design.theme is absent or not a known ThemeKey → "default" preset.
 *   - When overrides are absent or empty strings → preset values used as-is.
 *
 * ─── Safe in any context ──────────────────────────────────────────────────────
 *
 *   No I/O, no Next.js deps, no server-only imports.
 *   Import from "@/tenant" (client-safe barrel).
 */

import { brand, neutral } from "@/design-system/theme/tenant-theme";
import { RADIUS_PRESETS } from "@/design-system/theme/tenant-theme";
import type { ThemeKey, TenantSettings } from "./types";
import { getPackageDefinition } from "./packages";

// ── Resolved sub-types ────────────────────────────────────────────────────────

/**
 * Resolved color tokens for a tenant.
 *
 * All values are concrete CSS color strings (hex, hsl, or CSS keyword).
 * Components read these at render time; they are never hardcoded.
 */
export interface ResolvedDesignColors {
  /** Main interactive color — buttons, active links, badges. */
  primary:       string;
  /** Hover/focus state of primary interactive elements. */
  primaryHover:  string;
  /** Active/pressed state of primary interactive elements. */
  primaryActive: string;
  /** Light tinted background behind primary elements. */
  primarySubtle: string;
  /** Text rendered on a primary-colored background (usually white). */
  primaryText:   string;
  /** Keyboard focus ring color. */
  ring:          string;
  /** Brand-colored inline text (links, callouts). */
  textBrand:     string;
  /** Default body text. */
  text:          string;
  /** Secondary / descriptive text. */
  textMuted:     string;
  /** Placeholder text, disabled states. */
  textSubtle:    string;
  /** Text on dark/inverse backgrounds. */
  textInverse:   string;
  /** Default page background. */
  bg:            string;
  /** Recessed surfaces — sidebars, alternate rows. */
  bgSubtle:      string;
  /** Dark background for inverse sections. */
  bgInverse:     string;
  /** Default dividers and input borders. */
  border:        string;
  /** Stronger dividers, active input borders. */
  borderStrong:  string;
}

/**
 * Resolved typography tokens for a tenant.
 *
 * `fontFamilySans` is the primary font stack — passed to `font-family` on
 * the root element when a custom font is chosen.
 */
export interface ResolvedDesignTypography {
  /** Primary sans-serif font stack, e.g. "'Inter', system-ui, sans-serif". */
  fontFamilySans: string;
  /** Base body font size as a CSS value. */
  fontSizeBase:   string;
  /** Default body font weight. */
  fontWeightBody: string;
  /** Heading font weight (h1–h3). */
  fontWeightHeading: string;
}

/**
 * Resolved border-radius tokens.
 *
 * Maps to the three component-level radius CSS variables:
 *   --radius-interactive, --radius-card, --radius-popover
 */
export interface ResolvedDesignRadius {
  /** Buttons, inputs, badges, chips. */
  interactive: string;
  /** Cards, panels, modals, sheets. */
  card:        string;
  /** Dropdowns, tooltips, menus. */
  popover:     string;
}

/**
 * Resolved spacing tokens for page-level layout rhythm.
 *
 * These are coarse "breathing room" values, not exhaustive spacing scales.
 * They are intended for section-level layout decisions.
 */
export interface ResolvedDesignSpacing {
  /** Horizontal page gutter — responsive CSS value. */
  pagePaddingX: string;
  /** Vertical gap between major page sections. */
  sectionGapY:  string;
}

/**
 * Resolved button style tokens.
 *
 * Controls the visual personality of primary call-to-action buttons without
 * requiring component variants. Applied via a `<style>` injection or
 * consumed directly in button component props.
 */
export interface ResolvedDesignButton {
  /** CSS font-weight for button labels. */
  fontWeight:    string;
  /** CSS text-transform for button labels ("none" | "uppercase" | "capitalize"). */
  textTransform: string;
  /** CSS letter-spacing for button labels. */
  letterSpacing: string;
}

/**
 * The fully resolved design theme for a tenant.
 *
 * All sub-objects are concrete CSS values — no ThemeKey references, no
 * optional fields (except `presetName` which is informational only).
 */
export interface ResolvedDesignTheme {
  /** Human-readable name of the resolved preset (informational; never rendered). */
  presetName:  string;
  /** Which preset key was used as the base. */
  presetKey:   ThemeKey;
  colors:      ResolvedDesignColors;
  typography:  ResolvedDesignTypography;
  radius:      ResolvedDesignRadius;
  spacing:     ResolvedDesignSpacing;
  button:      ResolvedDesignButton;
}

// ── Preset definitions ────────────────────────────────────────────────────────
//
// Each preset is a complete ResolvedDesignTheme with all fields populated.
// getResolvedTenantTheme() selects the right preset then applies overrides
// from TenantDesignSettings on top — no field is ever left undefined.

const DEFAULT_PRESET: ResolvedDesignTheme = {
  presetName: "Marketing Default",
  presetKey:  "default",

  colors: {
    // Brand / interactive — indigo
    primary:       brand[500],   // #6366f1
    primaryHover:  brand[600],   // #4f46e5
    primaryActive: brand[700],   // #4338ca
    primarySubtle: brand[50],    // #eef2ff
    primaryText:   neutral[0],   // #ffffff
    ring:          brand[500],   // #6366f1
    textBrand:     brand[600],   // #4f46e5
    // Text
    text:          neutral[900], // #0f172a
    textMuted:     neutral[500], // #64748b
    textSubtle:    neutral[400], // #94a3b8
    textInverse:   neutral[0],   // #ffffff
    // Backgrounds
    bg:            neutral[50],  // #f8fafc
    bgSubtle:      neutral[100], // #f1f5f9
    bgInverse:     neutral[900], // #0f172a
    // Borders
    border:        neutral[200], // #e2e8f0
    borderStrong:  neutral[300], // #cbd5e1
  },

  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "700",
  },

  radius: { ...RADIUS_PRESETS.balanced },

  spacing: {
    pagePaddingX: "clamp(1.5rem, 5vw, 4rem)",
    sectionGapY:  "4rem",
  },

  button: {
    fontWeight:    "500",
    textTransform: "none",
    letterSpacing: "0",
  },
};

const MINIMAL_PRESET: ResolvedDesignTheme = {
  presetName: "Enterprise Clean",
  presetKey:  "minimal",

  colors: {
    // Brand / interactive — slate (neutral palette as primary)
    primary:       neutral[800], // #1e293b
    primaryHover:  neutral[900], // #0f172a
    primaryActive: neutral[950], // #020617
    primarySubtle: neutral[100], // #f1f5f9
    primaryText:   neutral[0],   // #ffffff
    ring:          neutral[700], // #334155
    textBrand:     neutral[700], // #334155
    // Text
    text:          neutral[900], // #0f172a
    textMuted:     neutral[500], // #64748b
    textSubtle:    neutral[400], // #94a3b8
    textInverse:   neutral[0],   // #ffffff
    // Backgrounds
    bg:            neutral[0],   // #ffffff  (pure white — cleaner feel)
    bgSubtle:      neutral[50],  // #f8fafc
    bgInverse:     neutral[900], // #0f172a
    // Borders
    border:        neutral[200], // #e2e8f0
    borderStrong:  neutral[300], // #cbd5e1
  },

  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "600",
  },

  radius: { ...RADIUS_PRESETS.sharp },

  spacing: {
    pagePaddingX: "clamp(1.5rem, 5vw, 4rem)",
    sectionGapY:  "3rem",
  },

  button: {
    fontWeight:    "500",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};

const BOLD_PRESET: ResolvedDesignTheme = {
  presetName: "Bold Brand",
  presetKey:  "bold",

  colors: {
    // Brand / interactive — deep indigo / violet
    primary:       brand[600],   // #4f46e5  (one step darker for more impact)
    primaryHover:  brand[700],   // #4338ca
    primaryActive: brand[800],   // #3730a3
    primarySubtle: brand[100],   // #e0e7ff
    primaryText:   neutral[0],   // #ffffff
    ring:          brand[500],   // #6366f1
    textBrand:     brand[500],   // #6366f1
    // Text
    text:          neutral[900], // #0f172a
    textMuted:     neutral[500], // #64748b
    textSubtle:    neutral[400], // #94a3b8
    textInverse:   neutral[0],   // #ffffff
    // Backgrounds
    bg:            neutral[50],  // #f8fafc
    bgSubtle:      neutral[100], // #f1f5f9
    bgInverse:     neutral[950], // #020617  (deeper black for contrast)
    // Borders
    border:        neutral[200], // #e2e8f0
    borderStrong:  neutral[300], // #cbd5e1
  },

  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "800",
  },

  radius: { ...RADIUS_PRESETS.soft },

  spacing: {
    pagePaddingX: "clamp(1.5rem, 5vw, 4rem)",
    sectionGapY:  "5rem",
  },

  button: {
    fontWeight:    "700",
    textTransform: "none",
    letterSpacing: "0",
  },
};

// ── Preset registry ───────────────────────────────────────────────────────────

/**
 * Map of all built-in design presets keyed by ThemeKey.
 *
 * "custom" maps to the same base as "default" — callers apply overrides
 * on top.  Export is intentional: admin UIs can iterate DESIGN_PRESETS to
 * render a theme picker without duplicating the preset list.
 */
export const DESIGN_PRESETS: Record<ThemeKey, ResolvedDesignTheme> = {
  default: DEFAULT_PRESET,
  minimal: MINIMAL_PRESET,
  bold:    BOLD_PRESET,
  custom:  { ...DEFAULT_PRESET, presetName: "Custom", presetKey: "custom" },
} as const;

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves a tenant's design settings into a fully populated ResolvedDesignTheme.
 *
 * Selection order:
 *   1. Look up the preset for `settings.design.theme` (falls back to "default"
 *      when the key is absent or not in DESIGN_PRESETS).
 *   2. Apply `primaryColor` override → colors.primary, colors.ring, colors.textBrand.
 *   3. Apply `primaryFont` override → typography.fontFamilySans.
 *
 * @param tenant  TenantSettings record, or null for the default preset.
 * @returns       A fully resolved ResolvedDesignTheme — never undefined.
 *
 * @example
 * const theme = getResolvedTenantTheme(tenant);
 * console.log(theme.colors.primary);        // "#6366f1"
 * console.log(theme.radius.interactive);    // "8px"
 * console.log(theme.button.textTransform);  // "none"
 */
export function getResolvedTenantTheme(
  tenant: TenantSettings | null,
): ResolvedDesignTheme {
  const design   = tenant?.design;
  const themeKey = design?.theme;

  // Select the effective preset key — must be both a known key and allowed
  // by the tenant's package.  Falls back to "default" in both failure cases:
  //   • themeKey is absent or not in DESIGN_PRESETS → use "default"
  //   • themeKey is known but the package does not permit it → use the
  //     first theme the package allows (guaranteed to be a known preset key)
  let effectiveKey: ThemeKey = "default";

  if (themeKey && themeKey in DESIGN_PRESETS) {
    if (tenant) {
      const pkg = getPackageDefinition(tenant.packageKey);
      if (pkg.allowedThemes.includes(themeKey)) {
        effectiveKey = themeKey;
      } else {
        // Package downgrade path: use the first theme the package allows.
        const fallback = pkg.allowedThemes[0];
        if (fallback && fallback in DESIGN_PRESETS) {
          effectiveKey = fallback;
        }
        // else: allowedThemes is unexpectedly empty — stay on "default"
      }
    } else {
      // No tenant — we have a themeKey from somewhere but no package context;
      // trust the key as-is (null-tenant path never reaches this branch in
      // practice since design comes from tenant?.design above).
      effectiveKey = themeKey;
    }
  }

  const basePreset = DESIGN_PRESETS[effectiveKey];

  // Short-circuit when there are no overrides to apply.
  const hasPrimaryColor = Boolean(design?.primaryColor);
  const hasPrimaryFont  = Boolean(design?.primaryFont);

  if (!hasPrimaryColor && !hasPrimaryFont) {
    return basePreset;
  }

  // Apply overrides immutably — never mutate the preset object.
  const colors: ResolvedDesignColors = hasPrimaryColor
    ? {
        ...basePreset.colors,
        primary:   design!.primaryColor!,
        ring:      design!.primaryColor!,
        textBrand: design!.primaryColor!,
      }
    : basePreset.colors;

  const typography: ResolvedDesignTypography = hasPrimaryFont
    ? { ...basePreset.typography, fontFamilySans: design!.primaryFont! }
    : basePreset.typography;

  return {
    ...basePreset,
    colors,
    typography,
  };
}
