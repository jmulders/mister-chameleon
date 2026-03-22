/**
 * Theme Presets
 *
 * Named, complete visual personalities for the platform.  A preset is a
 * full TenantTheme-compatible configuration — pick one and you get sensible
 * defaults for every token: colours, radius, typography, buttons, motion,
 * and component surface styles.
 *
 * ─── Three built-in presets ──────────────────────────────────────────────────
 *
 *   marketing-default   Indigo-violet palette, balanced radius.
 *                       Dark hero, brand CTA, generous card radius.
 *                       Best for: agencies, SaaS marketing sites.
 *
 *   enterprise-clean    Neutral slate palette, sharp radius, muted accents.
 *                       Hero uses a deep-slate rather than pitch-black.
 *                       Best for: B2B tools, fintech, developer-facing products.
 *
 *   bold-brand          Vivid brand palette, soft radius, high-contrast CTAs.
 *                       Hero and CTA both lean into brand colour.
 *                       Best for: consumer apps, lifestyle brands, bold agencies.
 *
 * ─── Architecture contract ───────────────────────────────────────────────────
 *
 *   Presets supply VALUES only — no layout decisions. The resolved TenantTheme
 *   is passed to tenantThemeToCSS() which emits CSS custom properties.
 *   Components never reference preset names directly.
 */

import type { TenantTheme }  from "./tenant-theme";
import { brand, neutral }    from "../tokens/colors";
import { fontFamily }         from "../tokens/typography";
import { shadows }            from "../tokens/shadow";

// ── Public types ──────────────────────────────────────────────────────────────

export type ThemePresetKey =
  | "marketing-default"
  | "enterprise-clean"
  | "bold-brand"
  | "workengine";

export type ThemePresetOverrides = {
  colors?: Partial<{
    brand:      Partial<TenantTheme["colors"]["brand"]>;
    text:       Partial<TenantTheme["colors"]["text"]>;
    background: Partial<TenantTheme["colors"]["background"]>;
    border:     Partial<TenantTheme["colors"]["border"]>;
  }>;
  radius?:          TenantTheme["radius"];
  typography?:      TenantTheme["typography"];
  button?:          TenantTheme["button"];
  motion?:          TenantTheme["motion"];
  componentStyles?: TenantTheme["componentStyles"];
  meta?:            Partial<TenantTheme["meta"]>;
};

// ── Preset definitions ────────────────────────────────────────────────────────

/**
 * marketing-default — standard SaaS / marketing site personality.
 *
 *   Palette:  indigo-violet (brand.500 / brand.600)
 *   Radius:   balanced — 8px interactive, 16px card
 *   Hero:     near-black (neutral-950) with brand glow
 *   CTA:      brand-600 with light text
 *   Cards:    white, 1px neutral-200 border, sm shadow
 *   Buttons:  brand-filled, 600 weight, sm shadow
 *   Motion:   standard 150ms ease-in-out
 */
const MARKETING_DEFAULT: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],
      primaryHover:  brand[600],
      primaryActive: brand[700],
      primarySubtle: brand[50],
      primaryText:   neutral[0],
      ring:          brand[500],
      textBrand:     brand[600],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  neutral[100],
      bgInverse: neutral[900],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "balanced",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "700",
    subheadingWeight: "600",
  },
  button: {
    bg:         brand[500],
    text:       neutral[0],
    hoverBg:    brand[600],
    activeBg:   brand[700],
    ring:       brand[500],
    shadow:     shadows.sm,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              neutral[950],
    ctaBg:               brand[600],
    ctaBodyText:         brand[100],
    subtleSectionBg:     neutral[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     neutral[200],
    cardRadius:          "1rem",
    cardShadow:          shadows.sm,
    quoteColor:          brand[500],
    heroGlowColor:       brand[500],
    heroGlowOpacity:     "0.2",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   neutral[400],
    proofBg:             neutral[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     neutral[200],
    proofCardRadius:     "1rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     brand[500],
    featureGridBg:           neutral[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   neutral[200],
    featureGridCardRadius:   "1rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       neutral[100],
  },
  meta: {
    name: "Platform Default",
  },
};

/**
 * enterprise-clean — restrained, technical personality.
 *
 *   Palette:  indigo accent on a slate-heavy neutral base
 *   Radius:   sharp — 2px interactive, 4px card
 *   Hero:     deep-slate (neutral-800)
 *   CTA:      neutral-800 — neutral, not brand-heavy
 *   Cards:    white, 1px border, no shadow (flat aesthetic)
 *   Buttons:  brand-filled, 500 weight, no shadow, sharp radius
 *   Motion:   snappy 100ms — immediate, functional feel
 */
const ENTERPRISE_CLEAN: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],
      primaryHover:  brand[600],
      primaryActive: brand[700],
      primarySubtle: brand[50],
      primaryText:   neutral[0],
      ring:          brand[500],
      textBrand:     brand[600],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[600],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[0],
      bgSubtle:  neutral[50],
      bgInverse: neutral[800],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[400],
    },
  },
  radius: "sharp",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "600",
    subheadingWeight: "500",
  },
  button: {
    bg:         brand[500],
    text:       neutral[0],
    hoverBg:    brand[600],
    activeBg:   brand[700],
    ring:       brand[500],
    shadow:     shadows.none,
    fontWeight: "500",
  },
  motion: {
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)", // no spring for enterprise
  },
  componentStyles: {
    heroBg:              neutral[800],
    ctaBg:               neutral[800],
    ctaBodyText:         neutral[300],
    subtleSectionBg:     neutral[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     neutral[200],
    cardRadius:          "0.25rem",
    cardShadow:          shadows.none,
    quoteColor:          brand[500],
    heroGlowColor:       brand[500],
    heroGlowOpacity:     "0.1",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   neutral[400],
    proofBg:             neutral[0],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     neutral[200],
    proofCardRadius:     "0.25rem",
    proofCardShadow:     shadows.none,
    proofQuoteColor:     brand[500],
    featureGridBg:           neutral[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   neutral[200],
    featureGridCardRadius:   "0.25rem",
    featureGridCardShadow:   shadows.none,
    featureGridIconBg:       neutral[50],
  },
  meta: {
    name: "Enterprise Clean",
  },
};

/**
 * bold-brand — high-contrast, expressive personality.
 *
 *   Palette:  indigo-violet pushed to maximum vibrancy
 *   Radius:   soft — 12px interactive, 24px card
 *   Hero:     brand-800 — deep brand hue, not neutral dark
 *   CTA:      brand-600 with elevated shadow
 *   Cards:    white, no border, lg shadow — elevated and airy
 *   Buttons:  800 weight, md shadow, soft radius
 *   Motion:   200ms with spring easing for expressive feel
 */
const BOLD_BRAND: TenantTheme = {
  colors: {
    brand: {
      primary:       brand[500],
      primaryHover:  brand[400],
      primaryActive: brand[600],
      primarySubtle: brand[100],
      primaryText:   neutral[0],
      ring:          brand[400],
      textBrand:     brand[500],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[600],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  brand[50],
      bgInverse: brand[800],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "soft",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "800",
    subheadingWeight: "700",
  },
  button: {
    bg:         brand[500],
    text:       neutral[0],
    hoverBg:    brand[400],
    activeBg:   brand[600],
    ring:       brand[400],
    shadow:     shadows.md,
    fontWeight: "700",
  },
  motion: {
    transitionFast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "400ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              brand[900],
    ctaBg:               brand[600],
    ctaBodyText:         brand[200],
    subtleSectionBg:     brand[50],
    subtleSectionBorder: brand[100],
    cardBg:              neutral[0],
    cardBorderColor:     "transparent",
    cardRadius:          "1.5rem",
    cardShadow:          shadows.lg,
    quoteColor:          brand[400],
    heroGlowColor:       brand[400],
    heroGlowOpacity:     "0.3",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   brand[200],
    proofBg:             brand[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     "transparent",
    proofCardRadius:     "1.5rem",
    proofCardShadow:     shadows.lg,
    proofQuoteColor:     brand[400],
    featureGridBg:           brand[50],
    featureGridBorder:       brand[100],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   "transparent",
    featureGridCardRadius:   "1.5rem",
    featureGridCardShadow:   shadows.lg,
    featureGridIconBg:       brand[50],
  },
  meta: {
    name: "Bold Brand",
  },
};

/**
 * workengine — product-led, work-management personality.
 *
 *   Palette:  true violet/purple — energetic, focused, modern B2B
 *   Radius:   soft — 12px interactive, 24px card (generous, approachable)
 *   Hero:     deep violet-950 (#2e1065) — almost-black purple
 *   CTA:      violet-600 (#7c3aed) — saturated brand purple
 *   Cards:    white with violet-200 border, md shadow — clean elevation
 *   Buttons:  700 weight, md shadow, soft radius — confident CTAs
 *   Motion:   150ms standard, spring easing for interactive richness
 *
 * The violet palette is distinct from the platform's indigo `brand[]` tokens —
 * these are raw Tailwind violet-scale hex values for a true purple brand.
 */

// WorkEngine violet palette — Tailwind violet scale, stored as inline constants
// rather than imported tokens so the workengine preset is self-contained and
// does not pollute the platform-wide brand[] scale with client-specific values.
const violet = {
  50:  "#f5f3ff",
  100: "#ede9fe",
  200: "#ddd6fe",
  300: "#c4b5fd",
  400: "#a78bfa",
  500: "#8b5cf6",   // primary
  600: "#7c3aed",   // primary-hover / CTA bg
  700: "#6d28d9",   // primary-active
  800: "#5b21b6",
  900: "#4c1d95",
  950: "#2e1065",   // hero bg / bg-inverse
} as const;

const WORKENGINE: TenantTheme = {
  colors: {
    brand: {
      primary:       violet[500],    // #8b5cf6 — vivid purple
      primaryHover:  violet[600],    // #7c3aed
      primaryActive: violet[700],    // #6d28d9
      primarySubtle: violet[50],     // #f5f3ff — feather-light purple tint
      primaryText:   neutral[0],     // #ffffff — white on purple
      ring:          violet[400],    // #a78bfa — lighter for visible ring
      textBrand:     violet[600],    // #7c3aed — deeper shade for text contrast
    },
    text: {
      text:        neutral[900],     // #0f172a — near-black
      textMuted:   neutral[500],     // #64748b
      textSubtle:  neutral[400],     // #94a3b8
      textInverse: neutral[0],       // #ffffff
    },
    background: {
      bg:        neutral[50],        // #f8fafc — light grey page surface
      bgSubtle:  neutral[100],       // #f1f5f9 — slightly recessed areas
      bgInverse: violet[950],        // #2e1065 — deep purple inverse sections
    },
    border: {
      border:       neutral[200],    // #e2e8f0
      borderStrong: neutral[300],    // #cbd5e1
    },
  },

  // ── Radius ──────────────────────────────────────────────────────────────────
  // "soft" → buttons/inputs: 12px · cards: 24px · popovers: 16px
  radius: "soft",

  // ── Typography ──────────────────────────────────────────────────────────────
  // Heavy heading weight for the energetic, product-led character.
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "800",
    subheadingWeight: "700",
  },

  // ── Button tokens ────────────────────────────────────────────────────────────
  button: {
    bg:         violet[500],
    text:       neutral[0],
    hoverBg:    violet[600],
    activeBg:   violet[700],
    ring:       violet[400],
    shadow:     shadows.md,          // elevated CTA feel
    fontWeight: "700",
  },

  // ── Motion tokens ────────────────────────────────────────────────────────────
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  // ── Component-level style tokens ─────────────────────────────────────────────
  componentStyles: {
    // Section backgrounds
    heroBg:              violet[950],   // #2e1065 — deep purple hero
    ctaBg:               violet[600],   // #7c3aed — saturated purple CTA
    ctaBodyText:         violet[100],   // #ede9fe — light purple body text on CTA
    subtleSectionBg:     violet[50],    // #f5f3ff — feather-light purple sections
    subtleSectionBorder: violet[100],   // #ede9fe

    // Cards — white with purple border for brand consistency
    cardBg:          neutral[0],        // #ffffff — white surface
    cardBorderColor: violet[200],       // #ddd6fe — subtle purple border
    cardRadius:      "1.5rem",          // 24px — soft personality (explicit override)
    cardShadow:      shadows.md,        // elevated feel

    // Quote / accent
    quoteColor:      violet[500],       // #8b5cf6

    // Hero expansion
    heroGlowColor:     violet[400],     // #a78bfa — vivid glow
    heroGlowOpacity:   "0.35",
    heroTitleColor:    neutral[0],      // #ffffff
    heroSubtitleColor: violet[300],     // #c4b5fd — soft purple subtitle

    // Proof / testimonials
    proofBg:          violet[50],       // #f5f3ff
    proofBorder:      "transparent",
    proofCardBg:      neutral[0],       // #ffffff
    proofCardBorder:  violet[200],      // #ddd6fe
    proofCardRadius:  "1.5rem",
    proofCardShadow:  shadows.md,
    proofQuoteColor:  violet[500],      // #8b5cf6

    // Feature grid
    featureGridBg:           violet[50],    // #f5f3ff
    featureGridBorder:       violet[100],   // #ede9fe
    featureGridCardBg:       neutral[0],    // #ffffff
    featureGridCardBorder:   violet[200],   // #ddd6fe
    featureGridCardRadius:   "1.5rem",
    featureGridCardShadow:   shadows.md,
    featureGridIconBg:       violet[100],   // #ede9fe — purple tinted icon bg
  },

  meta: {
    name:    "WorkEngine",
    tagline: "Work flows better.",
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const THEME_PRESETS: Readonly<Record<ThemePresetKey, TenantTheme>> = {
  "marketing-default": MARKETING_DEFAULT,
  "enterprise-clean":  ENTERPRISE_CLEAN,
  "bold-brand":        BOLD_BRAND,
  "workengine":        WORKENGINE,
} as const;

// ── Resolution layer ──────────────────────────────────────────────────────────

/**
 * Resolve a named preset + optional deep overrides into a final TenantTheme.
 *
 * Resolution order:
 *   1. Preset base values
 *   2. overrides.colors.*
 *   3. overrides.radius
 *   4. overrides.typography
 *   5. overrides.button
 *   6. overrides.motion
 *   7. overrides.componentStyles
 *   8. overrides.meta
 */
export function resolveTheme(
  presetKey: ThemePresetKey,
  overrides?: ThemePresetOverrides,
): TenantTheme {
  const preset = THEME_PRESETS[presetKey];
  if (!overrides) return preset;

  const { colors: oc, radius, typography, button, motion, componentStyles, meta } = overrides;

  return {
    colors: {
      brand:      { ...preset.colors.brand,      ...(oc?.brand      ?? {}) },
      text:       { ...preset.colors.text,       ...(oc?.text       ?? {}) },
      background: { ...preset.colors.background, ...(oc?.background ?? {}) },
      border:     { ...preset.colors.border,     ...(oc?.border     ?? {}) },
    },
    radius:    radius ?? preset.radius,
    typography: typography !== undefined
      ? { ...preset.typography, ...typography }
      : preset.typography,
    button: button !== undefined
      ? { ...preset.button, ...button }
      : preset.button,
    motion: motion !== undefined
      ? { ...preset.motion, ...motion }
      : preset.motion,
    componentStyles: componentStyles !== undefined
      ? { ...preset.componentStyles, ...componentStyles }
      : preset.componentStyles,
    meta: meta !== undefined
      ? { ...preset.meta, ...meta }
      : preset.meta,
  };
}

export function isThemePresetKey(key: string): key is ThemePresetKey {
  return key in THEME_PRESETS;
}
