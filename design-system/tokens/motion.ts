/**
 * Motion tokens
 *
 * Shared timing and easing values for transitions and animations.
 * Keeping these as tokens allows a single edit to adjust the "feel"
 * of all interactive elements simultaneously — e.g. a snappier enterprise
 * feel vs. a springy consumer-app feel.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // In TypeScript (for tenantThemeToCSS / preset definitions):
 *   import { transitionDuration, easing } from "@/design-system/tokens/motion";
 *
 *   // In components (via CSS custom properties emitted by tenantThemeToCSS):
 *   style={{ transition: "background var(--transition-base)" }}
 *   className="transition-colors duration-[var(--transition-fast)]"
 *
 * ─── Duration semantic tier ───────────────────────────────────────────────────
 *
 *   instant  0 ms   — immediate; use for state flips with no animation
 *   fast     100 ms — micro-interactions (hover states, button press)
 *   base     150 ms — default — colours, borders, opacity
 *   slow     300 ms — panels, modals, overlays expanding
 *   slower   500 ms — complex multi-step animations
 *
 * ─── Easing functions ─────────────────────────────────────────────────────────
 *
 *   default  — smooth ease-in-out for most transitions
 *   in       — starts slow, accelerates — elements leaving the screen
 *   out      — decelerates — elements entering the screen
 *   spring   — slight overshoot — expressive UI, consumer apps
 */

export const transitionDuration = {
  instant: "0ms",
  fast:    "100ms",
  base:    "150ms",
  slow:    "300ms",
  slower:  "500ms",
} as const;

export const easing = {
  default: "cubic-bezier(0.4, 0, 0.2, 1)",    // smooth ease-in-out
  in:      "cubic-bezier(0.4, 0, 1, 1)",        // ease-in
  out:     "cubic-bezier(0, 0, 0.2, 1)",         // ease-out
  spring:  "cubic-bezier(0.34, 1.56, 0.64, 1)", // slight overshoot
} as const;

export type TransitionDurationKey = keyof typeof transitionDuration;
export type EasingKey             = keyof typeof easing;
