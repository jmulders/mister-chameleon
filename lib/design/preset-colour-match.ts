/**
 * Preset colour matching + custom-look derivation for the preset explorer.
 *
 * Pure logic (no React): rank the gallery presets by how close their swatch is
 * to the operator's chosen colours (CIEDE2000 over the matching swatch roles),
 * and, when nothing fits, derive a complete-look token payload from the chosen
 * colours so it can be saved as a token set via the existing actions.
 */

import type { DesignPresetCard } from "@/tenant/design-presets-gallery";
import {
  hexToLab, deltaE2000, isLight, hueFamily,
  mix, darken, lighten, readableText, type Lab, type HueFamily,
} from "@/lib/color";

export interface ChosenColours {
  /** Required. The colour the look is built around. */
  primary: string;
  background?: string;
  accent?: string;
  foreground?: string;
}

export type MatchLabel = "Very close" | "Close" | "Loose" | "Distant";

export interface RankedPreset {
  preset: DesignPresetCard;
  /** Average CIEDE2000 over the roles the operator provided (lower = closer). */
  deltaE: number;
  label:  MatchLabel;
}

/** Above this average deltaE, no gallery preset is a good match: offer a custom look. */
export const NO_MATCH_THRESHOLD = 15;

const SWATCH_ROLES = ["primary", "background", "accent", "foreground"] as const;
type SwatchRole = typeof SWATCH_ROLES[number];

export function matchLabel(dE: number): MatchLabel {
  if (dE <= 5) return "Very close";
  if (dE <= 12) return "Close";
  if (dE <= 20) return "Loose";
  return "Distant";
}

/**
 * Rank presets by colour similarity to `chosen`. Only the roles the operator
 * provided are compared, each against the preset's same swatch role; the score
 * is their average CIEDE2000. Returns all presets sorted closest-first (empty
 * when no valid colour was provided).
 */
export function rankPresets(
  presets: readonly DesignPresetCard[],
  chosen: ChosenColours,
): RankedPreset[] {
  const chosenLab = new Map<SwatchRole, Lab>();
  for (const role of SWATCH_ROLES) {
    const hex = chosen[role];
    if (hex) { const lab = hexToLab(hex); if (lab) chosenLab.set(role, lab); }
  }
  if (chosenLab.size === 0) return [];

  const ranked = presets.map((preset) => {
    let sum = 0;
    for (const [role, lab] of chosenLab) {
      const swLab = hexToLab(preset.swatch[role]);
      sum += swLab ? deltaE2000(lab, swLab) : 100;
    }
    const deltaE = sum / chosenLab.size;
    return { preset, deltaE, label: matchLabel(deltaE) };
  });
  ranked.sort((a, b) => a.deltaE - b.deltaE);
  return ranked;
}

/** Facet helpers: derive light/dark and hue family from a preset's swatch. */
export function presetIsLight(p: DesignPresetCard): boolean { return isLight(p.swatch.background); }
export function presetHueFamily(p: DesignPresetCard): HueFamily { return hueFamily(p.swatch.primary); }

/** Heading font options for a custom look (all in the supported Google Font set). */
export const HEADING_FONTS: ReadonlyArray<{ label: string; stack: string }> = [
  { label: "Inter",              stack: "'Inter', system-ui, sans-serif" },
  { label: "Playfair Display",   stack: "'Playfair Display', Georgia, serif" },
  { label: "Cormorant Garamond", stack: "'Cormorant Garamond', Georgia, serif" },
  { label: "Libre Baskerville",  stack: "'Libre Baskerville', Georgia, serif" },
  { label: "Lora",               stack: "'Lora', Georgia, serif" },
  { label: "Merriweather",       stack: "'Merriweather', Georgia, serif" },
  { label: "PT Serif",           stack: "'PT Serif', Georgia, serif" },
  { label: "Source Serif 4",     stack: "'Source Serif 4', Georgia, serif" },
  { label: "Space Grotesk",      stack: "'Space Grotesk', system-ui, sans-serif" },
  { label: "Sora",               stack: "'Sora', system-ui, sans-serif" },
  { label: "Outfit",             stack: "'Outfit', system-ui, sans-serif" },
  { label: "Montserrat",         stack: "'Montserrat', system-ui, sans-serif" },
  { label: "Oswald",             stack: "'Oswald', system-ui, sans-serif" },
  { label: "Manrope",            stack: "'Manrope', system-ui, sans-serif" },
];

/** Body font options for a custom look (all in the supported Google Font set). */
export const BODY_FONTS: ReadonlyArray<{ label: string; stack: string }> = [
  { label: "Inter",         stack: "'Inter', system-ui, sans-serif" },
  { label: "Work Sans",     stack: "'Work Sans', system-ui, sans-serif" },
  { label: "Mulish",        stack: "'Mulish', system-ui, sans-serif" },
  { label: "Nunito",        stack: "'Nunito', system-ui, sans-serif" },
  { label: "Source Sans 3", stack: "'Source Sans 3', system-ui, sans-serif" },
];

/**
 * Derive a complete-look token payload (DesignTokenUploadInput shape) from the
 * chosen colours. Colours are derived from the seed roles; the non-colour groups
 * (radius / shadow / spacing / component / layout / border) are seeded from the
 * closest matched preset so the look is complete and coherent; and all four font
 * vars are emitted (fontHeading, and fontBody = fontSans = fontUI) so the whole
 * UI follows the body font. Returns the tokens plus a 4-colour swatch for preview.
 */
export function buildCustomLookTokens(
  chosen: ChosenColours,
  base: DesignPresetCard,
  headingStack: string,
  bodyStack: string,
): { tokens: Record<string, unknown>; swatch: DesignPresetCard["swatch"] } {
  const primary    = chosen.primary;
  const background = chosen.background ?? "#ffffff";
  const foreground = chosen.foreground ?? readableText(background);
  const accent     = chosen.accent ?? primary;

  const color: Record<string, string> = {
    primary,
    primaryHover:    darken(primary, 0.12),
    onPrimary:       readableText(primary),
    secondary:       accent,
    accent,
    background,
    foreground,
    muted:           mix(background, foreground, 0.08),
    mutedForeground: mix(foreground, background, 0.45),
    border:          mix(background, foreground, 0.16),
    card:            isLight(background) ? "#ffffff" : lighten(background, 0.06),
    cardForeground:  foreground,
    link:            primary,
    success:         "#3f8a6a",
    danger:          "#b4534a",
    gradient:        `linear-gradient(135deg, ${primary} 0%, ${accent} 120%)`,
    gradientHero:    `linear-gradient(180deg, ${foreground} 0%, ${mix(foreground, primary, 0.5)} 55%, ${primary} 100%)`,
  };

  const baseTypography = (base.tokenOverrides.typography ?? {}) as Record<string, string>;
  const typography: Record<string, string> = {
    ...baseTypography,
    fontHeading: headingStack,
    fontBody:    bodyStack,
    fontSans:    bodyStack,
    fontUI:      bodyStack,
  };

  const tokens: Record<string, unknown> = { theme: "custom", color, typography };
  const baseOverrides = base.tokenOverrides as Record<string, unknown>;
  for (const group of ["radius", "shadow", "spacing", "component", "layout", "border"] as const) {
    if (baseOverrides[group]) tokens[group] = baseOverrides[group];
  }

  return { tokens, swatch: { primary, background, foreground, accent } };
}
