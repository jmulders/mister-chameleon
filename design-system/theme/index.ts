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

export { RADIUS_PRESETS, tenantThemeToCSS } from "./tenant-theme";

// ── Named theme presets ───────────────────────────────────────────────────────
//
// Three complete visual personalities shipped with the platform:
//   "marketing-default"  indigo-violet, balanced radius, dark hero
//   "enterprise-clean"   slate neutral, sharp radius, muted CTA
//   "bold-brand"         vivid brand palette, soft radius, expressive hero
//
// Usage:
//   import { resolveTheme, THEME_PRESETS } from "@/design-system/theme";
//   const theme = resolveTheme("enterprise-clean", { meta: { name: "Acme" } });
//   const css   = tenantThemeToCSS(theme);
export type { ThemePresetKey, ThemePresetOverrides } from "./presets";
export { THEME_PRESETS, resolveTheme, isThemePresetKey } from "./presets";
