/**
 * Border radius tokens
 *
 * A stepped scale from sharp (xs) through pill (full).
 * `md` is the default interactive element radius.
 * `xl` / `2xl` suit cards and modals.
 */

export const radii = {
  none: "0",
  xs: "0.125rem", //  2px
  sm: "0.25rem", //   4px
  md: "0.5rem", //    8px  ← buttons, inputs
  lg: "0.75rem", //  12px
  xl: "1rem", //     16px  ← cards
  "2xl": "1.5rem", // 24px  ← modals, panels
  "3xl": "2rem", //  32px
  full: "9999px", // pill
} as const;

export type RadiusKey = keyof typeof radii;
