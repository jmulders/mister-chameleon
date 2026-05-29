/**
 * Theme Family Typography Configuration
 *
 * Single source of truth for the five flagship theme families.
 *
 * ─── Architecture ────────────────────────────────────────────────────────────
 *
 *   Theme Family  → structure, typography style, block behaviour
 *   Theme Preset  → colours / branding / accents
 *
 *   finalDesign = familyDefaults + presetDefaults + overrides
 *
 *   Fonts belong to the family layer. Presets that belong to one of these five
 *   families set `featuredFamilyKey` on their `TenantTheme` object.
 *   `buildThemeVarsArray` in tenant-theme.ts reads that key and appends the
 *   family typography vars *after* the preset-level typography vars, so the
 *   family always wins the cascade.
 *
 * ─── CSS variables emitted ────────────────────────────────────────────────────
 *
 *   Typography
 *     --font-heading             heading font-family stack
 *     --font-body                body font-family stack (alias for --font-sans)
 *     --font-sans                body font-family stack (standard token name)
 *     --font-serif               accent / secondary font (when accentFont is set)
 *     --font-heading-weight      heading font-weight
 *     --font-subheading-weight   sub-heading font-weight (derived)
 *     --font-body-weight         body font-weight
 *     --font-line-height         base body line-height
 *   Scale
 *     --font-size-h1  ..h3       fluid heading sizes (clamp-based)
 *     --font-size-body           base body size
 *     --font-size-small          small / caption size
 *   Block profile override
 *     --block-heading-tracking   letter-spacing for headings
 *   Structural
 *     --btn-radius               derived from buttonStyle
 *     --btn-font-weight          button label font-weight
 *     --btn-text-transform       button label text-transform
 *     --card-radius              card/panel border-radius
 *     --block-heading-transform  heading text-transform
 *     --family-hero-variant      preferred hero layout variant
 *     --family-button-style      semantic button shape ("sharp" | "rounded" | "pill")
 *     --family-card-style        semantic card treatment ("flat" | "bordered" | "elevated")
 *     --family-header-variant    header component variant ("minimal" | "flyout" | "mega")
 *     --family-header-style      header background mode
 *     --family-nav-variant       desktop nav dropdown pattern
 *     --family-nav-density       nav link padding density
 *     --family-nav-emphasis      nav link presentation style
 *     --family-footer-variant    footer section structure
 *     --family-footer-density    footer padding density
 *
 * ─── How to add a new family ─────────────────────────────────────────────────
 *
 *   1. Add a new entry to FeaturedFamilyKey.
 *   2. Add a fontScaleProfile entry if you need a new scale personality.
 *   3. Add the ThemeFamilyConfig entry in FEATURED_FAMILY_CONFIGS.
 *   4. In presets.ts, set `featuredFamilyKey: "your-key"` on the target preset
 *      and remove the now-redundant inline typography fields.
 */

// ── Type definitions ───────────────────────────────────────────────────────────

/**
 * The five flagship families that have explicit typography and font-scale
 * configurations.
 *
 * NOTE: these keys intentionally match the corresponding ThemePresetKey values
 * so that "family key ↔ canonical preset" resolution in the Storybook toolbar
 * requires no extra lookup table.
 */
export type FeaturedFamilyKey =
  | "editorial-classic"
  | "corporate-clean"
  | "bold-marketing"
  | "portfolio-showcase"
  | "premium-luxury"
  | "careers-human"
  // ── Premium style families ───────────────────────────────────────────────
  | "dark-ai"
  | "clean-corporate"
  | "structured-saas";

/**
 * Named font-scale personalities.  Each drives the fluid type ramp from h1
 * down to small text.  Use a profile that matches the family's information
 * density and editorial intent.
 *
 *   editorial  — generous scale, wide heading jumps; magazine / long-form
 *   corporate  — restrained scale, narrow jumps; data-dense B2B
 *   marketing  — largest h1, wide jumps; campaign / conversion pages
 *   showcase   — slightly generous scale; portfolio / visual-first
 *   luxury     — largest h1, tightest leading; premium / editorial luxury
 */
export type FontScaleProfile =
  | "editorial"
  | "corporate"
  | "marketing"
  | "showcase"
  | "luxury"
  | "human"
  | "ai"           // Dark AI: large precision display headings, developer-platform energy
  | "saas"         // Clean Corporate: restrained professional SaaS — close to corporate but slightly wider
  | "editorial-saas"; // Structured SaaS: bold split hero, tight tracking, compact density

/**
 * Block-style personality label.  Used for documentation and (future) admin
 * UI — the actual structural token values live in BlockStyleProfile instances
 * in block-style-profile.ts.
 */
export type FamilyBlockStyleName =
  | "editorial"
  | "corporate"
  | "bold"
  | "showcase"
  | "premium"
  | "human"
  | "ai"          // Dark AI: flat dark surfaces, sharp precision, glow details
  | "saas"        // Clean Corporate: elevated white cards, balanced radius, structured clarity
  | "structured"; // Structured SaaS: bordered cards, hairline dividers, editorial product density

/**
 * Semantic button shape personality.
 *
 *   sharp    — 0px radius: editorial, corporate precision
 *   rounded  — 0.375rem radius: professional, approachable
 *   pill     — 9999px radius: marketing energy, conversion-focused
 */
export type ButtonStyle = "sharp" | "rounded" | "pill";

/**
 * Semantic card visual treatment.
 *
 *   flat      — no border, no shadow; content-first minimalism
 *   bordered  — has border, no shadow; structured, corporate clarity
 *   elevated  — has shadow, minimal border; depth for marketing/showcase
 */
export type CardStyle = "flat" | "bordered" | "elevated";

/**
 * Full typography specification for a theme family.
 */
export type ThemeFamilyTypography = {
  /** Full CSS font-family stack for all headings (h1–h4). */
  headingFont: string;
  /** Full CSS font-family stack for body text and UI. */
  bodyFont: string;
  /** Optional accent / secondary font — emitted as --font-serif. */
  accentFont?: string | null;
  /** Numeric font-weight for headings (e.g. 500, 600, 700). */
  headingWeight: number;
  /** Numeric font-weight for body text (e.g. 400). */
  bodyWeight: number;
  /** Unitless base line-height multiplier (e.g. 1.6). */
  lineHeight: number;
  /** letter-spacing for section headings (e.g. "-0.02em"). Omit for "0em". */
  headingTracking?: string;
  /** Scale profile key — selects the fluid type ramp. */
  fontScaleProfile: FontScaleProfile;
};

/**
 * Structural (non-colour) personality for a theme family.
 *
 * These values drive component shape and spacing — things that remain visible
 * even after stripping all colour from the page.
 *
 *   buttonStyle        → semantic button shape; "sharp" | "rounded" | "pill"
 *                        CSS value derived: sharp=0px, rounded=0.375rem, pill=9999px
 *   buttonFontWeight   → font-weight for button labels (100–900)
 *   buttonTextTransform→ "none" | "uppercase" — capitalization style
 *   cardRadius         → CSS length applied to --card-radius family override
 *   cardStyle          → semantic card treatment: "flat" | "bordered" | "elevated"
 *   headingTransform   → "none" | "uppercase" — heading capitalization
 *   heroVariant        → preferred hero layout: "centered" | "split" | "fullscreen"
 *   navigation         → desktop nav dropdown personality
 *   header             → header component variant + background style
 *   footer             → footer section structure and density
 */
export type StructuralFamilyConfig = {
  /**
   * Semantic button shape.
   *   "sharp"   → 0px radius — editorial / corporate precision
   *   "rounded" → 0.375rem   — professional / approachable
   *   "pill"    → 9999px     — marketing pill buttons
   */
  buttonStyle: ButtonStyle;
  /** Font-weight for button label text. */
  buttonFontWeight: number;
  /** Text transform for button labels. */
  buttonTextTransform: "none" | "uppercase";
  /**
   * Card border-radius. Overrides the preset-level --card-radius so that
   * family shape identity wins over the preset palette.
   */
  cardRadius: string;
  /**
   * Semantic card visual treatment.
   *   "flat"     — no border, no shadow; content-first minimalism
   *   "bordered" — visible border; structured, corporate clarity
   *   "elevated" — drop shadow; depth for marketing / showcase pages
   */
  cardStyle: CardStyle;
  /** Heading text-transform. */
  headingTransform: "none" | "uppercase";
  /**
   * Preferred hero layout variant.
   *   "centered"   — centred headline + subtitle, single CTA column
   *   "split"      — 50/50 text left + image/media right
   *   "fullscreen" — full-viewport hero with overlaid content
   */
  heroVariant: "centered" | "split" | "fullscreen";
  /**
   * Desktop navigation dropdown personality.
   *   variant   — panel pattern: mega = full-width columns, flyout = vertical
   *               list, grid = visual tile grid, content = featured content strip
   *   density   — link padding: compact (tight) or comfortable (spacious)
   *   emphasis  — text = text-only links, visual = icon+label cards
   */
  navigation: {
    variant:  "mega" | "flyout" | "grid" | "content";
    density:  "compact" | "comfortable";
    emphasis: "text" | "visual";
  };
  /**
   * Header personality.
   *
   *   variant — structural component type (controls nav panel shape):
   *     "minimal"     — compact strip, horizontal links, no dropdown panels
   *     "flyout"      — standard height, vertical flyout dropdown on hover
   *     "mega"        — standard height, full-width multi-column panel
   *
   *   style — initial background mode (before scroll):
   *     "light"       — white/light background, dark text (default)
   *     "dark"        — dark background, light text
   *     "transparent" — no initial background; floats over the hero section
   *
   * Note: the effective HeaderVariant used in LayoutVariantEditor is derived from
   * style-defaults.ts → getFamilyDefaultHeaderVariant(), which returns "transparent"
   * when style="transparent" (since transparency is a complete UI variant there).
   */
  header: {
    variant: "minimal" | "flyout" | "mega";
    style: "light" | "dark" | "transparent";
  };
  /**
   * Footer layout personality.
   *   variant   — corporate = multi-column links, branding = logo-centric,
   *               minimal = single row brand + links
   *   density   — compact = tight vertical rhythm, spacious = more padding
   */
  footer: {
    variant: "corporate" | "branding" | "minimal";
    density: "compact" | "comfortable" | "spacious";
  };
};

/**
 * Full configuration for one featured theme family.
 */
export type ThemeFamilyConfig = {
  /** Stable identifier. */
  key: FeaturedFamilyKey;
  /** Human-readable display name (used in admin UI). */
  label: string;
  /** One-sentence positioning statement. */
  description: string;
  /** Structural layout personality label. */
  blockStyleProfile: FamilyBlockStyleName;
  /** Typography specification — the single source of truth for this family. */
  typography: ThemeFamilyTypography;
  /** Non-colour structural personality — shape, weight, spacing. */
  structural: StructuralFamilyConfig;
};

// ── Font scale profiles ────────────────────────────────────────────────────────
//
// Fluid clamp() values give each profile its own sense of hierarchy without
// hard-coding breakpoints.  The pattern is:
//   clamp(min, preferred-vw, max)
// where preferred-vw is calibrated for a 1280 px viewport.

export const fontScaleProfiles: Readonly<
  Record<FontScaleProfile, { h1: string; h2: string; h3: string; body: string; small: string }>
> = {
  editorial: {
    // Wide scale — big h1 for magazine impact, generous h2/h3 jumps.
    h1:    "clamp(2.75rem, 5vw, 4.5rem)",
    h2:    "clamp(2rem, 3.2vw, 3rem)",
    h3:    "clamp(1.5rem, 2.4vw, 2.125rem)",
    body:  "1rem",
    small: "0.875rem",
  },
  corporate: {
    // Restrained scale — authority without aggression; data-dense layouts.
    h1:    "clamp(2.5rem, 4.2vw, 4rem)",
    h2:    "clamp(1.875rem, 3vw, 2.5rem)",
    h3:    "clamp(1.375rem, 2vw, 1.875rem)",
    body:  "1rem",
    small: "0.875rem",
  },
  marketing: {
    // Largest h1 on the platform — maximum attention for campaign pages.
    h1:    "clamp(3rem, 6vw, 5rem)",
    h2:    "clamp(2.25rem, 4vw, 3.25rem)",
    h3:    "clamp(1.5rem, 2.4vw, 2rem)",
    body:  "1rem",
    small: "0.875rem",
  },
  showcase: {
    // Slightly generous — spacious visual-first portfolio feel.
    h1:    "clamp(2.75rem, 5vw, 4.25rem)",
    h2:    "clamp(2rem, 3.4vw, 2.75rem)",
    h3:    "clamp(1.5rem, 2.2vw, 1.875rem)",
    body:  "1rem",
    small: "0.875rem",
  },
  luxury: {
    // Widest overall ramp — premium vertical rhythm, refined spacing.
    h1:    "clamp(3rem, 5.4vw, 4.75rem)",
    h2:    "clamp(2.125rem, 3.6vw, 3rem)",
    h3:    "clamp(1.625rem, 2.4vw, 2rem)",
    body:  "1rem",
    small: "0.875rem",
  },
  human: {
    // Deliberately moderate h1 — candidate-facing, not campaign-facing.
    // The goal is readability and calm, not maximum visual impact.
    // Slightly larger body (1.0625rem) for comfortable reading on any device.
    h1:    "clamp(2.125rem, 3.6vw, 3.25rem)",  // noticeably smaller than marketing (5rem)
    h2:    "clamp(1.75rem, 2.8vw, 2.375rem)",  // gentle step down from h1
    h3:    "clamp(1.375rem, 2vw, 1.75rem)",     // section headings stay readable
    body:  "1.0625rem",                          // slightly above 1rem — better readability
    small: "0.9375rem",                          // larger small text — accessibility
  },
  ai: {
    // Precision display scale — large, bold, engineer-approved.
    // Dark AI platforms live by their hero headline; h1 must command the viewport.
    // h2/h3 step down crisply; body stays at 1rem for terminal-style readability.
    h1:    "clamp(2.75rem, 5.5vw, 5rem)",       // near-marketing scale; maximum authority
    h2:    "clamp(2rem, 3.4vw, 3.25rem)",        // clear visual hierarchy step
    h3:    "clamp(1.5rem, 2.2vw, 2.25rem)",      // section headings with presence
    body:  "1rem",
    small: "0.875rem",
  },
  saas: {
    // Restrained professional SaaS — close to "corporate" but with a slightly
    // wider h1 to accommodate the split-hero layout used in clean-corporate.
    // Keeps information density high without sacrificing credibility.
    h1:    "clamp(2.625rem, 4.5vw, 4.25rem)",   // wider than corporate (4rem) for split hero
    h2:    "clamp(1.875rem, 3vw, 2.625rem)",     // tight step — structured hierarchy
    h3:    "clamp(1.375rem, 2vw, 1.875rem)",
    body:  "1rem",
    small: "0.875rem",
  },
  "editorial-saas": {
    // Structured SaaS / Editorial Product — split-hero oriented, bold display
    // headings, compact body reading rhythm.  Inspired by Aelen / Lexington Themes
    // viewport: confident B2B SaaS where content hierarchy is the differentiator.
    // h1 is intentionally bold (close to marketing) to own the split-hero panel,
    // h2/h3 step down crisply for scan-first content index layouts.
    h1:    "clamp(2.5rem, 4.5vw, 4rem)",        // bold split-hero display
    h2:    "clamp(1.875rem, 2.8vw, 2.5rem)",    // section headings — clear hierarchy
    h3:    "clamp(1.375rem, 1.8vw, 1.75rem)",   // feature headings — compact, scannable
    body:  "1rem",
    small: "0.875rem",
  },
} as const;

// ── Button radius derivation ───────────────────────────────────────────────────

/**
 * Maps a ButtonStyle semantic value to the corresponding CSS border-radius.
 * Used in familyStructuralToVars() to derive --btn-radius.
 */
export const BUTTON_STYLE_RADIUS: Readonly<Record<ButtonStyle, string>> = {
  sharp:   "0px",
  rounded: "0.375rem",
  pill:    "9999px",
} as const;

// ── Featured family registry ───────────────────────────────────────────────────

export const FEATURED_FAMILY_CONFIGS: Readonly<Record<FeaturedFamilyKey, ThemeFamilyConfig>> = {

  // ── Editorial Classic ─────────────────────────────────────────────────────────
  //
  // Serif-led editorial character: Playfair Display headings over Inter body.
  // Long-form content brands, law firms, publishers, premium consulting.
  //
  // Design intent:
  //   - Minimal header preserves the editorial reading experience
  //   - Rounded buttons: professional credibility without being overly corporate
  //   - Flat cards: content is the star, no chrome distractions
  //   - Minimal footer: restraint, spacious rhythm matches editorial pacing
  //   - Centred hero: headline-first, the words lead

  "editorial-classic": {
    key:               "editorial-classic",
    label:             "Editorial Classic",
    description:       "Content-first, serif-led, spacious editorial style.",
    blockStyleProfile: "editorial",
    typography: {
      headingFont:      "'Playfair Display', Georgia, serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       "'Cormorant Garamond', Georgia, serif",
      headingWeight:    600,
      bodyWeight:       400,
      lineHeight:       1.75,
      headingTracking:  "-0.02em",
      fontScaleProfile: "editorial",
    },
    structural: {
      buttonStyle:         "rounded",
      buttonFontWeight:    500,
      buttonTextTransform: "none",
      cardRadius:          "0.25rem",
      cardStyle:           "flat",
      headingTransform:    "none",
      heroVariant:         "centered",
      // Flyout: clean vertical list — editorial restraint over mega-panel noise.
      navigation: { variant: "flyout", density: "comfortable", emphasis: "text" },
      // Minimal header: the content brand, not the navigation, is the hero.
      // Light style: serif brand marks on white maintain editorial credibility.
      header: { variant: "minimal", style: "light" },
      // Minimal footer with spacious rhythm matches the editorial pacing.
      footer: { variant: "minimal", density: "spacious" },
    },
  },

  // ── Corporate Clean ───────────────────────────────────────────────────────────
  //
  // All-Inter: crisp, zero-distraction authority.
  // Management consulting, modern law firms, enterprise SaaS.
  //
  // Design intent:
  //   - Mega header: structured multi-column panel signals organisational depth
  //   - Sharp buttons: corporate precision, no softness
  //   - Bordered cards: structure and clarity, bounded information units
  //   - Corporate footer, comfortable density: efficient use of footer real estate
  //   - Split hero: product/evidence alongside the headline

  "corporate-clean": {
    key:               "corporate-clean",
    label:             "Corporate Clean",
    description:       "Structured, trustworthy, balanced business design.",
    blockStyleProfile: "corporate",
    typography: {
      headingFont:      "'Inter', system-ui, sans-serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       null,
      headingWeight:    600,
      bodyWeight:       400,
      lineHeight:       1.55,
      headingTracking:  "0em",
      fontScaleProfile: "corporate",
    },
    structural: {
      buttonStyle:         "sharp",
      buttonFontWeight:    600,
      buttonTextTransform: "none",
      cardRadius:          "0.5rem",
      cardStyle:           "bordered",
      headingTransform:    "none",
      heroVariant:         "split",
      // Mega: structured multi-column panel signals organisational depth.
      navigation: { variant: "mega", density: "compact", emphasis: "text" },
      // Mega header: authority through structured navigation.
      // Light header: authority through clarity — white header on corporate sites.
      header: { variant: "mega", style: "light" },
      // Corporate footer, comfortable density — clear and efficient.
      footer: { variant: "corporate", density: "comfortable" },
    },
  },

  // ── Bold Marketing ────────────────────────────────────────────────────────────
  //
  // Poppins headings at 700 weight: maximum impact for conversion pages.
  // Consumer products, B2C campaigns, product launches, events.
  //
  // Design intent:
  //   - Transparent header: the full-bleed hero breathes fully
  //   - Pill buttons: universal signal for conversion / marketing energy
  //   - Elevated cards: depth and dimension matches the bold visual character
  //   - Branding footer: brand identity stays prominent
  //   - Fullscreen hero: maximum visual impact

  "bold-marketing": {
    key:               "bold-marketing",
    label:             "Bold Marketing",
    description:       "High-impact campaign and conversion-focused style.",
    blockStyleProfile: "bold",
    typography: {
      headingFont:      "'Poppins', system-ui, sans-serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       null,
      headingWeight:    700,
      bodyWeight:       400,
      lineHeight:       1.45,
      headingTracking:  "-0.02em",
      fontScaleProfile: "marketing",
    },
    structural: {
      buttonStyle:         "pill",
      buttonFontWeight:    700,
      buttonTextTransform: "none",
      cardRadius:          "1rem",
      cardStyle:           "elevated",
      headingTransform:    "none",
      heroVariant:         "fullscreen",
      // Content: wide dropdown with featured content block — editorial + conversion.
      navigation: { variant: "content", density: "comfortable", emphasis: "visual" },
      // Minimal header component with transparent style — floats over the hero.
      header: { variant: "minimal", style: "transparent" },
      // Branding footer, comfortable density — brand identity above the fold break.
      footer: { variant: "branding", density: "comfortable" },
    },
  },

  // ── Portfolio Showcase ────────────────────────────────────────────────────────
  //
  // Space Grotesk headings: geometric, distinct, media-complementing.
  // Creative agencies, designers, photographers, portfolio-first brands.

  "portfolio-showcase": {
    key:               "portfolio-showcase",
    label:             "Portfolio Showcase",
    description:       "Media-led, modern, visual-first presentation.",
    blockStyleProfile: "showcase",
    typography: {
      headingFont:      "'Space Grotesk', system-ui, sans-serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       "'DM Sans', system-ui, sans-serif",
      headingWeight:    600,
      bodyWeight:       400,
      lineHeight:       1.55,
      headingTracking:  "0em",
      fontScaleProfile: "showcase",
    },
    structural: {
      // Zero-radius everywhere — geometric, design-aware, gallery aesthetic.
      buttonStyle:         "sharp",
      buttonFontWeight:    500,
      buttonTextTransform: "none",
      cardRadius:          "0px",
      cardStyle:           "flat",
      headingTransform:    "none",
      heroVariant:         "fullscreen",
      // Grid: visual tile dropdown mirrors the portfolio's image-first character.
      navigation: { variant: "grid", density: "comfortable", emphasis: "visual" },
      // Flyout header component with dark style: overlaid on full-bleed imagery.
      header: { variant: "flyout", style: "dark" },
      // Minimal footer keeps whitespace clean for a gallery-like finish.
      footer: { variant: "minimal", density: "compact" },
    },
  },

  // ── Premium Luxury ────────────────────────────────────────────────────────────
  //
  // Cormorant Garamond headings at 500 weight: refined, unhurried, exclusive.
  // Luxury brands, boutique hospitality, premium professional services.

  "premium-luxury": {
    key:               "premium-luxury",
    label:             "Premium Luxury",
    description:       "Elegant, refined, high-end brand expression.",
    blockStyleProfile: "premium",
    typography: {
      headingFont:      "'Cormorant Garamond', Georgia, serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       "'Libre Baskerville', Georgia, serif",
      headingWeight:    500,
      bodyWeight:       400,
      lineHeight:       1.75,
      headingTracking:  "-0.02em",
      fontScaleProfile: "luxury",
    },
    structural: {
      // Sharp — refined, exclusive, jewellery-brand precision.
      buttonStyle:         "sharp",
      buttonFontWeight:    400,
      buttonTextTransform: "uppercase",
      cardRadius:          "0.25rem",
      cardStyle:           "bordered",
      headingTransform:    "uppercase",
      heroVariant:         "split",
      // Flyout: minimal vertical list — restraint signals exclusivity.
      navigation: { variant: "flyout", density: "comfortable", emphasis: "text" },
      // Flyout header component with transparent style: brand mark floats over luxury hero.
      header: { variant: "flyout", style: "transparent" },
      // Minimal footer: refined simplicity; no information overload.
      footer: { variant: "minimal", density: "spacious" },
    },
  },

  // ── Careers Human ─────────────────────────────────────────────────────────────
  //
  // DM Sans headings at 500 weight — geometric but friendly, not aggressive.
  // The calm, trustworthy family for recruitment sites and employer-brand platforms.
  //
  // Design intent:
  //   - Softer heading weight (500) vs Bold Marketing (700): no conversion pressure
  //   - Larger body text (1.0625rem) and generous line-height (1.70): readable for
  //     candidates reading job descriptions and culture pages at length
  //   - Rounded buttons: approachable, not pill (too marketing) or sharp (too corporate)
  //   - Flat cards: no shadow drama — clarity first
  //   - Split hero: team photo + headline; human before product
  //   - Flyout nav, light header: the content is the hero, not the navigation
  //   - Corporate footer, comfortable density: grounded, no gimmicks

  "careers-human": {
    key:               "careers-human",
    label:             "Careers Human",
    description:       "Human, calm, and trustworthy — employer brand without the sales pressure.",
    blockStyleProfile: "human",
    typography: {
      headingFont:      "'DM Sans', system-ui, sans-serif",
      bodyFont:         "'DM Sans', system-ui, sans-serif",
      accentFont:       null,
      headingWeight:    500,         // softer than Bold Marketing (700); not aggressive
      bodyWeight:       400,
      lineHeight:       1.70,        // more spacious than marketing (1.45); easier to read
      headingTracking:  "-0.01em",   // subtle tightening — professional but not tight
      fontScaleProfile: "human",
    },
    structural: {
      buttonStyle:         "rounded",   // professional + approachable; not pill (marketing)
      buttonFontWeight:    500,         // not heavy 700; measured confidence
      buttonTextTransform: "none",      // natural case; not uppercase "SOLLICITEER NU"
      cardRadius:          "0.75rem",   // friendlier than corporate 0.5rem; softer than 1.5rem
      cardStyle:           "bordered",  // structure without shadow drama
      headingTransform:    "none",
      heroVariant:         "split",     // team photo + headline; human before abstract
      // Flyout: clean vertical list — calm, no mega-panel overwhelm.
      navigation: { variant: "flyout", density: "comfortable", emphasis: "text" },
      // Flyout header, light style — content-first; nothing floats over the hero.
      header: { variant: "flyout", style: "light" },
      // Corporate footer with comfortable density — grounded, not branded-marketing.
      footer: { variant: "corporate", density: "comfortable" },
    },
  },

  // ── Dark AI ───────────────────────────────────────────────────────────────────
  //
  // Manrope headings at 700 weight: maximum geometric authority on dark surfaces.
  // AI tools, developer APIs, ML infrastructure, premium dark-mode SaaS.
  //
  // Design intent:
  //   - Minimal header with dark/transparent style: brand floats over near-black hero
  //   - Sharp buttons: engineering precision — the opposite of pill-shaped marketing
  //   - Flat cards: dark panels with subtle border; no distracting elevation chrome
  //   - Branding footer: logo-centric; identity > navigation in a developer context
  //   - Centered hero: the headline IS the product; text-first, glow behind

  "dark-ai": {
    key:               "dark-ai",
    label:             "Dark AI",
    description:       "Precision engineering aesthetic — near-black surface, sharp geometry, developer-grade authority.",
    blockStyleProfile: "ai",
    typography: {
      headingFont:      "'Manrope', system-ui, sans-serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
      headingWeight:    700,         // bold geometric headings — AI-forward authority
      bodyWeight:       400,
      lineHeight:       1.65,        // slightly tighter than editorial (1.75) — information-dense
      headingTracking:  "-0.035em",  // strong negative tracking — premium AI precision feel
      fontScaleProfile: "ai",
    },
    structural: {
      // Sharp — engineering precision; 0px radius on all interactive elements.
      buttonStyle:         "sharp",
      buttonFontWeight:    600,
      buttonTextTransform: "none",
      cardRadius:          "0.375rem",  // very slight rounding on dark surfaces; almost sharp
      cardStyle:           "flat",      // dark flat panels; border-only chrome, no shadows
      headingTransform:    "none",
      heroVariant:         "centered",  // statement headline centred; glow behind; text leads
      // Flyout: clean vertical list — developer-tool restraint; no mega-panel noise.
      navigation: { variant: "flyout", density: "compact", emphasis: "text" },
      // Minimal header component with transparent style: floats over near-black hero.
      // NOTE: "dark" style maps to var(--bg-inverse) which is #ffffff in the Dark AI preset
      //       (bg-inverse = maximum contrast inversion = white on dark). Using "transparent"
      //       instead lets the header float over the hero with no background, then transitions
      //       to the dark glass headerBgScrolled token on scroll — the correct Dark AI behaviour.
      header: { variant: "minimal", style: "transparent" },
      // Branding footer: logo-centric identity; developer platforms don't need footer columns.
      footer: { variant: "branding", density: "comfortable" },
    },
  },

  // ── Structured SaaS ──────────────────────────────────────────────────────────
  //
  // Plus Jakarta Sans headings at 700 weight: editorial confidence without aggression.
  // B2B SaaS and editorial-product brands — Aelen/Lexington Themes aesthetic.
  //
  // Design intent:
  //   - Compact mega header: full navigation depth without visual weight
  //   - Sharp buttons: structured precision; editorial product over soft marketing
  //   - Bordered cards: hairline borders define structure; no elevation chrome
  //   - Corporate footer, compact density: efficient, content-first
  //   - Split hero: product statement + media; editorial hierarchy at first glance
  //   - Tight heading tracking (-0.025em): controlled, structured, confident

  "structured-saas": {
    key:               "structured-saas",
    label:             "Structured SaaS",
    description:       "Editorial product confidence — bordered cards, split hero, compact density, Plus Jakarta Sans.",
    blockStyleProfile: "structured",
    typography: {
      headingFont:      "'Plus Jakarta Sans', system-ui, sans-serif",
      bodyFont:         "'Inter', system-ui, sans-serif",
      accentFont:       null,
      headingWeight:    700,         // bold enough for editorial authority; not ultra-heavy
      bodyWeight:       400,
      lineHeight:       1.55,        // compact professional reading rhythm
      headingTracking:  "-0.025em",  // tighter than corporate (0em), less dramatic than ai (-0.035em)
      fontScaleProfile: "editorial-saas",
    },
    structural: {
      // Sharp — structured editorial precision; 0px radius everywhere
      buttonStyle:         "sharp",
      buttonFontWeight:    600,
      buttonTextTransform: "none",
      cardRadius:          "0.25rem",   // almost sharp; hairline-consistent with the bordered style
      cardStyle:           "bordered",  // defining structural characteristic: content bounded by borders
      headingTransform:    "none",
      heroVariant:         "split",     // product statement + media; editorial confidence at first glance
      // Mega: structured multi-column panel — depth signal for a product with many features
      navigation: { variant: "mega", density: "compact", emphasis: "text" },
      // Flyout header, light style — structured but not heavy; editorial SaaS restraint.
      header: { variant: "flyout", style: "light" },
      // Corporate footer, compact density — efficient, structured, no wasted space.
      footer: { variant: "corporate", density: "compact" },
    },
  },

  // ── Clean Corporate ───────────────────────────────────────────────────────────
  //
  // DM Sans headings at 600 weight: structured, confident, approachable.
  // Modern B2B SaaS, consulting, professional services, first-visit trust-building.
  //
  // Design intent:
  //   - Mega header: multi-column panel signals product depth and organisational scale
  //   - Rounded buttons: professional credibility + approachability; not pill marketing
  //   - Elevated cards: clean lift (sky-tinted shadow) — modern SaaS confidence
  //   - Corporate footer: full-width links + brand; signals maturity and thoroughness
  //   - Split hero: product visual alongside headline — evidence at first glance

  "clean-corporate": {
    key:               "clean-corporate",
    label:             "Clean Corporate",
    description:       "Modern B2B SaaS and professional-services style — white, structured, trust-first.",
    blockStyleProfile: "saas",
    typography: {
      headingFont:      "'DM Sans', system-ui, sans-serif",
      bodyFont:         "'DM Sans', system-ui, sans-serif",
      accentFont:       null,
      headingWeight:    600,         // semi-bold — decisive without aggression
      bodyWeight:       400,
      lineHeight:       1.60,        // professional reading rhythm; tighter than editorial (1.75)
      headingTracking:  "-0.02em",   // restrained tightening — B2B credibility signal
      fontScaleProfile: "saas",
    },
    structural: {
      // Rounded — professional and approachable; more decisive than pill, less cold than sharp.
      buttonStyle:         "rounded",
      buttonFontWeight:    600,
      buttonTextTransform: "none",
      cardRadius:          "0.75rem",   // balanced — modern SaaS friendliness
      cardStyle:           "elevated",  // clean shadow lift — "this product is polished"
      headingTransform:    "none",
      heroVariant:         "split",     // product evidence + headline; credibility at first glance
      // Mega: structured multi-column panel — signals product depth and feature breadth.
      navigation: { variant: "mega", density: "comfortable", emphasis: "text" },
      // Mega header, light style — clean white header; corporate authority through clarity.
      header: { variant: "mega", style: "light" },
      // Corporate footer, comfortable density — professional thoroughness; no gimmicks.
      footer: { variant: "corporate", density: "comfortable" },
    },
  },

} as const;

// ── Ordered list for admin / Storybook UI ──────────────────────────────────────

export const FEATURED_FAMILY_KEYS: readonly FeaturedFamilyKey[] = [
  // ── Premium style families (shown first in admin UI) ─────────────────────────
  "dark-ai",
  "clean-corporate",
  "structured-saas",
  // ── Original flagship families ───────────────────────────────────────────────
  "editorial-classic",
  "corporate-clean",
  "bold-marketing",
  "portfolio-showcase",
  "premium-luxury",
  "careers-human",
] as const;

// ── Type guard ─────────────────────────────────────────────────────────────────

/**
 * Returns true when `key` is a registered featured family key.
 * Use as a runtime guard before indexing FEATURED_FAMILY_CONFIGS.
 */
export function isFeaturedFamilyKey(key: string): key is FeaturedFamilyKey {
  return key in FEATURED_FAMILY_CONFIGS;
}

// ── CSS variable emitter — typography ─────────────────────────────────────────

/**
 * Returns the [name, value] CSS custom-property pairs for a family's typography
 * configuration.  These should be appended **after** the preset-level typography
 * vars in buildThemeVarsArray so that the family layer wins the cascade.
 *
 * Variables emitted:
 *   Typography
 *     --font-heading             heading font-family
 *     --font-body                body font-family  (alias for --font-sans)
 *     --font-sans                body font-family  (canonical token)
 *     --font-serif               accent font (only when accentFont is set)
 *     --font-heading-weight      heading font-weight
 *     --font-subheading-weight   subheading font-weight (auto-derived)
 *     --font-body-weight         body font-weight
 *     --font-line-height         base line-height
 *   Scale
 *     --font-size-h1 … --font-size-small
 *   Block profile
 *     --block-heading-tracking   overrides BlockStyleProfile.headingTracking
 */
export function familyTypographyToVars(key: FeaturedFamilyKey): [string, string][] {
  const { typography: t, key: familyKey } = FEATURED_FAMILY_CONFIGS[key];
  const scale    = fontScaleProfiles[t.fontScaleProfile];

  // Derive a reasonable subheading weight one step below the heading weight.
  // e.g. 700 → 600, 600 → 500, 500 → 400.
  const subW = t.headingWeight >= 700
    ? String(t.headingWeight - 100)
    : t.headingWeight >= 600
      ? String(t.headingWeight - 100)
      : String(t.headingWeight);

  const vars: [string, string][] = [
    // ── Font families ─────────────────────────────────────────────────────────
    ["--font-heading",            t.headingFont],
    ["--font-body",               t.bodyFont],
    ["--font-sans",               t.bodyFont],

    // ── Weights & rhythm ──────────────────────────────────────────────────────
    ["--font-heading-weight",    String(t.headingWeight)],
    ["--font-subheading-weight", subW],
    ["--font-body-weight",       String(t.bodyWeight)],
    ["--font-line-height",       String(t.lineHeight)],

    // ── Heading tracking (overrides block style profile value) ─────────────────
    ["--block-heading-tracking", t.headingTracking ?? "0em"],

    // ── Font size scale ────────────────────────────────────────────────────────
    ["--font-size-h1",    scale.h1],
    ["--font-size-h2",    scale.h2],
    ["--font-size-h3",    scale.h3],
    ["--font-size-body",  scale.body],
    ["--font-size-small", scale.small],

    // ── Family provenance (for dev tools / diagnostics) ────────────────────────
    ["--mc-family-key", familyKey],
  ];

  // Optional accent font — emitted only when specified to avoid accidentally
  // overriding a preset's serif token for families that have no accent.
  if (t.accentFont) {
    vars.push(["--font-serif", t.accentFont]);
  }

  return vars;
}

// ── CSS variable emitter — structural ─────────────────────────────────────────

/**
 * Returns [name, value] CSS custom-property pairs for a family's structural
 * (non-colour) configuration.  Designed to be appended **after** the
 * typography vars so the full family layer is applied in a single cascade step.
 *
 * Variables emitted:
 *   --btn-radius               border-radius derived from buttonStyle
 *   --btn-font-weight          font-weight for button label text
 *   --btn-text-transform       text-transform for button labels
 *   --card-radius              card/panel border-radius (family override)
 *   --block-heading-transform  heading text-transform (family override)
 *   --family-hero-variant      preferred hero layout variant
 *   --family-button-style      semantic button shape ("sharp" | "rounded" | "pill")
 *   --family-card-style        semantic card treatment ("flat" | "bordered" | "elevated")
 *   --family-header-variant    header component variant ("minimal" | "flyout" | "mega")
 *   --family-header-style      initial header background mode
 *   --family-nav-variant       desktop nav dropdown pattern
 *   --family-nav-density       nav link padding density
 *   --family-nav-emphasis      nav link presentation style
 *   --family-footer-variant    footer section structure
 *   --family-footer-density    footer padding density
 */
export function familyStructuralToVars(key: FeaturedFamilyKey): [string, string][] {
  const { structural: s } = FEATURED_FAMILY_CONFIGS[key];
  const btnRadius = BUTTON_STYLE_RADIUS[s.buttonStyle];

  return [
    ["--btn-radius",              btnRadius],
    ["--btn-font-weight",         String(s.buttonFontWeight)],
    ["--btn-text-transform",      s.buttonTextTransform],
    ["--card-radius",             s.cardRadius],
    ["--block-heading-transform", s.headingTransform],
    // Hero + semantic shape tokens
    ["--family-hero-variant",     s.heroVariant],
    ["--family-button-style",     s.buttonStyle],
    ["--family-card-style",       s.cardStyle],
    // Header personality
    ["--family-header-variant",   s.header.variant],
    ["--family-header-style",     s.header.style],
    // Navigation personality
    ["--family-nav-variant",      s.navigation.variant],
    ["--family-nav-density",      s.navigation.density],
    ["--family-nav-emphasis",     s.navigation.emphasis],
    // Footer personality
    ["--family-footer-variant",   s.footer.variant],
    ["--family-footer-density",   s.footer.density],
  ];
}

// ── resolveThemeWithFamily — runtime helper ────────────────────────────────────
//
// Convenience wrapper matching the shape requested in the task spec.
// Combines a family config, a preset (opaque reference), and the resolved
// scale into a single object useful for diagnostics or admin rendering.

export type ResolvedFamilyTheme = {
  familyKey:  FeaturedFamilyKey;
  presetKey:  string;
  family:     ThemeFamilyConfig;
  scale:      typeof fontScaleProfiles[FontScaleProfile];
};

/**
 * Resolves a family + preset key combination into a single diagnostic object.
 *
 * Note: for actual CSS emission, use tenantThemeToCSS() on the preset's
 * TenantTheme (which already includes the familyKey via `featuredFamilyKey`).
 * This function is a lightweight helper for admin UI and analytics code.
 */
export function resolveThemeWithFamily(
  familyKey: FeaturedFamilyKey,
  presetKey: string,
): ResolvedFamilyTheme {
  const family = FEATURED_FAMILY_CONFIGS[familyKey];
  const scale  = fontScaleProfiles[family.typography.fontScaleProfile];
  return { familyKey, presetKey, family, scale };
}
