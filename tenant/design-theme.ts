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

// ── Curated commercial theme presets ─────────────────────────────────────────
//
// Inline colour values mirror design-system/theme/presets.ts.
// These records are the typed, structured representation used by admin UI
// components — the full CSS injection uses THEME_PRESETS + tenantThemeToVarsRecord.

const CORPORATE_BLUE_PRESET: ResolvedDesignTheme = {
  presetName: "Corporate Blue",
  presetKey:  "corporate-blue",
  colors: {
    primary:       "#1d4ed8",
    primaryHover:  "#1e40af",
    primaryActive: "#1e3a8a",
    primarySubtle: "#eff6ff",
    primaryText:   "#ffffff",
    ring:          "#1d4ed8",
    textBrand:     "#1d4ed8",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#f8fafc",
    bgSubtle:      "#eff6ff",
    bgInverse:     "#0f2a5c",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "700" },
  radius: { ...RADIUS_PRESETS.sharp },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "3.5rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const MODERN_GREEN_PRESET: ResolvedDesignTheme = {
  presetName: "Modern Green",
  presetKey:  "modern-green",
  colors: {
    primary:       "#059669",
    primaryHover:  "#047857",
    primaryActive: "#065f46",
    primarySubtle: "#ecfdf5",
    primaryText:   "#ffffff",
    ring:          "#059669",
    textBrand:     "#047857",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#f8fafc",
    bgSubtle:      "#ecfdf5",
    bgInverse:     "#064e3b",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "700" },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
};

const MINIMAL_NEUTRAL_PRESET: ResolvedDesignTheme = {
  presetName: "Minimal Neutral",
  presetKey:  "minimal-neutral",
  colors: {
    primary:       "#52525b",
    primaryHover:  "#3f3f46",
    primaryActive: "#27272a",
    primarySubtle: "#f4f4f5",
    primaryText:   "#ffffff",
    ring:          "#71717a",
    textBrand:     "#3f3f46",
    text:          "#18181b",
    textMuted:     "#71717a",
    textSubtle:    "#a1a1aa",
    textInverse:   "#ffffff",
    bg:            "#ffffff",
    bgSubtle:      "#fafafa",
    bgInverse:     "#18181b",
    border:        "#e4e4e7",
    borderStrong:  "#d4d4d8",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "500" },
  radius: { ...RADIUS_PRESETS.sharp },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "3rem" },
  button:  { fontWeight: "500", textTransform: "none", letterSpacing: "0" },
};

const BOLD_DARK_PRESET: ResolvedDesignTheme = {
  presetName: "Bold Dark",
  presetKey:  "bold-dark",
  colors: {
    primary:       "#f59e0b",
    primaryHover:  "#d97706",
    primaryActive: "#b45309",
    primarySubtle: "#fffbeb",
    primaryText:   "#0f172a",
    ring:          "#f59e0b",
    textBrand:     "#d97706",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#f8fafc",
    bgSubtle:      "#f1f5f9",
    bgInverse:     "#0f172a",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "800" },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "800", textTransform: "none", letterSpacing: "0" },
};

const TECH_INDIGO_PRESET: ResolvedDesignTheme = {
  presetName: "Tech Indigo",
  presetKey:  "tech-indigo",
  colors: {
    primary:       "#5b21b6",
    primaryHover:  "#4c1d95",
    primaryActive: "#2e1065",
    primarySubtle: "#f5f3ff",
    primaryText:   "#ffffff",
    ring:          "#6d28d9",
    textBrand:     "#5b21b6",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#f8fafc",
    bgSubtle:      "#f5f3ff",
    bgInverse:     "#2e1065",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "700" },
  radius: { ...RADIUS_PRESETS.sharp },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "3.5rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
};

const WARM_PROFESSIONAL_PRESET: ResolvedDesignTheme = {
  presetName: "Warm Professional",
  presetKey:  "warm-professional",
  colors: {
    primary:       "#d97706",
    primaryHover:  "#b45309",
    primaryActive: "#92400e",
    primarySubtle: "#fffbeb",
    primaryText:   "#ffffff",
    ring:          "#d97706",
    textBrand:     "#b45309",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#fafaf9",
    bgSubtle:      "#fffbeb",
    bgInverse:     "#451a03",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "700" },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const RECRUITMENT_ENERGY_PRESET: ResolvedDesignTheme = {
  presetName: "Recruitment Energy",
  presetKey:  "recruitment-energy",
  colors: {
    primary:       "#ea580c",
    primaryHover:  "#c2410c",
    primaryActive: "#9a3412",
    primarySubtle: "#fff7ed",
    primaryText:   "#ffffff",
    ring:          "#f97316",
    textBrand:     "#ea580c",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#f8fafc",
    bgSubtle:      "#fff7ed",
    bgInverse:     "#431407",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "800" },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "800", textTransform: "none", letterSpacing: "0" },
};

const HEALTHCARE_CALM_PRESET: ResolvedDesignTheme = {
  presetName: "Healthcare Calm",
  presetKey:  "healthcare-calm",
  colors: {
    primary:       "#0891b2",
    primaryHover:  "#0e7490",
    primaryActive: "#155e75",
    primarySubtle: "#ecfeff",
    primaryText:   "#ffffff",
    ring:          "#0891b2",
    textBrand:     "#0e7490",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#f0f9ff",
    bgSubtle:      "#ecfeff",
    bgInverse:     "#164e63",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "600" },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4.5rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const INDUSTRIAL_STRONG_PRESET: ResolvedDesignTheme = {
  presetName: "Industrial Strong",
  presetKey:  "industrial-strong",
  colors: {
    primary:       "#dc2626",
    primaryHover:  "#b91c1c",
    primaryActive: "#991b1b",
    primarySubtle: "#fef2f2",
    primaryText:   "#ffffff",
    ring:          "#dc2626",
    textBrand:     "#b91c1c",
    text:          "#0f172a",
    textMuted:     "#64748b",
    textSubtle:    "#94a3b8",
    textInverse:   "#ffffff",
    bg:            "#fafaf9",
    bgSubtle:      "#f5f5f4",
    bgInverse:     "#1c1917",
    border:        "#e7e5e4",
    borderStrong:  "#d6d3d1",
  },
  typography: { fontFamilySans: "'Inter', system-ui, sans-serif", fontSizeBase: "1rem", fontWeightBody: "400", fontWeightHeading: "700" },
  radius: { ...RADIUS_PRESETS.sharp },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "3.5rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
};

const PREMIUM_EDITORIAL_PRESET: ResolvedDesignTheme = {
  presetName: "Premium Editorial",
  presetKey:  "premium-editorial",
  colors: {
    // Warm brown primary — earthy, premium, high-end editorial
    primary:       "#8b5e3c",
    primaryHover:  "#7a5233",
    primaryActive: "#6a4429",
    primarySubtle: "#f5ede4",
    primaryText:   "#ffffff",
    ring:          "#8b5e3c",
    textBrand:     "#8b5e3c",
    // Deep warm charcoal text — rich, never cold
    text:          "#2d2016",
    textMuted:     "#7a6652",
    textSubtle:    "#a8937e",
    textInverse:   "#faf6ef",
    // Warm cream surfaces — the signature editorial ground
    bg:            "#faf6ef",
    bgSubtle:      "#f2ebe0",
    bgInverse:     "#1a0f08",
    // Soft warm borders — never harsh
    border:        "#e0d5c5",
    borderStrong:  "#c8b99f",
  },
  typography: {
    fontFamilySans:    "'DM Sans', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "600",   // Cormorant Garamond at 600 — elegant, authoritative
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(2rem, 6vw, 5rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0.01em" },
};

const DARK_CONTRAST_PRESET: ResolvedDesignTheme = {
  presetName: "Dark Contrast",
  presetKey:  "dark-contrast",

  colors: {
    // Brand / interactive — pure white on black for maximum contrast
    primary:       "#ffffff",
    primaryHover:  "#f0f0f0",
    primaryActive: "#e0e0e0",
    primarySubtle: "#1a1a1a",
    primaryText:   "#000000",    // black text on white button
    ring:          "#ffffff",
    textBrand:     "#e5e5e5",
    // Text — white on black
    text:          "#fafafa",
    textMuted:     "#a3a3a3",
    textSubtle:    "#737373",
    textInverse:   "#000000",
    // Backgrounds — pure black
    bg:            "#000000",
    bgSubtle:      "#0d0d0d",
    bgInverse:     "#ffffff",
    // Borders — dark grey barely visible on black
    border:        "#2a2a2a",
    borderStrong:  "#3d3d3d",
  },

  typography: {
    fontFamilySans:    "'DM Sans', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "300",    // thin headings for premium minimal look
  },

  radius: { interactive: "2px", card: "4px", popover: "4px" },

  spacing: {
    pagePaddingX: "clamp(1.5rem, 5vw, 4rem)",
    sectionGapY:  "5rem",
  },

  button: {
    fontWeight:    "500",
    textTransform: "none",
    letterSpacing: "0.02em",
  },
};

const EDITORIAL_CLASSIC_PRESET: ResolvedDesignTheme = {
  presetName: "Editorial Classic",
  presetKey:  "editorial-classic",

  colors: {
    // Brand / interactive — charcoal ink on white
    primary:       "#1a1a1a",
    primaryHover:  "#000000",
    primaryActive: "#000000",
    primarySubtle: "#f0ede8",
    primaryText:   "#ffffff",
    ring:          "#1a1a1a",
    textBrand:     "#1a1a1a",
    // Text — dark charcoal newspaper ink
    text:          "#1a1a1a",
    textMuted:     "#5a5a5a",
    textSubtle:    "#9a9a9a",
    textInverse:   "#f8f6f3",
    // Backgrounds — clean white editorial
    bg:            "#ffffff",
    bgSubtle:      "#f8f6f3",   // warm paper
    bgInverse:     "#1c1917",   // charcoal
    // Borders — warm paper edge
    border:        "#e8e4de",
    borderStrong:  "#c8c4bc",
  },

  typography: {
    fontFamilySans:    "'Source Sans 3', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "700",
  },

  radius: { interactive: "2px", card: "2px", popover: "4px" },

  spacing: {
    pagePaddingX: "clamp(1.5rem, 5vw, 4rem)",
    sectionGapY:  "4rem",
  },

  button: {
    fontWeight:    "600",
    textTransform: "none",
    letterSpacing: "0",
  },
};

const STARTUP_ENERGY_PRESET: ResolvedDesignTheme = {
  presetName: "Startup Energy",
  presetKey:  "startup-energy",
  colors: {
    primary:       "#e11d48",
    primaryHover:  "#be123c",
    primaryActive: "#9f1239",
    primarySubtle: "#fff1f2",
    primaryText:   "#ffffff",
    ring:          "#e11d48",
    textBrand:     "#e11d48",
    text:          "#1c0a14",
    textMuted:     "#6b7280",
    textSubtle:    "#9ca3af",
    textInverse:   "#ffffff",
    bg:            "#ffffff",
    bgSubtle:      "#fff1f2",
    bgInverse:     "#1c0a14",
    border:        "#fce7f3",
    borderStrong:  "#fbcfe8",
  },
  typography: {
    fontFamilySans:    "'Outfit', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "800",
  },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4.5rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
};

const CORPORATE_TRUST_PRESET: ResolvedDesignTheme = {
  presetName: "Corporate Trust",
  presetKey:  "corporate-trust",
  colors: {
    primary:       "#2563eb",
    primaryHover:  "#1d4ed8",
    primaryActive: "#1e40af",
    primarySubtle: "#eff6ff",
    primaryText:   "#ffffff",
    ring:          "#2563eb",
    textBrand:     "#2563eb",
    text:          "#0f172a",
    textMuted:     "#475569",
    textSubtle:    "#94a3b8",
    textInverse:   "#f8fafc",
    bg:            "#f8fafc",
    bgSubtle:      "#f1f5f9",
    bgInverse:     "#0f2a5c",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: {
    fontFamilySans:    "'DM Sans', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "600",
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const PLAYFUL_STARTUP_PRESET: ResolvedDesignTheme = {
  presetName: "Playful Startup",
  presetKey:  "playful-startup",
  colors: {
    // Vivid violet primary — energetic, modern, startup-forward
    primary:       "#6d28d9",
    primaryHover:  "#5b21b6",
    primaryActive: "#4c1d95",
    primarySubtle: "#f5f3ff",
    primaryText:   "#ffffff",
    ring:          "#7c3aed",
    textBrand:     "#6d28d9",
    // Deep purple-tinted near-black text — on-brand without being harsh
    text:          "#150a2e",
    textMuted:     "#6b7280",
    textSubtle:    "#9ca3af",
    textInverse:   "#ffffff",
    // Clean white surfaces — lets the violet accents do the work
    bg:            "#ffffff",
    bgSubtle:      "#faf9ff",
    bgInverse:     "#1e0545",
    // Neutral borders — keeps layouts clean and scannable
    border:        "#e5e7eb",
    borderStrong:  "#d1d5db",
  },
  typography: {
    fontFamilySans:    "'Outfit', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "800",   // Plus Jakarta Sans at 800 — punchy, high-energy
  },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4.5rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
};

const MODERN_SAAS_PRESET: ResolvedDesignTheme = {
  presetName: "Modern SaaS",
  presetKey:  "modern-saas",
  colors: {
    // Blue-violet primary — crisp, modern, product-forward
    primary:       "#5b6af9",
    primaryHover:  "#4754e8",
    primaryActive: "#3b47d5",
    primarySubtle: "#eff0ff",
    primaryText:   "#ffffff",
    ring:          "#5b6af9",
    textBrand:     "#4754e8",
    // Near-black text — sharp, high legibility
    text:          "#111827",
    textMuted:     "#4b5563",
    textSubtle:    "#9ca3af",
    textInverse:   "#ffffff",
    // Pure white surfaces — maximum clarity
    bg:            "#ffffff",
    bgSubtle:      "#f9fafb",
    bgInverse:     "#0d0d1a",
    // Clean borders
    border:        "#e5e7eb",
    borderStrong:  "#d1d5db",
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "700",
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const PORTFOLIO_SHOWCASE_PRESET: ResolvedDesignTheme = {
  presetName: "Portfolio Showcase",
  presetKey:  "portfolio-showcase",
  colors: {
    primary:       "#0891b2",
    primaryHover:  "#0e7490",
    primaryActive: "#155e75",
    primarySubtle: "#f0f9ff",
    primaryText:   "#ffffff",
    ring:          "#0891b2",
    textBrand:     "#0e7490",
    text:          "#0f172a",
    textMuted:     "#475569",
    textSubtle:    "#94a3b8",
    textInverse:   "#f8fafc",
    bg:            "#f8fafc",
    bgSubtle:      "#f1f5f9",
    bgInverse:     "#020617",
    border:        "#e2e8f0",
    borderStrong:  "#cbd5e1",
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "700",
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const PREMIUM_LUXURY_PRESET: ResolvedDesignTheme = {
  presetName: "Premium Luxury",
  presetKey:  "premium-luxury",
  colors: {
    primary:       "#a16207",
    primaryHover:  "#854d0e",
    primaryActive: "#6b3d0b",
    primarySubtle: "#fefce8",
    primaryText:   "#ffffff",
    ring:          "#a16207",
    textBrand:     "#a16207",
    text:          "#1c1917",
    textMuted:     "#78716c",
    textSubtle:    "#a8a29e",
    textInverse:   "#fafaf9",
    bg:            "#fafaf9",
    bgSubtle:      "#f5f5f4",
    bgInverse:     "#0c0a09",
    border:        "#e7e5e4",
    borderStrong:  "#d6d3d1",
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "400",
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "6rem" },
  button:  { fontWeight: "500", textTransform: "none", letterSpacing: "0.02em" },
};
const CORPORATE_CLEAN_PRESET: ResolvedDesignTheme = {
  presetName: "Corporate Clean",
  presetKey:  "corporate-clean",
  colors: {
    primary:       "#334155",   // slate-700
    primaryHover:  "#1e293b",   // slate-800
    primaryActive: "#0f172a",   // slate-900
    primarySubtle: "#f1f5f9",   // slate-100
    primaryText:   "#ffffff",
    ring:          "#334155",
    textBrand:     "#334155",
    text:          "#0f172a",   // slate-900
    textMuted:     "#475569",   // slate-600
    textSubtle:    "#94a3b8",   // slate-400
    textInverse:   "#f8fafc",   // slate-50
    bg:            "#ffffff",
    bgSubtle:      "#f8fafc",   // slate-50
    bgInverse:     "#0f172a",   // slate-900
    border:        "#e2e8f0",   // slate-200
    borderStrong:  "#cbd5e1",   // slate-300
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "600",
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const BOLD_MARKETING_PRESET: ResolvedDesignTheme = {
  presetName: "Bold Marketing",
  presetKey:  "bold-marketing",
  colors: {
    primary:       "#db2777",   // pink-600
    primaryHover:  "#be185d",   // pink-700
    primaryActive: "#9d174d",   // pink-800
    primarySubtle: "#fdf2f8",   // pink-50
    primaryText:   "#ffffff",
    ring:          "#db2777",
    textBrand:     "#db2777",
    text:          "#111827",   // gray-900
    textMuted:     "#374151",   // gray-700
    textSubtle:    "#9ca3af",   // gray-400
    textInverse:   "#ffffff",
    bg:            "#ffffff",
    bgSubtle:      "#fdf2f8",   // pink-50
    bgInverse:     "#1e1b4b",   // deep indigo-black
    border:        "#f3f4f6",   // gray-100
    borderStrong:  "#e5e7eb",   // gray-200
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "900",
  },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
};

// ── Careers / HR theme presets ────────────────────────────────────────────────
//
// Colours mirror design-system/theme/presets.ts CAREERS_HUMAN exactly so both
// the CSS-variable injection path (THEME_PRESETS) and the typed token path
// (DESIGN_PRESETS → getResolvedTenantTheme) agree on every value.
//
// Teal palette:  50=#eef7f6  700=#1a7a6c  800=#156056  900=#0f4a42
// WarmGray:      50=#fafaf8  200=#e8e6e3  300=#d4d1cc  400=#a8a49e
//                500=#7a766f  900=#1a1816

const CAREERS_HUMAN_PRESET: ResolvedDesignTheme = {
  presetName: "Careers Human",
  presetKey:  "careers-human",
  colors: {
    primary:       "#1a7a6c",   // teal[700] — calm, established, trustworthy
    primaryHover:  "#156056",   // teal[800]
    primaryActive: "#0f4a42",   // teal[900]
    primarySubtle: "#eef7f6",   // teal[50]
    primaryText:   "#ffffff",
    ring:          "#1a7a6c",   // teal[700]
    textBrand:     "#1a7a6c",   // teal[700]
    text:          "#1a1816",   // warmGray[900] — warm near-black
    textMuted:     "#7a766f",   // warmGray[500]
    textSubtle:    "#a8a49e",   // warmGray[400]
    textInverse:   "#ffffff",
    bg:            "#fafaf8",   // warmGray[50] — warm off-white, not clinical
    bgSubtle:      "#eef7f6",   // teal[50]
    bgInverse:     "#0f4a42",   // teal[900] — deep teal hero, welcoming
    border:        "#e8e6e3",   // warmGray[200]
    borderStrong:  "#d4d1cc",   // warmGray[300]
  },
  typography: {
    fontFamilySans:    "'DM Sans', system-ui, sans-serif",
    fontSizeBase:      "1.0625rem",  // 17px — generous reading rhythm for job descriptions
    fontWeightBody:    "400",
    fontWeightHeading: "500",        // measured, human-scale — not bold urgency
  },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4.5rem" },
  button:  { fontWeight: "500", textTransform: "none", letterSpacing: "0" },
};

// ── Seasonal theme presets ─────────────────────────────────────────────────────
//
// Previously these delegated to DEFAULT_PRESET (leaving getResolvedTenantTheme()
// returning indigo brand colours when a seasonal theme was active).  They now
// carry the full resolved colour token set so every component that reads typed
// design values — not just CSS vars — sees the correct theme.

const VALENTINE_PINK_PRESET: ResolvedDesignTheme = {
  presetName: "Valentine Pink",
  presetKey:  "valentine-pink",
  colors: {
    primary:       "#be185d",   // rose-700
    primaryHover:  "#9f1239",   // rose-800
    primaryActive: "#881337",   // rose-900
    primarySubtle: "#fff1f2",   // rose-50
    primaryText:   "#ffffff",
    ring:          "#be185d",
    textBrand:     "#be185d",
    text:          "#111827",
    textMuted:     "#4b5563",
    textSubtle:    "#9ca3af",
    textInverse:   "#ffffff",
    bg:            "#ffffff",
    bgSubtle:      "#fff1f2",   // rose-50
    bgInverse:     "#881337",   // rose-900 hero
    border:        "#fce7f3",   // rose-100
    borderStrong:  "#fbcfe8",   // rose-200
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "700",
  },
  radius: { ...RADIUS_PRESETS.soft },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "5rem" },
  button:  { fontWeight: "600", textTransform: "none", letterSpacing: "0" },
};

const DUTCH_ORANGE_PRESET: ResolvedDesignTheme = {
  presetName: "Dutch Orange",
  presetKey:  "dutch-orange",
  colors: {
    primary:       "#FF7A1A",   // vivid Dutch football-shirt orange (upgraded from #F36F21)
    primaryHover:  "#D95E1D",   // one step darker — secondary / hover state
    primaryActive: "#B44B0E",   // deep active press state
    primarySubtle: "#FFF1E6",   // very light warm orange tint (accent background)
    primaryText:   "#ffffff",
    ring:          "#21468B",   // Dutch flag blue — focus ring accent
    textBrand:     "#D95E1D",   // brand-coloured text — matches hover shade
    text:          "#111827",
    textMuted:     "#4b5563",
    textSubtle:    "#9ca3af",
    textInverse:   "#ffffff",
    bg:            "#ffffff",
    bgSubtle:      "#FFF1E6",   // matches accent / primarySubtle
    bgInverse:     "#B44B0E",   // deep Dutch orange hero bg
    border:        "#FFE0C0",   // warm light orange border
    borderStrong:  "#F9924A",   // vivid mid-orange — badge/card accent borders
  },
  typography: {
    fontFamilySans:    "'Inter', system-ui, sans-serif",
    fontSizeBase:      "1rem",
    fontWeightBody:    "400",
    fontWeightHeading: "800",
  },
  radius: { ...RADIUS_PRESETS.balanced },
  spacing: { pagePaddingX: "clamp(1.5rem, 5vw, 4rem)", sectionGapY: "4rem" },
  button:  { fontWeight: "700", textTransform: "none", letterSpacing: "0" },
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
  // ── Original platform presets ──────────────────────────────────────────────
  default: DEFAULT_PRESET,
  minimal: MINIMAL_PRESET,
  bold:    BOLD_PRESET,
  custom:  { ...DEFAULT_PRESET, presetName: "Custom", presetKey: "custom" },
  // ── Curated commercial themes ──────────────────────────────────────────────
  "corporate-blue":     CORPORATE_BLUE_PRESET,
  "modern-green":       MODERN_GREEN_PRESET,
  "minimal-neutral":    MINIMAL_NEUTRAL_PRESET,
  "bold-dark":          BOLD_DARK_PRESET,
  "tech-indigo":        TECH_INDIGO_PRESET,
  "warm-professional":  WARM_PROFESSIONAL_PRESET,
  "recruitment-energy": RECRUITMENT_ENERGY_PRESET,
  "healthcare-calm":    HEALTHCARE_CALM_PRESET,
  "industrial-strong":  INDUSTRIAL_STRONG_PRESET,
  "premium-editorial":  PREMIUM_EDITORIAL_PRESET,
  "dark-contrast":      DARK_CONTRAST_PRESET,
  "editorial-classic":  EDITORIAL_CLASSIC_PRESET,
  "playful-startup":    PLAYFUL_STARTUP_PRESET,
  "startup-energy":     STARTUP_ENERGY_PRESET,
  "corporate-trust":    CORPORATE_TRUST_PRESET,
  "modern-saas":        MODERN_SAAS_PRESET,
  "corporate-clean":    CORPORATE_CLEAN_PRESET,
  "bold-marketing":     BOLD_MARKETING_PRESET,
  // ── Signature themes ──────────────────────────────────────────────────────
  "portfolio-showcase": PORTFOLIO_SHOWCASE_PRESET,
  "premium-luxury":     PREMIUM_LUXURY_PRESET,
  // ── Seasonal themes ───────────────────────────────────────────────────────
  //   Full typed token entries — no longer delegating to DEFAULT_PRESET.
  //   Both getResolvedTenantTheme() and resolveThemeForTenant() now agree on
  //   colour values, fixing the "selected but not applied" bug.
  "valentine-pink":     VALENTINE_PINK_PRESET,
  "dutch-orange":       DUTCH_ORANGE_PRESET,
  // ── Careers / HR themes ───────────────────────────────────────────────────
  //   Colours mirror design-system/theme/presets.ts CAREERS_HUMAN so both
  //   the CSS-variable injection path and the typed token path agree.
  "careers-human":      CAREERS_HUMAN_PRESET,
  // ── Premium families — resolved via tenantThemeToCSS(resolveTheme(key)) ──
  //   These entries satisfy the exhaustive Record<ThemeKey, ResolvedDesignTheme>
  //   constraint; actual CSS vars are injected by the new preset pipeline.
  "dark-ai":            { ...DARK_CONTRAST_PRESET,  presetName: "Dark AI",           presetKey: "dark-ai" },
  "clean-corporate":    { ...CORPORATE_TRUST_PRESET, presetName: "Clean Corporate",   presetKey: "clean-corporate" },
  "structured-saas":    { ...WARM_PROFESSIONAL_PRESET, presetName: "Structured SaaS", presetKey: "structured-saas" },
} as const;

// ── Safe preset lookup ────────────────────────────────────────────────────────

/**
 * Maps obsolete preset keys (removed from the registry) to their closest
 * valid replacement.  Shared between getSafeDesignPreset() and
 * getResolvedTenantTheme() so legacy key normalisation is always consistent.
 */
export const LEGACY_THEME_MAP: Readonly<Record<string, ThemeKey>> = {
  "marketing-default": "modern-saas",
  "enterprise-clean":  "corporate-trust",
  "bold-brand":        "startup-energy",
  "workengine":        "modern-saas",
} as const;

/**
 * Normalise a raw theme key string (e.g. from the database) to a valid
 * `ThemeKey` that is guaranteed to exist in `DESIGN_PRESETS`.
 *
 * Normalisation steps:
 *   1. Apply LEGACY_THEME_MAP (maps removed keys to current replacements).
 *   2. Check that the result is actually in DESIGN_PRESETS.
 *   3. Fall back to "default" if neither step produced a valid key.
 *
 * @param raw  Any string — a ThemeKey, a legacy key, or garbage from the DB.
 * @returns    A ThemeKey that is guaranteed to exist in DESIGN_PRESETS.
 */
export function normalizeThemeKey(raw: string | null | undefined): ThemeKey {
  if (!raw) return "default";

  // Step 1: apply legacy alias map
  const mapped = LEGACY_THEME_MAP[raw];
  const candidate = mapped ?? raw;

  // Step 2: validate against registry
  if (candidate in DESIGN_PRESETS) return candidate as ThemeKey;

  // Step 3: fallback
  return "default";
}

/**
 * Returns the `ResolvedDesignTheme` for a raw key string — guaranteed non-null.
 *
 * Use this everywhere you need to go from a stored theme key to a preset
 * object without risking `undefined`.  It applies the legacy alias map and
 * falls back to `"default"` when the key is absent or unrecognised.
 *
 * @param raw  Any string — a ThemeKey, a legacy key, or garbage from the DB.
 * @returns    A fully populated ResolvedDesignTheme — never undefined.
 *
 * @example
 * // Safe — even with a stale / unknown key
 * const pd = getSafeDesignPreset(form.theme);
 * console.log(pd.typography.fontFamilySans);   // always a string
 * console.log(pd.colors.primary);              // always a string
 */
export function getSafeDesignPreset(raw: string | null | undefined): ResolvedDesignTheme {
  return DESIGN_PRESETS[normalizeThemeKey(raw)];
}

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

  // Normalise stale stored key before checking DESIGN_PRESETS.
  // Uses the shared LEGACY_THEME_MAP — same map as getSafeDesignPreset().
  const resolvedThemeKey = (themeKey && LEGACY_THEME_MAP[themeKey])
    ? LEGACY_THEME_MAP[themeKey] as ThemeKey
    : themeKey;

  // Select the effective preset key — must be both a known key and allowed
  // by the tenant's package.  Falls back to "default" in both failure cases:
  //   • themeKey is absent or not in DESIGN_PRESETS → use "default"
  //   • themeKey is known but the package does not permit it → use the
  //     first theme the package allows (guaranteed to be a known preset key)
  let effectiveKey: ThemeKey = "default";

  if (resolvedThemeKey && resolvedThemeKey in DESIGN_PRESETS) {
    if (tenant) {
      const pkg = getPackageDefinition(tenant.packageKey);
      if (pkg.allowedThemes.includes(resolvedThemeKey)) {
        effectiveKey = resolvedThemeKey;
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
      effectiveKey = resolvedThemeKey;
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
