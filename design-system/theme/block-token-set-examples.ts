/**
 * Example block token sets — ready to load in the admin editor for testing.
 *
 * These are worked-out, coherent sets that demonstrate the range of the curated
 * token surface: a dark inverse section, a bright highlight/accent band, a soft
 * muted card zone, and a bold brand-primary call-to-action block. Load them via
 * the "Load example sets" button in Design → Blocks, then assign a set to any
 * content block or adaptive slot by its `key`.
 *
 * They reference the tenant's own palette where possible (via surface roles) and
 * concrete colours where a specific look is intended, so they read sensibly on
 * top of most presets.
 */

import type { BlockTokenSet } from "./block-token-set";

export const EXAMPLE_BLOCK_TOKEN_SETS: BlockTokenSet[] = [
  {
    id:          "bts_example_dark",
    key:         "dark-section",
    name:        "Dark section",
    description: "Inverse, high-contrast band — light text on a near-black surface. Good for a bold statement or a break between light sections.",
    tokens: {
      surface:       "inverse",
      text:          "#f8fafc",
      textMuted:     "#94a3b8",
      primary:       "#38bdf8",
      primaryText:   "#0b1220",
      cardBg:        "#111827",
      cardBorder:    "#1f2937",
      cardRadius:    "16px",
      headingWeight: "700",
      dividerColor:  "#1f2937",
    },
  },
  {
    id:          "bts_example_highlight",
    key:         "highlight",
    name:        "Highlight band",
    description: "Warm, bright accent band to draw the eye — subtle amber background with strong primary accents.",
    tokens: {
      background:    "#fff7ed",
      text:          "#7c2d12",
      textMuted:     "#9a3412",
      primary:       "#ea580c",
      primaryText:   "#ffffff",
      cardBg:        "#ffffff",
      cardBorder:    "#fed7aa",
      cardRadius:    "12px",
      headingWeight: "800",
    },
  },
  {
    id:          "bts_example_soft",
    key:         "soft-cards",
    name:        "Soft cards",
    description: "Calm, low-contrast zone with rounded cards and gentle dividers. Nice for feature grids and FAQs.",
    tokens: {
      surface:      "subtle",
      text:         "#1f2937",
      textMuted:    "#6b7280",
      cardBg:       "#ffffff",
      cardBorder:   "#e5e7eb",
      cardRadius:   "20px",
      dividerColor: "#e5e7eb",
      dividerWidth: "1px",
    },
  },
  {
    id:          "bts_example_cta",
    key:         "brand-cta",
    name:        "Brand CTA",
    description: "Solid brand-primary block for a call-to-action — inverted text on the primary colour, tight radius.",
    tokens: {
      surface:       "strong",
      text:          "#ffffff",
      textMuted:     "rgba(255,255,255,0.8)",
      primaryText:   "#ffffff",
      cardBg:        "rgba(255,255,255,0.10)",
      cardBorder:    "rgba(255,255,255,0.25)",
      cardRadius:    "10px",
      headingWeight: "700",
    },
  },
];
