/**
 * BlockSurface — per-block background control.
 *
 * Values:
 *   default  — page background (var(--bg), typically white)
 *   subtle   — light tinted section (var(--section-subtle-bg))
 *   emphasis — very light primary tint (color-mix primary 8% + bg)
 *   strong   — solid primary color (var(--primary))
 *   inverse  — dark background (var(--section-inverse-bg, #0f172a))
 *
 * When surface is undefined, each block uses its own hardcoded CSS variable
 * default — preserving existing behavior for blocks that don't set surface.
 */

export type BlockSurface = "default" | "subtle" | "emphasis" | "strong" | "inverse";

/**
 * Maps a BlockSurface value to a CSS background string.
 * Returns undefined when surface is not set (block uses its own default).
 */
export function resolveSurface(surface?: BlockSurface): string | undefined {
  switch (surface) {
    case "default":  return "var(--bg)";
    case "subtle":   return "var(--section-subtle-bg)";
    case "emphasis": return "color-mix(in srgb, var(--primary) 8%, var(--bg))";
    case "strong":   return "var(--primary)";
    case "inverse":  return "var(--section-inverse-bg, #0f172a)";
    default:         return undefined;
  }
}
