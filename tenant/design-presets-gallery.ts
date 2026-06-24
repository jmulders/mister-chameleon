/**
 * Design Preset Gallery
 *
 * A curated, in-repo set of ready-to-apply design presets surfaced in the
 * tenant admin Design page ("Presets" tab). Picking a preset writes its
 * `tokenOverrides` onto the tenant's `design.tokenOverrides` (and sets
 * `design.theme = baseTheme`), so the public site re-renders in that style.
 *
 * ─── Why static / in-repo ────────────────────────────────────────────────────
 *
 *   Presets are platform-curated and versioned with the code — no DB table, no
 *   query cost. Per-tenant *custom* presets (the Builder) compose into the same
 *   `design.tokenOverrides`; saving them is a separate concern, not stored here.
 *
 * ─── Token contract ──────────────────────────────────────────────────────────
 *
 *   Every key used below MUST be allowlisted in design-token-validator.ts
 *   (GROUP_TOKEN_KEYS), or applying the preset is rejected by the validator.
 *   The groups + keys here are the ones validated in Phase 1.
 *
 *   `baseTheme: "custom"` means "no curated base theme" — only these explicit
 *   token overrides apply, so each preset fully defines its own look without a
 *   curated palette underneath it.
 *
 *   NOTE: typography overrides only render when the apply action also sets
 *   `design.typographyOverrideEnabled = true` (see resolve-theme.ts) — the
 *   preset-apply server action is responsible for that flag.
 */

import type { ThemeKey, TenantTokenOverrides } from "./types";

export interface DesignPresetCard {
  /** Stable id (used as the gallery key + analytics). */
  readonly id: string;
  /** Display name shown on the card. */
  readonly name: string;
  /** One-line description of the personality / best-fit use. */
  readonly description: string;
  /** Base ThemeKey to set on the tenant. "custom" = tokens fully define the look. */
  readonly baseTheme: ThemeKey;
  /** Grouped token overrides — written to design.tokenOverrides on apply. */
  readonly tokenOverrides: TenantTokenOverrides;
  /** Four representative colours for the gallery card preview/swatch. */
  readonly swatch: {
    readonly primary: string;
    readonly background: string;
    readonly foreground: string;
    readonly accent: string;
  };
}

export const DESIGN_PRESET_GALLERY: readonly DesignPresetCard[] = [
  {
    id: "indigo-saas",
    name: "Indigo SaaS",
    description: "Clean, modern, product-led SaaS. Indigo on white, Inter, balanced corners.",
    baseTheme: "custom",
    swatch: { primary: "#4f46e5", background: "#ffffff", foreground: "#0f172a", accent: "#eef2ff" },
    tokenOverrides: {
      color: { primary: "#4f46e5", primaryHover: "#4338ca", secondary: "#06b6d4", accent: "#eef2ff", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9", mutedForeground: "#64748b", border: "#e2e8f0", card: "#ffffff", cardForeground: "#0f172a", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Inter', system-ui, sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "0", headingTransform: "none" },
      radius: { interactive: "8px", card: "12px" },
      shadow: { md: "0 6px 18px rgba(2,6,23,.08)" },
      component: { buttonPaddingX: "1.1rem", buttonPaddingY: ".62rem" },
      layout: { headerBg: "#ffffff", headerFg: "#0f172a", headerBorder: "#e2e8f0", navLinkWeight: "600", navLinkTracking: "0" },
    },
  },
  {
    id: "editorial-serif",
    name: "Editorial Serif",
    description: "High-end editorial. Warm cream, ink text, Cormorant serif headings, hairline rules.",
    baseTheme: "custom",
    swatch: { primary: "#1f2937", background: "#faf6ef", foreground: "#2b2620", accent: "#f3efe7" },
    tokenOverrides: {
      color: { primary: "#1f2937", primaryHover: "#111827", secondary: "#9ca3af", accent: "#f3efe7", background: "#faf6ef", foreground: "#2b2620", muted: "#f1ece2", mutedForeground: "#7c7363", border: "#e3dccf", card: "#fffdf8", cardForeground: "#2b2620", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Cormorant Garamond', Georgia, serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "17px", headingWeight: "600", letterSpacing: "0", headingTransform: "none", headingLineHeight: "1.15" },
      radius: { interactive: "2px", card: "2px" },
      shadow: { md: "0 1px 0 rgba(43,38,32,.06)" },
      component: { buttonPaddingX: "1.3rem", buttonPaddingY: ".7rem" },
      layout: { headerBg: "#faf6ef", headerFg: "#2b2620", headerBorder: "#e3dccf", navLinkWeight: "500", navLinkTracking: ".02em" },
    },
  },
  {
    id: "industrial-strong",
    name: "Industrial Strong",
    description: "Manufacturing & logistics. Red on stone, UPPERCASE headings, zero radius, hard borders.",
    baseTheme: "custom",
    swatch: { primary: "#dc2626", background: "#f5f3ef", foreground: "#1c1917", accent: "#f5f3ef" },
    tokenOverrides: {
      color: { primary: "#dc2626", primaryHover: "#b91c1c", secondary: "#1c1917", accent: "#f5f3ef", background: "#f5f3ef", foreground: "#1c1917", muted: "#e7e2da", mutedForeground: "#57534e", border: "#1c1917", card: "#ffffff", cardForeground: "#1c1917", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Oswald', 'Arial Narrow', sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: ".04em", headingTransform: "uppercase" },
      radius: { interactive: "0px", card: "0px" },
      shadow: { md: "4px 4px 0 #1c1917" },
      component: { buttonPaddingX: "1.25rem", buttonPaddingY: ".7rem" },
      layout: { headerBg: "#1c1917", headerFg: "#f5f3ef", headerBorder: "#1c1917", navLinkWeight: "700", navLinkTracking: ".08em", navTransform: "uppercase" },
    },
  },
  {
    id: "minimal-mono",
    name: "Minimal Mono",
    description: "Pure structure, no colour. Zinc monochrome, near-zero radius, thin lines, whitespace.",
    baseTheme: "custom",
    swatch: { primary: "#18181b", background: "#ffffff", foreground: "#18181b", accent: "#f4f4f5" },
    tokenOverrides: {
      color: { primary: "#18181b", primaryHover: "#000000", secondary: "#71717a", accent: "#f4f4f5", background: "#ffffff", foreground: "#18181b", muted: "#fafafa", mutedForeground: "#a1a1aa", border: "#e4e4e7", card: "#ffffff", cardForeground: "#18181b", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Inter', system-ui, sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "15px", headingWeight: "600", letterSpacing: "-.01em", headingTransform: "none" },
      radius: { interactive: "2px", card: "2px" },
      shadow: { md: "none" },
      component: { buttonPaddingX: "1rem", buttonPaddingY: ".55rem" },
      layout: { headerBg: "#ffffff", headerFg: "#18181b", headerBorder: "#e4e4e7", navLinkWeight: "500", navLinkTracking: "0" },
    },
  },
  {
    id: "bold-dark",
    name: "Bold Dark",
    description: "High-energy launches. Near-black canvas, amber accent, glow, balanced radius.",
    baseTheme: "custom",
    swatch: { primary: "#f59e0b", background: "#0a0a0f", foreground: "#f4f4f5", accent: "#1c1917" },
    tokenOverrides: {
      color: { primary: "#f59e0b", primaryHover: "#d97706", secondary: "#a78bfa", accent: "#1c1917", background: "#0a0a0f", foreground: "#f4f4f5", muted: "#15151f", mutedForeground: "#a1a1aa", border: "#27272a", card: "#15151f", cardForeground: "#f4f4f5", onPrimary: "#1c1917" },
      typography: { fontHeading: "'Space Grotesk', system-ui, sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "-.01em", headingTransform: "none" },
      radius: { interactive: "10px", card: "14px" },
      shadow: { md: "0 0 40px rgba(245,158,11,.25)" },
      component: { buttonPaddingX: "1.2rem", buttonPaddingY: ".66rem" },
      layout: { headerBg: "#0a0a0f", headerFg: "#f4f4f5", headerBorder: "#27272a", navLinkWeight: "600", navLinkTracking: "0" },
    },
  },
  {
    id: "healthcare-calm",
    name: "Healthcare Calm",
    description: "Healthcare & wellness. Cyan on sky-blue, soft rounded corners, airy and light.",
    baseTheme: "custom",
    swatch: { primary: "#0891b2", background: "#f0f9ff", foreground: "#0c4a6e", accent: "#ecfeff" },
    tokenOverrides: {
      color: { primary: "#0891b2", primaryHover: "#0e7490", secondary: "#34d399", accent: "#ecfeff", background: "#f0f9ff", foreground: "#0c4a6e", muted: "#e0f2fe", mutedForeground: "#0369a1", border: "#bae6fd", card: "#ffffff", cardForeground: "#0c4a6e", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Manrope', system-ui, sans-serif", fontBody: "'Manrope', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "0", headingTransform: "none" },
      radius: { interactive: "16px", card: "20px" },
      shadow: { md: "0 8px 24px rgba(8,145,178,.12)" },
      component: { buttonPaddingX: "1.3rem", buttonPaddingY: ".7rem" },
      layout: { headerBg: "#ffffff", headerFg: "#0c4a6e", headerBorder: "#bae6fd", navLinkWeight: "600", navLinkTracking: "0" },
    },
  },
  {
    id: "corporate-navy",
    name: "Corporate Navy",
    description: "Trust & authority for professional services. Navy blue, sharp corners, DM Sans.",
    baseTheme: "custom",
    swatch: { primary: "#1e3a8a", background: "#ffffff", foreground: "#0f172a", accent: "#eff6ff" },
    tokenOverrides: {
      color: { primary: "#1e3a8a", primaryHover: "#1e40af", secondary: "#2563eb", accent: "#eff6ff", background: "#ffffff", foreground: "#0f172a", muted: "#f1f5f9", mutedForeground: "#475569", border: "#dbe2ea", card: "#ffffff", cardForeground: "#0f172a", onPrimary: "#ffffff" },
      typography: { fontHeading: "'DM Sans', system-ui, sans-serif", fontBody: "'DM Sans', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "-.01em", headingTransform: "none" },
      radius: { interactive: "4px", card: "6px" },
      shadow: { md: "0 4px 14px rgba(15,23,42,.08)" },
      component: { buttonPaddingX: "1.15rem", buttonPaddingY: ".64rem" },
      layout: { headerBg: "#1e3a8a", headerFg: "#ffffff", headerBorder: "#1e3a8a", navLinkWeight: "600", navLinkTracking: "0" },
    },
  },
  {
    id: "playful-startup",
    name: "Playful Startup",
    description: "Consumer apps & EdTech. Vivid violet + pink, big soft corners, expressive Space Grotesk.",
    baseTheme: "custom",
    swatch: { primary: "#7c3aed", background: "#ffffff", foreground: "#1e1b4b", accent: "#f5f3ff" },
    tokenOverrides: {
      color: { primary: "#7c3aed", primaryHover: "#6d28d9", secondary: "#ec4899", accent: "#f5f3ff", background: "#ffffff", foreground: "#1e1b4b", muted: "#faf5ff", mutedForeground: "#6d28d9", border: "#ede9fe", card: "#ffffff", cardForeground: "#1e1b4b", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Space Grotesk', system-ui, sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "-.02em", headingTransform: "none" },
      radius: { interactive: "18px", card: "22px" },
      shadow: { md: "0 12px 30px rgba(124,58,237,.18)" },
      component: { buttonPaddingX: "1.35rem", buttonPaddingY: ".72rem" },
      layout: { headerBg: "#ffffff", headerFg: "#1e1b4b", headerBorder: "#ede9fe", navLinkWeight: "600", navLinkTracking: "0" },
    },
  },
  {
    id: "premium-luxury",
    name: "Premium Luxury",
    description: "Prestige brands. Deep gold on warm cream, refined serif headings, pill buttons.",
    baseTheme: "custom",
    swatch: { primary: "#a87c2a", background: "#fbf8f1", foreground: "#2d2a24", accent: "#f7f1e3" },
    tokenOverrides: {
      color: { primary: "#a87c2a", primaryHover: "#8c6420", secondary: "#2d2a24", accent: "#f7f1e3", background: "#fbf8f1", foreground: "#2d2a24", muted: "#f2ebdc", mutedForeground: "#8a8170", border: "#e6dcc6", card: "#fffdf7", cardForeground: "#2d2a24", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Cormorant Garamond', Georgia, serif", fontBody: "'Manrope', system-ui, sans-serif", baseFontSize: "17px", headingWeight: "600", letterSpacing: ".01em", headingTransform: "none", headingLineHeight: "1.15" },
      radius: { interactive: "9999px", card: "10px" },
      shadow: { md: "0 10px 30px rgba(45,42,36,.10)" },
      component: { buttonPaddingX: "1.5rem", buttonPaddingY: ".72rem" },
      layout: { headerBg: "#fbf8f1", headerFg: "#2d2a24", headerBorder: "#e6dcc6", navLinkWeight: "500", navLinkTracking: ".06em" },
    },
  },
  {
    id: "modern-green",
    name: "Modern Green",
    description: "Growth & sustainability. Emerald, fresh and friendly, Manrope, balanced radius.",
    baseTheme: "custom",
    swatch: { primary: "#059669", background: "#ffffff", foreground: "#052e16", accent: "#ecfdf5" },
    tokenOverrides: {
      color: { primary: "#059669", primaryHover: "#047857", secondary: "#34d399", accent: "#ecfdf5", background: "#ffffff", foreground: "#052e16", muted: "#f0fdf4", mutedForeground: "#15803d", border: "#d1fae5", card: "#ffffff", cardForeground: "#052e16", onPrimary: "#ffffff" },
      typography: { fontHeading: "'Manrope', system-ui, sans-serif", fontBody: "'Manrope', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "800", letterSpacing: "-.01em", headingTransform: "none" },
      radius: { interactive: "10px", card: "14px" },
      shadow: { md: "0 8px 22px rgba(5,150,105,.14)" },
      component: { buttonPaddingX: "1.2rem", buttonPaddingY: ".66rem" },
      layout: { headerBg: "#ffffff", headerFg: "#052e16", headerBorder: "#d1fae5", navLinkWeight: "700", navLinkTracking: "0" },
    },
  },
  {
    id: "aurora-purple",
    name: "Aurora Purple",
    description: "Purple brand with a hero gradient fading from deep purple to bright violet. Space Grotesk headings, soft corners, purple glow.",
    baseTheme: "custom",
    swatch: { primary: "#7c3aed", background: "#faf5ff", foreground: "#2e1065", accent: "#d946ef" },
    tokenOverrides: {
      color: { primary: "#7c3aed", primaryHover: "#6d28d9", secondary: "#d946ef", accent: "#f3e8ff", background: "#faf5ff", foreground: "#2e1065", muted: "#f3e8ff", mutedForeground: "#6d28d9", border: "#e9d5ff", card: "#ffffff", cardForeground: "#2e1065", onPrimary: "#ffffff", link: "#9333ea", success: "#10b981", danger: "#e11d48", gradient: "linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)", gradientHero: "linear-gradient(180deg, #1a0533 0%, #4c1d95 52%, #7c3aed 100%)" },
      typography: { fontHeading: "'Space Grotesk', system-ui, sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "-.02em", headingTransform: "none", headingLineHeight: "1.08" },
      radius: { interactive: "14px", card: "18px" },
      shadow: { md: "0 14px 36px rgba(124,58,237,.20)" },
      border: { width: "1px" },
      spacing: { sectionPadding: "clamp(60px,9vw,144px)", container: "74rem", align: "center" },
      component: { buttonPaddingX: "1.3rem", buttonPaddingY: ".7rem" },
      motion: { hoverLift: "-4px" },
      layout: { headerBg: "#2e1065", headerFg: "#ffffff", headerBorder: "#7c3aed", navLinkWeight: "600", navLinkTracking: "0" },
      focus: { ringWidth: "3px", ringColor: "#7c3aed" },
    },
  },
  {
    id: "aurora-purple-gold",
    name: "Aurora Purple Gold",
    description: "Aurora Purple with a complementary gold accent — soft-gold eyebrow badge + gold secondary, a thin gold rule under the dark header. Purple + gold = classic premium.",
    baseTheme: "custom",
    swatch: { primary: "#7c3aed", background: "#faf5ff", foreground: "#2e1065", accent: "#c79a2e" },
    tokenOverrides: {
      color: { primary: "#7c3aed", primaryHover: "#6d28d9", secondary: "#c79a2e", accent: "#fdf3d7", background: "#faf5ff", foreground: "#2e1065", muted: "#f3e8ff", mutedForeground: "#6d28d9", border: "#e9d5ff", card: "#ffffff", cardForeground: "#2e1065", onPrimary: "#ffffff", link: "#9333ea", success: "#10b981", danger: "#e11d48", gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)", gradientHero: "linear-gradient(180deg, #1a0533 0%, #4c1d95 52%, #7c3aed 100%)" },
      typography: { fontHeading: "'Space Grotesk', system-ui, sans-serif", fontBody: "'Inter', system-ui, sans-serif", baseFontSize: "16px", headingWeight: "700", letterSpacing: "-.02em", headingTransform: "none", headingLineHeight: "1.08" },
      radius: { interactive: "14px", card: "18px" },
      shadow: { md: "0 14px 36px rgba(124,58,237,.20)" },
      border: { width: "1px" },
      spacing: { sectionPadding: "clamp(60px,9vw,144px)", container: "74rem", align: "center" },
      component: { buttonPaddingX: "1.3rem", buttonPaddingY: ".7rem" },
      motion: { hoverLift: "-4px" },
      layout: { headerBg: "#2e1065", headerFg: "#ffffff", headerBorder: "#c79a2e", navLinkWeight: "600", navLinkTracking: "0" },
      focus: { ringWidth: "3px", ringColor: "#7c3aed" },
    },
  },
] as const;

/** Look up a preset by id. */
export function getDesignPreset(id: string): DesignPresetCard | undefined {
  return DESIGN_PRESET_GALLERY.find((p) => p.id === id);
}
