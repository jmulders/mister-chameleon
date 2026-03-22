/**
 * Typography tokens
 *
 * Font families, size scale, weights, line-heights, and letter-spacing.
 * Sizes follow a modular scale (base 1rem, ratio ≈ 1.25).
 */

export const fontFamily = {
  sans: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    "Roboto",
    '"Helvetica Neue"',
    "Arial",
    "sans-serif",
  ].join(", "),
  mono: [
    "ui-monospace",
    '"Cascadia Code"',
    '"Source Code Pro"',
    "Menlo",
    "Monaco",
    "Consolas",
    '"Courier New"',
    "monospace",
  ].join(", "),
} as const;

export const fontSize = {
  xs: "0.75rem", //   12px
  sm: "0.875rem", //  14px
  base: "1rem", //    16px
  lg: "1.125rem", //  18px
  xl: "1.25rem", //   20px
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem", //   48px
  "6xl": "3.75rem", // 60px
  "7xl": "4.5rem", // 72px
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const lineHeight = {
  none: "1",
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "2",
} as const;

export const letterSpacing = {
  tighter: "-0.05em",
  tight: "-0.025em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.05em",
  widest: "0.1em",
} as const;

export type FontSizeKey = keyof typeof fontSize;
export type FontWeightKey = keyof typeof fontWeight;
