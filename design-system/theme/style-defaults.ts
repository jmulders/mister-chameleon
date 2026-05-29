/**
 * Style Defaults
 *
 * Utility functions that derive the default typography, header variant,
 * and footer variant that a Featured Theme Family provides as its baseline.
 *
 * These values fill the *second* layer in the three-tier design cascade:
 *
 *   1. Preset layer       — colours, radius, motion from THEME_PRESETS[theme]
 *   2. Family defaults    ← THIS MODULE — typography + structural from family config
 *   3. User overrides     — tokenOverrides.typography / headerVariant / footerVariant
 *
 * ─── Why a separate module ───────────────────────────────────────────────────
 *
 *   Admin UI components (LayoutVariantEditor, DesignPageClient) need to answer
 *   questions like "what is the header variant inherited from the current family?"
 *   without importing the full presets registry or duplicating the derivation logic.
 *
 *   This module is the single source of truth for those questions.
 *
 * ─── Important ───────────────────────────────────────────────────────────────
 *
 *   These are *read-only* defaults, not stored values.  They are derived at
 *   runtime from FEATURED_FAMILY_CONFIGS and must never be written to
 *   tokenOverrides (that would conflate user overrides with family defaults).
 *   The CSS cascade already applies them via familyTypographyToVars() +
 *   familyStructuralToVars() — this module is only for admin UI display.
 */

import type { ThemePresetKey } from "./presets";
import { THEME_PRESETS }       from "./presets";
import {
  FEATURED_FAMILY_CONFIGS,
  BUTTON_STYLE_RADIUS,
  isFeaturedFamilyKey,
  type FeaturedFamilyKey,
  type ButtonStyle,
  type CardStyle,
} from "./theme-families.config";
import type { HeaderVariant, FooterVariant, FooterDensity } from "@/tenant/types";

// ── Featured family resolution ─────────────────────────────────────────────────

/**
 * Given a preset key, returns the FeaturedFamilyKey if the preset belongs to
 * one of the five flagship families.  Returns null otherwise.
 *
 * Resolution order:
 *   1. Key is itself a valid FeaturedFamilyKey (e.g. "editorial-classic").
 *   2. The preset's `featuredFamilyKey` property (set in presets.ts).
 *
 * Returns null for seasonal presets, legacy presets, or any preset that has
 * no featured-family association.
 */
export function getFeaturedFamilyForPreset(
  presetKey: ThemePresetKey | string,
): FeaturedFamilyKey | null {
  const key = String(presetKey);

  // Direct match — some presets share their key with a family
  if (isFeaturedFamilyKey(key)) return key as FeaturedFamilyKey;

  // Look up the preset's declared featuredFamilyKey
  const preset = THEME_PRESETS[key as ThemePresetKey];
  if (!preset) return null;

  const fk = (preset as unknown as Record<string, unknown>).featuredFamilyKey as string | undefined;
  if (fk && isFeaturedFamilyKey(fk)) return fk as FeaturedFamilyKey;

  return null;
}

// ── Default typography ─────────────────────────────────────────────────────────

/** The typography defaults a family applies as its second-layer cascade. */
export interface FamilyTypographyDefaults {
  /** Full CSS font-family stack for all headings. */
  headingFont: string;
  /** Full CSS font-family stack for body and UI text. */
  bodyFont:    string;
  /** Optional accent/secondary font stack, or null when not set. */
  accentFont:  string | null;
  /** Numeric font-weight for headings (e.g. 500, 600, 700). */
  headingWeight: number;
  /** Numeric font-weight for body text (e.g. 400). */
  bodyWeight: number;
  /** Unitless line-height multiplier (e.g. 1.6). */
  lineHeight: number;
}

/**
 * Returns the typography defaults that the given featured family applies as
 * its baseline.  These are the values the admin UI should show as "Inherited
 * from [Family]" when no user override exists.
 */
export function getFamilyTypographyDefaults(
  familyKey: FeaturedFamilyKey,
): FamilyTypographyDefaults {
  const t = FEATURED_FAMILY_CONFIGS[familyKey].typography;
  return {
    headingFont:   t.headingFont,
    bodyFont:      t.bodyFont,
    accentFont:    t.accentFont ?? null,
    headingWeight: t.headingWeight,
    bodyWeight:    t.bodyWeight,
    lineHeight:    t.lineHeight,
  };
}

// ── Default layout variants ────────────────────────────────────────────────────

/** The layout variant defaults a family applies as its second-layer cascade. */
export interface FamilyLayoutDefaults {
  headerVariant: HeaderVariant;
  footerVariant: FooterVariant;
  footerDensity: FooterDensity;
  /** Preferred hero section layout. */
  heroVariant:   "centered" | "split" | "fullscreen";
  /** Semantic button shape personality. */
  buttonStyle:   ButtonStyle;
  /** Semantic card visual treatment. */
  cardStyle:     CardStyle;
  /** Human-readable label for the family (for UI display). */
  familyLabel:   string;
}

/**
 * Returns the HeaderVariant for a family.
 *
 * ─── Resolution rules ─────────────────────────────────────────────────────────
 *
 *   1. If `header.style === "transparent"`, return "transparent" — the
 *      transparent mode is itself a full structural variant in the admin UI
 *      (header floats over the hero, ignores nav panel shape).
 *   2. Otherwise return `header.variant` directly ("minimal" | "flyout" | "mega").
 *
 * The old derivation from `navigation.variant` has been replaced now that
 * `StructuralFamilyConfig` carries an explicit `header.variant` field.
 */
export function getFamilyDefaultHeaderVariant(
  familyKey: FeaturedFamilyKey,
): HeaderVariant {
  const s = FEATURED_FAMILY_CONFIGS[familyKey].structural;
  if (s.header.style === "transparent") return "transparent";
  return s.header.variant;
}

/**
 * Returns the default FooterVariant for a family.
 * Maps directly from the structural footer config (same union values).
 */
export function getFamilyDefaultFooterVariant(
  familyKey: FeaturedFamilyKey,
): FooterVariant {
  return FEATURED_FAMILY_CONFIGS[familyKey].structural.footer.variant;
}

/**
 * Returns the default FooterDensity for a family.
 */
export function getFamilyDefaultFooterDensity(
  familyKey: FeaturedFamilyKey,
): FooterDensity {
  return FEATURED_FAMILY_CONFIGS[familyKey].structural.footer.density;
}

/**
 * Returns the preferred hero layout variant for a family.
 */
export function getFamilyDefaultHeroVariant(
  familyKey: FeaturedFamilyKey,
): "centered" | "split" | "fullscreen" {
  return FEATURED_FAMILY_CONFIGS[familyKey].structural.heroVariant;
}

/**
 * Returns the semantic button style for a family.
 */
export function getFamilyDefaultButtonStyle(
  familyKey: FeaturedFamilyKey,
): ButtonStyle {
  return FEATURED_FAMILY_CONFIGS[familyKey].structural.buttonStyle;
}

/**
 * Returns the semantic card style for a family.
 */
export function getFamilyDefaultCardStyle(
  familyKey: FeaturedFamilyKey,
): CardStyle {
  return FEATURED_FAMILY_CONFIGS[familyKey].structural.cardStyle;
}

/**
 * Returns all layout defaults for a family in a single call.
 */
export function getFamilyLayoutDefaults(
  familyKey: FeaturedFamilyKey,
): FamilyLayoutDefaults {
  return {
    headerVariant: getFamilyDefaultHeaderVariant(familyKey),
    footerVariant: getFamilyDefaultFooterVariant(familyKey),
    footerDensity: getFamilyDefaultFooterDensity(familyKey),
    heroVariant:   getFamilyDefaultHeroVariant(familyKey),
    buttonStyle:   getFamilyDefaultButtonStyle(familyKey),
    cardStyle:     getFamilyDefaultCardStyle(familyKey),
    familyLabel:   FEATURED_FAMILY_CONFIGS[familyKey].label,
  };
}

// ── Override detection helpers ─────────────────────────────────────────────────

/**
 * Returns true when the given fontHeading value is a user override (i.e. it
 * differs from the family default, or the family has no default and a value
 * is explicitly set).
 *
 * Pass the stored tokenOverrides.typography.fontHeading value (or undefined
 * when not set) alongside the resolved family key for the active preset.
 */
export function isHeadingFontOverridden(
  storedFontHeading: string | undefined,
  familyKey:         FeaturedFamilyKey | null,
): boolean {
  if (!storedFontHeading) return false;
  if (!familyKey) return true; // no family → any stored value is an override
  const defaults = getFamilyTypographyDefaults(familyKey);
  return storedFontHeading.trim() !== defaults.headingFont.trim();
}

/**
 * Returns true when the given fontBody value is a user override.
 */
export function isBodyFontOverridden(
  storedFontBody: string | undefined,
  familyKey:      FeaturedFamilyKey | null,
): boolean {
  if (!storedFontBody) return false;
  if (!familyKey) return true;
  const defaults = getFamilyTypographyDefaults(familyKey);
  return storedFontBody.trim() !== defaults.bodyFont.trim();
}

/**
 * Returns true when the given headerVariant is a user override (i.e. differs
 * from the family's default header variant, or the family is unknown).
 */
export function isHeaderVariantOverridden(
  storedVariant: HeaderVariant | undefined,
  familyKey:     FeaturedFamilyKey | null,
): boolean {
  if (!storedVariant) return false; // not set = "auto" = inherited
  if (!familyKey) return true;
  return storedVariant !== getFamilyDefaultHeaderVariant(familyKey);
}

/**
 * Returns true when the given footerVariant is a user override.
 */
export function isFooterVariantOverridden(
  storedVariant: FooterVariant | undefined,
  familyKey:     FeaturedFamilyKey | null,
): boolean {
  if (!storedVariant) return false;
  if (!familyKey) return true;
  return storedVariant !== getFamilyDefaultFooterVariant(familyKey);
}

/**
 * Returns true when the given footerDensity is a user override.
 */
export function isFooterDensityOverridden(
  storedDensity: FooterDensity | undefined,
  familyKey:     FeaturedFamilyKey | null,
): boolean {
  if (!storedDensity) return false;
  if (!familyKey) return true;
  return storedDensity !== getFamilyDefaultFooterDensity(familyKey);
}

// ── Short font name helper ─────────────────────────────────────────────────────

/**
 * Extracts a short, human-readable font name from a full CSS font-family stack.
 *
 * Examples:
 *   "'Playfair Display', Georgia, serif"  →  "Playfair Display"
 *   "'Inter', system-ui, sans-serif"      →  "Inter"
 *   "system-ui, sans-serif"               →  "system-ui"
 */
export function shortFontName(stack: string): string {
  return stack
    .replace(/^['"]([^'"]+)['"].*$/, "$1")
    .replace(/^([^,]+).*$/, "$1")
    .trim();
}
