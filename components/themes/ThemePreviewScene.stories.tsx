/**
 * Themes / Preview — Storybook stories
 *
 * One story per ThemePresetKey.  Each story renders ThemePreviewScene inside
 * a decorator that injects the full theme CSS via tenantThemeToCSS().
 *
 * ─── Root cause of "all themes look the same" (fixed here) ───────────────────
 *
 *   tenantThemeToCSS() returns ONLY the inner body of a :root { } rule —
 *   bare CSS custom property declarations with no selector:
 *
 *     "  --primary: #5b6af9;\n  --bg: #ffffff;\n  ..."
 *
 *   Injecting that string into a <style> tag without wrapping it in `:root {}`
 *   produces invalid CSS that browsers silently ignore.  Every story then
 *   falls back to the baseline theme.css defaults — indigo brand, slate
 *   neutrals — making all 20 stories look identical.
 *
 *   Fix: wrap with `:root {\n...\n}` before injecting, exactly as layout.tsx
 *   does in production:
 *     const cssVarBlock = `:root {\n${tenantThemeToCSS(tenantConfig.theme)}}`;
 *
 * ─── Why each story sets args: { presetKey } ─────────────────────────────────
 *
 *   ThemePreviewScene accepts a `presetKey` prop that selects a per-theme
 *   hero layout variant (split / editorial / background / …) and thematic
 *   copy, making each preview look structurally distinct.
 *
 *   In Storybook 7+ the `Story` wrapper inside a decorator is NOT a plain
 *   React component — arbitrary JSX props like `<Story presetKey="…" />` are
 *   silently ignored.  The only reliable way to pass a prop from a decorator
 *   is via `<Story args={{ …context.args, presetKey }} />`, but even that can
 *   be inconsistent across Storybook versions.
 *
 *   The bulletproof Storybook-native approach is to set the prop directly on
 *   the story via `args: { presetKey }`.  Storybook merges story args with
 *   meta args and passes the result as props to the component.  This is how
 *   all official Storybook examples handle per-story prop overrides.
 *
 *   The `themed()` factory function below sets both `decorators` and `args`
 *   from a single presetKey so the key is never duplicated.
 *
 * ─── Story IDs (used by ThemeGallery iframe URLs) ────────────────────────────
 *
 *   Title:  "Themes/Preview"  →  title slug: "themes-preview"
 *   Export: CorporateBlue    →  story slug: "corporate-blue"
 *   Full ID: themes-preview--corporate-blue
 *
 *   This maps directly to:
 *     /iframe.html?id=themes-preview--{themeKey}&viewMode=story
 *
 * ─── CSS injection strategy ──────────────────────────────────────────────────
 *
 *   The decorator wraps tenantThemeToCSS() in `:root {}` and injects it via
 *   <style dangerouslySetInnerHTML>.  Because CSS in any <style> element
 *   applies globally regardless of DOM position, and this tag is rendered after
 *   the globals.css baseline (loaded by .storybook/preview.ts), the theme-
 *   specific overrides win by document order for equal-specificity selectors.
 *
 * ─── Viewport ────────────────────────────────────────────────────────────────
 *
 *   Stories render at 1280px wide (fullscreen layout, no padding).
 *   The ThemeGallery scales the iframe down to a 256×180px thumbnail via
 *   CSS transform: scale(0.2).
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { THEME_PRESETS }           from "@/design-system/theme/presets";
import { tenantThemeToCSS }        from "@/design-system/theme";
import { ThemePreviewScene }        from "./ThemePreviewScene";
import { ThemePreviewFeaturesPage } from "./ThemePreviewFeaturesPage";

// ── CSS-injection decorator ───────────────────────────────────────────────────
//
// This decorator's only job is to inject the theme's CSS custom properties
// into the story iframe as a valid :root { } rule.
//
// It does NOT attempt to pass presetKey to the component — that is handled
// by setting args: { presetKey } on each story (see factory functions below).

// Typed off Story itself rather than as a bare `Decorator`.
//
// Bare Decorator defaults to Storybook's generic `Args`, while StoryObj<typeof
// meta> narrows decorators to this component's own args — so a bare Decorator was
// not assignable to Story["decorators"] and every story here was a type error.
// Deriving the type from Story means it cannot drift again when the props change.
// (Story["decorators"] is `Fn | Fn[] | undefined`, hence the Extract to get at
// the array's element type.)
type ThemeDecorator = Extract<NonNullable<Story["decorators"]>, readonly unknown[]>[number];

function withTheme(presetKey: keyof typeof THEME_PRESETS): ThemeDecorator {
  return function ThemeDecorator(Story) {
    // Wrap in :root {} — same as layout.tsx in production:
    //   const cssVarBlock = `:root {\n${tenantThemeToCSS(tenantConfig.theme)}}`;
    const css = `:root {\n${tenantThemeToCSS(THEME_PRESETS[presetKey])}}`;
    return (
      <>
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <Story />
      </>
    );
  };
}

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta = {
  title:     "Themes/Preview",
  component: ThemePreviewScene,
  parameters: {
    // Full-bleed: remove Storybook's default padding so the preview fills the
    // iframe exactly — matching what the admin gallery renders.
    layout:   "fullscreen",
    // Disable actions/docs addon noise for thumbnail stories.
    controls: { disable: true },
    actions:  { disable: true },
  },
} satisfies Meta<typeof ThemePreviewScene>;

export default meta;

type Story = StoryObj<typeof meta>;

// ── Story factory functions ───────────────────────────────────────────────────
//
// `themed(presetKey, name)` — standard ThemePreviewScene story.
//   Sets args: { presetKey } so ThemePreviewScene receives it as a prop and
//   can select the correct hero layout, copy, and photo for that theme.
//
// `themedFeature(presetKey, name)` — ThemePreviewFeaturesPage story.
//   Uses a custom render; does not pass presetKey (FeaturesPage has no prop).

function themed(presetKey: keyof typeof THEME_PRESETS, name: string): Story {
  return {
    decorators: [withTheme(presetKey)],
    // args is the Storybook-native way to pass props to the component.
    // This is the only approach that works reliably across all Storybook versions.
    args: { presetKey },
    name,
  };
}

function themedFeature(presetKey: keyof typeof THEME_PRESETS, name: string): Story {
  return {
    decorators: [withTheme(presetKey)],
    render: () => <ThemePreviewFeaturesPage />,
    name,
  };
}

// ── One story per ThemePresetKey ──────────────────────────────────────────────
//
// Export name  → story slug (Storybook kebab-cases PascalCase exports)
// CorporateBlue    → corporate-blue   ✓ matches ThemePresetKey
// ModernGreen      → modern-green     ✓
// … and so on for all supported themes.

// ── Curated commercial themes ─────────────────────────────────────────────────

export const CorporateBlue     = themed("corporate-blue",     "Corporate Blue");
export const ModernGreen       = themed("modern-green",       "Modern Green");
export const MinimalNeutral    = themed("minimal-neutral",    "Minimal Neutral");
export const BoldDark          = themed("bold-dark",          "Bold Dark");
export const TechIndigo        = themed("tech-indigo",        "Tech Indigo");
export const WarmProfessional  = themed("warm-professional",  "Warm Professional");
export const RecruitmentEnergy = themed("recruitment-energy", "Recruitment Energy");
export const HealthcareCalm    = themed("healthcare-calm",    "Healthcare Calm");
export const IndustrialStrong  = themed("industrial-strong",  "Industrial Strong");
export const PremiumEditorial  = themed("premium-editorial",  "Premium Editorial");
export const DarkContrast      = themed("dark-contrast",      "Dark Contrast");
export const EditorialClassic  = themed("editorial-classic",  "Editorial Classic");
export const PlayfulStartup    = themed("playful-startup",    "Playful Startup");
export const StartupEnergy     = themed("startup-energy",     "Startup Energy");
export const CorporateTrust    = themed("corporate-trust",    "Corporate Trust");
export const ModernSaas        = themed("modern-saas",        "Modern SaaS");
export const CorporateClean    = themed("corporate-clean",    "Corporate Clean");
export const BoldMarketing     = themed("bold-marketing",     "Bold Marketing");

// ── Signature themes (editorial · corporate · bold) ───────────────────────────

export const PortfolioShowcase = themed("portfolio-showcase", "Portfolio Showcase");
export const PremiumLuxury     = themed("premium-luxury",     "Premium Luxury");

// ── Seasonal themes ───────────────────────────────────────────────────────────

export const ValentinePink = themed("valentine-pink", "Valentine Pink");
export const DutchOrange   = themed("dutch-orange",   "Dutch Orange");

// ── Careers / employer-brand ──────────────────────────────────────────────────
//
// Export name:  CareersHuman  →  story slug: careers-human
// Full story ID: themes-preview--careers-human
// Matches the iframe URL pattern used by ThemeGallery.

export const CareersHuman = themed("careers-human", "Careers Human");

// ── Features page — second preview tab for multi-page gallery preview ─────────
//
// Export name pattern:  {PascalPresetKey}Features
// Story slug pattern:   {preset-key}-features
// Full story ID:        themes-preview--{preset-key}-features
//
// These stories render ThemePreviewFeaturesPage (StatsBlock + ProofBlock + CTA)
// instead of ThemePreviewScene (Hero + FeatureGrid + CTA), giving the admin
// gallery a second distinct "page" to tab through for featured presets.

export const CorporateBlueFeatures    = themedFeature("corporate-blue",    "Corporate Blue / Features");
export const ModernSaasFeatures       = themedFeature("modern-saas",       "Modern SaaS / Features");
export const EditorialClassicFeatures = themedFeature("editorial-classic", "Editorial Classic / Features");
export const CorporateCleanFeatures   = themedFeature("corporate-clean",   "Corporate Clean / Features");
export const BoldMarketingFeatures    = themedFeature("bold-marketing",    "Bold Marketing / Features");
export const PortfolioShowcaseFeatures = themedFeature("portfolio-showcase", "Portfolio Showcase / Features");
export const PremiumLuxuryFeatures    = themedFeature("premium-luxury",    "Premium Luxury / Features");
export const CareersHumanFeatures     = themedFeature("careers-human",     "Careers Human / Features");
