/**
 * Border tokens
 *
 * A small, opinionated set of border-width values.  Most surfaces use `thin`
 * (1 px); interactive elements in their active/focused state use `medium` (2 px).
 * Thick borders are reserved for decorative or high-emphasis treatments.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // In TypeScript (for tenantThemeToCSS / preset definitions):
 *   import { borderWidth } from "@/design-system/tokens/border";
 *
 *   // In components (via CSS custom properties emitted by tenantThemeToCSS):
 *   style={{ borderWidth: "var(--border-width)" }}
 *
 * ─── Semantic tier ───────────────────────────────────────────────────────────
 *
 *   none    — no border
 *   thin    — 1px — default dividers, card outlines, inputs
 *   medium  — 2px — active state inputs, focus borders
 *   thick   — 4px — decorative accent borders, callout left-border
 */

export const borderWidth = {
  none:   "0px",
  thin:   "1px",
  medium: "2px",
  thick:  "4px",
} as const;

export type BorderWidthKey = keyof typeof borderWidth;
