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

import type { BlockTokenSet, CuratedBlockTokens } from "./block-token-set";

/**
 * A rich, worked-out SITE-WIDE default token set — "Aurora Purple Gold".
 *
 * Premium purple + gold aesthetic (mirrors the aurora-purple-gold design preset):
 * soft purple-white surfaces, deep-violet text, violet primary with gold accents,
 * a dark aurora hero with a gold glow, and gold quote/divider highlights. Fills
 * ~50 of the curated fields so loading it gives a coherent, complete look you can
 * then tweak. Load via "Load example" in Design → Blocks → Site design tokens.
 */
export const EXAMPLE_SITE_DESIGN_TOKENS: CuratedBlockTokens = {
  // Surface & background
  background:        "#faf5ff",
  bgSubtle:          "#f3e8ff",

  // Text
  text:              "#2e1065",
  textMuted:         "#6d28d9",
  textSubtle:        "#7c5aa8",
  textInverse:       "#faf5ff",

  // Borders
  border:            "#e9d5ff",
  borderStrong:      "#d4af37",

  // Primary / accent
  primary:           "#7c3aed",
  primaryHover:      "#6d28d9",
  primaryActive:     "#5b21b6",
  primarySubtle:     "#f3e8ff",
  primaryText:       "#ffffff",
  textBrand:         "#7c3aed",
  ring:              "#7c3aed",

  // Buttons
  btnBg:             "#7c3aed",
  btnText:           "#ffffff",
  btnHoverBg:        "#6d28d9",
  btnActiveBg:       "#5b21b6",
  btnRadius:         "14px",
  btnFontWeight:     "600",
  btnShadow:         "0 8px 20px rgba(124,58,237,.28)",

  // Cards
  cardBg:            "#ffffff",
  cardBorder:        "#e9d5ff",
  cardRadius:        "18px",
  cardShadow:        "0 14px 36px rgba(124,58,237,.20)",
  cardQuote:         "#d4af37",

  // Radius
  radiusInteractive: "14px",
  radiusPopover:     "16px",

  // Typography
  headingFont:       "'Space Grotesk', system-ui, sans-serif",
  headingWeight:     "700",
  subheadingWeight:  "600",
  headingTracking:   "-0.02em",
  fontSans:          "'Inter', system-ui, sans-serif",
  fontSerif:         "'Playfair Display', Georgia, serif",

  // Hero — dark aurora with a gold glow
  heroBg:            "linear-gradient(180deg, #1a0533 0%, #4c1d95 52%, #7c3aed 100%)",
  heroTitleColor:    "#ffffff",
  heroSubtitleColor: "#e9d5ff",
  heroGlowColor:     "#d4af37",
  heroGlowOpacity:   "0.28",

  // Proof / testimonials
  proofBg:           "#faf5ff",
  proofCardBg:       "#ffffff",
  proofCardBorder:   "#e9d5ff",
  proofQuoteColor:   "#d4af37",

  // Feature grid — gold icon tiles for a premium accent
  featureGridBg:         "#f3e8ff",
  featureGridCardBg:     "#ffffff",
  featureGridCardBorder: "#e9d5ff",
  featureGridIconBg:     "#fdf3d7",

  // CTA — deep aurora gradient
  ctaBg:             "linear-gradient(135deg, #2e1065 0%, #7c3aed 120%)",
  ctaBodyText:       "#e9d5ff",

  // Dividers & motion
  dividerColor:      "#e9d5ff",
  dividerWidth:      "1px",
  transitionBase:    "200ms cubic-bezier(0.4, 0, 0.2, 1)",
};

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
