/**
 * Non-blocking WCAG contrast warnings for the colour explorer.
 *
 * Pure helpers (no React) so the threshold logic is unit-testable and shared by
 * the PresetColourExplorer UI. We warn, never block: any palette can be saved.
 *
 * Thresholds follow WCAG 2.x AA for normal text:
 *   ratio >= 4.5  -> ok
 *   3   <= ratio < 4.5 -> warn (below AA)
 *   ratio <  3    -> fail (below the large-text / UI minimum: hard to read)
 */

import { contrastRatio, readableText } from "@/lib/color";

export type ContrastLevel = "ok" | "warn" | "fail";

export function contrastLevel(ratio: number | null): ContrastLevel {
  if (ratio === null) return "ok"; // unparseable colour: nothing to warn about
  if (ratio < 3)   return "fail";
  if (ratio < 4.5) return "warn";
  return "ok";
}

export function worstLevel(...levels: ContrastLevel[]): ContrastLevel {
  if (levels.includes("fail")) return "fail";
  if (levels.includes("warn")) return "warn";
  return "ok";
}

export function ratioText(ratio: number | null): string {
  return ratio === null ? "n/a" : `${ratio.toFixed(2)}:1`;
}

export interface PaletteContrast {
  /** Foreground (text) on background. null when no foreground is chosen. */
  fgOnBg:      number | null;
  /** Primary colour on background. null when the primary hex is invalid. */
  primaryOnBg: number | null;
  /** The auto-picked button text (readableText(primary)) on the primary fill. */
  onPrimary:   number | null;
  /** Worst level across the three pairs (drives the summary line). */
  worst:       ContrastLevel;
}

/**
 * Compute the three contrast pairs for a chosen palette. Callers pass already
 * validated hexes (or null when a role is off/invalid); background falls back to
 * white, the page default, when none is chosen.
 */
export function paletteContrast(input: {
  primaryHex:    string | null;
  backgroundHex: string | null;
  foregroundHex: string | null;
}): PaletteContrast {
  const bg = input.backgroundHex ?? "#ffffff";
  const fgOnBg      = input.foregroundHex ? contrastRatio(input.foregroundHex, bg) : null;
  const primaryOnBg = input.primaryHex    ? contrastRatio(input.primaryHex, bg)    : null;
  const onPrimary   = input.primaryHex    ? contrastRatio(readableText(input.primaryHex), input.primaryHex) : null;
  return {
    fgOnBg,
    primaryOnBg,
    onPrimary,
    worst: worstLevel(contrastLevel(fgOnBg), contrastLevel(primaryOnBg), contrastLevel(onPrimary)),
  };
}
