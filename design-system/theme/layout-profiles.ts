/**
 * design-system/theme/layout-profiles.ts
 *
 * Maps every theme preset to a "layout profile" — a structural blueprint that
 * determines which adaptive context blocks are active by default for new tenants
 * with this theme.
 *
 * ─── Why here and not in presets.ts? ─────────────────────────────────────────
 *
 *   presets.ts carries visual design tokens only (fonts, header/footer variant,
 *   swatch colour).  Adding structural concerns there would violate separation.
 *   This file is the bridge between design identity and page structure.
 *
 * ─── Context block keys ───────────────────────────────────────────────────────
 *
 *   These must match the ContextBlockKey union in tenant/types.ts:
 *     "hero" | "proof" | "cta" | "conversion" | "notification"
 *
 *   We use plain strings here so this file stays free of tenant/ imports
 *   (design-system is a lower layer).  Callers cast to ContextBlockKey[].
 *
 * ─── Profile usage ────────────────────────────────────────────────────────────
 *
 *   getThemeLayoutProfile(themeKey)    — returns profile for any theme key
 *   onboardingInputToTenantSettings()  — applies profile to new tenant blocks
 *   ThemeBlueprintCard                 — displays profile info in OnboardingForm
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type LayoutProfileKey =
  | "full-marketing"
  | "corporate-standard"
  | "content-first"
  | "clean-landing";

export interface ThemeLayoutProfile {
  readonly key:           LayoutProfileKey;
  readonly label:         string;
  readonly description:   string;
  /** Context block keys enabled by default for tenants with this theme. */
  readonly contextBlocks: readonly string[];
  /** Human-readable feature list shown in the OnboardingForm blueprint card. */
  readonly highlights:    readonly string[];
}

// ── Profile definitions ───────────────────────────────────────────────────────

export const LAYOUT_PROFILES: Record<LayoutProfileKey, ThemeLayoutProfile> = {

  /**
   * Full marketing funnel — all five context blocks active.
   * For bold/marketing/startup themes where conversion pressure matters.
   */
  "full-marketing": {
    key:         "full-marketing",
    label:       "Full marketing funnel",
    description: "Maximum conversion focus — all adaptive blocks active for a complete customer journey.",
    contextBlocks: ["hero", "proof", "cta", "conversion", "notification"],
    highlights: [
      "Adaptive hero — personalised first impression",
      "Social proof — testimonials and case studies",
      "CTA section — conversion-focused call to action",
      "Conversion form — demo request or contact",
      "Notification bar — overlay for returning visitors",
    ],
  },

  /**
   * Corporate standard — hero, proof, CTA, and conversion form.
   * No notification overlay; professional and complete without clutter.
   */
  "corporate-standard": {
    key:         "corporate-standard",
    label:       "Corporate standard",
    description: "Professional business site — all core blocks, without a notification overlay.",
    contextBlocks: ["hero", "proof", "cta", "conversion"],
    highlights: [
      "Adaptive hero — personalised first impression",
      "Social proof — references and results",
      "CTA section — clear call to action",
      "Conversion form — contact or demo request",
    ],
  },

  /**
   * Content-first — hero, proof, and CTA; no hard conversion step.
   * For portfolio, editorial and careers-focused themes.
   */
  "content-first": {
    key:         "content-first",
    label:       "Content-first",
    description: "Content takes centre stage — hero, social proof, and CTA without a conversion form.",
    contextBlocks: ["hero", "proof", "cta"],
    highlights: [
      "Adaptive hero — personalised first impression",
      "Social proof — portfolio and results",
      "CTA section — inviting call to action",
    ],
  },

  /**
   * Clean landing — hero, CTA, and conversion form; stripped to essentials.
   * For minimal, luxury and high-focus landing themes.
   */
  "clean-landing": {
    key:         "clean-landing",
    label:       "Clean landing",
    description: "Focused landing page — minimum distraction, maximum conversion.",
    contextBlocks: ["hero", "cta", "conversion"],
    highlights: [
      "Adaptive hero — personalised first impression",
      "CTA section — direct call to action",
      "Conversion form — demo or contact",
    ],
  },

};

// ── Theme → profile mapping ───────────────────────────────────────────────────
//
// Themes not listed here default to "full-marketing" — the richest profile,
// which is the safest starting point (operators remove what they don't need).

const THEME_LAYOUT_MAP: Readonly<Record<string, LayoutProfileKey>> = {

  // ── Corporate themes → corporate-standard ──────────────────────────────────
  "corporate-blue":    "corporate-standard",
  "minimal-neutral":   "corporate-standard",
  "industrial-strong": "corporate-standard",
  "corporate-trust":   "corporate-standard",
  "corporate-clean":   "corporate-standard",
  "clean-corporate":   "corporate-standard",
  "tech-indigo":       "corporate-standard",
  "healthcare-calm":   "corporate-standard",
  "dark-ai":           "corporate-standard",
  "structured-saas":   "corporate-standard",

  // ── Portfolio / careers / editorial → content-first ───────────────────────
  "premium-editorial":  "content-first",
  "portfolio-showcase": "content-first",
  "careers-human":      "content-first",
  "recruitment-energy": "content-first",

  // ── Minimal / luxury / high-contrast → clean-landing ─────────────────────
  "premium-luxury": "clean-landing",
  "dark-contrast":  "clean-landing",
  "minimal":        "clean-landing",    // platform theme

  // ── Client-type blueprints ────────────────────────────────────────────────
  // werkenbij  → content-first  (people, culture, vacatures — no hard conversion form)
  // corporate  → corporate-standard (authority site: split hero + services + logos)
  // saas       → full-marketing (product-led: bold SaaS hero + stats + feature cards)
  "werkenbij-blueprint":      "content-first",
  "corporate-b2b-blueprint":  "corporate-standard",
  "saas-blueprint":           "full-marketing",

  // ── Marketing / bold / seasonal → full-marketing (default, not listed) ────
  // bold-dark, playful-startup, startup-energy, modern-saas, bold-marketing,
  // modern-green, dutch-orange, valentine-pink, default, bold, custom
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the layout profile for a given theme key.
 * Falls back to "full-marketing" for any unknown theme key.
 */
export function getThemeLayoutProfile(themeKey: string): ThemeLayoutProfile {
  const profileKey = THEME_LAYOUT_MAP[themeKey] ?? "full-marketing";
  return LAYOUT_PROFILES[profileKey];
}
