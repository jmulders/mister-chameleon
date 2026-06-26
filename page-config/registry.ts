/**
 * Content Block Registry
 *
 * The registry is the platform's authoritative catalogue of supported
 * ContentBlock types.  It provides:
 *
 *   1. A `BlockDefinition` for each type — structural metadata including
 *      display name, category, allowed visual variants, and implementation
 *      status.  Used by admin UIs, block-picker components, and tooling.
 *
 *   2. A runtime-accessible tuple of all LIVE block type strings
 *      (`REGISTERED_CONTENT_BLOCK_TYPES`).  Used to validate CMS `_type`
 *      values before constructing a ContentBlock.
 *
 *   3. Type guard (`isRegisteredBlockType`) for narrowing an unknown string
 *      to a live ContentBlockType in mapper and validator code.
 *
 * ─── Status values ────────────────────────────────────────────────────────────
 *
 *   "live"    — CMS mapper case + renderer component both exist.
 *               The block is gateable via package entitlements.
 *
 *   "defined" — Data types and block struct exist in types.ts.
 *               CMS mapper case and/or renderer component are pending.
 *               The block will not appear on live pages until promoted to "live".
 *
 * ─── Extending ────────────────────────────────────────────────────────────────
 *
 *   To add a new content block type:
 *     1. Add the key to ContentBlockKey in tenant/types.ts.
 *     2. Add *BlockData interface + *Block struct in page-config/types.ts.
 *     3. Add a BlockDefinition entry in BLOCK_DEFINITIONS below (status: "defined").
 *     4. Add a CMS mapper case in cms/mappers/page-config-mapper.ts.
 *     5. Implement the renderer component in components/blocks/sections/.
 *     6. Promote status to "live" and add the key to REGISTERED_CONTENT_BLOCK_TYPES.
 *
 * ─── What this registry is NOT ────────────────────────────────────────────────
 *
 *   This registry does NOT map block types to React components — that is the
 *   renderer layer's responsibility.  This keeps the page-config module free
 *   of React / Next.js dependencies.
 *
 *   This registry does NOT gate which block types a tenant may use.  Package
 *   entitlements live in TenantBlocks (tenant/types.ts).
 */

import type { BlockDefinition, BlockCategory, ContentBlockType } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Block definition catalogue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authoritative ordered list of all block definitions.
 *
 * Canonical order: text → media → social-proof → features → content → conversion.
 * Within each category: existing live blocks first, then new defined blocks.
 *
 * TypeScript ensures every key is a valid ContentBlockType.
 * Adding a definition with an unrecognised key is a compile error.
 */
const BLOCK_DEFINITIONS: readonly BlockDefinition[] = [

  // ── Text ───────────────────────────────────────────────────────────────────

  {
    key:             "textSection",
    displayName:     "Text section",
    category:        "text",
    allowedVariants: ["text_single", "text_split", "text_lead", "default", "centered"],
    dataType:        "TextSectionBlockData",
    status:          "live",
  },
  {
    key:             "richText",
    displayName:     "Rich text",
    category:        "text",
    allowedVariants: ["narrow", "default", "wide"],
    dataType:        "RichTextBlockData",
    status:          "live",
  },

  // ── Media ──────────────────────────────────────────────────────────────────

  {
    key:             "image",
    displayName:     "Image",
    category:        "media",
    allowedVariants: ["full-width", "contained", "float-left", "float-right"],
    dataType:        "ImageBlockData",
    status:          "defined",
  },
  {
    key:             "video",
    displayName:     "Video",
    category:        "media",
    allowedVariants: ["full-width", "contained"],
    dataType:        "VideoBlockData",
    status:          "live",
  },
  {
    key:             "slider",
    displayName:     "Slider",
    category:        "media",
    allowedVariants: ["full-width", "contained", "cards"],
    dataType:        "SliderBlockData",
    status:          "defined",
  },

  // ── Social proof ───────────────────────────────────────────────────────────

  {
    key:             "testimonialSection",
    displayName:     "Testimonials",
    category:        "social-proof",
    allowedVariants: [
      "testimonial_grid", "testimonial_single", "testimonial_highlight",
      "testimonial_slider", "testimonial_featured_image",
      "default", "quote-card",
    ],
    dataType:        "TestimonialSectionBlockData",
    status:          "live",
  },
  {
    key:             "quote",
    displayName:     "Quote",
    category:        "social-proof",
    allowedVariants: ["centered", "left-border", "large"],
    dataType:        "QuoteBlockData",
    status:          "live",
  },
  {
    key:             "logoStrip",
    displayName:     "Logo strip",
    category:        "social-proof",
    allowedVariants: ["default", "muted", "logo_grid", "logo_wall_light"],
    dataType:        "LogoStripBlockData",
    status:          "live",
  },
  {
    key:             "stats",
    displayName:     "Stats",
    category:        "social-proof",
    allowedVariants: ["default", "compact"],
    dataType:        "StatsBlockData",
    status:          "live",
  },

  // ── Features ───────────────────────────────────────────────────────────────

  {
    key:             "featureGrid",
    displayName:     "Feature grid",
    category:        "features",
    allowedVariants: ["feature_grid_3up", "feature_grid_4up", "feature_grid_cards", "feature_grid_checklist", "feature_grid_dark", "feature_grid_spacious", "default", "cards", "compact", "icons-left"],
    dataType:        "FeatureGridBlockData",
    status:          "live",
  },

  // ── Content ────────────────────────────────────────────────────────────────

  {
    key:             "faqSection",
    displayName:     "FAQ",
    category:        "content",
    allowedVariants: ["faq_default", "faq_split", "default", "two-col"],
    dataType:        "FaqSectionBlockData",
    status:          "live",
  },
  {
    key:             "about",
    displayName:     "About / Split media",
    category:        "content",
    allowedVariants: ["media_right", "media_left", "media_full", "default", "split", "team-grid"],
    dataType:        "AboutBlockData",
    status:          "live",
  },
  {
    key:             "newsList",
    displayName:     "News list",
    category:        "content",
    allowedVariants: ["default", "grid", "list", "featured", "news_slider"],
    dataType:        "NewsListBlockData",
    status:          "live",
  },
  {
    key:             "caseHighlight",
    displayName:     "Case highlight",
    category:        "content",
    allowedVariants: ["compact", "expanded"],
    dataType:        "CaseHighlightBlockData",
    status:          "defined",
  },

  // ── Conversion ─────────────────────────────────────────────────────────────

  {
    key:             "ctaSection",
    displayName:     "Call to action",
    category:        "conversion",
    allowedVariants: [
      "cta_banner", "cta_split", "cta_card", "cta_media_first", // full-section variants
      "cta_banner_default", "cta_banner_compact",                // compact banner variants
      "cta_glow", "cta_soft",                                    // premium family variants
      "default", "brand", "dark",                                // legacy aliases
    ],
    dataType:        "CtaSectionBlockData",
    status:          "live",
  },

  // ── Forms ──────────────────────────────────────────────────────────────────
  //
  // Forms are placed on pages by the CMS via a formKey reference.
  // Submit behaviour is entirely platform-driven (FormDefinition @ @/forms).

  {
    key:             "formSection",
    displayName:     "Form",
    category:        "conversion",
    allowedVariants: ["form_inline", "form_split", "form_panel", "default", "card", "minimal"],
    dataType:        "FormBlockData",
    status:          "live",
  },

  // ── Listing / detail ───────────────────────────────────────────────────────
  //
  // Reusable blocks for blog and vacancy overview + detail page compositions.
  // Blog and vacancy pages are composed from existing templates + these blocks
  // — no new templates are required.  Use article-page for detail pages,
  // and marketing-page / article-page for listing overviews.

  {
    key:             "listing",
    displayName:     "Listing",
    category:        "content",
    allowedVariants: ["listing_cards", "listing_rows", "listing_compact", "listing_slider", "default", "grid", "list", "compact"],
    dataType:        "ListingBlockData",
    status:          "live",
  },
  {
    key:             "articleBody",
    displayName:     "Article body",
    category:        "text",
    allowedVariants: ["default", "wide"],
    dataType:        "ArticleBodyBlockData",
    status:          "live",
  },
  {
    key:             "articleMeta",
    displayName:     "Article meta",
    category:        "content",
    allowedVariants: ["default", "compact", "hero"],
    dataType:        "ArticleMetaBlockData",
    status:          "live",
  },
  {
    key:             "relatedContent",
    displayName:     "Related content",
    category:        "content",
    allowedVariants: ["default", "grid", "list", "carousel", "related_slider"],
    dataType:        "RelatedContentBlockData",
    status:          "live",
  },
  {
    key:             "vacancyMeta",
    displayName:     "Vacancy meta",
    category:        "content",
    allowedVariants: ["default", "compact", "sidebar"],
    dataType:        "VacancyMetaBlockData",
    status:          "live",
  },
  {
    key:             "applyPanel",
    displayName:     "Apply panel",
    category:        "conversion",
    allowedVariants: ["default", "inline", "sticky"],
    dataType:        "ApplyPanelBlockData",
    status:          "live",
  },
  {
    key:             "filterBar",
    displayName:     "Filter bar",
    category:        "content",
    allowedVariants: ["default", "compact", "expanded"],
    dataType:        "FilterBarBlockData",
    status:          "live",
  },
  {
    key:             "searchResults",
    displayName:     "Search results",
    category:        "content",
    allowedVariants: ["grid", "list"],
    dataType:        "SearchResultsBlockData",
    status:          "live",
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  //
  // Full-text search input + inline result presentation.
  // The block calls /api/search (SearchProvider-agnostic) and renders
  // SearchResult[] using SearchResultCard.  Provider wiring lives in Sear3.

  {
    key:             "search",
    displayName:     "Search",
    category:        "content",
    allowedVariants: ["default", "minimal", "full"],
    dataType:        "SearchBlockData",
    status:          "live",
  },

  // ── Careers / W6 ───────────────────────────────────────────────────────────

  {
    key:             "processSteps",
    displayName:     "Process steps",
    category:        "content",
    allowedVariants: ["default", "accordion", "compact"],
    dataType:        "ProcessStepsBlockData",
    status:          "live",
  },
  {
    key:             "recruiterPanel",
    displayName:     "Recruiter panel",
    category:        "conversion",
    allowedVariants: ["default", "compact", "card"],
    dataType:        "RecruiterPanelBlockData",
    status:          "live",
  },

  // ── Conversion / pricing ───────────────────────────────────────────────────

  {
    key:             "pricingSection",
    displayName:     "Pricing",
    category:        "conversion",
    allowedVariants: ["pricing_tiers", "pricing_compact", "pricing_table"],
    dataType:        "PricingSectionBlockData",
    status:          "live",
  },

  // ── Content / editorial ────────────────────────────────────────────────────

  {
    key:             "contentSection",
    displayName:     "Content section",
    category:        "content",
    allowedVariants: ["content_default", "content_split"],
    dataType:        "ContentSectionBlockData",
    status:          "live",
  },
  {
    key:             "teamSection",
    displayName:     "Team",
    category:        "content",
    allowedVariants: ["team_grid", "team_compact"],
    dataType:        "TeamSectionBlockData",
    status:          "live",
  },

  // ── New core blocks ─────────────────────────────────────────────────────────

  {
    key:             "timeline",
    displayName:     "Timeline",
    category:        "content",
    allowedVariants: ["timeline_vertical", "timeline_compact", "timeline_milestones"],
    dataType:        "TimelineBlockData",
    status:          "live",
  },
  {
    key:             "quickLinks",
    displayName:     "Quick links",
    category:        "content",
    allowedVariants: ["quicklinks_grid", "quicklinks_list", "quicklinks_compact"],
    dataType:        "QuickLinksBlockData",
    status:          "live",
  },
  {
    key:             "textMedia",
    displayName:     "Text + media",
    category:        "content",
    allowedVariants: ["text_media_right", "text_media_left", "text_media_stacked"],
    dataType:        "TextMediaBlockData",
    status:          "live",
  },
  {
    key:             "contactSection",
    displayName:     "Contact",
    category:        "conversion",
    allowedVariants: ["contact_default", "contact_split", "contact_minimal"],
    dataType:        "ContactSectionBlockData",
    status:          "live",
  },
  {
    key:             "floatingContact",
    displayName:     "Floating contact",
    category:        "conversion",
    allowedVariants: ["default"],
    dataType:        "FloatingContactBlockData",
    status:          "live",
  },

  // ── Commerce / product ─────────────────────────────────────────────────────

  {
    key:             "productOverview",
    displayName:     "Product overview",
    category:        "features",
    allowedVariants: ["product_grid", "product_cards", "product_list"],
    dataType:        "ProductOverviewBlockData",
    status:          "live",
  },
  {
    key:             "productDetail",
    displayName:     "Product detail",
    category:        "content",
    allowedVariants: ["product_detail_default", "product_detail_full"],
    dataType:        "ProductDetailBlockData",
    status:          "live",
  },
  {
    key:             "cartSummary",
    displayName:     "Cart summary",
    category:        "conversion",
    allowedVariants: ["cart_default"],
    dataType:        "CartSummaryBlockData",
    status:          "live",
  },
  {
    key:             "checkoutBlock",
    displayName:     "Checkout",
    category:        "conversion",
    allowedVariants: ["checkout_default"],
    dataType:        "CheckoutBlockData",
    status:          "live",
  },

  // ── Map ─────────────────────────────────────────────────────────────────────

  {
    key:             "mapBlock",
    displayName:     "Map",
    category:        "content",
    allowedVariants: ["default"],
    dataType:        "MapBlockData",
    status:          "live",
  },

] satisfies readonly BlockDefinition[];

// ─────────────────────────────────────────────────────────────────────────────
// Derived look-up structures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The block definition registry, keyed by ContentBlockType.
 *
 * Provides O(1) look-up by type key.
 * TypeScript does NOT enforce exhaustiveness here because the type is
 * `Record<ContentBlockType, BlockDefinition>` built at runtime from the array.
 * Use `getBlockDefinition()` for safe look-up (returns undefined for unknowns).
 */
export const BLOCK_REGISTRY: Readonly<Record<ContentBlockType, BlockDefinition>> =
  Object.fromEntries(
    BLOCK_DEFINITIONS.map((d) => [d.key, d]),
  ) as Readonly<Record<ContentBlockType, BlockDefinition>>;

// ─────────────────────────────────────────────────────────────────────────────
// Live block type set  (CMS mapper + renderer complete)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ordered tuple of all LIVE content block type identifiers.
 *
 * "Live" means both a CMS mapper case and a renderer component exist for
 * this block type.  The CMS mapper uses this set (via `isRegisteredBlockType`)
 * to filter incoming CMS sections — blocks not in this tuple are silently
 * skipped regardless of what the CMS returns.
 *
 * When a block is promoted from "defined" to "live":
 *   1. Add the CMS mapper case in cms/mappers/page-config-mapper.ts.
 *   2. Implement the renderer component.
 *   3. Add the key to this tuple.
 *   4. Update the BlockDefinition status above.
 *
 * `as const satisfies` preserves the literal types while confirming every
 * entry is a valid ContentBlockType.
 */
export const REGISTERED_CONTENT_BLOCK_TYPES = [
  // ── Core marketing blocks ──────────────────────────────────────────────────
  "textSection",
  "richText",
  "featureGrid",
  "testimonialSection",
  "faqSection",
  "ctaSection",
  "formSection",
  // ── Social proof / media ───────────────────────────────────────────────────
  "quote",
  "logoStrip",
  "stats",
  // ── Content ────────────────────────────────────────────────────────────────
  "about",
  "newsList",
  // ── Listing / overview ─────────────────────────────────────────────────────
  "listing",
  "filterBar",
  "searchResults",
  // ── Detail page (blog + vacancy) ──────────────────────────────────────────
  "articleMeta",
  "articleBody",
  "relatedContent",
  "vacancyMeta",
  "applyPanel",
  // ── Search ─────────────────────────────────────────────────────────────────
  "search",
  // ── Careers / W6 ──────────────────────────────────────────────────────────
  "processSteps",
  "recruiterPanel",
  // ── Conversion / pricing ──────────────────────────────────────────────────
  "pricingSection",
  // ── Content / editorial ────────────────────────────────────────────────────
  "textMedia",
  "contentSection",
  "teamSection",
  // ── Commerce / product ─────────────────────────────────────────────────────
  "productOverview",
  "productDetail",
  "cartSummary",
  "checkoutBlock",
  // ── Map ────────────────────────────────────────────────────────────────────
  "mapBlock",
  // ── Media ──────────────────────────────────────────────────────────────────
  "video",
  // ── New core blocks ────────────────────────────────────────────────────────
  "timeline",
  "quickLinks",
  "contactSection",
  "floatingContact",
] as const satisfies readonly ContentBlockType[];

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable display names  (backward-compatible; derived from registry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Human-readable labels for every registered block type.
 *
 * Derived from BLOCK_REGISTRY to avoid duplication.
 * Retained for backward compatibility with existing consumers of
 * CONTENT_BLOCK_DISPLAY_NAMES.  Prefer `getBlockDefinition(type).displayName`
 * for new code.
 */
export const CONTENT_BLOCK_DISPLAY_NAMES: Readonly<Record<ContentBlockType, string>> =
  Object.fromEntries(
    BLOCK_DEFINITIONS.map((d) => [d.key, d.displayName]),
  ) as Readonly<Record<ContentBlockType, string>>;

// ─────────────────────────────────────────────────────────────────────────────
// Type guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Narrows an unknown string to a LIVE ContentBlockType.
 *
 * "Live" blocks have full CMS mapper + renderer support.  Use in CMS mappers
 * when the block type comes from external data (e.g. Sanity `_type`) and needs
 * to be validated before constructing a ContentBlock.
 *
 * Blocks whose type is not in REGISTERED_CONTENT_BLOCK_TYPES are silently
 * skipped — forward-compatible with CMS schema evolution and incremental
 * block rollout.
 *
 * @example
 * for (const section of raw.sections) {
 *   if (!isRegisteredBlockType(section._type)) continue; // skip non-live
 *   const block = mapSection(section);                   // fully typed
 *   blocks.push(block);
 * }
 */
export function isRegisteredBlockType(type: string): type is ContentBlockType {
  return (REGISTERED_CONTENT_BLOCK_TYPES as readonly string[]).includes(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the display name for a block type.
 *
 * Falls back to the raw type string for unknown types — defensive; should not
 * happen when callers use `isRegisteredBlockType` first.
 *
 * @example
 * getBlockDisplayName("featureGrid"); // "Feature grid"
 * getBlockDisplayName("ctaSection");  // "Call to action"
 */
export function getBlockDisplayName(type: string): string {
  const def = (BLOCK_REGISTRY as Record<string, BlockDefinition>)[type];
  return def ? def.displayName : type;
}

/**
 * Returns the full `BlockDefinition` for a block type key.
 *
 * Returns `undefined` for unknown keys — safe to call with untrusted input
 * (e.g. a type key stored in the CMS or tenant config) without throwing.
 *
 * @example
 * const def = getBlockDefinition("featureGrid");
 * def?.category          // "features"
 * def?.allowedVariants   // ["2-col", "3-col", "4-col", "icon-list"]
 * def?.status            // "live"
 *
 * getBlockDefinition("unknown"); // undefined
 */
export function getBlockDefinition(key: string): BlockDefinition | undefined {
  return (BLOCK_REGISTRY as Record<string, BlockDefinition>)[key];
}

/**
 * Returns all block definitions in canonical category order.
 *
 * The returned array follows the same order as `BLOCK_DEFINITIONS`:
 * text → media → social-proof → features → content → conversion.
 *
 * Useful for building block-picker UIs, documentation generators, and
 * exhaustive iteration in tests.
 *
 * @example
 * const all = getAllBlockDefinitions();
 * all.map(d => d.key);
 * // → ["textSection", "richText", "image", "video", "slider",
 * //    "testimonialSection", "quote", "logoStrip", "stats",
 * //    "featureGrid", "faqSection", "about", "newsList", "caseHighlight",
 * //    "ctaSection"]
 */
export function getAllBlockDefinitions(): readonly BlockDefinition[] {
  return BLOCK_DEFINITIONS;
}

/**
 * Returns all block definitions belonging to the given category.
 *
 * Useful for rendering category-filtered block-picker sections and
 * per-category documentation.
 *
 * @example
 * getBlocksByCategory("social-proof").map(d => d.key);
 * // → ["testimonialSection", "quote", "logoStrip", "stats"]
 *
 * getBlocksByCategory("conversion").map(d => d.key);
 * // → ["ctaSection"]
 */
export function getBlocksByCategory(category: BlockCategory): readonly BlockDefinition[] {
  return BLOCK_DEFINITIONS.filter((d) => d.category === category);
}
