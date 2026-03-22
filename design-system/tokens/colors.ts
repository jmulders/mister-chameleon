/**
 * Color tokens
 *
 * Brand palette:   indigo-violet — smart, modern, adaptive.
 * Neutral palette: slate — clean, legible, SaaS-standard.
 * Semantic:        success / warning / error intent colors.
 *
 * These constants are consumed two ways:
 *  1. Mapped to `@theme` CSS variables in theme.css (→ Tailwind utilities)
 *  2. Imported directly in TypeScript for runtime theming
 */

export const brand = {
  50: "#eef2ff",
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1", // primary
  600: "#4f46e5", // primary-hover
  700: "#4338ca",
  800: "#3730a3",
  900: "#312e81",
  950: "#1e1b4b",
} as const;

export const neutral = {
  0: "#ffffff",
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  950: "#020617",
} as const;

export const success = {
  50: "#f0fdf4",
  500: "#22c55e",
  700: "#15803d",
} as const;

export const warning = {
  50: "#fffbeb",
  500: "#f59e0b",
  700: "#b45309",
} as const;

export const error = {
  50: "#fef2f2",
  500: "#ef4444",
  700: "#b91c1c",
} as const;

/** Semantic aliases — resolved against the palette above */
export const semantic = {
  // Surfaces
  bg: neutral[50],
  bgSubtle: neutral[100],
  bgInverse: neutral[900],

  // Text
  text: neutral[900],
  textMuted: neutral[500],
  textSubtle: neutral[400],
  textInverse: neutral[0],

  // Borders
  border: neutral[200],
  borderStrong: neutral[300],

  // Brand / interactive
  primary: brand[500],
  primaryHover: brand[600],
  primarySubtle: brand[50],
  primaryText: neutral[0],
} as const;

export type BrandShade = keyof typeof brand;
export type NeutralShade = keyof typeof neutral;
