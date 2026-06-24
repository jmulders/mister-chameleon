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

import { THEME_PRESETS, isThemePresetKey } from "@/design-system/theme/presets";
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
