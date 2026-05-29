/**
 * Block Style Profile
 *
 * A theme-aware styling layer that sits above raw CSS design tokens.
 * Where tokens control colour, font, and radius, the block style profile
 * controls the *visual character* of block layouts in two complementary
 * ways:
 *
 *   1. Concrete CSS values  — heading tracking, media framing, logo filter,
 *      divider widths, card padding, content gap.  Directly consumed by
 *      blocks via CSS custom properties.
 *
 *   2. Semantic dimensions  — headingTreatment, featureGridStyle,
 *      testimonialStyle, etc.  Translated into *derived* CSS vars by
 *      blockStyleProfileToVars().  Blocks consume these derived vars rather
 *      than inspecting the enum value.
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   1. Each TenantTheme may declare an optional `blockStyle: BlockStyleProfile`.
 *   2. `blockStyleProfileToVars()` converts the profile into [name, value] pairs
 *      that are included in `buildThemeVarsArray()` alongside colour tokens.
 *   3. These CSS custom properties (--block-*) are injected into :root at
 *      request time by the root layout, identical to colour token injection.
 *   4. Blocks consume the vars via inline `style` props — no per-block JS logic.
 *
 * ─── Concrete profile dimensions ──────────────────────────────────────────────
 *
 *   headingTracking   letter-spacing for section headings
 *   headingTransform  text-transform for section headings
 *   mediaRadius       border-radius of media wrappers
 *   mediaShadow       box-shadow of media wrappers
 *   mediaBorder       border shorthand of media wrappers
 *   mediaBg           background of media wrappers (framing / polaroid)
 *   mediaPadding      inner padding of media wrappers (framing)
 *   logoFilter        CSS filter() applied to logo images
 *   dividerWidth      border-top/bottom-width for section dividers
 *   dividerColor      border colour for section dividers
 *   cardPadding       internal padding for feature and proof cards
 *   contentGap        vertical gap between heading and content grid
 *
 * ─── Semantic profile dimensions ──────────────────────────────────────────────
 *
 *   sectionSurface    flat | carded | contrast
 *   textMediaStyle    balanced | editorial | immersive | showcase
 *   featureGridStyle  plain | cards | highlighted | premium
 *   testimonialStyle  quote | cards | editorial | premium
 *   logoStripStyle    quiet | ticker | brand-bar
 *   headingTreatment  clean | serif-display | bold-display | refined
 *   mediaTreatment    soft | sharp | framed | full-bleed
 *   density           compact | comfortable | airy
 *
 * ─── Derived CSS vars (from semantic dimensions) ──────────────────────────────
 *
 *   headingTreatment  → --block-heading-font-family, --block-heading-font-weight
 *   featureGridStyle  → --block-feature-card-bg, --block-feature-card-border,
 *                        --block-feature-card-shadow
 *   testimonialStyle  → --proof-card-bg, --proof-card-border, --proof-card-shadow
 *   sectionSurface    → --block-section-surface-bg, --block-section-surface-border,
 *                        --block-section-surface-radius
 *   density           → --block-density-section-gap, --block-density-item-gap
 *   logoStripStyle    → --block-logo-strip-style, --block-logo-strip-filter
 *   textMediaStyle    → --block-text-media-gap, --block-text-media-image-flex
 *   mediaTreatment    → --block-media-min-height
 */

// ── Profile type ───────────────────────────────────────────────────────────────

export interface BlockStyleProfile {
  // ── Concrete visual fields ──────────────────────────────────────────────────

  /**
   * letter-spacing applied to h2/h3/h4 headings across all blocks.
   *
   * Examples:
   *   "-0.04em"  → ultra-tight (luxury, dark contrast)
   *   "-0.025em" → standard tight (matching Tailwind tracking-tight)
   *   "-0.01em"  → slight negative (editorial)
   *   "0em"      → natural (neutral)
   *   "0.04em"   → wide / expressive (playful)
   */
  headingTracking: string;

  /**
   * text-transform for headings. "none" preserves mixed case; "uppercase"
   * adds editorial formality.
   */
  headingTransform: "none" | "uppercase";

  /**
   * border-radius CSS value for media wrappers (img / video containers).
   */
  mediaRadius: string;

  /** box-shadow for media wrappers. */
  mediaShadow: string;

  /**
   * border shorthand for media wrappers (e.g. "1px solid var(--card-border)").
   * "none" means no visible border.
   */
  mediaBorder: string;

  /**
   * Background of the media wrapper element. Use "transparent" for no framing,
   * "var(--card-bg)" to create a framed / polaroid look.
   */
  mediaBg: string;

  /**
   * Padding inside the media wrapper. Non-zero values create a framed inset.
   */
  mediaPadding: string;

  /**
   * CSS filter() expression applied to logo images in the logo strip.
   *
   * Examples:
   *   "none"                             → full-colour logos
   *   "grayscale(1) opacity(0.55)"       → muted editorial look
   *   "grayscale(0.7) opacity(0.65)"     → moderate desaturation (corporate)
   */
  logoFilter: string;

  /**
   * border-top-width / border-bottom-width for section dividers.
   * Set to "0px" to suppress; "1px" for a visible hairline.
   */
  dividerWidth: string;

  /** Border colour for section dividers. */
  dividerColor: string;

  /**
   * Padding inside feature grid and testimonial / proof cards.
   *
   * Examples: "1rem" → compact, "1.5rem" → comfortable, "2rem" → generous
   */
  cardPadding: string;

  /**
   * Gap between the section heading and the content grid below it.
   *
   * Examples: "2.5rem" → compact, "3rem" → comfortable, "4rem" → airy
   */
  contentGap: string;

  // ── Semantic layout dimensions ──────────────────────────────────────────────

  /**
   * The visual surface treatment applied to sections in this theme.
   *
   *   flat     — transparent background; content floats on the page background
   *   carded   — section rendered on a card surface with border and radius
   *   contrast — section uses the subtle-background token for tonal contrast
   */
  sectionSurface: "flat" | "carded" | "contrast";

  /**
   * How the text/media split block balances its two columns.
   *
   *   balanced   — roughly equal weight; standard editorial split
   *   editorial  — text-dominant; more vertical rhythm, wider text column
   *   immersive  — image-dominant; wider media column, less text weight
   *   showcase   — strongly image-dominant; media drives the composition
   */
  textMediaStyle: "balanced" | "editorial" | "immersive" | "showcase";

  /**
   * Visual character of cards in the feature grid block.
   *
   *   plain       — no card surface; content sits on the page background
   *   cards       — standard card with background, border, and subtle shadow
   *   highlighted — primary-subtle background, no border; accent feel
   *   premium     — card with elevated shadow and generous padding
   */
  featureGridStyle: "plain" | "cards" | "highlighted" | "premium";

  /**
   * Visual character of cards in the testimonial / proof block.
   *
   *   quote      — minimal; just the quote text and attribution, no container
   *   cards      — standard card with background and border
   *   editorial  — quote-style with generous spacing; editorial publication feel
   *   premium    — elevated card with shadow; upscale presentation
   */
  testimonialStyle: "quote" | "cards" | "editorial" | "premium";

  /**
   * Logo strip presentation mode.
   *
   *   quiet      — muted/grayscale logos in a static or slow-scrolling row
   *   ticker     — animated marquee; energetic horizontal scroll
   *   brand-bar  — full-colour logos; brand presence prominently shown
   */
  logoStripStyle: "quiet" | "ticker" | "brand-bar";

  /**
   * Heading typography treatment across blocks.
   *
   *   clean         — theme's heading font at standard weight (clean sans)
   *   serif-display — serif fallback stack at 700 weight (editorial feel)
   *   bold-display  — theme's heading font at 800 weight (impact marketing)
   *   refined       — serif fallback stack at 300 weight (premium luxury)
   */
  headingTreatment: "clean" | "serif-display" | "bold-display" | "refined";

  /**
   * Media element treatment.
   *
   *   soft       — rounded radius, optional subtle shadow
   *   sharp      — minimal or zero radius, flat
   *   framed     — border + background creates a polaroid / mat frame effect
   *   full-bleed — enforced minimum height; media dominates vertically
   */
  mediaTreatment: "soft" | "sharp" | "framed" | "full-bleed";

  /**
   * Overall visual density (spacing rhythm) of the page.
   *
   *   compact     — tighter section gaps (3rem); efficiency-first layouts
   *   comfortable — standard spacing (4.5rem); balanced professional rhythm
   *   airy        — generous spacing (6rem); premium, breathing layouts
   */
  density: "compact" | "comfortable" | "airy";
}

// ── CSS var derivation helpers ─────────────────────────────────────────────────

/** Derived CSS vars from headingTreatment. */
const HEADING_FONT_FAMILY: Record<BlockStyleProfile["headingTreatment"], string> = {
  "clean":         "var(--font-heading)",
  "serif-display": "Georgia, 'Playfair Display', 'Times New Roman', serif",
  "bold-display":  "var(--font-heading)",
  "refined":       "Georgia, 'Cormorant Garamond', 'Times New Roman', serif",
};

const HEADING_FONT_WEIGHT: Record<BlockStyleProfile["headingTreatment"], string> = {
  "clean":         "var(--font-heading-weight)",
  "serif-display": "700",
  "bold-display":  "800",
  "refined":       "300",
};

/** Derived CSS vars from featureGridStyle. */
const FEATURE_CARD_BG: Record<BlockStyleProfile["featureGridStyle"], string> = {
  "plain":       "transparent",
  "cards":       "var(--card-bg)",
  "highlighted": "var(--primary-subtle)",
  "premium":     "var(--card-bg)",
};

const FEATURE_CARD_BORDER: Record<BlockStyleProfile["featureGridStyle"], string> = {
  "plain":       "none",
  "cards":       "1px solid var(--border)",
  "highlighted": "none",
  "premium":     "none",
};

const FEATURE_CARD_SHADOW: Record<BlockStyleProfile["featureGridStyle"], string> = {
  "plain":       "none",
  "cards":       "0 1px 4px rgba(0,0,0,0.06)",
  "highlighted": "none",
  "premium":     "0 8px 32px rgba(0,0,0,0.10)",
};

/** Derived CSS vars from testimonialStyle (overrides globals.css defaults). */
const PROOF_CARD_BG: Record<BlockStyleProfile["testimonialStyle"], string> = {
  "quote":     "transparent",
  "cards":     "var(--card-bg)",
  "editorial": "transparent",
  "premium":   "var(--card-bg)",
};

const PROOF_CARD_BORDER: Record<BlockStyleProfile["testimonialStyle"], string> = {
  "quote":     "transparent",
  "cards":     "var(--border)",
  "editorial": "transparent",
  "premium":   "transparent",
};

const PROOF_CARD_SHADOW: Record<BlockStyleProfile["testimonialStyle"], string> = {
  "quote":     "none",
  "cards":     "0 1px 4px rgba(0,0,0,0.06)",
  "editorial": "none",
  "premium":   "0 8px 32px rgba(0,0,0,0.10)",
};

/** Derived CSS vars from sectionSurface. */
const SECTION_SURFACE_BG: Record<BlockStyleProfile["sectionSurface"], string> = {
  "flat":     "transparent",
  "carded":   "var(--card-bg)",
  "contrast": "var(--bg-subtle)",
};

const SECTION_SURFACE_BORDER: Record<BlockStyleProfile["sectionSurface"], string> = {
  "flat":     "none",
  "carded":   "1px solid var(--border)",
  "contrast": "none",
};

const SECTION_SURFACE_RADIUS: Record<BlockStyleProfile["sectionSurface"], string> = {
  "flat":     "0px",
  "carded":   "var(--card-radius)",
  "contrast": "0px",
};

/** Derived CSS vars from density. */
const DENSITY_SECTION_GAP: Record<BlockStyleProfile["density"], string> = {
  "compact":     "3rem",
  "comfortable": "4.5rem",
  "airy":        "6rem",
};

const DENSITY_ITEM_GAP: Record<BlockStyleProfile["density"], string> = {
  "compact":     "1.25rem",
  "comfortable": "1.75rem",
  "airy":        "2.5rem",
};

/** Derived CSS vars from textMediaStyle. */
const TEXT_MEDIA_GAP: Record<BlockStyleProfile["textMediaStyle"], string> = {
  "balanced":  "3rem",
  "editorial": "4rem",
  "immersive": "2rem",
  "showcase":  "1.5rem",
};

const TEXT_MEDIA_IMAGE_FLEX: Record<BlockStyleProfile["textMediaStyle"], string> = {
  "balanced":  "1",
  "editorial": "0.7",
  "immersive": "1.3",
  "showcase":  "1.6",
};

/** Derived CSS vars from mediaTreatment. */
const MEDIA_MIN_HEIGHT: Record<BlockStyleProfile["mediaTreatment"], string> = {
  "soft":       "auto",
  "sharp":      "auto",
  "framed":     "auto",
  "full-bleed": "clamp(280px, 45vw, 560px)",
};

// ── Default profile ────────────────────────────────────────────────────────────
//
// Matches the marketing-default personality: standard SaaS / marketing feel.

export const DEFAULT_BLOCK_STYLE_PROFILE: BlockStyleProfile = {
  // Concrete
  headingTracking:  "-0.025em",
  headingTransform: "none",
  mediaRadius:      "var(--card-radius)",
  mediaShadow:      "none",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.6) opacity(0.7)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  // Semantic
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

// ── Named preset profiles ──────────────────────────────────────────────────────

/** Dark Contrast — austere, precision-first, maximum contrast. */
export const DARK_CONTRAST_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.04em",
  headingTransform: "none",
  mediaRadius:      "0px",
  mediaShadow:      "none",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(1) opacity(0.6)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "1rem",
  contentGap:       "2.5rem",
  sectionSurface:   "flat",
  textMediaStyle:   "immersive",
  featureGridStyle: "plain",
  testimonialStyle: "editorial",
  logoStripStyle:   "quiet",
  headingTreatment: "bold-display",
  mediaTreatment:   "sharp",
  density:          "compact",
};

/** Editorial Classic — warm editorial, magazine character. */
export const EDITORIAL_CLASSIC_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.01em",
  headingTransform: "none",
  mediaRadius:      "0.375rem",
  mediaShadow:      "none",
  mediaBorder:      "1px solid var(--card-border)",
  mediaBg:          "var(--card-bg)",
  mediaPadding:     "0.75rem",
  logoFilter:       "grayscale(1) opacity(0.45)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "flat",
  textMediaStyle:   "editorial",
  featureGridStyle: "plain",
  testimonialStyle: "quote",
  logoStripStyle:   "quiet",
  headingTreatment: "serif-display",
  mediaTreatment:   "framed",
  density:          "airy",
};

/** Premium Editorial — cinematic depth, airy spacing. */
export const PREMIUM_EDITORIAL_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.03em",
  headingTransform: "none",
  mediaRadius:      "0.5rem",
  mediaShadow:      "0 8px 40px rgba(0,0,0,0.14)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.8) opacity(0.55)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",
  contentGap:       "4rem",
  sectionSurface:   "flat",
  textMediaStyle:   "editorial",
  featureGridStyle: "premium",
  testimonialStyle: "premium",
  logoStripStyle:   "quiet",
  headingTreatment: "serif-display",
  mediaTreatment:   "framed",
  density:          "airy",
};

/** Playful Startup — energetic, round, expressive. */
export const PLAYFUL_STARTUP_PROFILE: BlockStyleProfile = {
  headingTracking:  "0.01em",
  headingTransform: "none",
  mediaRadius:      "1.5rem",
  mediaShadow:      "0 4px 24px rgba(0,0,0,0.10)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "none",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "brand-bar",
  headingTreatment: "bold-display",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Corporate Blue — structured, credible, professional. */
export const CORPORATE_BLUE_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",
  headingTransform: "none",
  mediaRadius:      "0.5rem",
  mediaShadow:      "0 4px 16px rgba(0,0,0,0.09)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.7) opacity(0.65)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "carded",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Modern SaaS — clean, airy, product-led. */
export const MODERN_SAAS_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.03em",
  headingTransform: "none",
  mediaRadius:      "0.75rem",
  mediaShadow:      "0 8px 32px rgba(91, 106, 249, 0.10)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.4) opacity(0.75)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",
  contentGap:       "4rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "airy",
};

/** Modern Green — fresh, open, natural. */
export const MODERN_GREEN_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",
  headingTransform: "none",
  mediaRadius:      "0.75rem",
  mediaShadow:      "0 4px 20px rgba(0,0,0,0.09)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.4) opacity(0.75)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3.5rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Minimal Neutral — zero ornament, geometric, stark. */
export const MINIMAL_NEUTRAL_PROFILE: BlockStyleProfile = {
  headingTracking:  "0em",
  headingTransform: "none",
  mediaRadius:      "0.25rem",
  mediaShadow:      "none",
  mediaBorder:      "1px solid var(--card-border)",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(1) opacity(0.5)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "plain",
  testimonialStyle: "quote",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "sharp",
  density:          "comfortable",
};

/** Bold Dark — cinematic, deep, high-energy. */
export const BOLD_DARK_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.035em",
  headingTransform: "none",
  mediaRadius:      "0.75rem",
  mediaShadow:      "0 8px 32px rgba(0,0,0,0.30)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(1) opacity(0.55)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "flat",
  textMediaStyle:   "immersive",
  featureGridStyle: "highlighted",
  testimonialStyle: "editorial",
  logoStripStyle:   "quiet",
  headingTreatment: "bold-display",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Tech Indigo — developer-precise, near-sharp, compact. */
export const TECH_INDIGO_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",
  headingTransform: "none",
  mediaRadius:      "0.5rem",
  mediaShadow:      "0 4px 16px rgba(99,102,241,0.10)",
  mediaBorder:      "1px solid var(--card-border)",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.5) opacity(0.70)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "2.5rem",
  sectionSurface:   "carded",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "framed",
  density:          "compact",
};

/** Warm Professional — gentle, welcoming, human. */
export const WARM_PROFESSIONAL_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.015em",
  headingTransform: "none",
  mediaRadius:      "0.875rem",
  mediaShadow:      "0 4px 20px rgba(217,119,6,0.10)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.3) opacity(0.80)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.75rem",
  contentGap:       "3.5rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Recruitment Energy — accessible, employer-brand-forward, active. */
export const RECRUITMENT_ENERGY_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.01em",
  headingTransform: "none",
  mediaRadius:      "0.75rem",
  mediaShadow:      "0 4px 16px rgba(0,0,0,0.08)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "none",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "contrast",
  textMediaStyle:   "balanced",
  featureGridStyle: "highlighted",
  testimonialStyle: "cards",
  logoStripStyle:   "brand-bar",
  headingTreatment: "bold-display",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Healthcare Calm — airy, spacious, soft, reassuring. */
export const HEALTHCARE_CALM_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.015em",
  headingTransform: "none",
  mediaRadius:      "1rem",
  mediaShadow:      "0 2px 12px rgba(0,0,0,0.06)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.3) opacity(0.75)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",
  contentGap:       "4rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "editorial",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "airy",
};

/** Industrial Strong — uppercase headings, zero rounding, structural. */
export const INDUSTRIAL_STRONG_PROFILE: BlockStyleProfile = {
  headingTracking:  "0.06em",
  headingTransform: "uppercase",
  mediaRadius:      "0px",
  mediaShadow:      "none",
  mediaBorder:      "2px solid var(--card-border)",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.8) opacity(0.60)",
  dividerWidth:     "2px",
  dividerColor:     "var(--border-strong)",
  cardPadding:      "1.5rem",
  contentGap:       "2.5rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "sharp",
  density:          "compact",
};

/** Startup Energy — velocity-forward, brand-vivid, no dividers. */
export const STARTUP_ENERGY_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.025em",
  headingTransform: "none",
  mediaRadius:      "1rem",
  mediaShadow:      "0 6px 24px rgba(0,0,0,0.12)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "none",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3.5rem",
  sectionSurface:   "contrast",
  textMediaStyle:   "immersive",
  featureGridStyle: "highlighted",
  testimonialStyle: "cards",
  logoStripStyle:   "brand-bar",
  headingTreatment: "bold-display",
  mediaTreatment:   "soft",
  density:          "comfortable",
};

/** Corporate Trust — conservative, structured, reliable. */
export const CORPORATE_TRUST_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",
  headingTransform: "none",
  mediaRadius:      "0.5rem",
  mediaShadow:      "0 4px 16px rgba(0,0,0,0.09)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.6) opacity(0.68)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "carded",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "framed",
  density:          "comfortable",
};

// ── Signature family profiles ──────────────────────────────────────────────────

/**
 * Portfolio Showcase
 *
 *   Media-forward, grid-heavy, strong case presentation.
 *   Full-bleed media, wide image flex, airy spacing.
 *   Designed for agencies and case-driven creative businesses.
 *
 *   sectionSurface:   flat   — content floats; let media breathe
 *   textMediaStyle:   showcase — strongly media-dominant
 *   featureGridStyle: highlighted — accented grid without heavy cards
 *   testimonialStyle: editorial — quote-led, generous spacing
 *   headingTreatment: clean — strong sans, theme weight
 *   mediaTreatment:   full-bleed — enforced minimum height, immersive
 *   density:          airy — spacious, visual-first rhythm
 */
export const PORTFOLIO_SHOWCASE_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.03em",
  headingTransform: "none",
  mediaRadius:      "0.75rem",
  mediaShadow:      "0 12px 40px rgba(0,0,0,0.14)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.2) opacity(0.85)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",
  contentGap:       "4rem",
  sectionSurface:   "flat",
  textMediaStyle:   "showcase",
  featureGridStyle: "highlighted",
  testimonialStyle: "editorial",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "full-bleed",
  density:          "airy",
};

/**
 * Premium Luxury
 *
 *   Elegant spacing, refined serif typography, premium card surfaces.
 *   Soft surfaces, restrained CTA treatment, upscale visual rhythm.
 *   Designed for high-end brands, boutique consultancy, and design/interior.
 *
 *   sectionSurface:   carded  — card surfaces add material elegance
 *   textMediaStyle:   immersive — image carries weight; text is supportive
 *   featureGridStyle: premium — elevated shadow, generous card padding
 *   testimonialStyle: premium — upscale card presentation
 *   headingTreatment: refined — light-weight serif; restrained luxury
 *   mediaTreatment:   framed  — careful material frame treatment
 *   density:          airy    — generous whitespace; nothing is rushed
 */
export const PREMIUM_LUXURY_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",
  headingTransform: "none",
  mediaRadius:      "0.5rem",
  mediaShadow:      "0 8px 48px rgba(0,0,0,0.12)",
  mediaBorder:      "1px solid var(--card-border)",
  mediaBg:          "var(--card-bg)",
  mediaPadding:     "0.5rem",
  logoFilter:       "grayscale(0.6) opacity(0.65)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "2.5rem",
  contentGap:       "5rem",
  sectionSurface:   "carded",
  textMediaStyle:   "immersive",
  featureGridStyle: "premium",
  testimonialStyle: "premium",
  logoStripStyle:   "quiet",
  headingTreatment: "refined",
  mediaTreatment:   "framed",
  density:          "airy",
};

// ── Valentine Pink ─────────────────────────────────────────────────────────────
//
//   Soft romantic personality for Valentine's Day seasonal campaigns.
//   Rose-pink palette, rounded media, editorial-style testimonials, airy density.
//   Designed to feel warm and heartfelt without being garish.
//
//   sectionSurface:   flat       — light rose tones; background carries colour
//   featureGridStyle: cards      — clean cards on rose-50 surface
//   testimonialStyle: editorial  — quote-style; warm generous spacing
//   headingTreatment: clean      — sans-serif stays approachable, not overly serif
//   mediaTreatment:   soft       — rounded corners; gentle energy
//   density:          airy       — generous spacing; romantic rhythm

export const VALENTINE_PINK_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.015em",
  headingTransform: "none",
  mediaRadius:      "1rem",
  mediaShadow:      "0 4px 20px rgba(190,24,93,0.10)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.2) opacity(0.75)",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",
  contentGap:       "4rem",
  sectionSurface:   "flat",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "editorial",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "soft",
  density:          "airy",
};

// ── Dutch Orange ───────────────────────────────────────────────────────────────
//
//   Bold national personality for Dutch themed campaigns (King's Day, sports).
//   Deep orange palette, full-colour logos, brand-bar logo strip, energetic.
//   Structured and confident — the orange is primary; everything else supports it.
//
//   sectionSurface:   contrast   — orange-tinted subtle sections; bold feel
//   featureGridStyle: highlighted — primary-subtle background; no cards needed
//   testimonialStyle: cards      — clean card frames; structured presentation
//   headingTreatment: bold-display — max weight headings; national energy
//   mediaTreatment:   sharp      — minimal radius; direct, no-nonsense
//   density:          comfortable — confident but not compressed

export const DUTCH_ORANGE_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",
  headingTransform: "none",
  mediaRadius:      "0.25rem",
  mediaShadow:      "none",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "none",
  // Dutch flag red (#AE1C28) as section divider — subtle tricolour identity
  // without painting large blocks; 2px stripe reads as a national accent.
  dividerWidth:     "2px",
  dividerColor:     "#AE1C28",
  cardPadding:      "1.5rem",
  contentGap:       "3.5rem",
  sectionSurface:   "contrast",
  textMediaStyle:   "balanced",
  featureGridStyle: "highlighted",
  testimonialStyle: "cards",
  logoStripStyle:   "brand-bar",
  headingTreatment: "bold-display",
  mediaTreatment:   "sharp",
  density:          "comfortable",
};

// ── Corporate Clean ────────────────────────────────────────────────────────────
//
//   Slate-neutral corporate theme — clean, whitespace-driven structure.
//   Visible hairline dividers, conservative framed media, quiet logo treatment.
//   Distinct from Corporate Blue (navy hero, sharp radius) and Corporate Trust
//   (DM Sans, blue-600 primary): slate-700 primary, balanced radius, no blue.
//
//   sectionSurface:   carded      — clean card panels; structured authority
//   featureGridStyle: cards       — white cards with border; clear grid
//   testimonialStyle: cards       — consistent framing across block types
//   headingTreatment: clean       — tight-not-tight tracking, natural case
//   mediaTreatment:   framed      — 1px-border framing instead of shadow
//   density:          comfortable — ordered, not cramped

export const CORPORATE_CLEAN_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.015em",
  headingTransform: "none",
  mediaRadius:      "0.375rem",
  mediaShadow:      "0 2px 12px rgba(15,23,42,0.07)",
  mediaBorder:      "1px solid var(--border)",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.4) opacity(0.65)",
  dividerWidth:     "1px",
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",
  contentGap:       "3rem",
  sectionSurface:   "carded",
  textMediaStyle:   "balanced",
  featureGridStyle: "cards",
  testimonialStyle: "cards",
  logoStripStyle:   "quiet",
  headingTreatment: "clean",
  mediaTreatment:   "framed",
  density:          "comfortable",
};

// ── Bold Marketing ─────────────────────────────────────────────────────────────
//
//   High-energy marketing theme for consumer products and campaign landing pages.
//   Vivid fuchsia-pink primary, full-colour logos (brand-bar), no dividers,
//   maximum heading weight, very airy spacing.  Contrast: startup-energy is
//   rose-red on a dark hero; bold-marketing is hot-pink on white with deep
//   indigo hero — colour family and surface treatment are both distinct.
//
//   sectionSurface:   contrast    — pink-tinted subtle sections; brand-vivid
//   featureGridStyle: highlighted — primary-subtle card bg; no card chrome
//   testimonialStyle: cards       — clean frames for social proof
//   headingTreatment: bold-display — 900-weight, ultra-tight tracking
//   mediaTreatment:   soft        — generous radius + pink-tinted shadow
//   density:          airy        — maximum whitespace; impact over density

export const BOLD_MARKETING_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.03em",
  headingTransform: "none",
  mediaRadius:      "1.25rem",
  mediaShadow:      "0 8px 32px rgba(219,39,119,0.10)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "none",
  dividerWidth:     "0px",
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",
  contentGap:       "4.5rem",
  sectionSurface:   "contrast",
  textMediaStyle:   "balanced",
  featureGridStyle: "highlighted",
  testimonialStyle: "cards",
  logoStripStyle:   "brand-bar",
  headingTreatment: "bold-display",
  mediaTreatment:   "soft",
  density:          "airy",
};

// ── Careers Human ─────────────────────────────────────────────────────────────
//
//   Human, calm, and spacious — the anti-marketing recruitment theme.
//   No conversion pressure, no heavy heading weight, no loud dividers.
//   Designed for candidate journeys: trust first, then action.
//
//   Philosophy:
//     — The candidate is evaluating the employer, not being sold a product.
//       Everything should say "we're honest, stable, and good to work with."
//     — More whitespace = less pressure = better employer impression.
//     — Soft framed media (team photos, office shots) > slick product shots.
//
//   sectionSurface:   flat        — clean, no card chrome; content breathes
//   featureGridStyle: cards       — gentle bordered cards; structured but friendly
//   testimonialStyle: editorial   — quote-style testimonials; personal, not "social proof"
//   headingTreatment: clean       — measured tracking, natural case, not bold-display
//   mediaTreatment:   soft        — rounded corners on team photos; warm, human
//   density:          airy        — maximum whitespace; calm rhythm

export const CAREERS_HUMAN_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.01em",     // slight negative — professional but not tight
  headingTransform: "none",
  mediaRadius:      "0.75rem",     // softer than corporate, less than pill
  mediaShadow:      "0 2px 16px rgba(0,0,0,0.06)",
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.3) opacity(0.70)",  // lightly muted — not loud
  dividerWidth:     "0px",         // no structural dividers — sections breathe freely
  dividerColor:     "var(--border)",
  cardPadding:      "2rem",        // generous card padding — no crowding
  contentGap:       "4rem",        // airy gap between heading and content
  sectionSurface:   "flat",        // transparent; background tones carry colour
  textMediaStyle:   "balanced",    // equal weight text/media — team-photo-friendly
  featureGridStyle: "cards",       // gentle bordered cards; no shadow drama
  testimonialStyle: "editorial",   // personal quote style; no card chrome
  logoStripStyle:   "quiet",       // muted logos — authenticity over brand-bar energy
  headingTreatment: "clean",       // natural weight, not bold-display
  mediaTreatment:   "soft",        // rounded media; warm, human
  density:          "airy",        // maximum whitespace = maximum calm
};

// ── Structured SaaS ───────────────────────────────────────────────────────────
//
//   Editorial-product theme — structured grids, visible hairline dividers,
//   flat/bordered cards, tight-but-not-compressed vertical rhythm.
//   The palette is warm amber on near-white: distinct from sky-blue (clean-
//   corporate) and indigo-dark (dark-ai). Optimised for product docs, pricing,
//   integrations, help center, changelog, and content-rich blog content.
//
//   Philosophy:
//     — Structure is the design: dividers, borders, and alignment carry the page.
//     — No elevation drama (no shadow lift, no glow) — content is the hero.
//     — Information-dense but readable: compact section gaps, generous card pads.
//     — Media is framed with a 1px border, no shadow — editorial restraint.
//
//   sectionSurface:   contrast   — alternating sections use bgSubtle; no cards
//   featureGridStyle: cards      — bordered cards with visible 1px border
//   testimonialStyle: cards      — consistent framing; professional social proof
//   headingTreatment: clean      — Plus Jakarta Sans bold; strong but not loud
//   mediaTreatment:   sharp      — 0px radius; structured, no softness
//   density:          compact    — tight section gaps; information-forward

export const STRUCTURED_SAAS_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.025em",    // editorial SaaS precision — not as tight as AI
  headingTransform: "none",
  mediaRadius:      "0.25rem",     // nearly sharp — structured, minimal softening
  mediaShadow:      "none",        // no shadow drama — structure comes from borders
  mediaBorder:      "1px solid var(--border)",  // framed media — editorial treatment
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.55) opacity(0.65)", // muted editorial treatment
  dividerWidth:     "1px",         // visible hairline dividers — structure is explicit
  dividerColor:     "var(--border)",
  cardPadding:      "1.5rem",      // comfortable but not generous — information-dense
  contentGap:       "2.5rem",      // compact gap — sections sit close to their content
  sectionSurface:   "contrast",    // bgSubtle alternation — no carding needed
  textMediaStyle:   "balanced",    // equal weight text/media — product screenshot-friendly
  featureGridStyle: "cards",       // bordered cards — explicit structure, no elevation
  testimonialStyle: "cards",       // clean bordered cards — consistent framing
  logoStripStyle:   "quiet",       // muted logo strip — editorial restraint
  headingTreatment: "clean",       // strong sans-serif; no serif display
  mediaTreatment:   "sharp",       // sharp edges — structured, precise, no gimmicks
  density:          "compact",     // tightest rhythm — product sites are dense by nature
};

/** Dark AI — near-black surface, tight tracking, no dividers, airy precision. */
export const DARK_AI_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.035em",    // tight — premium, AI-forward precision
  headingTransform: "none",
  mediaRadius:      "0.5rem",      // low radius — sharp, purposeful
  mediaShadow:      "0 0 32px rgba(124, 106, 248, 0.12)", // subtle violet glow
  mediaBorder:      "1px solid rgba(255,255,255,0.06)",   // barely visible border
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(1) opacity(0.45)",  // fully desaturated — elegant restraint
  dividerWidth:     "0px",         // no dividers — space carries structure
  dividerColor:     "transparent",
  cardPadding:      "2rem",        // generous — no crowding in dark spaces
  contentGap:       "5rem",        // extra airy — dark surfaces need more breathing room
  sectionSurface:   "flat",        // no card chrome — sections read as infinite planes
  textMediaStyle:   "immersive",   // media fills the frame — cinematic treatment
  featureGridStyle: "plain",       // no card borders on dark bg — clean separation by colour
  testimonialStyle: "editorial",   // typographic quote treatment — no chrome
  logoStripStyle:   "quiet",       // muted, ghost logos on dark
  headingTreatment: "bold-display",// tight + heavy — signature AI-aesthetic
  mediaTreatment:   "sharp",       // sharp edges — precise, tech-forward
  density:          "airy",        // maximum whitespace — dark needs air
};

/** Clean Corporate — crisp white surface, structured, modern SaaS. */
export const CLEAN_CORPORATE_PROFILE: BlockStyleProfile = {
  headingTracking:  "-0.02em",     // gentle negative — modern, readable
  headingTransform: "none",
  mediaRadius:      "0.75rem",     // balanced — professional without feeling playful
  mediaShadow:      "0 4px 24px rgba(0,0,0,0.07)", // very subtle lift
  mediaBorder:      "none",
  mediaBg:          "transparent",
  mediaPadding:     "0px",
  logoFilter:       "grayscale(0.25) opacity(0.72)", // lightly muted — credible, clean
  dividerWidth:     "0px",         // no structural dividers — sections breathe freely
  dividerColor:     "transparent",
  cardPadding:      "1.75rem",     // comfortable — not too tight, not too loose
  contentGap:       "4rem",        // airy gap between heading and content grid
  sectionSurface:   "flat",        // clean flat surfaces — alternating bg handles rhythm
  textMediaStyle:   "balanced",    // equal weight — screenshot/UI-friendly
  featureGridStyle: "cards",       // subtle shadow cards — credibility + lift
  testimonialStyle: "cards",       // clean bordered cards — professional social proof
  logoStripStyle:   "quiet",       // muted logos — let clients speak, not their brand
  headingTreatment: "clean",       // semi-bold, geometric — modern SaaS standard
  mediaTreatment:   "soft",        // rounded, shadow-lifted — approachable precision
  density:          "airy",        // generous whitespace — premium, not cramped
};

// ── CSS var emitter ────────────────────────────────────────────────────────────

/**
 * Converts a BlockStyleProfile into flat [cssVarName, value] pairs.
 *
 * These are included in buildThemeVarsArray() so they are injected into :root
 * alongside the colour and typography vars — no separate injection step needed.
 *
 * Two layers of vars are emitted:
 *   1. Direct field → var mappings (--block-heading-tracking, etc.)
 *   2. Derived vars from semantic dimensions (--block-feature-card-bg, etc.)
 */
export function blockStyleProfileToVars(
  profile: BlockStyleProfile,
): [string, string][] {
  return [
    // ── Concrete field vars ───────────────────────────────────────────────────

    // Heading treatment (concrete values)
    ["--block-heading-tracking",   profile.headingTracking],
    ["--block-heading-transform",  profile.headingTransform],

    // Media framing (concrete values)
    ["--block-media-radius",       profile.mediaRadius],
    ["--block-media-shadow",       profile.mediaShadow],
    ["--block-media-border",       profile.mediaBorder],
    ["--block-media-bg",           profile.mediaBg],
    ["--block-media-padding",      profile.mediaPadding],

    // Logo presentation (concrete value)
    ["--block-logo-filter",        profile.logoFilter],

    // Section dividers (concrete values)
    ["--block-divider-width",      profile.dividerWidth],
    ["--block-divider-color",      profile.dividerColor],

    // Density / spacing (concrete values)
    ["--block-card-padding",       profile.cardPadding],
    ["--block-content-gap",        profile.contentGap],

    // ── Derived vars from semantic dimensions ─────────────────────────────────

    // headingTreatment → font family + weight overrides
    ["--block-heading-font-family", HEADING_FONT_FAMILY[profile.headingTreatment]],
    ["--block-heading-font-weight", HEADING_FONT_WEIGHT[profile.headingTreatment]],

    // featureGridStyle → card surface vars
    ["--block-feature-card-bg",     FEATURE_CARD_BG[profile.featureGridStyle]],
    ["--block-feature-card-border", FEATURE_CARD_BORDER[profile.featureGridStyle]],
    ["--block-feature-card-shadow", FEATURE_CARD_SHADOW[profile.featureGridStyle]],

    // testimonialStyle → proof card surface vars (overrides globals.css defaults)
    ["--proof-card-bg",             PROOF_CARD_BG[profile.testimonialStyle]],
    ["--proof-card-border",         PROOF_CARD_BORDER[profile.testimonialStyle]],
    ["--proof-card-shadow",         PROOF_CARD_SHADOW[profile.testimonialStyle]],

    // sectionSurface → section wrapper surface vars
    ["--block-section-surface-bg",     SECTION_SURFACE_BG[profile.sectionSurface]],
    ["--block-section-surface-border", SECTION_SURFACE_BORDER[profile.sectionSurface]],
    ["--block-section-surface-radius", SECTION_SURFACE_RADIUS[profile.sectionSurface]],

    // density → spacing rhythm vars
    ["--block-density-section-gap", DENSITY_SECTION_GAP[profile.density]],
    ["--block-density-item-gap",    DENSITY_ITEM_GAP[profile.density]],

    // logoStripStyle → logo strip mode + filter override
    ["--block-logo-strip-style",  profile.logoStripStyle],
    ["--block-logo-strip-filter",
      profile.logoStripStyle === "brand-bar" ? "none" : profile.logoFilter],

    // textMediaStyle → text/media balance vars
    ["--block-text-media-gap",         TEXT_MEDIA_GAP[profile.textMediaStyle]],
    ["--block-text-media-image-flex",  TEXT_MEDIA_IMAGE_FLEX[profile.textMediaStyle]],

    // mediaTreatment → min-height for full-bleed
    ["--block-media-min-height",   MEDIA_MIN_HEIGHT[profile.mediaTreatment]],
  ];
}
