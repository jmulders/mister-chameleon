/**
 * Chrome background resolution — header / footer logo variant selection
 *
 * Shared helper used by Header + Footer to decide whether the chrome surface is
 * visually dark, so the dark-background logo variant (settings.logoDark) can be
 * picked automatically. "Dark" is derived from the EFFECTIVE background colour:
 *
 *   1. The tenant's layout token override (design.tokenOverrides.layout.*Bg) —
 *      what the custom presets / Builder set.
 *   2. Otherwise the active curated theme preset's componentStyles.*Bg — so a
 *      curated dark theme (no per-tenant override) is handled too.
 *   3. Otherwise undefined → treated as not-dark (default light chrome).
 *
 * This keeps logo selection maintainable: each preset already defines its header/
 * footer background, and the right logo follows from it with zero extra wiring.
 */

import { THEME_PRESETS, isThemePresetKey, type ThemePresetKey } from "@/design-system/theme/presets";
import { getDesignPreset } from "@/tenant/design-presets-gallery";
import type { TenantSettings } from "@/tenant/types";

/** Resolve the effective header/footer background colour for a tenant, or undefined. */
export function effectiveChromeBg(
  settings: TenantSettings | null | undefined,
  which: "header" | "footer",
): string | undefined {
  const ov = settings?.design?.tokenOverrides?.layout;
  const override = which === "header" ? ov?.headerBg : ov?.footerBg;
  if (override) return override;

  const key = settings?.design?.theme;
  if (key && isThemePresetKey(key)) {
    const cs = THEME_PRESETS[key]?.componentStyles;
    return which === "header" ? cs?.headerBg : cs?.footerBg;
  }
  return undefined;
}

/**
 * Returns true when a hex colour is visually dark (relative luminance < 0.5).
 * Non-hex values (transparent, rgba(), gradients) → not dark, so the default
 * (light-background) logo is used.
 */
export function isDarkHex(hex?: string | null): boolean {
  if (!hex) return false;
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

/** True when the given chrome surface (header/footer) should use the dark-bg logo. */
export function chromeIsDark(
  settings: TenantSettings | null | undefined,
  which: "header" | "footer",
): boolean {
  return isDarkHex(effectiveChromeBg(settings, which));
}

/**
 * The RESOLVED per-request theme, as far as chrome darkness is concerned.
 * Mirrors app/layout's promoted `contextualThemeKey` / `contextualPresetId`.
 */
export interface ResolvedChrome {
  /** Applied curated theme key (contextual), or null → base default is painted. */
  themeKey: ThemePresetKey | null;
  /** Applied gallery preset id (contextual), or null. */
  presetId: string | null;
}

/**
 * Effective header/footer background for THIS request, following the RESOLVED
 * theme (the same source the chrome is actually painted from) rather than the
 * static base. This makes the logo light/dark choice track theme personalisation.
 *
 * Fallback chain (per surface, independent):
 *   1. resolved gallery preset → its own layout override, then its baseTheme preset
 *      (a gallery preset REPLACES base tenant overrides when painted, so base is skipped)
 *   2. resolved curated theme → base tokenOverrides.layout (wins, applied last when
 *      painted), then the resolved preset's componentStyles
 *   3. no resolved theme → the base chain (effectiveChromeBg)
 */
export function resolvedChromeBg(
  settings: TenantSettings | null | undefined,
  which: "header" | "footer",
  resolved?: ResolvedChrome | null,
): string | undefined {
  if (resolved) {
    if (resolved.presetId) {
      const card = getDesignPreset(resolved.presetId);
      if (card) {
        const ov = which === "header"
          ? card.tokenOverrides?.layout?.headerBg
          : card.tokenOverrides?.layout?.footerBg;
        if (ov) return ov;
        if (isThemePresetKey(card.baseTheme)) {
          const cs = THEME_PRESETS[card.baseTheme].componentStyles;
          const v = which === "header" ? cs?.headerBg : cs?.footerBg;
          if (v) return v;
        }
      }
    } else if (resolved.themeKey) {
      // Base layout override wins (it is applied last when the theme is painted),
      // then the resolved curated preset's own chrome.
      const layoutOv = settings?.design?.tokenOverrides?.layout;
      const baseOverride = which === "header" ? layoutOv?.headerBg : layoutOv?.footerBg;
      if (baseOverride) return baseOverride;
      const cs = THEME_PRESETS[resolved.themeKey]?.componentStyles;
      const v = which === "header" ? cs?.headerBg : cs?.footerBg;
      if (v) return v;
    }
  }
  // No resolved theme (or it carried no chrome) → static base chain.
  return effectiveChromeBg(settings, which);
}

/**
 * True when the given chrome surface should use the dark-bg logo, following the
 * RESOLVED per-request theme. Falls back to the static base when `resolved` is absent.
 */
export function resolvedChromeIsDark(
  settings: TenantSettings | null | undefined,
  which: "header" | "footer",
  resolved?: ResolvedChrome | null,
): boolean {
  return isDarkHex(resolvedChromeBg(settings, which, resolved));
}
