/**
 * Theme module
 *
 * Re-exports token compositions for TypeScript consumers.
 * The CSS variables are defined in theme.css (imported via globals.css).
 *
 * Theme switching at runtime is done by setting `data-theme` on <html>.
 * The decision engine and experience context provider will manage this.
 */

import { brand, neutral, semantic } from "../tokens/colors";
import { sectionSpacing } from "../tokens/spacing";
import { fontFamily, fontSize, fontWeight } from "../tokens/typography";
import { radii } from "../tokens/radii";

export const lightTheme = {
  colors: { brand, neutral, semantic },
  spacing: { section: sectionSpacing },
  typography: { fontFamily, fontSize, fontWeight },
  radii,
} as const;

export type Theme = typeof lightTheme;

/** Valid data-theme attribute values — extended as experience themes are added */
export type ThemeKey = "default" | (string & {});

// ── Tenant theme ──────────────────────────────────────────────────────────────
// Re-export the tenant theme types and CSS generator for consumers who import
// from "@/design-system/theme" rather than from the specific file.
export type {
  TenantTheme,
  TenantBrandColors,
  TenantTextColors,
  TenantBackgroundColors,
  TenantBorderColors,
  TenantBrandMeta,
  TenantRadiusValues,
  RadiusPersonality,
  ThemeTypography,
  ThemeButtonTokens,
  ThemeMotionTokens,
  ThemeComponentStyles,
} from "./tenant-theme";

export { RADIUS_PRESETS, tenantThemeToCSS, tenantThemeToVarsRecord } from "./tenant-theme";

// ── Named theme presets ───────────────────────────────────────────────────────
//
// 18 complete visual personalities: 16 curated commercial themes +
// 2 signature showcase/luxury themes. See THEME_CATALOG for the full list.
//
// Usage:
//   import { resolveTheme, THEME_PRESETS } from "@/design-system/theme";
//   const theme = resolveTheme("corporate-trust", { meta: { name: "Acme" } });
//   const css   = tenantThemeToCSS(theme);
export type {
  ThemePresetKey,
  ThemePresetOverrides,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
} from "./presets";
export {
  THEME_PRESETS,
  THEME_CATALOG,
  resolveTheme,
  isThemePresetKey,
} from "./presets";

// ── Featured theme family typography config ───────────────────────────────────
export type {
  FeaturedFamilyKey,
  FontScaleProfile,
  FamilyBlockStyleName,
  ThemeFamilyTypography,
  ThemeFamilyConfig,
  StructuralFamilyConfig,
  ResolvedFamilyTheme,
} from "./theme-families.config";
export {
  fontScaleProfiles,
  FEATURED_FAMILY_CONFIGS,
  FEATURED_FAMILY_KEYS,
  isFeaturedFamilyKey,
  familyTypographyToVars,
  familyStructuralToVars,
  resolveThemeWithFamily,
} from "./theme-families.config";
