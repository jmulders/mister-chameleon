/**
 * Theme Presets
 *
 * Named, complete visual personalities for the platform.  A preset is a
 * full TenantTheme-compatible configuration — pick one and you get sensible
 * defaults for every token: colours, radius, typography, buttons, motion,
 * and component surface styles.
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
import {
  DEFAULT_BLOCK_STYLE_PROFILE,
  DARK_CONTRAST_PROFILE,
  EDITORIAL_CLASSIC_PROFILE,
  PREMIUM_EDITORIAL_PROFILE,
  PLAYFUL_STARTUP_PROFILE,
  CORPORATE_BLUE_PROFILE,
  MODERN_SAAS_PROFILE,
  MODERN_GREEN_PROFILE,
  MINIMAL_NEUTRAL_PROFILE,
  BOLD_DARK_PROFILE,
  TECH_INDIGO_PROFILE,
  WARM_PROFESSIONAL_PROFILE,
  RECRUITMENT_ENERGY_PROFILE,
  HEALTHCARE_CALM_PROFILE,
  INDUSTRIAL_STRONG_PROFILE,
  STARTUP_ENERGY_PROFILE,
  CORPORATE_TRUST_PROFILE,
  PORTFOLIO_SHOWCASE_PROFILE,
  PREMIUM_LUXURY_PROFILE,
  VALENTINE_PINK_PROFILE,
  DUTCH_ORANGE_PROFILE,
  CORPORATE_CLEAN_PROFILE,
  BOLD_MARKETING_PROFILE,
  CAREERS_HUMAN_PROFILE,
  DARK_AI_PROFILE,
  CLEAN_CORPORATE_PROFILE,
  STRUCTURED_SAAS_PROFILE,
} from "./block-style-profile";
import type { ThemeFamilyKey } from "./theme-family";
import type { FeaturedFamilyKey } from "./theme-families.config";
import type { HeaderVariant, FooterVariant, FooterDensity } from "@/tenant/types";

// ── Public types ──────────────────────────────────────────────────────────────

export type ThemePresetKey =
  // ── Curated commercial themes ─────────────────────────────────────────────
  | "corporate-blue"
  | "modern-green"
  | "minimal-neutral"
  | "bold-dark"
  | "tech-indigo"
  | "warm-professional"
  | "recruitment-energy"
  | "healthcare-calm"
  | "industrial-strong"
  | "premium-editorial"
  | "dark-contrast"
  | "editorial-classic"
  | "playful-startup"
  | "startup-energy"
  | "corporate-trust"
  | "modern-saas"
  | "corporate-clean"
  | "bold-marketing"
  // ── Signature themes (showcase · luxury) ─────────────────────────────────
  | "portfolio-showcase"
  | "premium-luxury"
  // ── Seasonal themes ────────────────────────────────────────────────────────
  | "valentine-pink"
  | "dutch-orange"
  // ── Careers / employer-brand ──────────────────────────────────────────────
  | "careers-human"
  // ── Premium style families ────────────────────────────────────────────────
  | "dark-ai"
  | "clean-corporate"
  | "structured-saas"
  // ── Client-type blueprints ────────────────────────────────────────────────
  | "werkenbij-blueprint"
  | "corporate-b2b-blueprint"
  | "saas-blueprint";

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

// ══════════════════════════════════════════════════════════════════════════════
// Curated commercial themes
//
// Each theme is self-contained — inline colour palettes rather than imported
// tokens so the preset file compiles without needing extra palette modules.
// Every theme covers the full TenantTheme surface: colors, radius, typography,
// button, motion, and componentStyles.
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared inline palettes ────────────────────────────────────────────────────
// Raw hex values scoped to this file — not exposed to the rest of the system.

const blue = {
  50:  "#eff6ff",
  100: "#dbeafe",
  600: "#2563eb",
  700: "#1d4ed8",
  800: "#1e40af",
  900: "#1e3a8a",
  nav: "#0f2a5c",  // deep navy hero
} as const;

const emerald = {
  50:  "#ecfdf5",
  100: "#d1fae5",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
} as const;

const zinc = {
  50:  "#fafafa",
  100: "#f4f4f5",
  200: "#e4e4e7",
  300: "#d4d4d8",
  400: "#a1a1aa",
  500: "#71717a",
  600: "#52525b",
  700: "#3f3f46",
  800: "#27272a",
  900: "#18181b",
  950: "#09090b",
} as const;

const amber = {
  50:  "#fffbeb",
  100: "#fef3c7",
  200: "#fde68a",
  500: "#f59e0b",
  600: "#d97706",
  700: "#b45309",
  800: "#92400e",
  950: "#451a03",
} as const;

const deepViolet = {
  50:  "#f5f3ff",
  100: "#ede9fe",
  200: "#ddd6fe",
  700: "#6d28d9",
  800: "#5b21b6",
  900: "#4c1d95",
  950: "#2e1065",
} as const;

const orange = {
  50:  "#fff7ed",
  100: "#ffedd5",
  500: "#f97316",
  600: "#ea580c",
  700: "#c2410c",
  800: "#9a3412",
  950: "#431407",
} as const;

const cyan = {
  50:  "#ecfeff",
  sky50: "#f0f9ff",
  600: "#0891b2",
  700: "#0e7490",
  800: "#155e75",
  900: "#164e63",
} as const;

const red = {
  50:  "#fef2f2",
  600: "#dc2626",
  700: "#b91c1c",
  800: "#991b1b",
} as const;

const stone = {
  50:  "#fafaf9",
  100: "#f5f5f4",
  200: "#e7e5e4",
  300: "#d6d3d1",
  900: "#1c1917",
  950: "#0c0a09",
} as const;

const gold = {
  50:  "#fefce8",
  100: "#fef9c3",
  700: "#a16207",
  800: "#854d0e",
  900: "#713f12",
} as const;

// ── 1. Corporate Blue ─────────────────────────────────────────────────────────
//
//   Palette:  Navy-blue — trust, authority, financial / enterprise B2B
//   Radius:   sharp — crisp, boardroom aesthetic
//   Hero:     deep navy #0f2a5c
//   CTA:      blue-700 — strong, direct
//   Cards:    white, 1px border, xs shadow — understated
//   Buttons:  600 weight, sharp radius, xs shadow
//   Motion:   snappy 100ms — professional, not playful
//   Best for: professional services, financial, B2B SaaS, consulting

const CORPORATE_BLUE: TenantTheme = {
  colors: {
    brand: {
      primary:       blue[700],
      primaryHover:  blue[800],
      primaryActive: blue[900],
      primarySubtle: blue[50],
      primaryText:   neutral[0],
      ring:          blue[700],
      textBrand:     blue[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  blue[50],
      bgInverse: blue.nav,
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "sharp",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "700",
    subheadingWeight: "600",
  },
  button: {
    bg:         blue[700],
    text:       neutral[0],
    hoverBg:    blue[800],
    activeBg:   blue[900],
    ring:       blue[700],
    shadow:     shadows.xs,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)", // no spring for corporate
  },
  componentStyles: {
    heroBg:              blue.nav,
    ctaBg:               blue[700],
    ctaBodyText:         blue[100],
    subtleSectionBg:     blue[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     neutral[200],
    cardRadius:          "0.25rem",
    cardShadow:          shadows.xs,
    quoteColor:          blue[700],
    heroGlowColor:       blue[600],
    heroGlowOpacity:     "0.15",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   blue[100],
    proofBg:             blue[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     neutral[200],
    proofCardRadius:     "0.25rem",
    proofCardShadow:     shadows.xs,
    proofQuoteColor:     blue[700],
    featureGridBg:           blue[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   neutral[200],
    featureGridCardRadius:   "0.25rem",
    featureGridCardShadow:   shadows.xs,
    featureGridIconBg:       blue[50],
  },
  blockStyle: CORPORATE_BLUE_PROFILE,
  meta: { name: "Corporate Blue" },
};

// ── 2. Modern Green ───────────────────────────────────────────────────────────
//
//   Palette:  Emerald-green — growth, sustainability, energy, fresh B2B
//   Radius:   balanced — approachable but structured
//   Hero:     deep emerald-900 — lush, rich
//   CTA:      emerald-600 — clear, confident
//   Cards:    white, sm shadow — clean elevation
//   Buttons:  700 weight, balanced radius
//   Best for: sustainability, health-tech, growth-focused SaaS, fintech

const MODERN_GREEN: TenantTheme = {
  colors: {
    brand: {
      primary:       emerald[600],
      primaryHover:  emerald[700],
      primaryActive: emerald[800],
      primarySubtle: emerald[50],
      primaryText:   neutral[0],
      ring:          emerald[600],
      textBrand:     emerald[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  emerald[50],
      bgInverse: emerald[900],
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
    bg:         emerald[600],
    text:       neutral[0],
    hoverBg:    emerald[700],
    activeBg:   emerald[800],
    ring:       emerald[600],
    shadow:     shadows.sm,
    fontWeight: "700",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              emerald[900],
    ctaBg:               emerald[700],
    ctaBodyText:         emerald[100],
    subtleSectionBg:     emerald[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     neutral[200],
    cardRadius:          "1rem",
    cardShadow:          shadows.sm,
    quoteColor:          emerald[600],
    heroGlowColor:       emerald[600],
    heroGlowOpacity:     "0.2",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   emerald[100],
    proofBg:             emerald[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     neutral[200],
    proofCardRadius:     "1rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     emerald[600],
    featureGridBg:           emerald[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   neutral[200],
    featureGridCardRadius:   "1rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       emerald[50],
  },
  blockStyle: MODERN_GREEN_PROFILE,
  meta: { name: "Modern Green" },
};

// ── 3. Minimal Neutral ────────────────────────────────────────────────────────
//
//   Palette:  Zinc monochrome — purely structural, no colour distraction
//   Radius:   sharp — architectural precision
//   Hero:     zinc-900 — near-black, not brand-coloured
//   CTA:      zinc-700 — dark neutral, not a brand hue
//   Cards:    white, thin border, no shadow — pure flat aesthetic
//   Buttons:  500 weight, no shadow, no letterSpacing
//   Motion:   50ms — immediate, almost zero latency
//   Best for: architecture, design agencies, portfolios, editorial brands

const MINIMAL_NEUTRAL: TenantTheme = {
  colors: {
    brand: {
      primary:       zinc[600],
      primaryHover:  zinc[700],
      primaryActive: zinc[800],
      primarySubtle: zinc[100],
      primaryText:   neutral[0],
      ring:          zinc[500],
      textBrand:     zinc[700],
    },
    text: {
      text:        zinc[900],
      textMuted:   zinc[500],
      textSubtle:  zinc[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[0],      // pure white — most reduced visual weight
      bgSubtle:  zinc[50],
      bgInverse: zinc[900],
    },
    border: {
      border:       zinc[200],
      borderStrong: zinc[300],
    },
  },
  radius: "sharp",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "500",       // restrained — headlines don't shout
    subheadingWeight: "400",
  },
  button: {
    bg:         zinc[700],
    text:       neutral[0],
    hoverBg:    zinc[800],
    activeBg:   zinc[900],
    ring:       zinc[500],
    shadow:     shadows.none,
    fontWeight: "500",
  },
  motion: {
    transitionFast: "50ms linear",
    transitionBase: "100ms linear",
    transitionSlow: "200ms linear",
    easingDefault:  "linear",
    easingSpring:   "linear",      // no spring — minimal ethos
  },
  componentStyles: {
    heroBg:              zinc[900],
    ctaBg:               zinc[800],
    ctaBodyText:         zinc[300],
    subtleSectionBg:     zinc[50],
    subtleSectionBorder: zinc[200],
    cardBg:              neutral[0],
    cardBorderColor:     zinc[200],
    cardRadius:          "0.125rem",  // 2px — near-zero radius
    cardShadow:          shadows.none,
    quoteColor:          zinc[600],
    heroGlowColor:       zinc[600],
    heroGlowOpacity:     "0.0",        // no glow — pure flat
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   zinc[400],
    proofBg:             zinc[50],
    proofBorder:         zinc[200],
    proofCardBg:         neutral[0],
    proofCardBorder:     zinc[200],
    proofCardRadius:     "0.125rem",
    proofCardShadow:     shadows.none,
    proofQuoteColor:     zinc[600],
    featureGridBg:           zinc[50],
    featureGridBorder:       zinc[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   zinc[200],
    featureGridCardRadius:   "0.125rem",
    featureGridCardShadow:   shadows.none,
    featureGridIconBg:       zinc[100],
  },
  blockStyle: MINIMAL_NEUTRAL_PROFILE,
  meta: { name: "Minimal Neutral" },
};

// ── 4. Bold Dark ──────────────────────────────────────────────────────────────
//
//   Palette:  Amber accent on deep-slate base — cinematic, high energy
//   Radius:   balanced — bold but not bubbly
//   Hero:     neutral-900 (near-black slate) — dramatic impact
//   CTA:      amber-500 — vivid warm call-to-action against dark
//   Cards:    white, lg shadow — maximum contrast lift
//   Buttons:  800 weight, md shadow — strong physical presence
//   Motion:   200ms spring — expressive without being slow
//   Best for: tech startups, SaaS, creative agencies, product launches

const BOLD_DARK: TenantTheme = {
  colors: {
    brand: {
      primary:       amber[500],
      primaryHover:  amber[600],
      primaryActive: amber[700],
      primarySubtle: amber[50],
      primaryText:   neutral[900],  // dark text on amber — readable
      ring:          amber[500],
      textBrand:     amber[600],
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
    headingWeight:    "800",
    subheadingWeight: "700",
  },
  button: {
    bg:         amber[500],
    text:       neutral[900],
    hoverBg:    amber[600],
    activeBg:   amber[700],
    ring:       amber[500],
    shadow:     shadows.md,
    fontWeight: "800",
  },
  motion: {
    transitionFast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "400ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              neutral[950],
    ctaBg:               amber[500],
    ctaBodyText:         neutral[900],
    subtleSectionBg:     neutral[100],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     "transparent",
    cardRadius:          "1rem",
    cardShadow:          shadows.lg,
    quoteColor:          amber[500],
    heroGlowColor:       amber[500],
    heroGlowOpacity:     "0.25",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   neutral[400],
    proofBg:             neutral[100],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     "transparent",
    proofCardRadius:     "1rem",
    proofCardShadow:     shadows.lg,
    proofQuoteColor:     amber[500],
    featureGridBg:           neutral[100],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   "transparent",
    featureGridCardRadius:   "1rem",
    featureGridCardShadow:   shadows.lg,
    featureGridIconBg:       amber[50],
  },
  blockStyle: BOLD_DARK_PROFILE,
  meta: { name: "Bold Dark" },
};

// ── 5. Tech Indigo ────────────────────────────────────────────────────────────
//
//   Palette:  Deep violet-800 — darker/richer purple than the platform default
//             Distinct from the platform brand[500] indigo-violet
//   Radius:   sharp — developer tool aesthetic, functional precision
//   Hero:     violet-950 — ultra-deep purple-black
//   CTA:      violet-800 — saturated, intentional
//   Cards:    white, violet tinted border, md shadow
//   Buttons:  700 weight, sharp radius, md shadow
//   Best for: developer tools, SaaS dashboards, API products, DevOps platforms

const TECH_INDIGO: TenantTheme = {
  colors: {
    brand: {
      primary:       deepViolet[800],
      primaryHover:  deepViolet[900],
      primaryActive: deepViolet[950],
      primarySubtle: deepViolet[50],
      primaryText:   neutral[0],
      ring:          deepViolet[700],
      textBrand:     deepViolet[800],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  deepViolet[50],
      bgInverse: deepViolet[950],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "sharp",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "700",
    subheadingWeight: "600",
  },
  button: {
    bg:         deepViolet[800],
    text:       neutral[0],
    hoverBg:    deepViolet[900],
    activeBg:   deepViolet[950],
    ring:       deepViolet[700],
    shadow:     shadows.md,
    fontWeight: "700",
  },
  motion: {
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "250ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  componentStyles: {
    heroBg:              deepViolet[950],
    ctaBg:               deepViolet[800],
    ctaBodyText:         deepViolet[200],
    subtleSectionBg:     deepViolet[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     deepViolet[200],
    cardRadius:          "0.25rem",
    cardShadow:          shadows.md,
    quoteColor:          deepViolet[700],
    heroGlowColor:       deepViolet[700],
    heroGlowOpacity:     "0.3",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   deepViolet[200],
    proofBg:             deepViolet[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     deepViolet[200],
    proofCardRadius:     "0.25rem",
    proofCardShadow:     shadows.md,
    proofQuoteColor:     deepViolet[700],
    featureGridBg:           deepViolet[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   deepViolet[200],
    featureGridCardRadius:   "0.25rem",
    featureGridCardShadow:   shadows.md,
    featureGridIconBg:       deepViolet[100],
  },
  blockStyle: TECH_INDIGO_PROFILE,
  meta: { name: "Tech Indigo" },
};

// ── 6. Warm Professional ──────────────────────────────────────────────────────
//
//   Palette:  Amber-600 — warm, approachable authority
//   Radius:   balanced — friendly but structured
//   Hero:     amber-950 — warm dark background
//   CTA:      amber-600 — inviting, human
//   Cards:    white, warm-tinted border, sm shadow
//   Buttons:  600 weight, balanced radius, sm shadow
//   Best for: consultancies, coaches, HR tech, real estate, legal

const WARM_PROFESSIONAL: TenantTheme = {
  colors: {
    brand: {
      primary:       amber[600],
      primaryHover:  amber[700],
      primaryActive: amber[800],
      primarySubtle: amber[50],
      primaryText:   neutral[0],
      ring:          amber[600],
      textBrand:     amber[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        "#fafaf9",           // stone-50 — warm white
      bgSubtle:  amber[50],
      bgInverse: amber[950],
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
    bg:         amber[600],
    text:       neutral[0],
    hoverBg:    amber[700],
    activeBg:   amber[800],
    ring:       amber[600],
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
    heroBg:              amber[950],
    ctaBg:               amber[600],
    ctaBodyText:         amber[100],
    subtleSectionBg:     amber[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     neutral[200],
    cardRadius:          "1rem",
    cardShadow:          shadows.sm,
    quoteColor:          amber[600],
    heroGlowColor:       amber[500],
    heroGlowOpacity:     "0.2",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   amber[200],
    proofBg:             amber[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     neutral[200],
    proofCardRadius:     "1rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     amber[600],
    featureGridBg:           amber[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   neutral[200],
    featureGridCardRadius:   "1rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       amber[50],
  },
  blockStyle: WARM_PROFESSIONAL_PROFILE,
  meta: { name: "Warm Professional" },
};

// ── 7. Recruitment Energy ─────────────────────────────────────────────────────
//
//   Palette:  Orange-600 — energetic, action-oriented, optimistic
//   Radius:   soft — approachable, candidate-friendly
//   Hero:     orange-950 — deep, immersive
//   CTA:      orange-600 — high-energy call-to-action
//   Cards:    white, lg shadow — elevated, aspirational
//   Buttons:  800 weight, soft radius — confident, inviting action
//   Motion:   200ms spring — lively, engaging
//   Best for: recruitment platforms, job boards, career sites, HR brands

const RECRUITMENT_ENERGY: TenantTheme = {
  colors: {
    brand: {
      primary:       orange[600],
      primaryHover:  orange[700],
      primaryActive: orange[800],
      primarySubtle: orange[50],
      primaryText:   neutral[0],
      ring:          orange[500],
      textBrand:     orange[600],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[50],
      bgSubtle:  orange[50],
      bgInverse: orange[950],
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
    bg:         orange[600],
    text:       neutral[0],
    hoverBg:    orange[700],
    activeBg:   orange[800],
    ring:       orange[500],
    shadow:     shadows.md,
    fontWeight: "800",
  },
  motion: {
    transitionFast: "120ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "400ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              orange[950],
    ctaBg:               orange[600],
    ctaBodyText:         orange[100],
    subtleSectionBg:     orange[50],
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     "transparent",
    cardRadius:          "1.5rem",
    cardShadow:          shadows.lg,
    quoteColor:          orange[500],
    heroGlowColor:       orange[500],
    heroGlowOpacity:     "0.3",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   orange[100],
    proofBg:             orange[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     "transparent",
    proofCardRadius:     "1.5rem",
    proofCardShadow:     shadows.lg,
    proofQuoteColor:     orange[500],
    featureGridBg:           orange[50],
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   "transparent",
    featureGridCardRadius:   "1.5rem",
    featureGridCardShadow:   shadows.lg,
    featureGridIconBg:       orange[50],
  },
  blockStyle: RECRUITMENT_ENERGY_PROFILE,
  meta: { name: "Recruitment Energy" },
};

// ── 8. Healthcare Calm ────────────────────────────────────────────────────────
//
//   Palette:  Cyan-600 on sky-tinted backgrounds — clean, trustworthy, calming
//   Radius:   soft — accessible, friendly, not clinical
//   Hero:     cyan-900 — deep but not aggressive
//   CTA:      cyan-600 — confident, health-brand
//   Cards:    white, no border, sm shadow — airy, spacious
//   Buttons:  600 weight, soft radius, sm shadow — measured authority
//   Motion:   200ms ease — deliberate, calming
//   Best for: healthcare, wellness, medical SaaS, mental health, insurance

const HEALTHCARE_CALM: TenantTheme = {
  colors: {
    brand: {
      primary:       cyan[600],
      primaryHover:  cyan[700],
      primaryActive: cyan[800],
      primarySubtle: cyan[50],
      primaryText:   neutral[0],
      ring:          cyan[600],
      textBrand:     cyan[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        cyan.sky50,          // sky-50 — very pale blue page surface
      bgSubtle:  cyan[50],
      bgInverse: cyan[900],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "soft",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "600",          // measured authority — not heavy-handed
    subheadingWeight: "500",
  },
  button: {
    bg:         cyan[600],
    text:       neutral[0],
    hoverBg:    cyan[700],
    activeBg:   cyan[800],
    ring:       cyan[600],
    shadow:     shadows.sm,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "120ms cubic-bezier(0.4, 0, 0.6, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.6, 1)",
    transitionSlow: "350ms cubic-bezier(0.4, 0, 0.6, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.6, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.3, 0.64, 1)", // gentle spring
  },
  componentStyles: {
    heroBg:              cyan[900],
    ctaBg:               cyan[700],
    ctaBodyText:         cyan[50],
    subtleSectionBg:     cyan.sky50,
    subtleSectionBorder: neutral[200],
    cardBg:              neutral[0],
    cardBorderColor:     "transparent",
    cardRadius:          "1.5rem",
    cardShadow:          shadows.sm,
    quoteColor:          cyan[600],
    heroGlowColor:       cyan[600],
    heroGlowOpacity:     "0.15",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   cyan[50],
    proofBg:             cyan.sky50,
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     "transparent",
    proofCardRadius:     "1.5rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     cyan[600],
    featureGridBg:           cyan.sky50,
    featureGridBorder:       neutral[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   "transparent",
    featureGridCardRadius:   "1.5rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       cyan[50],
  },
  blockStyle: HEALTHCARE_CALM_PROFILE,
  meta: { name: "Healthcare Calm" },
};

// ── 9. Industrial Strong ──────────────────────────────────────────────────────
//
//   Palette:  Red-600 on stone/warm-grey base — strong, direct, no-nonsense
//   Radius:   sharp — industrial, mechanical, no softness
//   Hero:     stone-900 — warm dark, not cold black
//   CTA:      red-600 — alert, urgent, action
//   Cards:    white, stone border, xs shadow — grounded, utilitarian
//   Buttons:  700 weight, sharp, xs shadow — direct
//   Motion:   100ms — immediate, machine-like response
//   Best for: manufacturing, logistics, construction, industrial B2B

const INDUSTRIAL_STRONG: TenantTheme = {
  colors: {
    brand: {
      primary:       red[600],
      primaryHover:  red[700],
      primaryActive: red[800],
      primarySubtle: red[50],
      primaryText:   neutral[0],
      ring:          red[600],
      textBrand:     red[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        stone[50],
      bgSubtle:  stone[100],
      bgInverse: stone[900],
    },
    border: {
      border:       stone[200],
      borderStrong: stone[300],
    },
  },
  radius: "sharp",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "700",
    subheadingWeight: "600",
  },
  button: {
    bg:         red[600],
    text:       neutral[0],
    hoverBg:    red[700],
    activeBg:   red[800],
    ring:       red[600],
    shadow:     shadows.xs,
    fontWeight: "700",
  },
  motion: {
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)", // no spring
  },
  componentStyles: {
    heroBg:              stone[900],
    ctaBg:               red[600],
    ctaBodyText:         red[50],
    subtleSectionBg:     stone[100],
    subtleSectionBorder: stone[200],
    cardBg:              neutral[0],
    cardBorderColor:     stone[200],
    cardRadius:          "0.25rem",
    cardShadow:          shadows.xs,
    quoteColor:          red[600],
    heroGlowColor:       red[600],
    heroGlowOpacity:     "0.1",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   stone[300],
    proofBg:             stone[100],
    proofBorder:         stone[200],
    proofCardBg:         neutral[0],
    proofCardBorder:     stone[200],
    proofCardRadius:     "0.25rem",
    proofCardShadow:     shadows.xs,
    proofQuoteColor:     red[600],
    featureGridBg:           stone[100],
    featureGridBorder:       stone[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   stone[200],
    featureGridCardRadius:   "0.25rem",
    featureGridCardShadow:   shadows.xs,
    featureGridIconBg:       stone[100],
  },
  blockStyle: INDUSTRIAL_STRONG_PROFILE,
  meta: { name: "Industrial Strong" },
};

// ── 10. Premium Editorial ─────────────────────────────────────────────────────
//
//   Palette:  Warm brown (#8b5e3c) primary on cream (#faf6ef) — elegant warmth
//             Dark charcoal (#2d2016) text — rich, readable contrast
//   Radius:   balanced — welcoming, not stiff
//   Hero:     deep warm brown (#1a0f08) — cinematic, inviting
//   CTA:      warm brown — understated luxury, earthy authority
//   Cards:    cream-white, warm border, sm shadow — magazine-quality depth
//   Buttons:  600 weight, balanced, subtle shadow — confident restraint
//   Fonts:    DM Sans body, Cormorant Garamond headings — sophisticated pairing
//   Mono:     JetBrains Mono — for code blocks / inline technical content
//   Motion:   160ms ease — deliberate, unhurried
//   Best for: premium media, publishing, luxury B2B, high-end retail, editorial

const PREMIUM_EDITORIAL: TenantTheme = {
  colors: {
    brand: {
      primary:       "#8b5e3c",    // warm brown — earthy, premium
      primaryHover:  "#7a5233",    // slightly deeper brown
      primaryActive: "#6a4429",    // rich dark brown for pressed state
      primarySubtle: "#f5ede4",    // pale warm cream tint
      primaryText:   "#ffffff",    // white text on brown buttons
      ring:          "#8b5e3c",
      textBrand:     "#8b5e3c",
    },
    text: {
      text:        "#2d2016",      // deep warm charcoal — rich, not cold black
      textMuted:   "#7a6652",      // warm mid-brown for secondary text
      textSubtle:  "#a8937e",      // muted warm tan for captions / placeholders
      textInverse: "#faf6ef",      // cream on dark — keeps warmth in inverse
    },
    background: {
      bg:        "#faf6ef",        // warm cream — the signature editorial ground
      bgSubtle:  "#f2ebe0",        // slightly deeper cream for recessed areas
      bgInverse: "#1a0f08",        // deep warm espresso — cinematic hero
    },
    border: {
      border:       "#e0d5c5",     // soft warm divider — never harsh
      borderStrong: "#c8b99f",     // defined warm border for active inputs
    },
  },
  radius: "balanced",
  typography: {
    fontSans:         "'DM Sans', system-ui, sans-serif",
    fontSerif:        "'Cormorant Garamond', Georgia, serif",
    fontMono:         "'JetBrains Mono', ui-monospace, monospace",
    headingFont:      "'Cormorant Garamond', Georgia, serif",
    headingWeight:    "600",        // medium-bold for elegant editorial punch
    subheadingWeight: "500",
  },
  button: {
    bg:         "#8b5e3c",
    text:       "#ffffff",
    hoverBg:    "#7a5233",
    activeBg:   "#6a4429",
    ring:       "#8b5e3c",
    shadow:     shadows.sm,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "160ms cubic-bezier(0.4, 0, 0.2, 1)", // slightly slower — editorial pace
    transitionSlow: "320ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",       // no spring — considered, deliberate
  },
  componentStyles: {
    heroBg:              "#1a0f08",   // deep espresso — cinematic opening
    ctaBg:               "#8b5e3c",   // warm brown CTA — earthy authority
    ctaBodyText:         "#f5ede4",   // pale cream body text on brown CTA
    subtleSectionBg:     "#f2ebe0",   // warm recessed section background
    subtleSectionBorder: "#e0d5c5",   // soft warm border on subtle sections
    cardBg:              "#ffffff",   // clean white cards — pop against cream bg
    cardBorderColor:     "#e0d5c5",   // warm dividing border
    cardRadius:          "0.75rem",   // balanced — magazine card feel
    cardShadow:          shadows.sm,  // visible lift — editorial depth
    quoteColor:          "#8b5e3c",   // warm brown pull-quote mark
    heroGlowColor:       "#8b5e3c",   // warm glow against dark hero
    heroGlowOpacity:     "0.25",
    heroTitleColor:      "#faf6ef",   // cream headline on espresso hero
    heroSubtitleColor:   "#c8b99f",   // muted warm tan subtitle
    proofBg:             "#f2ebe0",
    proofBorder:         "#e0d5c5",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#e0d5c5",
    proofCardRadius:     "0.75rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     "#8b5e3c",
    featureGridBg:           "#f2ebe0",
    featureGridBorder:       "#e0d5c5",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#e0d5c5",
    featureGridCardRadius:   "0.75rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       "#f5ede4",
  },
  blockStyle: PREMIUM_EDITORIAL_PROFILE,
  meta: { name: "Premium Editorial" },
};

// ── 11. Dark Contrast ─────────────────────────────────────────────────────────
//
//   Palette:  Pure black background, pure white primary — maximum contrast.
//             No colour; structure and contrast carry all meaning.
//   Radius:   sharp — minimal, precision-first aesthetic
//   Hero:     pure black — seamless continuation of the body
//   CTA:      white — the only "pop" in the layout
//   Cards:    near-black (#111111), barely lifted from the body
//   Buttons:  white with black text, 500 weight, 0.02em tracking
//   Fonts:    DM Sans (body) + Space Grotesk (headings, 300 weight)
//   Motion:   deliberate — 250ms base
//   Best for: luxury brands, creative agencies, high-fashion, premium SaaS

const DARK_CONTRAST: TenantTheme = {
  colors: {
    brand: {
      primary:       "#ffffff",
      primaryHover:  "#f0f0f0",
      primaryActive: "#e0e0e0",
      primarySubtle: "#1a1a1a",
      primaryText:   "#000000",
      ring:          "#ffffff",
      textBrand:     "#e5e5e5",
    },
    text: {
      text:        "#fafafa",
      textMuted:   "#a3a3a3",
      textSubtle:  "#737373",
      textInverse: "#000000",
    },
    background: {
      bg:        "#000000",
      bgSubtle:  "#0d0d0d",
      bgInverse: "#ffffff",
    },
    border: {
      border:       "#2a2a2a",
      borderStrong: "#3d3d3d",
    },
  },
  radius: "sharp",
  typography: {
    fontSans:         "'DM Sans', system-ui, sans-serif",
    headingFont:      "'Space Grotesk', system-ui, sans-serif",
    headingWeight:    "300",
    subheadingWeight: "400",
  },
  button: {
    bg:         "#ffffff",
    text:       "#000000",
    hoverBg:    "#f0f0f0",
    activeBg:   "#e0e0e0",
    ring:       "#ffffff",
    shadow:     shadows.none,
    fontWeight: "500",
  },
  motion: {
    transitionFast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "250ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "400ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",   // no spring — austere
  },
  componentStyles: {
    heroBg:              "#000000",
    ctaBg:               "#ffffff",
    ctaBodyText:         "#3d3d3d",
    subtleSectionBg:     "#0d0d0d",
    subtleSectionBorder: "#2a2a2a",
    cardBg:              "#111111",
    cardBorderColor:     "#2a2a2a",
    cardRadius:          "0.25rem",
    cardShadow:          shadows.none,
    quoteColor:          "#ffffff",
    heroGlowColor:       "#ffffff",
    heroGlowOpacity:     "0.04",
    heroTitleColor:      "#fafafa",
    heroSubtitleColor:   "#737373",
    proofBg:             "#0d0d0d",
    proofBorder:         "#2a2a2a",
    proofCardBg:         "#111111",
    proofCardBorder:     "#2a2a2a",
    proofCardRadius:     "0.25rem",
    proofCardShadow:     shadows.none,
    proofQuoteColor:     "#ffffff",
    featureGridBg:           "#0d0d0d",
    featureGridBorder:       "#2a2a2a",
    featureGridCardBg:       "#111111",
    featureGridCardBorder:   "#2a2a2a",
    featureGridCardRadius:   "0.25rem",
    featureGridCardShadow:   shadows.none,
    featureGridIconBg:       "#1a1a1a",
    // ── Header — dark-contrast specific ────────────────────────────────────────
    // Without explicit header tokens the default rgba(255,255,255,0.95) creates
    // a white header bar floating over a pure-black page — completely wrong for
    // this preset.  Dark semi-opaque header matches the dark page aesthetic.
    headerBg:          "rgba(0, 0, 0, 0.95)",
    headerBgScrolled:  "rgba(0, 0, 0, 0.98)",
    headerFg:          "#fafafa",
    headerBorder:      "#2a2a2a",
    footerBg:          "#0d0d0d",
    footerFg:          "#a3a3a3",
    footerBorder:      "#2a2a2a",
    // ── Nav dropdown — dark-contrast specific ──────────────────────────────────
    // Dropdown panel needs a dark surface to match the dark page.
    // Without this, navDropdownBg would default to cardBg (#111111) which is
    // correct, but we set it explicitly for clarity and override insurance.
    navDropdownBg:              "#111111",
    navDropdownBorder:          "#2a2a2a",
    navDropdownText:            "#a3a3a3",
    navDropdownLinkHoverBg:     "#1a1a1a",
    navDropdownLinkHoverText:   "#fafafa",
  },
  blockStyle: DARK_CONTRAST_PROFILE,
  meta: { name: "Dark Contrast" },
};

// ── 12. Editorial Classic ─────────────────────────────────────────────────────
//
//   Palette:  Pure white editorial canvas, charcoal ink.
//             Warm paper undertone (f8f6f3) for subtle sections.
//   Radius:   near-zero — newspaper precision (2px)
//   Hero:     dark charcoal — ink-black editorial contrast
//   CTA:      charcoal — understated, editorial-grade authority
//   Cards:    white, warm paper border, flat (no shadow)
//   Buttons:  600 weight, no transform, sharp radius
//   Fonts:    Source Sans 3 (body) + Playfair Display (headings, serif)
//   Motion:   calm — 200ms base, no spring
//   Best for: news/media, publishers, law firms, finance, long-form content

const EDITORIAL_CLASSIC: TenantTheme = {
  colors: {
    brand: {
      primary:       "#1a1a1a",
      primaryHover:  "#000000",
      primaryActive: "#000000",
      primarySubtle: "#f0ede8",
      primaryText:   "#ffffff",
      ring:          "#1a1a1a",
      textBrand:     "#1a1a1a",
    },
    text: {
      text:        "#1a1a1a",
      textMuted:   "#5a5a5a",
      textSubtle:  "#9a9a9a",
      textInverse: "#f8f6f3",
    },
    background: {
      bg:        "#ffffff",
      bgSubtle:  "#f8f6f3",   // warm paper
      bgInverse: "#1c1917",   // charcoal
    },
    border: {
      border:       "#e8e4de",
      borderStrong: "#c8c4bc",
    },
  },
  radius: "sharp",
  // Typography is intentionally minimal here — the featured family config
  // (featuredFamilyKey below) emits Playfair Display headings, Inter body,
  // Cormorant Garamond accent font, and the editorial scale profile.
  typography: {
    headingWeight:    "600",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "500",
  },
  // ── Featured family key — drives typography from the family layer ───────────
  featuredFamilyKey: "editorial-classic" as FeaturedFamilyKey,
  button: {
    bg:         "#1a1a1a",
    text:       "#ffffff",
    hoverBg:    "#000000",
    activeBg:   "#000000",
    ring:       "#1a1a1a",
    shadow:     shadows.none,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "350ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",   // no spring — editorial
  },
  componentStyles: {
    heroBg:              "#1c1917",
    ctaBg:               "#1a1a1a",
    ctaBodyText:         "#c8c4bc",
    subtleSectionBg:     "#f8f6f3",
    subtleSectionBorder: "#e8e4de",
    cardBg:              "#ffffff",
    cardBorderColor:     "#e8e4de",
    cardRadius:          "0.125rem",   // near-zero — maximal precision
    cardShadow:          shadows.none,
    quoteColor:          "#1a1a1a",
    heroGlowColor:       "#c8c4bc",
    heroGlowOpacity:     "0.1",
    heroTitleColor:      "#f8f6f3",
    heroSubtitleColor:   "#9a9a9a",
    proofBg:             "#f8f6f3",
    proofBorder:         "#e8e4de",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#e8e4de",
    proofCardRadius:     "0.125rem",
    proofCardShadow:     shadows.none,
    proofQuoteColor:     "#1a1a1a",
    featureGridBg:           "#f8f6f3",
    featureGridBorder:       "#e8e4de",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#e8e4de",
    featureGridCardRadius:   "0.125rem",
    featureGridCardShadow:   shadows.none,
    featureGridIconBg:       "#f0ede8",
  },
  blockStyle: EDITORIAL_CLASSIC_PROFILE,
  meta: { name: "Editorial Classic" },
};

// ── 13. Playful Startup ────────────────────────────────────────────────────────
//
//   Palette:  Vivid violet (#6d28d9) primary on clean white — energetic, modern
//             Deep purple-tinted near-black (#150a2e) text
//   Radius:   soft — bubbly, approachable, consumer-friendly
//   Hero:     deep purple #1e0545 — immersive, dark-mode energy
//   CTA:      vivid violet — magnetic, conversion-focused
//   Cards:    white, light violet border, md shadow — floating, airy
//   Buttons:  700 weight, soft radius, lift shadow — action-first
//   Fonts:    Outfit body (friendly geometric), Plus Jakarta Sans headings (punchy 800)
//   Mono:     Fira Code — developer-friendly for technical content
//   Motion:   spring-forward, snappy 100ms — playful, responsive
//   Best for: consumer apps, EdTech, lifestyle brands, startup landing pages, SaaS

const PLAYFUL_STARTUP: TenantTheme = {
  colors: {
    brand: {
      primary:       "#6d28d9",    // vivid violet — energetic, modern
      primaryHover:  "#5b21b6",    // deeper violet
      primaryActive: "#4c1d95",    // dark violet for pressed state
      primarySubtle: "#f5f3ff",    // barely-there violet tint
      primaryText:   "#ffffff",    // white text on violet
      ring:          "#7c3aed",    // slightly brighter violet focus ring
      textBrand:     "#6d28d9",
    },
    text: {
      text:        "#150a2e",      // deep purple-tinted near-black — rich, on-brand
      textMuted:   "#6b7280",      // neutral-500 — readable secondary
      textSubtle:  "#9ca3af",      // neutral-400 — captions, placeholders
      textInverse: "#ffffff",
    },
    background: {
      bg:        "#ffffff",        // clean white — keeps energy in the accents
      bgSubtle:  "#faf9ff",        // barely-purple-tinted off-white for recessed areas
      bgInverse: "#1e0545",        // deep immersive purple-black hero
    },
    border: {
      border:       "#e5e7eb",     // neutral, not purple — keeps layouts clean
      borderStrong: "#d1d5db",
    },
  },
  radius: "soft",
  typography: {
    fontSans:         "'Outfit', system-ui, sans-serif",
    fontMono:         "'Fira Code', ui-monospace, monospace",
    headingFont:      "'Plus Jakarta Sans', system-ui, sans-serif",
    headingWeight:    "800",        // extra-bold headings — punchy startup energy
    subheadingWeight: "700",
  },
  button: {
    bg:         "#6d28d9",
    text:       "#ffffff",
    hoverBg:    "#5b21b6",
    activeBg:   "#4c1d95",
    ring:       "#7c3aed",
    shadow:     shadows.md,        // pronounced lift — buttons pop
    fontWeight: "700",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.34, 1.56, 0.64, 1)", // spring-in for micro-interactions
    transitionBase: "150ms cubic-bezier(0.34, 1.4, 0.64, 1)",  // slightly springy base
    transitionSlow: "280ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",       // full spring — playful
  },
  componentStyles: {
    heroBg:              "#1e0545",   // deep immersive purple-black
    ctaBg:               "#6d28d9",   // vivid violet CTA
    ctaBodyText:         "#e9d5ff",   // light lavender body text on violet
    subtleSectionBg:     "#faf9ff",   // whisper-purple off-white
    subtleSectionBorder: "#ede9fe",   // soft violet border
    cardBg:              "#ffffff",
    cardBorderColor:     "#ede9fe",   // violet-tinted card border
    cardRadius:          "1.5rem",    // extra-generous — approachable, soft
    cardShadow:          shadows.md,  // floating look
    quoteColor:          "#6d28d9",
    heroGlowColor:       "#7c3aed",   // violet glow
    heroGlowOpacity:     "0.35",      // more visible glow — playful energy
    heroTitleColor:      "#ffffff",
    heroSubtitleColor:   "#c4b5fd",   // violet-200 — coordinated and legible
    proofBg:             "#faf9ff",
    proofBorder:         "#ede9fe",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#ede9fe",
    proofCardRadius:     "1.5rem",
    proofCardShadow:     shadows.md,
    proofQuoteColor:     "#6d28d9",
    featureGridBg:           "#faf9ff",
    featureGridBorder:       "#ede9fe",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#ede9fe",
    featureGridCardRadius:   "1.5rem",
    featureGridCardShadow:   shadows.md,
    featureGridIconBg:       "#f5f3ff",
  },
  blockStyle: PLAYFUL_STARTUP_PROFILE,
  meta: { name: "Playful Startup" },
};

// ── 14. Startup Energy ────────────────────────────────────────────────────────
//
//   Palette:  Vivid rose (#e11d48) primary on clean white — punchy, unmissable
//             Deep rose-tinted near-black (#1c0a14) text
//   Radius:   soft — bubbly, high-energy, conversion-first
//   Hero:     deep espresso-rose #1c0a14 — bold, confident, full-bleed
//   CTA:      rose-600 — action-demanding, maximum contrast
//   Cards:    white, pink-100 border, md shadow — lifted, energetic
//   Buttons:  700 weight, soft radius, pronounced shadow — impossible to miss
//   Fonts:    Outfit body (friendly geometric), Poppins headings (800 — punchy)
//   Mono:     Fira Code — technical content in this energetic wrapper
//   Motion:   spring-forward, 100ms — fast and snappy
//   Best for: startup launches, product hunts, edtech, B2C conversion pages

const STARTUP_ENERGY: TenantTheme = {
  colors: {
    brand: {
      primary:       "#e11d48",    // rose-600 — max energy, startup urgency
      primaryHover:  "#be123c",    // rose-700
      primaryActive: "#9f1239",    // rose-800
      primarySubtle: "#fff1f2",    // rose-50 — barely-there tint
      primaryText:   "#ffffff",
      ring:          "#e11d48",
      textBrand:     "#e11d48",
    },
    text: {
      text:        "#1c0a14",      // deep rose-tinted near-black
      textMuted:   "#6b7280",      // neutral mid-tone
      textSubtle:  "#9ca3af",      // captions / placeholders
      textInverse: "#ffffff",
    },
    background: {
      bg:        "#ffffff",        // clean white — energy in the accents
      bgSubtle:  "#fff1f2",        // rose-50 — warm tinted recessed areas
      bgInverse: "#1c0a14",        // deep rose-black hero
    },
    border: {
      border:       "#fce7f3",     // pink-100 — soft energetic border
      borderStrong: "#fbcfe8",     // pink-200
    },
  },
  radius: "soft",
  typography: {
    fontSans:         "'Outfit', system-ui, sans-serif",
    fontMono:         "'Fira Code', ui-monospace, monospace",
    headingFont:      "'Poppins', system-ui, sans-serif",
    headingWeight:    "800",        // ultra-bold headings — maximum impact
    subheadingWeight: "700",
  },
  button: {
    bg:         "#e11d48",
    text:       "#ffffff",
    hoverBg:    "#be123c",
    activeBg:   "#9f1239",
    ring:       "#e11d48",
    shadow:     shadows.md,        // pronounced lift — action-demanding
    fontWeight: "700",
  },
  motion: {
    transitionFast: "80ms cubic-bezier(0.34, 1.56, 0.64, 1)",  // ultra-snappy spring
    transitionBase: "120ms cubic-bezier(0.34, 1.4, 0.64, 1)",
    transitionSlow: "250ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              "#1c0a14",   // deep rose-black — full-bleed bold opening
    ctaBg:               "#e11d48",   // rose CTA — max-contrast, impossible to miss
    ctaBodyText:         "#fce7f3",   // pink-100 body text on rose
    subtleSectionBg:     "#fff1f2",   // rose-50 recessed
    subtleSectionBorder: "#fce7f3",   // pink-100
    cardBg:              "#ffffff",
    cardBorderColor:     "#fce7f3",   // pink-100
    cardRadius:          "1.5rem",    // extra-round — bubbly, startup-forward
    cardShadow:          shadows.md,
    quoteColor:          "#e11d48",
    heroGlowColor:       "#e11d48",
    heroGlowOpacity:     "0.40",      // vivid glow — high drama
    heroTitleColor:      "#ffffff",
    heroSubtitleColor:   "#fda4af",   // rose-300 — warm, readable on dark
    proofBg:             "#fff1f2",
    proofBorder:         "#fce7f3",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#fce7f3",
    proofCardRadius:     "1.5rem",
    proofCardShadow:     shadows.md,
    proofQuoteColor:     "#e11d48",
    featureGridBg:           "#fff1f2",
    featureGridBorder:       "#fce7f3",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#fce7f3",
    featureGridCardRadius:   "1.5rem",
    featureGridCardShadow:   shadows.md,
    featureGridIconBg:       "#fff1f2",
  },
  blockStyle: STARTUP_ENERGY_PROFILE,
  meta: { name: "Startup Energy" },
};

// ── 15. Corporate Trust ───────────────────────────────────────────────────────
//
//   Palette:  Confident blue (#2563eb) on slate-50 — modern professional authority
//             Slate-900 (#0f172a) text — clean, readable, trustworthy
//   Radius:   balanced — approachable, not stiff; more modern than corporate-blue
//   Hero:     deep navy #0f2a5c — authority, depth, institutional confidence
//   CTA:      blue-600 — clear, confident call-to-action
//   Cards:    white, slate-200 border, sm shadow — ordered, trustworthy
//   Buttons:  600 weight, balanced, sm shadow — credible, not flashy
//   Fonts:    DM Sans body & headings — clean, modern, widely legible
//   Mono:     IBM Plex Mono — professional mono for code/data
//   Motion:   150ms standard — deliberate, professional, never hurried
//   Best for: financial services, professional services, SaaS platforms, enterprise

const CORPORATE_TRUST: TenantTheme = {
  colors: {
    brand: {
      primary:       "#2563eb",    // blue-600 — confident, modern professional
      primaryHover:  "#1d4ed8",    // blue-700
      primaryActive: "#1e40af",    // blue-800
      primarySubtle: "#eff6ff",    // blue-50
      primaryText:   "#ffffff",
      ring:          "#2563eb",
      textBrand:     "#2563eb",
    },
    text: {
      text:        "#0f172a",      // slate-900 — clean, highly legible
      textMuted:   "#475569",      // slate-600 — clear secondary text
      textSubtle:  "#94a3b8",      // slate-400 — captions, placeholders
      textInverse: "#f8fafc",      // slate-50 — warm off-white on dark
    },
    background: {
      bg:        "#f8fafc",        // slate-50 — clean, professional foundation
      bgSubtle:  "#f1f5f9",        // slate-100 — recessed panels, sidebars
      bgInverse: "#0f2a5c",        // deep navy — institutional authority
    },
    border: {
      border:       "#e2e8f0",     // slate-200 — clear, not intrusive
      borderStrong: "#cbd5e1",     // slate-300 — active input borders
    },
  },
  radius: "balanced",
  typography: {
    fontSans:         "'DM Sans', system-ui, sans-serif",
    fontMono:         "'IBM Plex Mono', ui-monospace, monospace",
    headingFont:      "'DM Sans', system-ui, sans-serif",
    headingWeight:    "600",        // semi-bold — authoritative but not aggressive
    subheadingWeight: "500",
  },
  button: {
    bg:         "#2563eb",
    text:       "#ffffff",
    hoverBg:    "#1d4ed8",
    activeBg:   "#1e40af",
    ring:       "#2563eb",
    shadow:     shadows.sm,        // subtle lift — credible, professional
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",    // no spring — authoritative
  },
  componentStyles: {
    heroBg:              "#0f2a5c",   // deep navy — institutional confidence
    ctaBg:               "#2563eb",   // blue-600 — confident, clear
    ctaBodyText:         "#bfdbfe",   // blue-200 — readable on blue
    subtleSectionBg:     "#f1f5f9",   // slate-100 — ordered, clean
    subtleSectionBorder: "#e2e8f0",   // slate-200
    cardBg:              "#ffffff",
    cardBorderColor:     "#e2e8f0",   // slate-200
    cardRadius:          "0.75rem",   // balanced — modern without being playful
    cardShadow:          shadows.sm,
    quoteColor:          "#2563eb",
    heroGlowColor:       "#3b82f6",   // blue-500 glow against navy hero
    heroGlowOpacity:     "0.20",      // understated — professional restraint
    heroTitleColor:      "#f8fafc",   // slate-50 headline
    heroSubtitleColor:   "#93c5fd",   // blue-300 — coordinated, readable
    proofBg:             "#f1f5f9",
    proofBorder:         "#e2e8f0",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#e2e8f0",
    proofCardRadius:     "0.75rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     "#2563eb",
    featureGridBg:           "#f1f5f9",
    featureGridBorder:       "#e2e8f0",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#e2e8f0",
    featureGridCardRadius:   "0.75rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       "#eff6ff",   // blue-50
  },
  blockStyle: CORPORATE_TRUST_PROFILE,
  meta: { name: "Corporate Trust" },
};

// ── 20. Modern SaaS ───────────────────────────────────────────────────────────
//
//   Palette:  Blue-violet primary (#5b6af9) on pure white with deep navy hero
//             Distinct from the existing brand palette — more blue, less purple
//   Radius:   balanced — approachable without being playful
//   Hero:     deep navy (#0d0d1a) — immersive without being pure black
//   CTA:      brand blue-violet — conversion-first
//   Cards:    white, sm shadow, brand-tinted glow on hover-proxy shadows
//   Buttons:  600 weight, sm shadow, clean
//   Fonts:    Inter body (quintessential SaaS), Manrope headings (geometric, modern)
//   Block:    MODERN_SAAS_PROFILE — no dividers, 2rem card padding, 4rem gaps
//   Motion:   standard 150ms — snappy, professional
//   Best for: B2B SaaS, developer tools, product-led sites, API companies

const MODERN_SAAS: TenantTheme = {
  colors: {
    brand: {
      primary:       "#5b6af9",    // blue-violet — crisp, modern, product-forward
      primaryHover:  "#4754e8",    // deeper blue-violet
      primaryActive: "#3b47d5",    // pressed / active state
      primarySubtle: "#eff0ff",    // barely-blue tinted surface for accents
      primaryText:   "#ffffff",    // white text on brand
      ring:          "#5b6af9",    // focus ring matches primary
      textBrand:     "#4754e8",    // slightly deeper for legible body-level brand text
    },
    text: {
      text:        "#111827",      // gray-900 — near-black for sharp readable copy
      textMuted:   "#4b5563",      // gray-600 — secondary text
      textSubtle:  "#9ca3af",      // gray-400 — captions, placeholders
      textInverse: "#ffffff",
    },
    background: {
      bg:        "#ffffff",        // pure white — maximum clarity
      bgSubtle:  "#f9fafb",        // gray-50 — barely off-white, ultra-clean surfaces
      bgInverse: "#0d0d1a",        // very deep navy-black — cinematic heroes
    },
    border: {
      border:       "#e5e7eb",     // gray-200 — crisp, minimal
      borderStrong: "#d1d5db",     // gray-300
    },
  },
  radius: "balanced",
  typography: {
    fontSans:         "'Inter', system-ui, sans-serif",   // body: quintessential SaaS font
    headingFont:      "'Manrope', system-ui, sans-serif", // headings: geometric, strong
    headingWeight:    "700",        // bold but not heavy — clean authority
    subheadingWeight: "600",
  },
  button: {
    bg:         "#5b6af9",
    text:       "#ffffff",
    hoverBg:    "#4754e8",
    activeBg:   "#3b47d5",
    ring:       "#5b6af9",
    shadow:     shadows.sm,        // subtle lift — polished, not heavy
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
    heroBg:              "#0d0d1a",   // deep navy — immersive, modern hero
    ctaBg:               "#5b6af9",   // primary brand for CTA sections
    ctaBodyText:         "#e0e2ff",   // light blue-white — readable on brand CTA
    subtleSectionBg:     "#f9fafb",   // matching bgSubtle for recessed sections
    subtleSectionBorder: "#e5e7eb",
    cardBg:              "#ffffff",
    cardBorderColor:     "#e5e7eb",
    cardRadius:          "0.875rem",  // generous rounding for cards
    cardShadow:          "0 2px 8px rgba(91, 106, 249, 0.07), 0 1px 2px rgba(0,0,0,0.04)",
    quoteColor:          "#5b6af9",
    heroGlowColor:       "#5b6af9",   // brand-tinted hero glow
    heroGlowOpacity:     "0.15",      // subtle — tasteful, not garish
    heroTitleColor:      "#ffffff",
    heroSubtitleColor:   "#9ca3af",
    proofBg:             "#f9fafb",
    proofBorder:         "transparent",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#e5e7eb",
    proofCardRadius:     "0.875rem",
    proofCardShadow:     "0 2px 8px rgba(91, 106, 249, 0.07), 0 1px 2px rgba(0,0,0,0.04)",
    proofQuoteColor:     "#5b6af9",
    featureGridBg:           "#f9fafb",
    featureGridBorder:       "#e5e7eb",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#e5e7eb",
    featureGridCardRadius:   "0.875rem",
    featureGridCardShadow:   "0 2px 8px rgba(91, 106, 249, 0.07), 0 1px 2px rgba(0,0,0,0.04)",
    featureGridIconBg:       "#eff0ff",   // brand-tinted icon wells
  },
  blockStyle: MODERN_SAAS_PROFILE,
  meta: { name: "Modern SaaS" },
};

// ── 23. Portfolio Showcase ────────────────────────────────────────────────────
//
//   The "agency + case presentation" signature theme — media-dominant layouts,
//   full-bleed image treatment, and airy spacing let work speak for itself.
//
//   Palette:  Teal-cyan (#0891b2 / cyan-600) — striking, media-complementing,
//             never fights photography
//   Radius:   balanced — confident but not playful
//   Hero:     near-black hero for maximum media contrast
//   Cards:    transparent borders, lg shadow — visual weight via shadow only
//   Block:    PORTFOLIO_SHOWCASE_PROFILE — full-bleed media, wide image flex,
//             highlighted feature grid, editorial testimonials, airy spacing
//   Best for: agencies, case-driven businesses, visual portfolios

const PORTFOLIO_SHOWCASE: TenantTheme = {
  colors: {
    brand: {
      primary:       cyan[600],       // #0891b2 — teal-cyan, media-complementing
      primaryHover:  cyan[700],       // #0e7490
      primaryActive: cyan[800],       // #155e75
      primarySubtle: cyan.sky50,      // #f0f9ff — barely tinted sky surface
      primaryText:   neutral[0],
      ring:          cyan[600],
      textBrand:     cyan[700],
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
      bgInverse: neutral[950],
    },
    border: {
      border:       neutral[200],
      borderStrong: neutral[300],
    },
  },
  radius: "balanced",
  // Typography: family override emits Space Grotesk headings, Inter body,
  // DM Sans accent font, and the showcase scale profile.
  typography: {
    headingWeight:    "600",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "500",
  },
  featuredFamilyKey: "portfolio-showcase" as FeaturedFamilyKey,
  button: {
    bg:         cyan[600],
    text:       neutral[0],
    hoverBg:    cyan[700],
    activeBg:   cyan[800],
    ring:       cyan[600],
    shadow:     shadows.md,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "400ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              neutral[950],
    ctaBg:               neutral[900],
    ctaBodyText:         neutral[200],
    subtleSectionBg:     neutral[100],
    subtleSectionBorder: "transparent",
    cardBg:          neutral[0],
    cardBorderColor: "transparent",
    cardRadius:      "1rem",
    cardShadow:      shadows.lg,
    quoteColor:       cyan[600],
    heroGlowColor:    cyan[600],
    heroGlowOpacity:  "0.20",
    heroTitleColor:   neutral[0],
    heroSubtitleColor: neutral[300],
    proofBg:         neutral[100],
    proofBorder:     "transparent",
    proofCardBg:     neutral[0],
    proofCardBorder: "transparent",
    proofCardRadius: "1rem",
    proofCardShadow: shadows.md,
    proofQuoteColor: cyan[600],
    featureGridBg:         neutral[100],
    featureGridBorder:     "transparent",
    featureGridCardBg:     cyan.sky50,
    featureGridCardBorder: "transparent",
    featureGridCardRadius: "1rem",
    featureGridCardShadow: shadows.md,
    featureGridIconBg:     cyan.sky50,
  },
  blockStyle: PORTFOLIO_SHOWCASE_PROFILE,
  meta: { name: "Portfolio Showcase" },
};

// ── 24. Premium Luxury ────────────────────────────────────────────────────────
//
//   The "high-end brand" signature theme — cream surfaces, warm gold accents,
//   refined light-weight serif headings, and generous whitespace signal
//   exclusivity without ostentation.
//
//   Palette:  Deep gold (#a16207 / gold-700) on warm cream (stone-50)
//   Radius:   balanced — elegant, not sharp or excessively round
//   Hero:     warm near-black (stone-950) — luxe dark backdrop
//   Cards:    carded with framed media — material quality
//   Block:    PREMIUM_LUXURY_PROFILE — refined heading treatment, premium
//             card surfaces, framed media, airy spacing, elevated shadows
//   Best for: high-end B2B, boutique consultancy, design/interior, prestige brands

const PREMIUM_LUXURY: TenantTheme = {
  colors: {
    brand: {
      primary:       gold[700],       // #a16207 — deep gold; luxe accent
      primaryHover:  gold[800],       // #854d0e — deeper gold on hover
      primaryActive: "#6b3d0b",       // very deep gold
      primarySubtle: gold[50],        // #fefce8 — champagne surface tint
      primaryText:   neutral[0],
      ring:          gold[700],
      textBrand:     gold[700],
    },
    text: {
      text:        stone[900],        // #1c1917 — warm near-black
      textMuted:   "#78716c",         // stone-500
      textSubtle:  "#a8a29e",         // stone-400
      textInverse: stone[50],         // warm off-white on dark
    },
    background: {
      bg:        stone[50],           // #fafaf9 — warm cream page background
      bgSubtle:  stone[100],          // #f5f5f4 — slightly deeper cream
      bgInverse: stone[950],          // #0c0a09 — warm near-black
    },
    border: {
      border:       stone[200],       // #e7e5e4 — warm light border
      borderStrong: stone[300],       // #d6d3d1 — stronger warm border
    },
  },
  radius: "balanced",
  // Typography: family override emits Cormorant Garamond headings, Inter body,
  // Libre Baskerville accent font, and the luxury scale profile.
  typography: {
    headingWeight:    "500",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "400",
  },
  featuredFamilyKey: "premium-luxury" as FeaturedFamilyKey,
  button: {
    bg:         gold[700],
    text:       neutral[0],
    hoverBg:    gold[800],
    activeBg:   "#6b3d0b",
    ring:       gold[700],
    shadow:     shadows.sm,           // restrained CTA — elegance over urgency
    fontWeight: "500",
  },
  motion: {
    transitionFast: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "500ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",   // no spring — composed restraint
  },
  componentStyles: {
    heroBg:              stone[950],   // warm near-black
    ctaBg:               stone[900],   // deep warm dark — restrained CTA section
    ctaBodyText:         stone[200],   // "#e7e5e4" — warm light text
    subtleSectionBg:     stone[100],
    subtleSectionBorder: stone[200],

    // Cards: warm cream with subtle warm border
    cardBg:          stone[50],
    cardBorderColor: stone[200],
    cardRadius:      "0.75rem",
    cardShadow:      shadows.md,

    quoteColor:       gold[700],
    heroGlowColor:    gold[700],
    heroGlowOpacity:  "0.15",
    heroTitleColor:   stone[50],
    heroSubtitleColor: stone[300],    // "#d6d3d1"

    // Proof: warm cream sections, elegant card treatment
    proofBg:         stone[100],
    proofBorder:     stone[200],
    proofCardBg:     stone[50],
    proofCardBorder: stone[200],
    proofCardRadius: "0.75rem",
    proofCardShadow: shadows.md,
    proofQuoteColor: gold[700],

    // Feature grid: elevated cards on warm cream surfaces
    featureGridBg:         stone[100],
    featureGridBorder:     stone[200],
    featureGridCardBg:     stone[50],
    featureGridCardBorder: stone[200],
    featureGridCardRadius: "0.75rem",
    featureGridCardShadow: shadows.lg,
    featureGridIconBg:     gold[50],
  },
  blockStyle: PREMIUM_LUXURY_PROFILE,
  meta: { name: "Premium Luxury" },
};

// ── 19. Valentine Pink ────────────────────────────────────────────────────────
//
//   Palette:  Rose-pink — romantic, warm, Valentine's season
//   Radius:   soft — gentle, rounded; nothing sharp
//   Hero:     deep rose #9d174d (pink-800)
//   Subtle:   #fdf2f8 (pink-50)
//   CTA:      pink-700 (#be185d) — warm, inviting
//   Best for: Valentine's Day campaigns, gifting, lifestyle, romance brands

const rose = {
  50:  "#fff1f2",
  100: "#ffe4e6",
  200: "#fecdd3",
  400: "#fb7185",
  600: "#e11d48",
  700: "#be185d",
  800: "#9d174d",
  900: "#881337",
} as const;

const VALENTINE_PINK: TenantTheme = {
  colors: {
    brand: {
      primary:       rose[700],
      primaryHover:  rose[800],
      primaryActive: rose[900],
      primarySubtle: rose[50],
      primaryText:   neutral[0],
      ring:          rose[700],
      textBrand:     rose[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[0],
      bgSubtle:  rose[50],
      bgInverse: rose[800],
    },
    border: {
      border:       neutral[200],
      borderStrong: rose[200],
    },
  },
  radius: "soft",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "700",
    subheadingWeight: "600",
  },
  button: {
    bg:         rose[700],
    text:       neutral[0],
    hoverBg:    rose[800],
    activeBg:   rose[900],
    ring:       rose[700],
    shadow:     shadows.sm,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              rose[800],
    ctaBg:               rose[700],
    ctaBodyText:         rose[100],
    subtleSectionBg:     rose[50],
    subtleSectionBorder: rose[100],
    cardBg:              neutral[0],
    cardBorderColor:     rose[100],
    cardRadius:          "1rem",
    cardShadow:          shadows.sm,
    quoteColor:          rose[700],
    heroGlowColor:       rose[600],
    heroGlowOpacity:     "0.20",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   rose[200],
    proofBg:             rose[50],
    proofBorder:         rose[100],
    proofCardBg:         neutral[0],
    proofCardBorder:     rose[200],
    proofCardRadius:     "1rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     rose[700],
    featureGridBg:           rose[50],
    featureGridBorder:       rose[100],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   rose[100],
    featureGridCardRadius:   "1rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       rose[50],
  },
  blockStyle: VALENTINE_PINK_PROFILE,
  meta: { name: "Valentine Pink" },
};

// ── Dutch national colour palette ─────────────────────────────────────────────
// Authentic Dutch national identity orange (#F36F21) used by football kit,
// King's Day branding, and Dutch sports organisations.  Distinct from the
// generic Tailwind orange-600 (#ea580c) which is too red-orange.
// Dutch flag blue (#21468B) is used only for focus rings and small accents —
// never as a dominant surface colour.

const dutchOrange = {
  50:  "#FFF1E6",    // warm orange tint — accent background, subtle section fills
  100: "#FFE0C0",    // light orange — card borders, section borders, proof strips
  500: "#FF7A1A",    // stronger highlight accent (max-saturation Dutch orange)
  600: "#FF7A1A",    // primary — vivid Dutch football-shirt orange
  700: "#D95E1D",    // hover / secondary — slightly darker, richer
  800: "#B44B0E",    // active / deep hero — warm deep orange
  900: "#7A2D08",    // very deep — near-black inverse sections
} as const;

// Dutch flag blue — used ONLY as focus ring / small badge accent.
const DUTCH_FLAG_BLUE  = "#21468B";

// ── 20. Dutch Orange ──────────────────────────────────────────────────────────
//
//   Palette:  Vivid Dutch football-shirt orange (#FF7A1A) — King's Day, national
//             team kit, Dutch sports events, Netherlands-first brands.
//   Primary:  #FF7A1A — max-saturation Dutch orange; stronger than the former
//             #F36F21 which read as slightly muted on screens.
//   Hover:    #D95E1D — one step darker/richer (the "secondary" in specs)
//   Radius:   balanced — confident, not sharp or soft
//   Hero:     deep Dutch orange #B44B0E — warm, not generic
//   Subtle:   #FFF1E6 — very light warm orange tint (matches requested accent)
//   CTA:      #FF7A1A — punchy, direct, national energy
//   Ring:     #21468B (Dutch flag blue) — subtle tricolour focus accent
//   Dividers: #AE1C28 (Dutch flag red) — 2px stripe accent in BlockStyleProfile

const DUTCH_ORANGE: TenantTheme = {
  colors: {
    brand: {
      primary:       dutchOrange[600],
      primaryHover:  dutchOrange[700],
      primaryActive: dutchOrange[800],
      primarySubtle: dutchOrange[50],
      primaryText:   neutral[0],
      ring:          DUTCH_FLAG_BLUE,   // Dutch blue for focus rings
      textBrand:     dutchOrange[700],
    },
    text: {
      text:        neutral[900],
      textMuted:   neutral[500],
      textSubtle:  neutral[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[0],
      bgSubtle:  dutchOrange[50],
      bgInverse: dutchOrange[800],
    },
    border: {
      border:       neutral[200],
      borderStrong: dutchOrange[700],
    },
  },
  radius: "balanced",
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "800",
    subheadingWeight: "700",
  },
  button: {
    bg:         dutchOrange[600],
    text:       neutral[0],
    hoverBg:    dutchOrange[700],
    activeBg:   dutchOrange[800],
    ring:       DUTCH_FLAG_BLUE,
    shadow:     shadows.sm,
    fontWeight: "700",
  },
  motion: {
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "250ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  componentStyles: {
    heroBg:              dutchOrange[800],
    ctaBg:               dutchOrange[600],
    ctaBodyText:         dutchOrange[100],
    subtleSectionBg:     dutchOrange[50],
    subtleSectionBorder: dutchOrange[100],
    cardBg:              neutral[0],
    cardBorderColor:     dutchOrange[100],
    cardRadius:          "0.5rem",
    cardShadow:          shadows.sm,
    quoteColor:          dutchOrange[600],
    heroGlowColor:       dutchOrange[500],
    heroGlowOpacity:     "0.25",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   dutchOrange[100],
    proofBg:             dutchOrange[50],
    proofBorder:         dutchOrange[100],
    proofCardBg:         neutral[0],
    proofCardBorder:     dutchOrange[100],
    proofCardRadius:     "0.5rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     dutchOrange[600],
    featureGridBg:           dutchOrange[50],
    featureGridBorder:       dutchOrange[100],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   dutchOrange[100],
    featureGridCardRadius:   "0.5rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       dutchOrange[50],
  },
  blockStyle: DUTCH_ORANGE_PROFILE,
  meta: { name: "Dutch Orange" },
};

// ── Slate palette (corporate-clean) ──────────────────────────────────────────
// Cool neutral palette — slate-700 primary.  Distinct from blue (corporate-blue,
// corporate-trust) and zinc (minimal-neutral) because it uses no hue offset.

const slate = {
  50:  "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  950: "#020617",
} as const;

// ── Pink palette (bold-marketing) ─────────────────────────────────────────────
// Vivid fuchsia-pink — occupies an unoccupied hue gap between rose (valentine-
// pink / startup-energy) and violet (playful-startup).

const pink = {
  50:  "#fdf2f8",
  100: "#fce7f3",
  600: "#db2777",
  700: "#be185d",
  800: "#9d174d",
  900: "#831843",
} as const;

// ── 21. Corporate Clean ───────────────────────────────────────────────────────
//
//   Palette:  Slate-700 — clean authority without the navy-blue of
//             Corporate Blue / Corporate Trust; zero hue.
//   Radius:   balanced — structured but not austere
//   Hero:     slate-900 (#0f172a) — near-black, clearly distinct from navy
//   Subtle:   slate-50 (#f8fafc)
//   CTA:      slate-700 (#334155) — confident, muted, corporate
//   Dividers: 1px hairline (see BlockStyleProfile) — explicit structure
//   Best for: management consulting, clean B2B SaaS, modern law firms

const CORPORATE_CLEAN: TenantTheme = {
  colors: {
    brand: {
      primary:       slate[700],
      primaryHover:  slate[800],
      primaryActive: slate[900],
      primarySubtle: slate[100],
      primaryText:   neutral[0],
      ring:          slate[700],
      textBrand:     slate[700],
    },
    text: {
      text:        slate[900],
      textMuted:   slate[600],
      textSubtle:  slate[400],
      textInverse: slate[50],
    },
    background: {
      bg:        neutral[0],
      bgSubtle:  slate[50],
      bgInverse: slate[900],
    },
    border: {
      border:       slate[200],
      borderStrong: slate[300],
    },
  },
  radius: "balanced",
  // Typography: family override emits Inter heading + body, no accent font,
  // and the corporate scale profile.
  typography: {
    headingWeight:    "600",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "500",
  },
  featuredFamilyKey: "corporate-clean" as FeaturedFamilyKey,
  button: {
    bg:         slate[700],
    text:       neutral[0],
    hoverBg:    slate[800],
    activeBg:   slate[900],
    ring:       slate[700],
    shadow:     shadows.xs,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",   // no spring for corporate
  },
  componentStyles: {
    heroBg:              slate[900],
    ctaBg:               slate[700],
    ctaBodyText:         slate[200],
    subtleSectionBg:     slate[50],
    subtleSectionBorder: slate[200],
    cardBg:              neutral[0],
    cardBorderColor:     slate[200],
    cardRadius:          "0.5rem",
    cardShadow:          shadows.xs,
    quoteColor:          slate[700],
    heroGlowColor:       slate[700],
    heroGlowOpacity:     "0.10",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   slate[300],
    proofBg:             slate[50],
    proofBorder:         slate[200],
    proofCardBg:         neutral[0],
    proofCardBorder:     slate[200],
    proofCardRadius:     "0.5rem",
    proofCardShadow:     shadows.xs,
    proofQuoteColor:     slate[700],
    featureGridBg:           slate[50],
    featureGridBorder:       slate[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   slate[200],
    featureGridCardRadius:   "0.5rem",
    featureGridCardShadow:   shadows.xs,
    featureGridIconBg:       slate[100],
  },
  blockStyle: CORPORATE_CLEAN_PROFILE,
  meta: { name: "Corporate Clean" },
};

// ── 22. Bold Marketing ────────────────────────────────────────────────────────
//
//   Palette:  Fuchsia-pink (#db2777) — vivid, attention-grabbing.
//             Occupies the pink hue gap; unambiguously "marketing".
//   Radius:   soft — rounded, friendly, consumer-brand feel
//   Hero:     deep indigo-black (#1e1b4b) — dark but distinct from violet-dark
//             of playful-startup (#1e1b4b vs #2e1065)
//   Subtle:   pink-50 (#fdf2f8)
//   CTA:      #db2777 — hot-pink, maximum brand energy
//   Best for: consumer products, B2C campaigns, product launches, events

const BOLD_MARKETING: TenantTheme = {
  colors: {
    brand: {
      primary:       pink[600],
      primaryHover:  pink[700],
      primaryActive: pink[800],
      primarySubtle: pink[50],
      primaryText:   neutral[0],
      ring:          pink[600],
      textBrand:     pink[700],
    },
    text: {
      text:        "#111827",   // gray-900
      textMuted:   "#374151",   // gray-700
      textSubtle:  "#9ca3af",   // gray-400
      textInverse: neutral[0],
    },
    background: {
      bg:        neutral[0],
      bgSubtle:  pink[50],
      bgInverse: "#1e1b4b",   // deep indigo-black — distinct from violet-dark
    },
    border: {
      border:       "#f3f4f6",   // gray-100 — clean, nearly invisible
      borderStrong: "#e5e7eb",   // gray-200
    },
  },
  radius: "soft",
  // Typography: family override emits Poppins headings, Inter body, no accent
  // font, and the marketing scale profile (largest h1 on the platform).
  typography: {
    headingWeight:    "700",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "600",
  },
  featuredFamilyKey: "bold-marketing" as FeaturedFamilyKey,
  button: {
    bg:         pink[600],
    text:       neutral[0],
    hoverBg:    pink[700],
    activeBg:   pink[800],
    ring:       pink[600],
    shadow:     shadows.md,
    fontWeight: "700",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
    transitionSlow: "400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  componentStyles: {
    heroBg:              "#1e1b4b",
    ctaBg:               pink[600],
    ctaBodyText:         pink[100],
    subtleSectionBg:     pink[50],
    subtleSectionBorder: pink[100],
    cardBg:              neutral[0],
    cardBorderColor:     "transparent",
    cardRadius:          "1.25rem",
    cardShadow:          shadows.lg,
    quoteColor:          pink[600],
    heroGlowColor:       pink[600],
    heroGlowOpacity:     "0.25",
    heroTitleColor:      neutral[0],
    heroSubtitleColor:   pink[100],
    proofBg:             pink[50],
    proofBorder:         "transparent",
    proofCardBg:         neutral[0],
    proofCardBorder:     "transparent",
    proofCardRadius:     "1.25rem",
    proofCardShadow:     shadows.lg,
    proofQuoteColor:     pink[600],
    featureGridBg:           pink[50],
    featureGridBorder:       "transparent",
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   "transparent",
    featureGridCardRadius:   "1.25rem",
    featureGridCardShadow:   shadows.lg,
    featureGridIconBg:       pink[50],
  },
  blockStyle: BOLD_MARKETING_PROFILE,
  meta: { name: "Bold Marketing" },
};

// ── 23. Careers Human ─────────────────────────────────────────────────────────
//
//   Palette:  Warm teal — calm, trustworthy, human employer brand.
//             Not the cyan of Healthcare (too clinical) nor the orange of
//             Recruitment Energy (too aggressive). Teal occupies the
//             "safe, organised, people-first" space.
//   Radius:   soft — rounded is approachable without being playful
//   Hero:     warm light background (#f8f7f4) + teal accents — no dark hero;
//             candidate sees a welcoming open space, not a sales overlay.
//   CTA:      teal-700 — confident but not urgent; says "join us" not "buy now"
//   Cards:    white, teal-tinted subtle border, xs shadow — gentle structure
//   Buttons:  500 weight, rounded, no uppercase — measured confidence
//   Motion:   180ms ease-out — unhurried; candidates read, they don't click fast
//   Typography: DM Sans via featuredFamilyKey (500 headings, 1.70 line-height)
//   Best for: werken-bij pages, careers sections, employer-brand campaigns,
//             any context where the candidate must feel welcomed, not sold to.

const teal = {
  50:  "#eef7f6",
  100: "#d5ede9",
  200: "#a8d9d2",
  600: "#1a8a79",
  700: "#1a7a6c",    // primary — calm, established, trustworthy
  800: "#156056",
  900: "#0f4a42",    // hero background — deep but warm, not cold navy
} as const;

const warmGray = {
  50:  "#fafaf8",    // warm off-white — not clinical pure white
  100: "#f2f1ef",
  200: "#e8e6e3",
  300: "#d4d1cc",
  400: "#a8a49e",
  500: "#7a766f",
  700: "#3d3a35",
  900: "#1a1816",
} as const;

const CAREERS_HUMAN: TenantTheme = {
  colors: {
    brand: {
      primary:       teal[700],
      primaryHover:  teal[800],
      primaryActive: teal[900],
      primarySubtle: teal[50],
      primaryText:   neutral[0],
      ring:          teal[700],
      textBrand:     teal[700],
    },
    text: {
      text:        warmGray[900],   // warm near-black — softer than pure #111
      textMuted:   warmGray[500],
      textSubtle:  warmGray[400],
      textInverse: neutral[0],
    },
    background: {
      bg:        warmGray[50],      // warm off-white page surface — not clinical
      bgSubtle:  teal[50],
      bgInverse: teal[900],         // deep teal hero — welcoming, not cold
    },
    border: {
      border:       warmGray[200],
      borderStrong: warmGray[300],
    },
  },
  radius: "soft",
  // Typography: DM Sans headings (500 weight, human scale) via featuredFamilyKey.
  // lineHeight 1.70 and body 1.0625rem give generous reading rhythm for
  // candidates reading job descriptions and culture copy at length.
  typography: {
    headingWeight:    "500",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "400",
  },
  featuredFamilyKey: "careers-human" as FeaturedFamilyKey,
  button: {
    bg:         teal[700],
    text:       neutral[0],
    hoverBg:    teal[800],
    activeBg:   teal[900],
    ring:       teal[700],
    shadow:     shadows.sm,      // gentle shadow — not aggressive
    fontWeight: "500",           // measured confidence, not bold urgency
  },
  motion: {
    // Unhurried transitions — candidates read; they don't click fast.
    transitionFast: "120ms cubic-bezier(0.4, 0, 0.6, 1)",
    transitionBase: "180ms cubic-bezier(0.4, 0, 0.6, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.6, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.6, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.2, 0.64, 1)",  // very gentle spring
  },
  componentStyles: {
    heroBg:              warmGray[50],   // light warm-white hero — open, not dark
    ctaBg:               teal[700],
    ctaBodyText:         teal[100],
    subtleSectionBg:     teal[50],
    subtleSectionBorder: warmGray[200],
    cardBg:              neutral[0],
    cardBorderColor:     warmGray[200],
    cardRadius:          "0.75rem",
    cardShadow:          shadows.sm,
    quoteColor:          teal[700],
    heroGlowColor:       teal[600],
    heroGlowOpacity:     "0.08",         // very subtle — no dramatic glow effects
    heroTitleColor:      warmGray[900],  // dark text on light hero (inverted from other themes)
    heroSubtitleColor:   warmGray[700],
    proofBg:             warmGray[50],
    proofBorder:         warmGray[200],
    proofCardBg:         neutral[0],
    proofCardBorder:     warmGray[200],
    proofCardRadius:     "0.75rem",
    proofCardShadow:     shadows.sm,
    proofQuoteColor:     teal[700],
    featureGridBg:           teal[50],
    featureGridBorder:       warmGray[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   warmGray[200],
    featureGridCardRadius:   "0.75rem",
    featureGridCardShadow:   shadows.sm,
    featureGridIconBg:       teal[50],
  },
  blockStyle: CAREERS_HUMAN_PROFILE,
  meta: { name: "Careers Human" },
};

// ── Structured SaaS amber-orange palette ────────────────────────────────────────
// Warm amber-orange accent — richer and darker than warm-professional (amber-600 #d97706)
// and clearly distinct from orange/recruitment-energy (orange-600 #ea580c).
// Paired with a warm stone surface for the editorial-product aesthetic.

const structuredAmber = {
  50:  "#fffbeb",    // amber-50 — warm tint for subtle sections
  100: "#fef3c7",   // amber-100 — light border tint
  600: "#d97706",   // amber-600 — brand (intentionally same as amber scale; dark enough for WCAG)
  700: "#b45309",   // amber-700 — hover state; richer editorial amber
  800: "#92400e",   // amber-800 — active/pressed state
  950: "#431407",   // very deep amber-black — near-black hero for warm depth
} as const;

// Stone surface palette for the editorial warm-white base
const structuredStone = {
  50:  "#fafaf9",   // stone-50 — warm off-white page background
  100: "#f5f5f4",   // stone-100 — recessed sections
  200: "#e7e5e4",   // stone-200 — card borders, dividers
  300: "#d6d3d1",   // stone-300 — stronger borders
  400: "#a8a29e",   // stone-400 — placeholder text
  500: "#78716c",   // stone-500 — secondary text
  900: "#1c1917",   // stone-900 — warm near-black text
  950: "#0c0a09",   // stone-950 — deepest background (rarely used)
} as const;

// ── Structured SaaS ────────────────────────────────────────────────────────────
//
//   Palette:  Warm amber-700 (#b45309) on warm stone-50 (#fafaf9) — editorial
//             product confidence. The structured, content-first SaaS aesthetic.
//   Radius:   sharp — 0px; hairline borders define all structure
//   Hero:     deep warm amber-black (#431407) — editorial depth; not blue-black
//   CTA:      amber-600 — clear, confident; not shouty orange
//   Cards:    white with 1px stone-200 border, no shadow — structure over elevation
//   Buttons:  600 weight, sharp, no uppercase — editorial precision
//   Fonts:    Plus Jakarta Sans headings (700); Inter body (400) — via featuredFamilyKey
//   Motion:   100ms standard — crisp, editorial; no spring
//   Best for: B2B SaaS editorial, product-led brands, Aelen/Lexington viewport style

const STRUCTURED_SAAS: TenantTheme = {
  colors: {
    brand: {
      primary:       structuredAmber[600],   // #d97706 — amber-600 as canonical brand
      primaryHover:  structuredAmber[700],   // #b45309 — richer amber on hover
      primaryActive: structuredAmber[800],   // #92400e — deep amber pressed
      primarySubtle: structuredAmber[50],    // #fffbeb — barely-there amber tint
      primaryText:   neutral[0],             // white text on amber
      ring:          structuredAmber[600],
      textBrand:     structuredAmber[700],   // richer amber for inline brand text
    },
    text: {
      text:        structuredStone[900],     // #1c1917 — warm near-black; editorial
      textMuted:   structuredStone[500],     // #78716c — secondary copy
      textSubtle:  structuredStone[400],     // #a8a29e — captions, metadata
      textInverse: neutral[0],              // white on dark sections
    },
    background: {
      bg:        structuredStone[50],        // #fafaf9 — warm off-white; not clinical
      bgSubtle:  structuredAmber[50],        // #fffbeb — tinted section surface
      bgInverse: structuredAmber[950],       // #431407 — warm deep-amber dark hero
    },
    border: {
      border:       structuredStone[200],    // #e7e5e4 — hairline dividers
      borderStrong: structuredStone[300],    // #d6d3d1 — stronger structural borders
    },
  },
  radius: "sharp",
  // Typography: Plus Jakarta Sans headings (700) + Inter body via featuredFamilyKey.
  // Compact editorial-saas scale profile.
  typography: {
    headingWeight:    "700",   // fallback; family override applies via featuredFamilyKey
    subheadingWeight: "600",
  },
  featuredFamilyKey: "structured-saas" as FeaturedFamilyKey,
  button: {
    bg:         structuredAmber[600],
    text:       neutral[0],
    hoverBg:    structuredAmber[700],
    activeBg:   structuredAmber[800],
    ring:       structuredAmber[600],
    shadow:     shadows.none,      // no button shadow — editorial restraint; borders carry structure
    fontWeight: "600",
  },
  motion: {
    // Crisp, editorial — no spring; structure over animation
    transitionFast: "75ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",   // no spring — structured restraint
  },
  componentStyles: {
    heroBg:              structuredAmber[950],    // warm deep amber-black hero
    ctaBg:               structuredAmber[600],    // amber brand CTA section
    ctaBodyText:         structuredAmber[100],    // light amber text on brand bg
    subtleSectionBg:     structuredAmber[50],     // amber tinted recessed sections
    subtleSectionBorder: structuredStone[200],
    cardBg:              neutral[0],              // pure white card surface
    cardBorderColor:     structuredStone[200],    // #e7e5e4 — hairline border; structure without shadow
    cardRadius:          "0.25rem",               // barely-rounded; consistent with sharp radius family
    cardShadow:          shadows.none,            // no shadow — borders define the card, not elevation
    quoteColor:          structuredAmber[700],    // richer amber quote marks
    heroGlowColor:       structuredAmber[600],    // amber glow — warm depth behind hero
    heroGlowOpacity:     "0.12",                  // subtle — editorial restraint, not marketing drama
    heroTitleColor:      neutral[0],              // white on dark hero
    heroSubtitleColor:   structuredAmber[100],    // soft amber-white subtitle on dark hero
    proofBg:             structuredStone[50],
    proofBorder:         structuredStone[200],
    proofCardBg:         neutral[0],
    proofCardBorder:     structuredStone[200],
    proofCardRadius:     "0.25rem",
    proofCardShadow:     shadows.none,
    proofQuoteColor:     structuredAmber[700],
    featureGridBg:           structuredAmber[50],
    featureGridBorder:       structuredStone[200],
    featureGridCardBg:       neutral[0],
    featureGridCardBorder:   structuredStone[200],
    featureGridCardRadius:   "0.25rem",
    featureGridCardShadow:   shadows.none,
    featureGridIconBg:       structuredAmber[50],
  },
  blockStyle:        STRUCTURED_SAAS_PROFILE,
  meta: { name: "Structured SaaS" },
};

// ── Dark AI ───────────────────────────────────────────────────────────────────
//
//   Palette:  Near-black (#06060c) with indigo-violet primary (#7b6eff)
//             Inspired by zerodrift.ai and modern AI-first product sites.
//   Radius:   sharp — precise, deliberate, tech-forward
//   Hero:     deepest near-black (#03030a) — infinite depth, no colour distraction
//   CTA:      indigo-violet — vivid enough to cut through the dark
//   Cards:    no chrome; transparent on dark bg — colour + spacing carry structure
//   Buttons:  600 weight, sharp radius, subtle glow ring on hover
//   Fonts:    Manrope headings (geometric, modern); Inter body (legible, neutral)
//   Motion:   200ms spring — smooth, premium, intentional
//   Glow:     subtle violet radial glow behind hero — AI depth signal
//   Best for: AI tools, developer APIs, premium SaaS, dark-mode-first products

const DARK_AI: TenantTheme = {
  colors: {
    brand: {
      primary:       "#7b6eff",    // indigo-violet — vivid AI accent, cuts through dark
      primaryHover:  "#6a5aff",    // deeper violet — directional hover
      primaryActive: "#5849ee",    // pressed state
      primarySubtle: "#16133a",    // very dark violet tint — card accent surfaces
      primaryText:   "#ffffff",    // white text on brand
      ring:          "#7b6eff",    // focus ring matches primary
      textBrand:     "#a89eff",    // lighter violet — legible brand text on dark bg
    },
    text: {
      text:        "#e4e2f0",      // warm off-white — softer than pure white; less harsh
      textMuted:   "#8884a8",      // muted lavender-grey — secondary copy on dark
      textSubtle:  "#5c5878",      // ghost text — captions, metadata
      textInverse: "#06060c",      // for rare light panels within dark theme
    },
    background: {
      bg:        "#06060c",        // near-black with blue-violet cast — the base
      bgSubtle:  "#0e0c1c",        // slightly elevated surface — cards, sidebars
      bgInverse: "#ffffff",        // pure white — maximum contrast inversion panels
    },
    border: {
      border:       "#1e1c30",     // barely visible violet-dark border
      borderStrong: "#2d2b45",     // stronger border for active/focus states
    },
  },
  radius: "sharp",
  typography: {
    fontSans:         "'Manrope', system-ui, sans-serif",
    fontMono:         "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    headingFont:      "'Manrope', system-ui, sans-serif",
    headingWeight:    "700",        // bold geometric headings — AI-forward authority
    subheadingWeight: "600",
  },
  button: {
    bg:         "#7b6eff",
    text:       "#ffffff",
    hoverBg:    "#6a5aff",
    activeBg:   "#5849ee",
    ring:       "#7b6eff",
    shadow:     "0 0 0 1px rgba(123,110,255,0.4)",  // soft glow ring
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "180ms cubic-bezier(0.22, 1, 0.36, 1)",  // smooth, premium
    transitionSlow: "350ms cubic-bezier(0.22, 1, 0.36, 1)",
    easingDefault:  "cubic-bezier(0.22, 1, 0.36, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.4, 0.64, 1)",      // spring with overshoot
  },
  componentStyles: {
    heroBg:              "#03030a",   // deepest near-black — infinite depth
    ctaBg:               "#7b6eff",   // brand violet
    ctaBodyText:         "#c8c4ff",   // soft violet-white — readable on violet bg
    //
    // ── Surface hierarchy ────────────────────────────────────────────────────────
    //
    //   #03030a  hero         — deepest; infinite depth, entry-point drama
    //   #06060c  base/sections — all large surfaces; seamless, no visible banding
    //   #0e0c1c  cards/panels  — elevated at small scale; purple cast acceptable
    //   #13112a  inner-card    — deepest elevation for proof/feature card inners
    //   glass    header        — rgba(6,6,12,0.82) translucent
    //
    // Large-section backgrounds (subtleSectionBg, proofBg, featureGridBg) are
    // intentionally set to the base colour so sections flow as one continuous
    // dark surface.  Only small contained surfaces (cards, dropdowns, sidebars)
    // use #0e0c1c, where the purple cast reads as intentional elevation rather
    // than as a navy band breaking the page.
    //
    subtleSectionBg:     "#06060c",   // same as base — large sections must not band
    subtleSectionBorder: "#1e1c30",
    cardBg:              "#0e0c1c",   // slightly elevated from base
    cardBorderColor:     "#1e1c30",   // barely visible — structure without chrome
    cardRadius:          "0.375rem",  // sharp-ish — consistent with radius: "sharp"
    cardShadow:          "0 4px 24px rgba(0,0,0,0.4)",
    quoteColor:          "#a89eff",   // light violet — brand quote marks on dark
    heroGlowColor:       "#7b6eff",   // violet radial glow behind hero content
    heroGlowOpacity:     "0.18",      // visible but not garish
    heroTitleColor:      "#f0eeff",   // near-white with violet undertone
    heroSubtitleColor:   "#8884a8",   // muted lavender — secondary hero copy
    proofBg:             "#06060c",   // matches base — no navy band in proof section
    proofBorder:         "#1e1c30",
    proofCardBg:         "#13112a",
    proofCardBorder:     "#2d2b45",
    proofCardRadius:     "0.375rem",
    proofCardShadow:     "0 2px 12px rgba(0,0,0,0.35)",
    proofQuoteColor:     "#a89eff",
    featureGridBg:           "#06060c",   // matches base — no navy band in feature grid
    featureGridBorder:       "#1e1c30",
    featureGridCardBg:       "#13112a",
    featureGridCardBorder:   "#2d2b45",
    featureGridCardRadius:   "0.375rem",
    featureGridCardShadow:   "0 2px 12px rgba(0,0,0,0.35)",
    featureGridIconBg:       "#16133a",
    // ── Header ──────────────────────────────────────────────────────────────────
    //
    // Translucent near-black glass surface — sits above the hero with a subtle
    // backdrop-blur.  Becomes near-opaque when the page is scrolled so the
    // content below is never exposed through the header.
    //
    // Without these overrides buildThemeVarsArray falls back to:
    //   headerDefaultBg = "rgba(255,255,255,0.95)"  → white header on dark page
    headerBg:              "rgba(6,6,12,0.82)",    // translucent — glass-over-hero
    headerBgScrolled:      "rgba(6,6,12,0.96)",    // near-opaque when scrolled
    headerFg:              "#e4e2f0",              // warm off-white — matches colors.text.text
    headerBorder:          "rgba(30,28,48,0.6)",   // subtle violet-dark rule; partially translucent
    // ── Nav dropdown ────────────────────────────────────────────────────────────
    navDropdownBg:           "#0e0c1c",            // slightly elevated dark surface
    navDropdownBorder:       "#2d2b45",            // stronger border for dropdown container
    navDropdownText:         "#8884a8",            // muted lavender — matches textMuted
    navDropdownLinkHoverBg:  "#16133a",            // very dark violet tint — primarySubtle
    navDropdownLinkHoverText:"#a89eff",            // lighter violet — textBrand
    // ── Footer ──────────────────────────────────────────────────────────────────
    footerBg:              "#030309",              // deepest near-black — grounds the page
    footerFg:              "#5c5878",              // ghost text — subtle on dark
    footerBorder:          "#1e1c30",              // standard dark violet border
  },
  blockStyle:        DARK_AI_PROFILE,
  featuredFamilyKey: "dark-ai" as FeaturedFamilyKey,
  meta: { name: "Dark AI" },
};

// ── Clean Corporate ────────────────────────────────────────────────────────────
//
//   Palette:  Pure white with sky-blue primary (#0284c7) — yeldra.com inspired
//             The "modern SaaS meets trusted corporate" aesthetic.
//   Radius:   balanced — professional and approachable, not playful
//   Hero:     deep slate-navy (#1a2744) — authoritative without being heavy
//   CTA:      sky-600 — clean, confident, distinct from indigo-blues elsewhere
//   Cards:    white with very subtle box-shadow — credible, clean lift
//   Buttons:  600 weight, balanced, sm shadow — professional restraint
//   Fonts:    DM Sans headings (geometric, modern); Inter body (legible)
//   Motion:   150ms — snappy but not rushed; corporate-appropriate
//   Best for: B2B SaaS, professional services, consulting, modern corp sites

const CLEAN_CORPORATE: TenantTheme = {
  colors: {
    brand: {
      primary:       "#0284c7",    // sky-600 — clean, modern, not already used
      primaryHover:  "#0369a1",    // sky-700
      primaryActive: "#075985",    // sky-800
      primarySubtle: "#f0f9ff",    // sky-50 — barely tinted background
      primaryText:   "#ffffff",
      ring:          "#0284c7",
      textBrand:     "#0369a1",    // sky-700 — legible brand text
    },
    text: {
      text:        "#0f172a",      // slate-900 — maximum legibility
      textMuted:   "#475569",      // slate-600 — clear secondary text
      textSubtle:  "#94a3b8",      // slate-400 — captions, metadata
      textInverse: "#f8fafc",      // slate-50 — for inverted (dark hero) sections
    },
    background: {
      bg:        "#ffffff",        // pure white — clarity and cleanliness
      bgSubtle:  "#f8fafc",        // slate-50 — recessed panels; barely perceptible
      bgInverse: "#1a2744",        // deep slate-navy — hero authority
    },
    border: {
      border:       "#e2e8f0",     // slate-200 — clean, not intrusive
      borderStrong: "#cbd5e1",     // slate-300 — active input borders
    },
  },
  radius: "balanced",
  typography: {
    fontSans:         "'DM Sans', system-ui, sans-serif",
    fontMono:         "'IBM Plex Mono', ui-monospace, monospace",
    headingFont:      "'DM Sans', system-ui, sans-serif",
    headingWeight:    "600",        // semi-bold — decisive but not heavy
    subheadingWeight: "500",
  },
  button: {
    bg:         "#0284c7",
    text:       "#ffffff",
    hoverBg:    "#0369a1",
    activeBg:   "#075985",
    ring:       "#0284c7",
    shadow:     shadows.sm,
    fontWeight: "600",
  },
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.4, 0, 0.2, 1)",   // no spring — corporate restraint
  },
  componentStyles: {
    heroBg:              "#1a2744",   // deep slate-navy — strong, focused authority
    ctaBg:               "#0284c7",   // sky-600 — clean, clear conversion
    ctaBodyText:         "#bae6fd",   // sky-200 — legible on sky-blue bg
    subtleSectionBg:     "#f8fafc",   // slate-50 — alternating section tint
    subtleSectionBorder: "#e2e8f0",   // slate-200
    cardBg:              "#ffffff",
    cardBorderColor:     "#e2e8f0",   // slate-200 — clean, not heavy
    cardRadius:          "0.75rem",   // balanced — friendly, professional
    cardShadow:          "0 2px 16px rgba(15,23,42,0.06)",  // very subtle lift
    quoteColor:          "#0284c7",   // sky brand for quote marks
    heroGlowColor:       "#0284c7",   // sky blue — subtle hero glow
    heroGlowOpacity:     "0.14",
    heroTitleColor:      "#f8fafc",   // slate-50 — crisp on dark hero
    heroSubtitleColor:   "#93c5fd",   // blue-300 — coordinated, readable on navy
    proofBg:             "#f8fafc",
    proofBorder:         "#e2e8f0",
    proofCardBg:         "#ffffff",
    proofCardBorder:     "#e2e8f0",
    proofCardRadius:     "0.75rem",
    proofCardShadow:     "0 2px 12px rgba(15,23,42,0.06)",
    proofQuoteColor:     "#0284c7",
    featureGridBg:           "#f8fafc",
    featureGridBorder:       "#e2e8f0",
    featureGridCardBg:       "#ffffff",
    featureGridCardBorder:   "#e2e8f0",
    featureGridCardRadius:   "0.75rem",
    featureGridCardShadow:   "0 2px 12px rgba(15,23,42,0.06)",
    featureGridIconBg:       "#f0f9ff",   // sky-50
  },
  blockStyle:        CLEAN_CORPORATE_PROFILE,
  featuredFamilyKey: "clean-corporate" as FeaturedFamilyKey,
  meta: { name: "Clean Corporate" },
};

// ── Blueprint: Werkenbij ──────────────────────────────────────────────────────
//
//   Palette:  Amber-orange — energy, human warmth, approachable employer brand
//   Radius:   soft — friendly, inviting, consumer-adjacent aesthetic
//   Hero:     deep warm-gray #1c1412 — premium dark with warmth
//   CTA:      orange-500 — energetic, stands out on all backgrounds
//   Best for: werkenbij-sites, employer branding, HR/recruitment, corporate careers

const WERKENBIJ_BLUEPRINT: TenantTheme = {
  colors: {
    brand: {
      primary:       "#f97316",   // orange-500
      primaryHover:  "#ea580c",   // orange-600
      primaryActive: "#c2410c",   // orange-700
      primarySubtle: "#fff7ed",   // orange-50
      primaryText:   "#ffffff",
      ring:          "#f97316",
      textBrand:     "#ea580c",
    },
    text: {
      text:        "#1c1412",   // warm near-black
      textMuted:   "#78716c",   // stone-500
      textSubtle:  "#a8a29e",   // stone-400
      textInverse: "#ffffff",
    },
    background: {
      bg:        "#fffaf7",   // warm off-white
      bgSubtle:  "#fef3e8",   // orange-50 tint
      bgInverse: "#1c1412",   // warm dark
    },
    border: {
      border:       "#e7e5e4",   // stone-200
      borderStrong: "#d6d3d1",   // stone-300
    },
  },
  radius: "soft",
  blockStyle: DEFAULT_BLOCK_STYLE_PROFILE,
  meta: { name: "Werkenbij Blueprint", tagline: "Employer brand, warm & human" },
};

// ── Blueprint: Corporate B2B ──────────────────────────────────────────────────
//
//   Palette:  Deep navy + slate — authority, trust, professional services
//   Radius:   sharp — boardroom, no-nonsense
//   Hero:     deep navy #0a1628 — darker and richer than corporate-blue
//   CTA:      blue-700 — reliable, trustworthy
//   Best for: B2B professional services, consulting, finance, enterprise

const CORPORATE_B2B_BLUEPRINT: TenantTheme = {
  colors: {
    brand: {
      primary:       "#1d4ed8",   // blue-700
      primaryHover:  "#1e40af",   // blue-800
      primaryActive: "#1e3a8a",   // blue-900
      primarySubtle: "#eff6ff",   // blue-50
      primaryText:   "#ffffff",
      ring:          "#1d4ed8",
      textBrand:     "#1d4ed8",
    },
    text: {
      text:        "#0f172a",   // slate-900
      textMuted:   "#475569",   // slate-600
      textSubtle:  "#94a3b8",   // slate-400
      textInverse: "#ffffff",
    },
    background: {
      bg:        "#f8fafc",   // slate-50
      bgSubtle:  "#f1f5f9",   // slate-100
      bgInverse: "#0a1628",   // deeper navy
    },
    border: {
      border:       "#e2e8f0",   // slate-200
      borderStrong: "#cbd5e1",   // slate-300
    },
  },
  radius: "sharp",
  blockStyle: CORPORATE_BLUE_PROFILE,
  meta: { name: "Corporate B2B Blueprint", tagline: "Authority, trust & professionalism" },
};

// ── Blueprint: B2B SaaS ───────────────────────────────────────────────────────
//
//   Palette:  Violet-indigo — modern tech, ambitious, product-led
//   Radius:   sharp — SaaS precision, no softness
//   Hero:     deep violet-black #0d0a1a — premium dark
//   CTA:      violet-600 — memorable, differentiating
//   Best for: B2B SaaS, tech platforms, developer tools, HR-tech

const SAAS_BLUEPRINT: TenantTheme = {
  colors: {
    brand: {
      primary:       "#7c3aed",   // violet-600
      primaryHover:  "#6d28d9",   // violet-700
      primaryActive: "#5b21b6",   // violet-800
      primarySubtle: "#f5f3ff",   // violet-50
      primaryText:   "#ffffff",
      ring:          "#7c3aed",
      textBrand:     "#7c3aed",
    },
    text: {
      text:        "#0f0a1e",   // near-black with violet tint
      textMuted:   "#64748b",   // slate-500
      textSubtle:  "#94a3b8",   // slate-400
      textInverse: "#ffffff",
    },
    background: {
      bg:        "#fafafa",
      bgSubtle:  "#f5f3ff",   // violet-50 tint
      bgInverse: "#0d0a1a",   // deep violet-black
    },
    border: {
      border:       "#e4e4e7",   // zinc-200
      borderStrong: "#d4d4d8",   // zinc-300
    },
  },
  radius: "sharp",
  blockStyle: MODERN_SAAS_PROFILE,
  meta: { name: "SaaS Blueprint", tagline: "Product-led, sharp & modern" },
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const THEME_PRESETS: Readonly<Record<ThemePresetKey, TenantTheme>> = {
  // ── Curated commercial themes ───────────────────────────────────────────────
  "corporate-blue":    CORPORATE_BLUE,
  "modern-green":      MODERN_GREEN,
  "minimal-neutral":   MINIMAL_NEUTRAL,
  "bold-dark":         BOLD_DARK,
  "tech-indigo":       TECH_INDIGO,
  "warm-professional": WARM_PROFESSIONAL,
  "recruitment-energy":RECRUITMENT_ENERGY,
  "healthcare-calm":   HEALTHCARE_CALM,
  "industrial-strong": INDUSTRIAL_STRONG,
  "premium-editorial": PREMIUM_EDITORIAL,
  "dark-contrast":     DARK_CONTRAST,
  "editorial-classic": EDITORIAL_CLASSIC,
  "playful-startup":   PLAYFUL_STARTUP,
  "startup-energy":    STARTUP_ENERGY,
  "corporate-trust":   CORPORATE_TRUST,
  "modern-saas":       MODERN_SAAS,
  "corporate-clean":   CORPORATE_CLEAN,
  "bold-marketing":    BOLD_MARKETING,
  // ── Signature themes ────────────────────────────────────────────────────────
  "portfolio-showcase": PORTFOLIO_SHOWCASE,
  "premium-luxury":     PREMIUM_LUXURY,
  // ── Seasonal themes ─────────────────────────────────────────────────────────
  "valentine-pink":     VALENTINE_PINK,
  "dutch-orange":       DUTCH_ORANGE,
  // ── Careers / employer-brand ─────────────────────────────────────────────
  "careers-human":      CAREERS_HUMAN,
  // ── Premium style families ──────────────────────────────────────────────
  "dark-ai":            DARK_AI,
  "clean-corporate":    CLEAN_CORPORATE,
  "structured-saas":    STRUCTURED_SAAS,
  // ── Client-type blueprints ───────────────────────────────────────────────
  "werkenbij-blueprint":      WERKENBIJ_BLUEPRINT,
  "corporate-b2b-blueprint":  CORPORATE_B2B_BLUEPRINT,
  "saas-blueprint":           SAAS_BLUEPRINT,
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

// ── Theme catalog (admin UI metadata) ────────────────────────────────────────

/**
 * A single page entry in a preset's multi-page preview configuration.
 *
 * Each entry maps to a specific Storybook story iframe.  The story must exist
 * in `components/themes/ThemePreviewScene.stories.tsx` (or another story file
 * under the "Themes/Preview" title) for the iframe to load.  When the iframe
 * fails to load, `PresetPreviewViewer` automatically falls back to the CSS
 * mini-preview so the tab is never blank.
 *
 * Story ID naming convention:
 *   Home page  — "themes-preview--{presetKey}"           (existing)
 *   Features   — "themes-preview--{presetKey}-features"  (added for featured presets)
 */
export interface PresetPreviewPage {
  /** Short stable identifier used as the React key and tab selection state. */
  id:      string;
  /** Human-readable label shown in the admin tab bar. */
  label:   string;
  /**
   * Full Storybook story ID passed to the iframe `?id=` query parameter.
   * Format: "{title-slug}--{story-slug}"
   * e.g.  "themes-preview--corporate-blue"
   *       "themes-preview--corporate-blue-features"
   */
  storyId: string;
}

/**
 * Display categories for grouping themes in the admin picker.
 */
export type ThemeCatalogCategory =
  | "platform"      // Original platform presets
  | "corporate"     // Conservative professional / B2B
  | "marketing"     // Lead-gen / conversion-focused
  | "specialist"    // Industry-vertical themes
  | "seasonal";     // Seasonal / time-limited campaigns

/**
 * Default design values loaded when a preset is activated.
 * Shown in the admin "Defaults loaded with this preset" info block.
 *
 * For featured-family presets these values MUST match the corresponding
 * FEATURED_FAMILY_CONFIGS entry to prevent drift.  For other presets they
 * represent the preset's designed intent and recommended starting point.
 */
export interface PresetDefaults {
  /**
   * Full CSS font-family stack for headings (same format as --font-heading).
   * Use the first font name — shortFontName() will extract it for display.
   */
  headingFont:   string;
  /**
   * Full CSS font-family stack for body/UI text (same format as --font-body).
   */
  bodyFont:      string;
  /**
   * Header component variant loaded by default with this preset.
   * "minimal" = top-bar, "flyout" = slide-out nav, "mega" = full-column panel.
   */
  headerVariant: HeaderVariant;
  /**
   * Footer section structure loaded by default with this preset.
   * "minimal" = single row, "corporate" = multi-column, "branding" = brand-bar.
   */
  footerVariant: FooterVariant;
  /**
   * Footer vertical padding density.
   */
  footerDensity: FooterDensity;
}

/**
 * Metadata record for rendering a theme in the admin theme picker.
 *
 * Components should render THEME_CATALOG rather than hard-coding theme names
 * so new themes appear automatically without touching UI code.
 */
export interface ThemeCatalogEntry {
  /** The ThemePresetKey used in THEME_PRESETS. */
  presetKey:   ThemePresetKey;
  /** Human-readable display label. */
  label:       string;
  /** One-line description shown in the admin picker. */
  description: string;
  /** Grouping category for the admin UI. */
  category:    ThemeCatalogCategory;
  /** Representative brand colour for the swatch preview (CSS hex). */
  swatchColor: string;
  /**
   * Structural personality family this preset belongs to.
   * Used by contextual theme rules to select presets by personality rather
   * than by exact key — enabling "when Christmas, pick from a warm family"
   * without hard-coding preset names in every rule.
   */
  familyKey:   ThemeFamilyKey;
  /**
   * Design defaults loaded when this preset is activated.
   * Always present — every preset must declare its intended defaults.
   * The admin UI reads this field directly; no secondary lookup required.
   */
  defaults:    PresetDefaults;
  /**
   * Optional multi-page preview configuration for the admin gallery.
   *
   * When present, the gallery renders a tab bar above the preview area so
   * operators can browse multiple page types for this preset.
   *
   * When absent, `PresetPreviewViewer` defaults to a single "Home" tab
   * pointing to `"themes-preview--{presetKey}"` — preserving existing behaviour
   * for presets that have not yet been given a multi-page config.
   */
  preview?:    readonly PresetPreviewPage[];
}

/**
 * Ordered catalog of all available themes — safe to iterate in admin UI
 * components.  Adding a new theme to THEME_PRESETS should be accompanied by
 * adding a corresponding entry here.
 */
export const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
  // ── Corporate themes ──────────────────────────────────────────────────────
  {
    presetKey:   "corporate-blue",
    label:       "Corporate Blue",
    description: "Navy blue, sharp radius — trust, authority, professional services",
    category:    "corporate",
    swatchColor: "#1d4ed8",
    familyKey:   "corporate-professional",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "mega",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--corporate-blue" },
      { id: "features", label: "Features", storyId: "themes-preview--corporate-blue-features" },
    ],
  },
  {
    presetKey:   "minimal-neutral",
    label:       "Minimal Neutral",
    description: "Zinc monochrome, near-zero radius — pure structure, no colour distraction",
    category:    "corporate",
    swatchColor: "#52525b",
    familyKey:   "corporate-professional",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "premium-editorial",
    label:       "Premium Editorial",
    description: "Warm brown serif, generous spacing — high-end editorial, luxury consulting",
    category:    "corporate",
    swatchColor: "#8b5e3c",
    familyKey:   "editorial-publishing",
    // Featured family: editorial-classic — Playfair Display headings override the
    // preset-level Cormorant Garamond; family layer always wins the CSS cascade.
    defaults: {
      headingFont:   "'Playfair Display', Georgia, serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "spacious",
    },
  },
  {
    presetKey:   "industrial-strong",
    label:       "Industrial Strong",
    description: "Red on stone, sharp radius, UPPERCASE — manufacturing, logistics, construction",
    category:    "corporate",
    swatchColor: "#dc2626",
    familyKey:   "industrial-utility",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "mega",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
  },

  // ── Marketing themes ──────────────────────────────────────────────────────
  {
    presetKey:   "bold-dark",
    label:       "Bold Dark",
    description: "Amber on near-black, balanced radius — high-energy product launches",
    category:    "marketing",
    swatchColor: "#f59e0b",
    familyKey:   "luxury-dark",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "modern-green",
    label:       "Modern Green",
    description: "Emerald, balanced radius — growth, sustainability, fresh B2B",
    category:    "marketing",
    swatchColor: "#059669",
    familyKey:   "startup-growth",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "warm-professional",
    label:       "Warm Professional",
    description: "Amber-600, balanced radius — approachable, coaching, consulting",
    category:    "marketing",
    swatchColor: "#d97706",
    familyKey:   "startup-growth",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },

  // ── Specialist themes ─────────────────────────────────────────────────────
  {
    presetKey:   "tech-indigo",
    label:       "Tech Indigo",
    description: "Deep violet-800, sharp radius — developer tools, SaaS dashboards, APIs",
    category:    "specialist",
    swatchColor: "#5b21b6",
    familyKey:   "saas-product",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "recruitment-energy",
    label:       "Recruitment Energy",
    description: "Orange, soft radius, heavy weight — job boards, career sites",
    category:    "specialist",
    swatchColor: "#ea580c",
    familyKey:   "startup-growth",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "healthcare-calm",
    label:       "Healthcare Calm",
    description: "Cyan on sky-blue, soft radius — healthcare, wellness, medical SaaS",
    category:    "specialist",
    swatchColor: "#0891b2",
    familyKey:   "wellness-care",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "comfortable",
    },
  },

  // ── Premium themes ─────────────────────────────────────────────────────────
  {
    presetKey:   "dark-contrast",
    label:       "Dark Contrast",
    description: "Black/white high-contrast minimal — luxury brands, creative agencies",
    category:    "specialist",
    swatchColor: "#ffffff",
    familyKey:   "luxury-dark",
    defaults: {
      headingFont:   "'Space Grotesk', system-ui, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "editorial-classic",
    label:       "Editorial Classic",
    description: "White editorial with serif headings — news, publishing, law, finance",
    category:    "corporate",
    swatchColor: "#1a1a1a",
    familyKey:   "editorial-publishing",
    // Featured family: editorial-classic
    defaults: {
      headingFont:   "'Playfair Display', Georgia, serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "spacious",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--editorial-classic" },
      { id: "features", label: "Features", storyId: "themes-preview--editorial-classic-features" },
    ],
  },
  {
    presetKey:   "playful-startup",
    label:       "Playful Startup",
    description: "Vivid violet, soft radius, expressive fonts — consumer apps, EdTech, lifestyle brands",
    category:    "marketing",
    swatchColor: "#6d28d9",
    familyKey:   "startup-growth",
    defaults: {
      headingFont:   "'Plus Jakarta Sans', system-ui, sans-serif",
      bodyFont:      "'Outfit', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "startup-energy",
    label:       "Startup Energy",
    description: "Rose-red, ultra-bold, spring motion — product launches, B2C conversion",
    category:    "marketing",
    swatchColor: "#e11d48",
    familyKey:   "startup-growth",
    defaults: {
      headingFont:   "'Poppins', system-ui, sans-serif",
      bodyFont:      "'Outfit', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "corporate-trust",
    label:       "Corporate Trust",
    description: "Blue-600, balanced radius, DM Sans — financial services, professional SaaS",
    category:    "corporate",
    swatchColor: "#2563eb",
    familyKey:   "corporate-professional",
    defaults: {
      headingFont:   "'DM Sans', system-ui, sans-serif",
      bodyFont:      "'DM Sans', system-ui, sans-serif",
      headerVariant: "mega",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "corporate-clean",
    label:       "Corporate Clean",
    description: "Slate-700 on pure white, hairline dividers, no blue — management consulting, modern law",
    category:    "corporate",
    swatchColor: "#334155",
    familyKey:   "corporate-professional",
    // Featured family: corporate-clean
    defaults: {
      headingFont:   "'Inter', system-ui, sans-serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "mega",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--corporate-clean" },
      { id: "features", label: "Features", storyId: "themes-preview--corporate-clean-features" },
    ],
  },
  {
    presetKey:   "modern-saas",
    label:       "Modern SaaS",
    description: "Blue-violet, Inter + Manrope — clean airy product-led SaaS",
    category:    "marketing",
    swatchColor: "#5b6af9",
    familyKey:   "saas-product",
    defaults: {
      headingFont:   "'Manrope', system-ui, sans-serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--modern-saas" },
      { id: "features", label: "Features", storyId: "themes-preview--modern-saas-features" },
    ],
  },
  {
    presetKey:   "bold-marketing",
    label:       "Bold Marketing",
    description: "Fuchsia-pink, 900-weight headings, brand-bar logos — B2C campaigns and product launches",
    category:    "marketing",
    swatchColor: "#db2777",
    familyKey:   "startup-growth",
    // Featured family: bold-marketing
    defaults: {
      headingFont:   "'Poppins', system-ui, sans-serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--bold-marketing" },
      { id: "features", label: "Features", storyId: "themes-preview--bold-marketing-features" },
    ],
  },
  // ── Signature themes ──────────────────────────────────────────────────────
  {
    presetKey:   "portfolio-showcase",
    label:       "Portfolio Showcase",
    description: "Teal-cyan, full-bleed media, floating shadow cards — agencies and case-driven sites",
    category:    "marketing",
    swatchColor: "#0891b2",
    familyKey:   "startup-growth",
    // Featured family: portfolio-showcase
    defaults: {
      headingFont:   "'Space Grotesk', system-ui, sans-serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "flyout",
      footerVariant: "minimal",
      footerDensity: "compact",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--portfolio-showcase" },
      { id: "features", label: "Features", storyId: "themes-preview--portfolio-showcase-features" },
    ],
  },
  {
    presetKey:   "premium-luxury",
    label:       "Premium Luxury",
    description: "Deep gold on warm cream, refined serif headings, generous whitespace — prestige brands",
    category:    "specialist",
    swatchColor: "#a16207",
    familyKey:   "editorial-publishing",
    // Featured family: premium-luxury
    defaults: {
      headingFont:   "'Cormorant Garamond', Georgia, serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "flyout",
      footerVariant: "minimal",
      footerDensity: "spacious",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--premium-luxury" },
      { id: "features", label: "Features", storyId: "themes-preview--premium-luxury-features" },
    ],
  },
  // ── Seasonal themes ───────────────────────────────────────────────────────
  {
    presetKey:   "valentine-pink",
    label:       "Valentine Pink",
    description: "Rose-pink, rounded, airy — seasonal romantic feel for Valentine's Day campaigns",
    category:    "seasonal",
    swatchColor: "#be185d",
    familyKey:   "wellness-care",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "comfortable",
    },
  },
  {
    presetKey:   "dutch-orange",
    label:       "Dutch Orange",
    description: "Bold orange, maximum weight headings, brand-bar logos — King's Day and Dutch national events",
    category:    "seasonal",
    swatchColor: "#FF7A1A",
    familyKey:   "startup-growth",
    defaults: {
      headingFont:   "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      bodyFont:      "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
  },

  // ── Careers / employer-brand ──────────────────────────────────────────────
  {
    presetKey:   "careers-human",
    label:       "Careers Human",
    description: "Warm teal, 500-weight DM Sans, generous whitespace — human, calm employer branding",
    category:    "specialist",
    swatchColor: "#1a7a6c",
    familyKey:   "wellness-care",   // closest structural family: calm, spacious, trust-first
    // Featured family: careers-human
    defaults: {
      headingFont:   "'DM Sans', system-ui, sans-serif",
      bodyFont:      "'DM Sans', system-ui, sans-serif",
      headerVariant: "flyout",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "themes-preview--careers-human" },
      { id: "features", label: "Features", storyId: "themes-preview--careers-human-features" },
    ],
  },

  // ── Premium style families ────────────────────────────────────────────────
  {
    presetKey:   "dark-ai",
    label:       "Dark AI",
    description: "Near-black with indigo-violet accent, sharp radius — AI tools, premium SaaS, developer platforms",
    category:    "specialist",
    swatchColor: "#7b6eff",
    familyKey:   "dark-ai",
    defaults: {
      headingFont:   "'Manrope', system-ui, sans-serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "minimal",
      footerVariant: "branding",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "dark-ai--homepage" },
      { id: "features", label: "Features", storyId: "dark-ai--features" },
    ],
  },
  {
    presetKey:   "clean-corporate",
    label:       "Clean Corporate",
    description: "Pure white with sky-blue accent, balanced radius — modern SaaS, B2B consulting, professional services",
    category:    "corporate",
    swatchColor: "#0284c7",
    familyKey:   "clean-corporate",
    defaults: {
      headingFont:   "'DM Sans', system-ui, sans-serif",
      bodyFont:      "'DM Sans', system-ui, sans-serif",
      headerVariant: "mega",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "clean-corporate--homepage" },
      { id: "features", label: "Features", storyId: "clean-corporate--features" },
    ],
  },
  {
    presetKey:   "structured-saas",
    label:       "Structured SaaS",
    description: "Warm amber-orange on stone-white, hairline borders, Plus Jakarta Sans — editorial B2B SaaS product style",
    category:    "specialist",
    swatchColor: "#d97706",
    familyKey:   "structured-saas",
    // Featured family: structured-saas — Plus Jakarta Sans headings, editorial-saas scale
    defaults: {
      headingFont:   "'Plus Jakarta Sans', system-ui, sans-serif",
      bodyFont:      "'Inter', system-ui, sans-serif",
      headerVariant: "flyout",
      footerVariant: "corporate",
      footerDensity: "compact",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "structured-saas--homepage" },
      { id: "features", label: "Features", storyId: "structured-saas--features" },
    ],
  },

  // ── Client-type blueprints ────────────────────────────────────────────────
  {
    presetKey:   "werkenbij-blueprint",
    label:       "Werkenbij Blueprint",
    description: "Amber-orange, soft radius, warm — employer brand & careers sites",
    category:    "specialist",
    swatchColor: "#f97316",
    familyKey:   "careers-human",
    defaults: {
      headingFont:   "DM Sans, system-ui, -apple-system, sans-serif",
      bodyFont:      "DM Sans, system-ui, -apple-system, sans-serif",
      headerVariant: "flyout",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",      label: "Home",      storyId: "werkenbij-blueprint--home" },
      { id: "vacatures", label: "Vacatures", storyId: "werkenbij-blueprint--vacatures" },
      { id: "over-ons",  label: "Over ons",  storyId: "werkenbij-blueprint--over-ons" },
      { id: "cultuur",   label: "Cultuur",   storyId: "werkenbij-blueprint--cultuur" },
      { id: "contact",   label: "Contact",   storyId: "werkenbij-blueprint--contact" },
    ],
  },
  {
    presetKey:   "corporate-b2b-blueprint",
    label:       "Corporate B2B Blueprint",
    description: "Deep navy, sharp radius — authority & trust for professional services",
    category:    "corporate",
    swatchColor: "#1d4ed8",
    familyKey:   "corporate-professional",
    defaults: {
      headingFont:   "Inter, system-ui, -apple-system, sans-serif",
      bodyFont:      "Inter, system-ui, -apple-system, sans-serif",
      headerVariant: "mega",
      footerVariant: "corporate",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",     label: "Home",     storyId: "corporate-b2b-blueprint--home" },
      { id: "diensten", label: "Diensten", storyId: "corporate-b2b-blueprint--diensten" },
      { id: "over-ons", label: "Over ons", storyId: "corporate-b2b-blueprint--over-ons" },
      { id: "cases",    label: "Cases",    storyId: "corporate-b2b-blueprint--cases" },
      { id: "contact",  label: "Contact",  storyId: "corporate-b2b-blueprint--contact" },
    ],
  },
  {
    presetKey:   "saas-blueprint",
    label:       "SaaS Blueprint",
    description: "Violet, sharp radius — product-led growth for B2B SaaS platforms",
    category:    "marketing",
    swatchColor: "#7c3aed",
    familyKey:   "saas-product",
    defaults: {
      headingFont:   "Geist Sans, system-ui, -apple-system, sans-serif",
      bodyFont:      "Geist Sans, system-ui, -apple-system, sans-serif",
      headerVariant: "minimal",
      footerVariant: "minimal",
      footerDensity: "comfortable",
    },
    preview: [
      { id: "home",        label: "Home",        storyId: "saas-blueprint--home" },
      { id: "product",     label: "Product",     storyId: "saas-blueprint--product" },
      { id: "pricing",     label: "Pricing",     storyId: "saas-blueprint--pricing" },
      { id: "cases",       label: "Cases",       storyId: "saas-blueprint--cases" },
      { id: "contact",     label: "Contact",     storyId: "saas-blueprint--contact" },
    ],
  },
] as const;
