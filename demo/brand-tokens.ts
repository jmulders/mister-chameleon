/**
 * Brand-signals → curated block tokens (fallback for the on-brand demo).
 *
 * The full URL token extractor can come back empty on flaky / JS-rendered sites.
 * The site analyzer, however, already detects coarse brand signals (primary /
 * secondary / text / surface colours, heading & body fonts, corner radius).
 * This maps those to the curated per-block token schema so the synthetic demo
 * still renders in the prospect's colours/fonts even when full extraction fails.
 * The richer extractor output is merged ON TOP of this base by the caller.
 */

import type { BrandSignals } from "@/demo/types";

const RADIUS_PX: Record<NonNullable<BrandSignals["borderRadius"]>, string> = {
  none: "0",
  sm:   "6px",
  md:   "10px",
  lg:   "16px",
  full: "9999px",
};

/** Build a CuratedBlockTokens map from the analyzer's brand signals. */
export function blockTokensFromBrandSignals(
  bs: BrandSignals | null | undefined,
): Record<string, string> {
  const t: Record<string, string> = {};
  if (!bs) return t;
  const put = (k: string, v?: string | null) => { if (v && v.trim()) t[k] = v; };

  // Primary / accent
  put("primary",      bs.primaryColor);
  put("btnBg",        bs.primaryColor);
  put("textBrand",    bs.primaryColor);
  put("ring",         bs.primaryColor);
  put("primaryHover", bs.secondaryColor);
  put("primaryActive", bs.secondaryColor);
  put("ctaBg",        bs.primaryColor);
  put("heroGlowColor", bs.primaryColor);
  put("cardQuote",    bs.primaryColor);

  // Text & surface
  put("text",       bs.textColor);
  put("background", bs.surfaceColor);

  // Fonts
  if (bs.headingFont) put("headingFont", `"${bs.headingFont}", system-ui, sans-serif`);
  if (bs.bodyFont)    put("fontSans",    `"${bs.bodyFont}", system-ui, sans-serif`);

  // Radius
  if (bs.borderRadius) {
    const px = RADIUS_PX[bs.borderRadius];
    put("cardRadius",        px);
    put("radiusInteractive", px);
  }

  return t;
}
