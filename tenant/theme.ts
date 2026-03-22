/**
 * Mister Chameleon — Tenant Theme
 *
 * The visual identity of the Mister Chameleon deployment expressed as a
 * TenantTheme object.
 *
 * ─── Palette choice ──────────────────────────────────────────────────────────
 *
 *   Brand:    indigo-violet (brand.500 = #6366f1) — smart, adaptive, modern.
 *   Neutral:  slate — clean, legible, SaaS-standard.
 *   Radius:   "balanced" — professional feel without sharp corners.
 *
 *   These values mirror the defaults defined in theme.css :root exactly.
 *   The inline <style> injection in layout.tsx is therefore a no-op for
 *   this tenant — it exists to establish the pattern for future tenants whose
 *   values will differ.
 *
 * ─── When the brand evolves ──────────────────────────────────────────────────
 *
 *   Edit the values here — the whole site updates via the CSS var cascade.
 *   No component files need changing.
 *
 * ─── Dark mode ───────────────────────────────────────────────────────────────
 *
 *   Light-mode values only for now. Dark mode is handled by the media-query
 *   override in theme.css. A future `dark` sub-theme field can be added to
 *   TenantTheme to allow per-tenant dark palettes.
 */

import type { TenantTheme } from "@/design-system/theme/tenant-theme";
import { brand, neutral } from "@/design-system/theme/tenant-theme";
import { shadows } from "@/design-system/tokens/shadow";
import { fontFamily } from "@/design-system/tokens/typography";

/**
 * Mister Chameleon brand theme.
 *
 * @example
 *   import { MISTER_CHAMELEON_THEME } from "@/tenant/theme";
 *   const css = tenantThemeToCSS(MISTER_CHAMELEON_THEME);
 */
export const MISTER_CHAMELEON_THEME: TenantTheme = {
  colors: {
    // ── Brand / interactive ─────────────────────────────────────────────────
    brand: {
      primary:        brand[500],   // #6366f1 — indigo
      primaryHover:   brand[600],   // #4f46e5
      primaryActive:  brand[700],   // #4338ca
      primarySubtle:  brand[50],    // #eef2ff — very light tint
      primaryText:    neutral[0],   // #ffffff — white text on brand bg
      ring:           brand[500],   // #6366f1 — matches primary
      textBrand:      brand[600],   // #4f46e5 — slightly darker for text contrast
    },

    // ── Text ────────────────────────────────────────────────────────────────
    text: {
      text:        neutral[900],   // #0f172a — near-black
      textMuted:   neutral[500],   // #64748b — slate-500
      textSubtle:  neutral[400],   // #94a3b8 — slate-400
      textInverse: neutral[0],     // #ffffff — on dark bg
    },

    // ── Surfaces ────────────────────────────────────────────────────────────
    background: {
      bg:        neutral[50],    // #f8fafc — off-white page bg
      bgSubtle:  neutral[100],   // #f1f5f9 — recessed areas
      bgInverse: neutral[900],   // #0f172a — dark sections
    },

    // ── Borders ─────────────────────────────────────────────────────────────
    border: {
      border:       neutral[200],   // #e2e8f0
      borderStrong: neutral[300],   // #cbd5e1
    },
  },

  // ── Radius personality ──────────────────────────────────────────────────────
  // "balanced" → buttons/inputs: 8px · cards: 16px · popovers: 12px
  radius: "balanced",

  // ── Typography ──────────────────────────────────────────────────────────────
  typography: {
    headingFont:      fontFamily.sans,
    headingWeight:    "700",
    subheadingWeight: "600",
  },

  // ── Button tokens ────────────────────────────────────────────────────────────
  button: {
    bg:         brand[500],
    text:       neutral[0],
    hoverBg:    brand[600],
    activeBg:   brand[700],
    ring:       brand[500],
    shadow:     shadows.sm,
    fontWeight: "600",
  },

  // ── Motion tokens ────────────────────────────────────────────────────────────
  motion: {
    transitionFast: "100ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionBase: "150ms cubic-bezier(0.4, 0, 0.2, 1)",
    transitionSlow: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
    easingDefault:  "cubic-bezier(0.4, 0, 0.2, 1)",
    easingSpring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },

  // ── Brand metadata ──────────────────────────────────────────────────────────
  meta: {
    name:        "Mister Chameleon",
    tagline:     "Adaptive websites that convert.",
    faviconPath: "/favicon.ico",
    // logoPath: "/logo.svg",  — add when the logo asset is available
  },
};
