/**
 * Shadow tokens
 *
 * A named shadow scale from xs (barely perceptible) through xl (dramatic lift).
 * The brand focus-ring shadow is included for interactive element focus states.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // In TypeScript (for tenantThemeToCSS / preset definitions):
 *   import { shadows } from "@/design-system/tokens/shadow";
 *   cardShadow: shadows.md
 *
 *   // In components (via CSS custom properties emitted by tenantThemeToCSS):
 *   style={{ boxShadow: "var(--shadow-card)" }}
 *
 *   // Tailwind v4 (via @theme in theme.css — shadow-sm, shadow-md, etc.):
 *   className="shadow-md"
 *
 * ─── Semantic tier ───────────────────────────────────────────────────────────
 *
 *   xs     barely visible — bottom edge of a flat surface
 *   sm     subtle — standard card / input lift
 *   md     moderate — popovers, dropdowns, hovering cards
 *   lg     prominent — modals, drawers, feature-card hover state
 *   xl     dramatic — full-screen overlays, hero decorations
 *   none   no shadow — flat aesthetic (enterprise-clean preset)
 *   brand  focus ring — keyboard focus on interactive elements
 */

export const shadows = {
  none:  "none",
  xs:    "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  sm:    "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md:    "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg:    "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl:    "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  brand: "0 0 0 3px rgb(99 102 241 / 0.25)",
} as const;

export type ShadowKey = keyof typeof shadows;
