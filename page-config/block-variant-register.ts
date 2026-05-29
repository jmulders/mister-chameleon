/**
 * Block Variant Register — Central Catalog
 *
 * This is the authoritative platform register for all supported block
 * layout variants.  It is consumed by:
 *
 *   - CMS/admin block-picker UIs  (surface variant options to editors)
 *   - Tooling and documentation generators
 *   - Runtime validation via getVariantRegisterEntry()
 *
 * ─── Model ───────────────────────────────────────────────────────────────────
 *
 *   TOKENS   = styling / appearance (colours, spacing, radii, fonts)
 *   VARIANTS = layout / structural execution of the same block
 *   CONTENT  = CMS / admin data
 *
 *   A variant key NEVER changes the block's data shape or block type.
 *   All colour and spacing adjustments live in design tokens.
 *
 * ─── Naming convention ───────────────────────────────────────────────────────
 *
 *   Canonical variant keys use the pattern:  {family}_{layout}
 *
 *   Examples:
 *     hero_default       hero_split         hero_proof
 *     feature_grid_3up   feature_grid_4up   feature_grid_cards
 *     cta_banner         cta_split          cta_card
 *
 *   Legacy short-form keys ("default", "cards", "two-col", …) remain valid
 *   in BLOCK_VARIANT_SETS for backward compatibility — they resolve to the
 *   same structural implementations as their spec-name equivalents.
 *
 * ─── Context blocks vs. content blocks ───────────────────────────────────────
 *
 *   Content blocks (FeatureGrid, TextSection, FAQ …) receive a `variant`
 *   string from the CMS via ContentBlock.variant.  Resolved in components
 *   via resolveBlockVariant().
 *
 *   Context slot blocks (Hero, Proof, CTA) are adaptive/decision-engine
 *   driven.  They receive a `layoutVariant` string on ResolvedContextSlot.
 *   Resolved via resolveContextBlockVariant().
 *
 *   Header / Footer are layout components.  They receive `variant` from
 *   tenant configuration.
 *
 * ─── Metadata fields ─────────────────────────────────────────────────────────
 *
 *   displayName      — short human label (e.g. "Split") kept for backward compat
 *   label            — explicit operator-facing name; falls back to displayName
 *   description      — one-sentence layout description (tooltip / longer hint)
 *   shortDescription — 3–6 word phrase surfaced as inline hint in block editors
 *
 * ─── Using this register ─────────────────────────────────────────────────────
 *
 * @example
 * // Get all variants for a block family (for a CMS picker UI):
 * const entry = getVariantRegisterEntry("featureGrid");
 * entry?.variants.map(v => ({ key: v.key, label: v.label ?? v.displayName }));
 *
 * // Get the default variant key for a family:
 * getDefaultVariant("testimonialSection"); // → "testimonial_grid"
 *
 * // Check if a variant key is valid for a family:
 * isRegisteredVariant("featureGrid", "feature_grid_4up"); // → true
 * isRegisteredVariant("featureGrid", "unknown");          // → false
 *
 * ─── Adding a new variant ────────────────────────────────────────────────────
 *
 *   1. Add a VariantDefinition entry to the relevant family below.
 *   2. Add the key to BLOCK_VARIANT_SETS in block-variants.ts.
 *   3. Implement the rendering branch in the block component.
 *   4. Update the BlockDefinition allowedVariants in registry.ts.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single layout variant option within a block family.
 */
export interface VariantDefinition {
  /** Canonical spec variant key — stored in CMS and ContentBlock.variant */
  readonly key:              string;
  /**
   * Short human-readable label for admin UIs and block pickers.
   * Kept for backward compatibility; prefer `label` for new code.
   */
  readonly displayName:      string;
  /**
   * One-sentence description of the structural layout.
   * Shown as a tooltip in block-picker UIs.
   */
  readonly description:      string;
  /** True for the variant that is used when no variant is specified */
  readonly isDefault?:       boolean;
  /**
   * Explicit operator-facing label shown in variant selectors.
   * Falls back to `displayName` when absent.
   *
   * @example "Hero split", "3-up grid", "Listing rows"
   */
  readonly label?:           string;
  /**
   * Concise 3–6 word phrase describing the structural layout.
   * Displayed as inline hint text in block editors so operators can
   * understand the layout at a glance without opening a tooltip.
   *
   * @example "Text left, media right"  "Three-column card grid"
   */
  readonly shortDescription?: string;
  /**
   * Key referencing a schematic preview illustration in VariantPreview.tsx.
   * Drives the visual thumbnail shown in the admin variant card picker.
   *
   * Multiple variants from different block families may share the same
   * previewType when they express the same structural layout.
   *
   * @example "grid-3"  "split-media-right"  "banner"
   */
  readonly previewType?: string;
}

/**
 * A single block family entry in the variant register.
 *
 * A "family" is the user-visible concept (e.g. "Feature Grid").
 * One or more ContentBlockType keys implement it.
 */
export interface VariantRegisterEntry {
  /** Internal block type key — matches ContentBlockType or context slot ID */
  readonly blockType:     string;
  /** Human-readable family name for admin UIs */
  readonly displayName:   string;
  /** Ordered list of structural variants for this family */
  readonly variants:      readonly VariantDefinition[];
  /**
   * The variant key to fall back to when an absent or unrecognised key is
   * encountered at runtime.  Should match the `isDefault: true` entry.
   */
  readonly defaultVariant: string;
}

// ── Register ──────────────────────────────────────────────────────────────────

/**
 * The ordered platform variant register.
 *
 * Covers all 12 block families defined in the platform variant spec, in
 * the priority order specified by PART 6 of the spec:
 *   Hero → Proof → CTA → FeatureGrid → Text/Media → Listing
 *   → Form → Footer → Header → FAQ → Testimonial
 */
export const BLOCK_VARIANT_REGISTER: readonly VariantRegisterEntry[] = [

  // ── 1. Hero (context slot) ─────────────────────────────────────────────────

  {
    blockType:      "hero",
    displayName:    "Hero",
    defaultVariant: "hero_default",
    variants: [
      {
        key:              "hero_default",
        displayName:      "Default",
        label:            "Default",
        description:      "Centered headline and CTA on a dark brand background — the standard above-the-fold hero.",
        shortDescription: "Centered, dark hero",
        previewType:      "centered",
        isDefault:        true,
      },
      {
        key:              "hero_split",
        displayName:      "Split",
        label:            "Split",
        description:      "Left-aligned text column with a decorative brand panel on the right; 50/50 split layout.",
        shortDescription: "Text left, media right",
        previewType:      "split-media-right",
      },
      {
        key:              "hero_proof",
        displayName:      "With proof",
        label:            "With proof",
        description:      "Centered hero layout with a compact social-proof row directly below the CTA.",
        shortDescription: "Hero + metrics row",
        previewType:      "centered-proof",
      },
      {
        key:              "hero_background",
        displayName:      "Background media",
        label:            "Background media",
        description:      "Full-viewport image or video background with a semi-transparent tint overlay; content alignment controlled by contentAlign prop (left, center, right).",
        shortDescription: "Full-bleed bg media overlay",
        previewType:      "centered",
      },
      {
        key:              "hero_minimal_dark",
        displayName:      "Minimal dark",
        label:            "Minimal dark",
        description:      "Near-black full-width hero with centered content; tight bold heading, subtle brand glow, no decorative panel. Optimised for Dark AI family.",
        shortDescription: "Dark centered, glow accent",
        previewType:      "centered",
      },
      {
        key:              "hero_split_clean",
        displayName:      "Split clean",
        label:            "Split — clean",
        description:      "Light-background split hero; headline and CTA on the left, product screenshot or illustration on the right. Optimised for Clean Corporate family.",
        shortDescription: "Light bg, text left, visual right",
        previewType:      "split-media-right",
      },
      {
        key:              "hero_dark_split",
        displayName:      "Dark split",
        label:            "Dark split",
        description:      "Dark brand background with text left, and a radial-glow decorative panel on the right. Best for Dark AI and Structured SaaS families.",
        shortDescription: "Dark bg, text left, glow right",
        previewType:      "split-media-right",
      },
      {
        key:              "hero_editorial",
        displayName:      "Editorial",
        label:            "Editorial",
        description:      "Light neutral section with a large typographic centered heading and generous vertical breathing room. Content-blog and editorial-first family variant.",
        shortDescription: "Light bg, large type, centered",
        previewType:      "centered",
      },
    ],
  },

  // ── 2. Proof (context slot) ────────────────────────────────────────────────

  {
    blockType:      "proof",
    displayName:    "Proof",
    defaultVariant: "proof_stats",
    variants: [
      {
        key:              "proof_stats",
        displayName:      "Stats",
        label:            "Stats",
        description:      "A row of headline metrics — the classic '10M+ users' social-proof band.",
        shortDescription: "Headline metrics band",
        previewType:      "stats-row",
        isDefault:        true,
      },
      {
        key:              "proof_logos",
        displayName:      "Logos",
        label:            "Logos",
        description:      "A horizontal strip of client / partner / integration logos.",
        shortDescription: "Client logo strip",
        previewType:      "logo-strip",
      },
      {
        key:              "proof_quotes",
        displayName:      "Quotes",
        label:            "Quotes",
        description:      "A grid of short customer testimonial cards.",
        shortDescription: "Quote card grid",
        previewType:      "quote-grid",
      },
    ],
  },

  // ── 3. CTA (context slot) ──────────────────────────────────────────────────

  {
    blockType:      "cta",
    displayName:    "CTA",
    defaultVariant: "cta_banner",
    variants: [
      {
        key:              "cta_banner",
        displayName:      "Banner",
        label:            "Banner",
        description:      "Full-width brand-coloured section with centered headline and button.",
        shortDescription: "Full-width brand banner",
        previewType:      "banner",
        isDefault:        true,
      },
      {
        key:              "cta_split",
        displayName:      "Split",
        label:            "Split",
        description:      "Headline and body text on the left, CTA button group on the right.",
        shortDescription: "Text left, button right",
        previewType:      "split-cta",
      },
      {
        key:              "cta_card",
        displayName:      "Card",
        label:            "Card",
        description:      "Contained card on a neutral-background section; less high-contrast than the banner.",
        shortDescription: "Contained card on neutral",
        previewType:      "card",
      },
    ],
  },

  // ── 3b. CTA Section (content block) ───────────────────────────────────────

  {
    blockType:      "ctaSection",
    displayName:    "CTA Section",
    defaultVariant: "cta_banner",
    variants: [
      {
        key:              "cta_banner",
        displayName:      "Banner",
        label:            "Banner",
        description:      "Full-width brand-coloured centered section with headline and button.",
        shortDescription: "Full-width brand banner",
        previewType:      "banner",
        isDefault:        true,
      },
      {
        key:              "cta_split",
        displayName:      "Split",
        label:            "Split",
        description:      "Heading and description on the left, button group on the right.",
        shortDescription: "Text left, button right",
        previewType:      "split-cta",
      },
      {
        key:              "cta_card",
        displayName:      "Card",
        label:            "Card",
        description:      "Neutral-background section with the CTA content inside an elevated card.",
        shortDescription: "Contained card on neutral",
        previewType:      "card",
      },
      {
        key:              "cta_banner_default",
        displayName:      "Banner Bar",
        label:            "Banner Bar",
        description:      "Compact horizontal bar on a neutral subtle background. Title and optional description on the left, 1–2 CTA buttons on the right. Good for in-page informational or promotional banners.",
        shortDescription: "Compact neutral horizontal bar",
        previewType:      "banner",
      },
      {
        key:              "cta_banner_compact",
        displayName:      "Banner Bar (Brand)",
        label:            "Banner Bar — Brand",
        description:      "Notification-bar style on a brand-coloured background. Title with optional inline description on the left, inverted CTA button(s) on the right. Maximum vertical compactness for alert-style or promo banners.",
        shortDescription: "Compact brand notification bar",
        previewType:      "banner",
      },
      {
        key:              "cta_media_first",
        displayName:      "Media first",
        label:            "Media first",
        description:      "Full-section CTA with a background image. A dark overlay ensures the text and button remain readable. Suitable for high-impact landing page conversion sections.",
        shortDescription: "Full-bleed bg image CTA",
        previewType:      "banner",
      },
      {
        key:              "cta_glow",
        displayName:      "Glow",
        label:            "Glow (dark)",
        description:      "Near-black section with a soft brand-coloured radial glow behind the headline; vivid primary CTA button cuts through the dark. Dark AI family signature variant.",
        shortDescription: "Dark section, glow accent",
        previewType:      "banner",
      },
      {
        key:              "cta_soft",
        displayName:      "Soft",
        label:            "Soft (light)",
        description:      "Very light neutral section with minimal visual weight; primary CTA and optional ghost secondary button. Lets the copy carry the weight. Clean Corporate family signature variant.",
        shortDescription: "Light neutral, copy-led",
        previewType:      "card",
      },
      {
        key:              "cta_newsletter",
        displayName:      "Newsletter",
        label:            "Newsletter signup",
        description:      "Inline email capture section: heading on the left, email input field + submit button on the right. No href-based CTA — form action driven. Content blog family variant.",
        shortDescription: "Email input inline signup",
        previewType:      "form-inline",
      },
    ],
  },

  // ── 4. Feature Grid ────────────────────────────────────────────────────────

  {
    blockType:      "featureGrid",
    displayName:    "Feature Grid",
    defaultVariant: "feature_grid_3up",
    variants: [
      {
        key:              "feature_grid_3up",
        displayName:      "3-up grid",
        label:            "3-up grid",
        description:      "Three-column bordered card grid on a subtle-bg section — the standard feature showcase.",
        shortDescription: "Three-column cards",
        previewType:      "grid-3",
        isDefault:        true,
      },
      {
        key:              "feature_grid_4up",
        displayName:      "4-up grid",
        label:            "4-up grid",
        description:      "Four-column card grid; good for larger feature sets or shorter descriptions.",
        shortDescription: "Four-column cards",
        previewType:      "grid-4",
      },
      {
        key:              "feature_grid_cards",
        displayName:      "Elevated cards",
        label:            "Elevated cards",
        description:      "Elevated shadow cards on a plain white section — draws more attention to each feature.",
        shortDescription: "Shadow cards, white bg",
        previewType:      "grid-shadow",
      },
      {
        key:              "feature_grid_checklist",
        displayName:      "Checklist",
        label:            "Checklist",
        description:      "Horizontal icon-left rows — scans like a capability checklist.",
        shortDescription: "Icon-left row list",
        previewType:      "checklist",
      },
      {
        key:              "feature_grid_dark",
        displayName:      "Dark grid",
        label:            "Dark grid",
        description:      "Three-column grid on a dark/near-black section background; icon badges use a brand-tinted glow; no card borders — colour separates content. Dark AI family variant.",
        shortDescription: "Dark bg, glow icon badges",
        previewType:      "grid-3",
      },
      {
        key:              "feature_grid_spacious",
        displayName:      "Spacious grid",
        label:            "Spacious grid",
        description:      "Three-column cards with extra vertical padding per card and very subtle shadow; no card border chrome — whitespace carries the rhythm. Clean Corporate family variant.",
        shortDescription: "Airy shadow cards, no borders",
        previewType:      "grid-shadow",
      },
    ],
  },

  // ── 5a. Text / Rich Content ────────────────────────────────────────────────

  {
    blockType:      "textSection",
    displayName:    "Text",
    defaultVariant: "text_single",
    variants: [
      {
        key:              "text_single",
        displayName:      "Single column",
        label:            "Single column",
        description:      "Left-aligned copy in a standard reading-width column.",
        shortDescription: "Left-aligned body copy",
        previewType:      "single-col",
        isDefault:        true,
      },
      {
        key:              "text_split",
        displayName:      "Split",
        label:            "Split",
        description:      "Heading on the left, body copy on the right — good for dense editorial sections.",
        shortDescription: "Heading left, body right",
        previewType:      "split-text",
      },
      {
        key:              "text_lead",
        displayName:      "Lead paragraph",
        label:            "Lead paragraph",
        description:      "Extra-large opening paragraph with a narrower, centered container — editorial intro style.",
        shortDescription: "Large intro paragraph",
        previewType:      "centered",
      },
    ],
  },

  // ── 5b. Media Content (implemented via About block) ────────────────────────

  {
    blockType:      "about",
    displayName:    "Media Content",
    defaultVariant: "media_right",
    variants: [
      {
        key:              "media_right",
        displayName:      "Image right",
        label:            "Image right",
        description:      "Text on the left, image on the right — the standard split media layout.",
        shortDescription: "Text left, image right",
        previewType:      "split-media-right",
        isDefault:        true,
      },
      {
        key:              "media_left",
        displayName:      "Image left",
        label:            "Image left",
        description:      "Image on the left, text on the right — use to alternate direction between sections.",
        shortDescription: "Image left, text right",
        previewType:      "split-media-left",
      },
      {
        key:              "media_full",
        displayName:      "Full width",
        label:            "Full width",
        description:      "Full-width image above the text block; good for hero-like editorial placements.",
        shortDescription: "Image above text",
        previewType:      "media-full",
      },
    ],
  },

  // ── 6. Listing ─────────────────────────────────────────────────────────────

  {
    blockType:      "listing",
    displayName:    "Listing",
    defaultVariant: "listing_cards",
    variants: [
      {
        key:              "listing_cards",
        displayName:      "Cards",
        label:            "Cards",
        description:      "Three-column card grid with image, date, and excerpt — the standard overview.",
        shortDescription: "Three-column card grid",
        previewType:      "grid-3",
        isDefault:        true,
      },
      {
        key:              "listing_rows",
        displayName:      "Rows",
        label:            "Rows",
        description:      "Single-column row list; more information per item, easier to scan linearly.",
        shortDescription: "Single-column list",
        previewType:      "list-rows",
      },
      {
        key:              "listing_compact",
        displayName:      "Compact",
        label:            "Compact",
        description:      "Dense list with reduced padding — best for sidebars or supplementary content.",
        shortDescription: "Dense, small padding",
        previewType:      "list-compact",
      },
    ],
  },

  // ── 7. Form Section ────────────────────────────────────────────────────────

  {
    blockType:      "formSection",
    displayName:    "Form",
    defaultVariant: "form_inline",
    variants: [
      {
        key:              "form_inline",
        displayName:      "Inline",
        label:            "Inline",
        description:      "Full-width form on a subtle-bg section — the standard contact/lead-gen placement.",
        shortDescription: "Full-width form section",
        previewType:      "form-inline",
        isDefault:        true,
      },
      {
        key:              "form_split",
        displayName:      "Split",
        label:            "Split",
        description:      "Headline and description on the left, form on the right.",
        shortDescription: "Intro left, form right",
        previewType:      "split-form",
      },
      {
        key:              "form_panel",
        displayName:      "Panel",
        label:            "Panel",
        description:      "Form inside an elevated card container — focused attention on the form.",
        shortDescription: "Form in elevated card",
        previewType:      "card",
      },
    ],
  },

  // ── 8. Footer (layout component — implementation pending) ──────────────────

  {
    blockType:      "footer",
    displayName:    "Footer",
    defaultVariant: "footer_simple",
    variants: [
      {
        key:              "footer_simple",
        displayName:      "Simple",
        label:            "Simple",
        description:      "Single-row footer with logo, copyright, and minimal links.",
        shortDescription: "Logo + links row",
        previewType:      "banner",
        isDefault:        true,
      },
      {
        key:              "footer_columns",
        displayName:      "Columns",
        label:            "Columns",
        description:      "Multi-column footer with grouped navigation links — the standard corporate footer.",
        shortDescription: "Multi-column link groups",
        previewType:      "footer-cols",
      },
      {
        key:              "footer_cta",
        displayName:      "CTA footer",
        label:            "CTA footer",
        description:      "Footer with a prominent CTA band above the standard links row.",
        shortDescription: "CTA band above links",
        previewType:      "footer-cta",
      },
    ],
  },

  // ── 9. Header (layout component) ──────────────────────────────────────────

  {
    blockType:      "header",
    displayName:    "Header",
    defaultVariant: "header_default",
    variants: [
      {
        key:              "header_default",
        displayName:      "Default",
        label:            "Default",
        description:      "Logo left, navigation links right — the standard sticky header.",
        shortDescription: "Logo left, nav right",
        previewType:      "nav-default",
        isDefault:        true,
      },
      {
        key:              "header_centered",
        displayName:      "Centered",
        label:            "Centered",
        description:      "Centered logo with navigation below or on either side.",
        shortDescription: "Logo centered, nav below",
        previewType:      "nav-centered",
      },
      {
        key:              "header_cta",
        displayName:      "With CTA",
        label:            "With CTA",
        description:      "Logo left, navigation center, primary CTA button pinned to the right.",
        shortDescription: "Logo, nav, pinned button",
        previewType:      "nav-cta",
      },
    ],
  },

  // ── 10. FAQ ────────────────────────────────────────────────────────────────

  {
    blockType:      "faqSection",
    displayName:    "FAQ",
    defaultVariant: "faq_default",
    variants: [
      {
        key:              "faq_default",
        displayName:      "Single column",
        label:            "Single column",
        description:      "Single-column accordion on a subtle-bg section — the standard FAQ layout.",
        shortDescription: "Accordion list",
        previewType:      "list-rows",
        isDefault:        true,
      },
      {
        key:              "faq_split",
        displayName:      "Two columns",
        label:            "Two columns",
        description:      "Two-column accordion grid — efficient for dense FAQ sets with 8+ questions.",
        shortDescription: "Two-column accordion",
        previewType:      "accordion-2col",
      },
    ],
  },

  // ── 11. Testimonial ────────────────────────────────────────────────────────

  {
    blockType:      "testimonialSection",
    displayName:    "Testimonial",
    defaultVariant: "testimonial_grid",
    variants: [
      {
        key:              "testimonial_grid",
        displayName:      "Grid",
        label:            "Grid",
        description:      "Three-column grid of bordered quote cards — the standard testimonial band.",
        shortDescription: "Three-column quotes",
        previewType:      "quote-grid",
        isDefault:        true,
      },
      {
        key:              "testimonial_single",
        displayName:      "Single",
        label:            "Single",
        description:      "Full-width centered single-quote layout with a large attribution.",
        shortDescription: "Full-width single quote",
        previewType:      "centered",
      },
      {
        key:              "testimonial_highlight",
        displayName:      "Highlight",
        label:            "Highlight",
        description:      "One large featured quote with accent background, then smaller supporting cards below.",
        shortDescription: "Featured + cards below",
        previewType:      "quote-highlight",
      },
    ],
  },

  // ── 12. Logo Strip ─────────────────────────────────────────────────────────

  {
    blockType:      "logoStrip",
    displayName:    "Logo Strip",
    defaultVariant: "default",
    variants: [
      {
        key:              "default",
        displayName:      "Strip",
        label:            "Strip",
        description:      "Single-row horizontal flex strip of logos at full contrast.",
        shortDescription: "Horizontal logo row",
        previewType:      "logo-strip",
        isDefault:        true,
      },
      {
        key:              "muted",
        displayName:      "Muted strip",
        label:            "Muted strip",
        description:      "Single-row strip with logos at reduced opacity — the classic \"trusted by\" treatment.",
        shortDescription: "Greyscale logo row",
        previewType:      "logo-strip",
      },
      {
        key:              "logo_grid",
        displayName:      "Logo grid",
        label:            "Logo grid",
        description:      "Multi-row CSS grid for larger logo clouds (6–12+ logos); logos wrap automatically.",
        shortDescription: "Grid cloud, auto-wraps",
        previewType:      "grid-3",
      },
      {
        key:              "logo_wall_light",
        displayName:      "Logo wall",
        label:            "Logo wall (light)",
        description:      "Clean white-background logo wall with full-colour logos at high contrast — maximum brand presence. Ideal for Clean Corporate and light-background themes.",
        shortDescription: "White bg, full-colour logos",
        previewType:      "grid-3",
      },
    ],
  },

  // ── 13. Pricing Section ────────────────────────────────────────────────────

  {
    blockType:      "pricingSection",
    displayName:    "Pricing",
    defaultVariant: "pricing_tiers",
    variants: [
      {
        key:              "pricing_tiers",
        displayName:      "Tier cards",
        label:            "Tier cards",
        description:      "Elevated card grid, one card per pricing tier — highlights the recommended plan.",
        shortDescription: "Cards, one per tier",
        previewType:      "grid-3",
        isDefault:        true,
      },
      {
        key:              "pricing_compact",
        displayName:      "Compact rows",
        label:            "Compact rows",
        description:      "Simplified row list with price inline — lower vertical footprint for secondary placements.",
        shortDescription: "Inline price rows",
        previewType:      "list-rows",
      },
    ],
  },

  // ── 14. Process Steps ──────────────────────────────────────────────────────

  {
    blockType:      "processSteps",
    displayName:    "Process Steps",
    defaultVariant: "default",
    variants: [
      {
        key:              "default",
        displayName:      "Vertical list",
        label:            "Vertical list",
        description:      "Vertical numbered list with dividers on a subtle-bg section — the standard process steps layout.",
        shortDescription: "Numbered vertical list",
        previewType:      "list-rows",
        isDefault:        true,
      },
      {
        key:              "accordion",
        displayName:      "Accordion",
        label:            "Accordion",
        description:      "Each step is a collapsible details/summary element — good for longer step descriptions or dense process flows.",
        shortDescription: "Collapsible step panels",
        previewType:      "list-rows",
      },
      {
        key:              "compact",
        displayName:      "Compact",
        label:            "Compact",
        description:      "Tight inline numbered list with a lower vertical footprint — good for embedding mid-page or in sidebars.",
        shortDescription: "Tight inline numbered list",
        previewType:      "list-compact",
      },
      {
        key:              "horizontal",
        displayName:      "Horizontal track",
        label:            "Horizontal track",
        description:      "Horizontal step track with numbered nodes connected by a line — ideal for short 3–5 step flows on landing pages and AI product pages.",
        shortDescription: "Horizontal numbered track",
        previewType:      "stats-row",
      },
    ],
  },

  // ── 15. Stats ──────────────────────────────────────────────────────────────

  {
    blockType:      "stats",
    displayName:    "Stats",
    defaultVariant: "default",
    variants: [
      {
        key:              "default",
        displayName:      "Metric cards",
        label:            "Metric cards",
        description:      "Row of large metric cards on a subtle-bg section — the standard social-proof stats band.",
        shortDescription: "Bordered metric cards",
        previewType:      "stats-row",
        isDefault:        true,
      },
      {
        key:              "compact",
        displayName:      "Compact row",
        label:            "Compact row",
        description:      "Tight inline row of stats with separator lines; no card backgrounds. Lower vertical footprint for mid-page context.",
        shortDescription: "Tight inline metric row",
        previewType:      "stats-row",
      },
      {
        key:              "dark",
        displayName:      "Dark metrics",
        label:            "Dark metrics",
        description:      "Near-black section background with large, bright metric values. No card borders — colour contrast carries the visual weight. Dark AI and enterprise family variant.",
        shortDescription: "Dark bg, bright metrics",
        previewType:      "stats-row",
      },
    ],
  },

] as const satisfies readonly VariantRegisterEntry[];

// ── Derived look-ups ──────────────────────────────────────────────────────────

/**
 * The variant register keyed by blockType for O(1) look-up.
 *
 * @example
 * VARIANT_REGISTER_MAP["featureGrid"]?.defaultVariant  // "feature_grid_3up"
 */
export const VARIANT_REGISTER_MAP: Readonly<Record<string, VariantRegisterEntry>> =
  Object.fromEntries(
    BLOCK_VARIANT_REGISTER.map((entry) => [entry.blockType, entry]),
  );

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the VariantRegisterEntry for a block type, or undefined when the
 * type is not in the register.
 *
 * Safe to call with untrusted input — never throws.
 *
 * @example
 * const entry = getVariantRegisterEntry("featureGrid");
 * entry?.variants.map(v => ({ value: v.key, label: v.label ?? v.displayName }));
 */
export function getVariantRegisterEntry(
  blockType: string,
): VariantRegisterEntry | undefined {
  return VARIANT_REGISTER_MAP[blockType];
}

/**
 * Returns the default variant key for a block type.
 *
 * Returns "default" as a universal fallback when the type is not registered —
 * all block components resolve unknown variants to "default" internally.
 *
 * @example
 * getDefaultVariant("featureGrid")     // "feature_grid_3up"
 * getDefaultVariant("testimonialSection") // "testimonial_grid"
 * getDefaultVariant("unknownBlock")    // "default"
 */
export function getDefaultVariant(blockType: string): string {
  return VARIANT_REGISTER_MAP[blockType]?.defaultVariant ?? "default";
}

/**
 * Returns true when `variantKey` is a registered variant for `blockType`.
 *
 * Does NOT validate that the block type itself is registered — an
 * unregistered block type always returns false (no variants are valid
 * for an unknown block).
 *
 * @example
 * isRegisteredVariant("featureGrid", "feature_grid_4up") // true
 * isRegisteredVariant("featureGrid", "unknown")          // false
 */
export function isRegisteredVariant(
  blockType: string,
  variantKey: string,
): boolean {
  const entry = VARIANT_REGISTER_MAP[blockType];
  if (!entry) return false;
  return entry.variants.some((v) => v.key === variantKey);
}

/**
 * Returns an ordered array of variant option objects suitable for use in
 * a `<select>` or radio-group block picker component.
 *
 * The returned `label` resolves `v.label ?? v.displayName` so callers always
 * get the most explicit operator-facing name without needing to know the
 * fallback logic.
 *
 * The returned `shortDescription` is a concise 3–6 word phrase; falls back
 * to an empty string when not populated.
 *
 * @example
 * getVariantOptions("featureGrid");
 * // → [
 * //     { value: "feature_grid_3up",      label: "3-up grid",      shortDescription: "Three-column cards",    isDefault: true  },
 * //     { value: "feature_grid_4up",       label: "4-up grid",      shortDescription: "Four-column cards",     isDefault: false },
 * //     { value: "feature_grid_cards",     label: "Elevated cards", shortDescription: "Shadow cards, white bg", isDefault: false },
 * //     { value: "feature_grid_checklist", label: "Checklist",      shortDescription: "Icon-left row list",    isDefault: false },
 * //   ]
 */
export function getVariantOptions(
  blockType: string,
): ReadonlyArray<{
  value:            string;
  label:            string;
  description:      string;
  shortDescription: string;
  isDefault:        boolean;
  /** Schematic preview key — empty string when no preview is defined */
  previewType:      string;
}> {
  const entry = VARIANT_REGISTER_MAP[blockType];
  if (!entry) return [];
  return entry.variants.map((v) => ({
    value:            v.key,
    label:            v.label ?? v.displayName,
    description:      v.description,
    shortDescription: v.shortDescription ?? "",
    isDefault:        v.isDefault ?? false,
    previewType:      v.previewType ?? "",
  }));
}
