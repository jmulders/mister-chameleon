/**
 * WorkEngine — Tenant Theme
 *
 * The visual identity of the WorkEngine deployment expressed as a TenantTheme.
 *
 * ─── Palette choice ──────────────────────────────────────────────────────────
 *
 *   Brand:    true violet/purple — energetic, focused, modern B2B product.
 *             Uses the Tailwind violet scale (#8b5cf6 at 500) rather than
 *             the platform's indigo `brand[]` tokens so the two tenants read
 *             as distinct brands.
 *   Neutral:  shared neutral slate for body text and surfaces.
 *   Radius:   "soft" — 12px interactive, 24px card, 16px popover.
 *             Generous but not bubbly — confident modern SaaS feel.
 *
 * ─── Architecture contract ───────────────────────────────────────────────────
 *
 *   This file delegates entirely to the "workengine" ThemePreset via
 *   resolveTheme().  All token values are defined once in
 *   design-system/theme/presets.ts — no duplication here.
 *
 *   The resolved TenantTheme is passed to tenantThemeToCSS() in the root
 *   layout, which emits CSS custom properties that override the :root
 *   defaults.  Components consume these values via the CSS variable cascade —
 *   no component code changes when this theme changes.
 *
 * ─── When the brand evolves ──────────────────────────────────────────────────
 *
 *   Edit the "workengine" preset in design-system/theme/presets.ts.
 *   The entire site updates via the CSS var cascade; no component files change.
 */

import { resolveTheme } from "@/design-system/theme/presets";
import type { TenantTheme } from "@/design-system/theme/tenant-theme";

/**
 * WorkEngine brand theme.
 *
 * Resolved from the "workengine" ThemePreset — see
 * design-system/theme/presets.ts for the full palette and component token
 * definitions.
 *
 * @example
 *   import { WORKENGINE_THEME } from "@/tenant/workengine-theme";
 *   const css = tenantThemeToCSS(WORKENGINE_THEME);
 */
export const WORKENGINE_THEME: TenantTheme = resolveTheme("workengine");
