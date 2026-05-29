/**
 * WorkEngine — Tenant Theme
 *
 * The visual identity of the WorkEngine deployment expressed as a TenantTheme.
 *
 * ─── Palette choice ──────────────────────────────────────────────────────────
 *
 *   Uses the "modern-saas" preset — blue-violet palette, clean airy surfaces,
 *   product-led growth aesthetic.  Closely matches the original WorkEngine
 *   violet brand while using a supported preset key.
 *
 * ─── Architecture contract ───────────────────────────────────────────────────
 *
 *   This file delegates to resolveTheme().  All token values are defined once
 *   in design-system/theme/presets.ts — no duplication here.
 *
 *   The resolved TenantTheme is passed to tenantThemeToCSS() in the root
 *   layout, which emits CSS custom properties that override the :root
 *   defaults.  Components consume these values via the CSS variable cascade —
 *   no component code changes when this theme changes.
 *
 * ─── When the brand evolves ──────────────────────────────────────────────────
 *
 *   Swap the preset key below or override individual tokens via
 *   resolveTheme("modern-saas", { colors: { brand: { primary: "#8b5cf6" } } }).
 */

import { resolveTheme } from "@/design-system/theme/presets";
import type { TenantTheme } from "@/design-system/theme/tenant-theme";

/**
 * WorkEngine brand theme — resolved from the "modern-saas" preset.
 *
 * @example
 *   import { WORKENGINE_THEME } from "@/tenant/workengine-theme";
 *   const css = tenantThemeToCSS(WORKENGINE_THEME);
 */
export const WORKENGINE_THEME: TenantTheme = resolveTheme("modern-saas");
