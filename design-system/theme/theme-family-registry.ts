/**
 * Theme Family Registry
 *
 * Maps friendly "theme family" names to their canonical ThemePresetKey and,
 * where applicable, their FeaturedFamilyKey (typography + structural config).
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *
 *   Blueprints declare a human-friendly `recommendedThemeFamily` string
 *   (e.g. "Corporate Trust") rather than coupling directly to a ThemePresetKey.
 *   This registry is the translation layer:
 *
 *     recommendedThemeFamily  →  canonicalPreset  (used to apply the theme)
 *                             →  familyKey        (optional, drives typography)
 *
 *   Three consumers:
 *     1. Blueprint apply-flow — looks up canonicalPreset and sets it as tenant theme.
 *     2. Admin theme selector  — groups presets under their family name.
 *     3. Storybook toolbar     — resolves the "family" control to a real preset.
 *
 * ─── Family coverage ─────────────────────────────────────────────────────────
 *
 *   Corporate Trust     — navy, crisp white, trust-forward. Accounting, law, consulting.
 *   Bold Conversion     — vivid accent, pill buttons, campaign energy. Agencies, DTC.
 *   Editorial Authority — serif headings, spacious type, long-form credibility.
 *   Soft Care           — sage green, warm white, gentle. Healthcare, wellness.
 *   Tech Clarity        — deep indigo, structured grid, technical authority.
 *
 * ─── Adding a family ─────────────────────────────────────────────────────────
 *
 *   1. Add a new `ThemeFamilyRecord` to THEME_FAMILY_REGISTRY.
 *   2. If the family needs custom typography, add a `FeaturedFamilyKey` entry
 *      to theme-families.config.ts and set `featuredFamilyKey` on the preset.
 *   3. Update any blueprint definitions that should use the new family.
 */

import type { ThemePresetKey }  from "./presets";
import type { FeaturedFamilyKey } from "./theme-families.config";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Friendly theme family name used in blueprints and admin UI.
 * These are human-readable labels; the registry maps them to preset keys.
 */
export type ThemeFamilyName =
  | "Corporate Trust"
  | "Bold Conversion"
  | "Editorial Authority"
  | "Soft Care"
  | "Tech Clarity"
  | "Careers Human";

/** All available theme family names as a readonly array (useful for UI). */
export const THEME_FAMILY_NAMES: readonly ThemeFamilyName[] = [
  "Corporate Trust",
  "Bold Conversion",
  "Editorial Authority",
  "Soft Care",
  "Tech Clarity",
  "Careers Human",
] as const;

/**
 * A single theme family definition.
 */
export interface ThemeFamilyRecord {
  /** Friendly display name — shown in admin, Storybook, blueprint picker. */
  name: ThemeFamilyName;
  /** Stable machine-readable key (no spaces). */
  key: string;
  /** One-line positioning statement. */
  description: string;
  /**
   * The canonical ThemePresetKey that best represents this family.
   * Applied automatically when a blueprint is activated with this family.
   */
  canonicalPreset: ThemePresetKey;
  /**
   * Alternative preset keys grouped under this family.
   * The admin theme picker uses this to group presets visually.
   */
  relatedPresets: ThemePresetKey[];
  /**
   * FeaturedFamilyKey for the typography + structural layer, when available.
   * When set, the family drives headings, body, scale, buttons, cards, and nav.
   * Null means the family relies purely on preset-level typography settings.
   */
  featuredFamilyKey: FeaturedFamilyKey | null;
  /** Emoji for quick visual scanning in admin UI. */
  icon: string;
  /**
   * Primary color swatch (CSS hex) for family picker preview.
   * Should match the canonical preset's primary/accent color.
   */
  colorSwatch: string;
  /**
   * Industry contexts where this family is the strongest fit.
   * Used for filtering and auto-suggestion in the blueprint apply flow.
   */
  industries: string[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const THEME_FAMILY_REGISTRY: readonly ThemeFamilyRecord[] = [

  // ── Corporate Trust ───────────────────────────────────────────────────────────
  //
  // Authoritative navy blue, crisp white backgrounds, disciplined grid.
  // The trust-first family for professional services and B2B.
  //
  // Canonical preset: corporate-trust (navy palette, Inter, structured layout)
  // Related: corporate-blue, corporate-clean, minimal-neutral
  // Typography layer: corporate-clean (Inter throughout, restrained scale)

  {
    name:              "Corporate Trust",
    key:               "corporate-trust",
    description:       "Authoritative navy and white — credibility and structured professionalism.",
    canonicalPreset:   "corporate-trust",
    relatedPresets:    ["corporate-blue", "corporate-clean", "minimal-neutral", "warm-professional"],
    featuredFamilyKey: "corporate-clean",
    icon:              "🏛️",
    colorSwatch:       "#1e3a5f",
    industries:        ["accounting", "law", "consulting", "finance", "professional_services"],
  },

  // ── Bold Conversion ───────────────────────────────────────────────────────────
  //
  // Vivid accent colors (pink/coral/orange), pill buttons, maximum campaign energy.
  // The high-conversion family for agencies, B2C, and growth-focused brands.
  //
  // Canonical preset: bold-marketing (vivid pink, Poppins headings, pill buttons)
  // Related: startup-energy, playful-startup, modern-green, modern-saas
  // Typography layer: bold-marketing (Poppins 700, largest type scale, fullscreen hero)

  {
    name:              "Bold Conversion",
    key:               "bold-conversion",
    description:       "Vivid accent, high energy, pill buttons — built for conversion.",
    canonicalPreset:   "bold-marketing",
    relatedPresets:    ["startup-energy", "playful-startup", "modern-green", "modern-saas"],
    featuredFamilyKey: "bold-marketing",
    icon:              "🚀",
    colorSwatch:       "#e91e8c",
    industries:        ["marketing_agency", "b2c", "lead_gen", "ecommerce", "recruitment"],
  },

  // ── Editorial Authority ───────────────────────────────────────────────────────
  //
  // Serif headings (Playfair Display / Cormorant), generous line-heights,
  // spacious vertical rhythm. The credibility family for publishers, legal
  // brands, premium consulting, and long-form content.
  //
  // Canonical preset: editorial-classic (ink-black, serif, minimal chrome)
  // Related: premium-editorial, dark-contrast
  // Typography layer: editorial-classic (Playfair Display, wide editorial scale)

  {
    name:              "Editorial Authority",
    key:               "editorial-authority",
    description:       "Serif headings and spacious typography — credibility through restraint.",
    canonicalPreset:   "editorial-classic",
    relatedPresets:    ["premium-editorial", "dark-contrast"],
    featuredFamilyKey: "editorial-classic",
    icon:              "📰",
    colorSwatch:       "#1a1a1a",
    industries:        ["media", "law", "consulting", "professional_services", "b2b_saas"],
  },

  // ── Soft Care ─────────────────────────────────────────────────────────────────
  //
  // Sage green, warm white, gentle type. Designed for emotional trust in
  // healthcare, wellness, midwifery, and perinatal care contexts.
  //
  // Canonical preset: healthcare-calm (sage, warm palette, rounded, Inter)
  // Related: warm-professional
  // Typography layer: null — healthcare-calm uses its own inline typography settings
  //   (no FeaturedFamilyKey was needed; the preset's Inter + gentle spacing is sufficient)

  {
    name:              "Soft Care",
    key:               "soft-care",
    description:       "Sage green and warm whites — emotional trust for healthcare and wellness.",
    canonicalPreset:   "healthcare-calm",
    relatedPresets:    ["warm-professional"],
    featuredFamilyKey: null,
    icon:              "🌿",
    colorSwatch:       "#6b9e7a",
    industries:        ["healthcare", "midwifery", "wellness", "mental_health"],
  },

  // ── Tech Clarity ─────────────────────────────────────────────────────────────
  //
  // Deep indigo, clean grid, structured information density. Technical authority
  // for IT services, cloud companies, developer-facing products.
  //
  // Canonical preset: tech-indigo (deep indigo accent, Inter, tight corporate grid)
  // Related: bold-dark, dark-contrast, industrial-strong
  // Typography layer: null — tech-indigo uses its own typography settings

  {
    name:              "Tech Clarity",
    key:               "tech-clarity",
    description:       "Deep indigo and crisp grid — structured authority for tech and IT.",
    canonicalPreset:   "tech-indigo",
    relatedPresets:    ["bold-dark", "dark-contrast", "industrial-strong"],
    featuredFamilyKey: null,
    icon:              "💻",
    colorSwatch:       "#3730a3",
    industries:        ["it_services", "b2b_saas", "cloud", "dev_tools", "cybersecurity"],
  },

  // ── Careers Human ─────────────────────────────────────────────────────────────
  //
  // Warm teal, DM Sans 500-weight, airy layout, light hero. The family for
  // werken-bij pages, employer-brand platforms, and recruitment sites.
  //
  // Canonical preset: careers-human (warm teal #1a7a6c, soft radius, calm motion)
  // Related: healthcare-calm (shared calm DNA), warm-professional
  // Typography layer: careers-human (DM Sans 500, human scale, 1.70 line-height)
  //
  // Why teal? Between the clinical cyan of Healthcare Calm and the aggressive
  // orange of Recruitment Energy sits a space that says "stable, people-first,
  // trustworthy employer" — warm teal owns that territory.

  {
    name:              "Careers Human",
    key:               "careers-human",
    description:       "Warm teal and calm type — welcoming employer brand for candidate-first recruitment sites.",
    canonicalPreset:   "careers-human",
    relatedPresets:    ["healthcare-calm", "warm-professional"],
    featuredFamilyKey: "careers-human",
    icon:              "🤝",
    colorSwatch:       "#1a7a6c",
    industries:        ["recruitment", "hr", "employer_brand", "staffing", "jobs"],
  },

] as const;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Find a theme family record by its friendly name. */
export function findThemeFamilyByName(name: string): ThemeFamilyRecord | undefined {
  return THEME_FAMILY_REGISTRY.find((f) => f.name === name);
}

/** Find a theme family record by its machine key. */
export function findThemeFamilyByKey(key: string): ThemeFamilyRecord | undefined {
  return THEME_FAMILY_REGISTRY.find((f) => f.key === key);
}

/** Find the theme family that owns a given preset key (canonical or related). */
export function findFamilyForPreset(presetKey: ThemePresetKey): ThemeFamilyRecord | undefined {
  return THEME_FAMILY_REGISTRY.find(
    (f) => f.canonicalPreset === presetKey || f.relatedPresets.includes(presetKey),
  );
}

/**
 * Resolves a blueprint's `recommendedThemeFamily` string to a ThemePresetKey.
 * Falls back to the provided `fallback` (or undefined) if no match is found.
 */
export function resolveThemeFamilyPreset(
  familyName: string,
  fallback?: ThemePresetKey,
): ThemePresetKey | undefined {
  const record = findThemeFamilyByName(familyName);
  return record?.canonicalPreset ?? fallback;
}

/** Returns all preset keys across all families — canonical + related. */
export function getAllFamilyPresets(): ThemePresetKey[] {
  const seen = new Set<ThemePresetKey>();
  const result: ThemePresetKey[] = [];
  for (const family of THEME_FAMILY_REGISTRY) {
    if (!seen.has(family.canonicalPreset)) {
      seen.add(family.canonicalPreset);
      result.push(family.canonicalPreset);
    }
    for (const related of family.relatedPresets) {
      if (!seen.has(related)) {
        seen.add(related);
        result.push(related);
      }
    }
  }
  return result;
}
