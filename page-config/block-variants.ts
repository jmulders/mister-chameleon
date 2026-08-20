/**
 * Block Variant Definitions
 *
 * Typed variant unions for every block type that supports layout variation,
 * plus runtime helpers for resolving raw variant strings to known-valid values.
 *
 * ─── Model ───────────────────────────────────────────────────────────────────
 *
 *   TOKENS   = styling / appearance
 *   VARIANTS = layout / structural execution of the same block
 *   CONTENT  = CMS / admin data
 *
 *   A variant key NEVER changes the block's data shape or block type.
 *
 * ─── Two variant namespaces ───────────────────────────────────────────────────
 *
 *   1. Content block variants  — stored in ContentBlock.variant (CMS-authored)
 *      Resolved by resolveBlockVariant().
 *      Type unions: *Variant (e.g. FeatureGridVariant, TextSectionVariant)
 *
 *   2. Context slot layout variants — stored in ResolvedContextSlot.layoutVariant
 *      Resolved by resolveContextBlockVariant().
 *      Type unions: *LayoutVariant (e.g. HeroLayoutVariant, ProofLayoutVariant)
 *
 * ─── Naming convention ───────────────────────────────────────────────────────
 *
 *   Canonical keys follow the pattern: {family}_{layout}
 *   Examples: hero_default, feature_grid_3up, cta_banner
 *
 *   Legacy short keys ("default", "cards", "two-col", …) remain valid for
 *   backward compatibility — they resolve to the same structural layouts as
 *   their canonical equivalents.
 *
 * ─── Resolving variants ───────────────────────────────────────────────────────
 *
 *   Components receive the raw variant string from the CMS and resolve it to
 *   a typed, validated value using resolveBlockVariant().
 *   Unknown or absent values always resolve to the family's default variant.
 *
 * ─── Adding a new variant ────────────────────────────────────────────────────
 *
 *   1. Add the key to the appropriate *Variant union below.
 *   2. Add it to the corresponding entry in BLOCK_VARIANT_SETS.
 *   3. Implement the rendering branch in the block component.
 *   4. Update the BlockDefinition allowedVariants in registry.ts.
 *   5. Add a VariantDefinition entry in block-variant-register.ts.
 *
 * ─── Usage (content block component) ─────────────────────────────────────────
 *
 * @example
 * import { resolveBlockVariant } from "@/page-config/block-variants";
 * import type { FeatureGridVariant } from "@/page-config/block-variants";
 *
 * const variant = resolveBlockVariant("featureGrid", rawVariant) as FeatureGridVariant;
 *
 * ─── Usage (context slot component) ──────────────────────────────────────────
 *
 * @example
 * import { resolveContextBlockVariant } from "@/page-config/block-variants";
 * import type { HeroLayoutVariant } from "@/page-config/block-variants";
 *
 * const layout = resolveContextBlockVariant("hero", layoutVariant) as HeroLayoutVariant;
 */

import type { ContentBlockType } from "./types";

// ═════════════════════════════════════════════════════════════════════════════
// CONTEXT SLOT LAYOUT VARIANTS
// ═════════════════════════════════════════════════════════════════════════════
//
// Variants for the three adaptive context slot blocks (Hero, Proof, CTA).
// These are layout/structural variants — they do not change the block data shape.

/**
 * Layout variant for the Hero context slot block.
 *
 *   hero_default      — centered headline and CTA on a dark brand background
 *   hero_split        — text left, decorative brand panel right (50/50)
 *   hero_proof        — centered hero + compact social-proof row below the CTA
 *   hero_background   — full-viewport image/video background with overlay content;
 *                       content alignment controlled by `contentAlign` prop
 *                       (left | center | right; default: center)
 *   hero_minimal_dark — near-black full-width hero; centered content, no decorative
 *                       panel; tight heading, subtle violet/brand glow. Dark AI family.
 *   hero_split_clean  — light-bg split hero; text left, product/UI screenshot right;
 *                       clean white surface variant. Clean Corporate family.
 *   hero_dark_split   — dark brand background + text left + radial-glow right panel;
 *                       split layout optimised for the Dark AI / Structured SaaS family.
 *   hero_editorial    — light neutral section; large typographic heading centered;
 *                       editorial / blog / content-first family variant.
 */
export type HeroLayoutVariant =
  | "hero_default" | "hero_split" | "hero_proof" | "hero_background"
  | "hero_minimal_dark" | "hero_split_clean"
  | "hero_dark_split" | "hero_editorial" | "hero_page_banner"
  | "hero_carousel";

/**
 * Layout variant for the Proof context slot block.
 *
 *   proof_stats     — headline metric row (e.g. "10M+ users" items) — default
 *   proof_logos     — client / partner / integration logo strip
 *   proof_quotes    — grid of short testimonial quote cards
 *   proof_spotlight — one case in the spotlight: media (photo / video) alongside a
 *                     quote/story with a relationship eyebrow and attribution;
 *                     slider when there are several. Uses the shared media core.
 */
export type ProofLayoutVariant = "proof_stats" | "proof_logos" | "proof_quotes" | "proof_spotlight";

/**
 * Layout variant for the CTA context slot block.
 *
 * Full-section family:
 *   cta_banner         — full-width brand-coloured banner with centered headline + button
 *   cta_split          — headline and body left, CTA button group right
 *   cta_card           — contained card on a neutral-background section
 *
 * Compact banner family:
 *   cta_banner_default — compact horizontal soft bar; title + description left,
 *                        1–2 CTAs right. Good for in-page promotional banners.
 *   cta_banner_compact — notification-bar style on brand background; maximum
 *                        vertical compactness for alert-style banners.
 *
 * Full-section + premium (rendered via CtaSectionBlock, shared with the content
 * block so the adaptive CTA slot does not diverge):
 *   cta_media_first    — background image with an overlaid headline + CTA
 *   cta_soft           — very light neutral section, understated
 *   cta_glow           — near-black section with a soft brand radial glow
 *
 * cta_newsletter is intentionally NOT part of the adaptive set: it is an email
 * capture with a form action, wired to the form-slot mechanism separately.
 */
export type CtaLayoutVariant =
  | "cta_banner" | "cta_split" | "cta_card"
  | "cta_banner_default" | "cta_banner_compact"
  | "cta_media_first" | "cta_soft" | "cta_glow";

/**
 * Layout variant for the Header layout component.
 *
 *   header_default   — logo left, nav links right (sticky)
 *   header_centered  — centered logo, nav arranged symmetrically
 *   header_cta       — logo left, nav center, primary CTA button pinned right
 *   header_triband   — three horizontal bands:
 *                        band 1: section tabs (left) + quick links (right)
 *                        band 2: logo (left) + search bar + lang switch + CTA (right)
 *                        band 3: main navigation items (full width)
 */
export type HeaderLayoutVariant = "header_default" | "header_centered" | "header_cta" | "header_triband";

// ── Context variant sets (for resolver) ───────────────────────────────────────

const CONTEXT_VARIANT_SETS: Record<string, readonly string[]> = {
  hero:   ["hero_default",  "hero_split",   "hero_proof",  "hero_background", "hero_minimal_dark", "hero_split_clean", "hero_dark_split", "hero_editorial", "hero_page_banner", "hero_carousel"] satisfies readonly HeroLayoutVariant[],
  proof:  ["proof_stats",   "proof_logos",  "proof_quotes", "proof_spotlight"] satisfies readonly ProofLayoutVariant[],
  cta:    ["cta_banner", "cta_split", "cta_card", "cta_banner_default", "cta_banner_compact", "cta_media_first", "cta_soft", "cta_glow"] satisfies readonly CtaLayoutVariant[],
  header: ["header_default","header_centered","header_cta","header_triband"]  satisfies readonly HeaderLayoutVariant[],
};

// ── Context variant defaults ───────────────────────────────────────────────────

const CONTEXT_VARIANT_DEFAULTS: Record<string, string> = {
  hero:   "hero_default",
  proof:  "proof_stats",
  cta:    "cta_banner",
  header: "header_default",
};

// ═════════════════════════════════════════════════════════════════════════════
// CONTENT BLOCK VARIANT UNIONS
// ═════════════════════════════════════════════════════════════════════════════
//
// Only blocks with implemented visual/structural variants are listed here.
// Blocks without variant support always render their single "default" layout.

/**
 * Variant for textSection blocks.
 *
 * Canonical spec keys:
 *   text_single — left-aligned single column (default)
 *   text_split  — heading left, body right (two-column)
 *   text_lead   — centred extra-large lead paragraph
 *
 * Legacy aliases (kept for backward compat):
 *   default  → text_single
 *   centered → text_lead (centered reading style)
 */
export type TextSectionVariant =
  | "text_single" | "text_split" | "text_lead"   // canonical spec names
  | "default" | "centered";                        // legacy aliases

/**
 * Variant for featureGrid blocks.
 *
 * Canonical spec keys:
 *   feature_grid_3up        — 3-col bordered card grid (default)
 *   feature_grid_4up        — 4-col grid for larger feature sets
 *   feature_grid_cards      — elevated shadow cards on white
 *   feature_grid_checklist  — horizontal icon-left rows
 *
 * Legacy aliases (kept for backward compat):
 *   default    → feature_grid_3up
 *   cards      → feature_grid_cards
 *   compact    → 2-col dense grid (no spec-name equivalent; kept as-is)
 *   icons-left → feature_grid_checklist
 */
/**
 * Additional FeatureGrid variants for premium style families:
 *
 *   feature_grid_dark     — 3-col grid on dark/near-black section background;
 *                           icon badges use brand-tinted glow. Dark AI family.
 *   feature_grid_spacious — 3-col grid with extra vertical padding per card,
 *                           very subtle shadow, no card borders. Clean Corporate.
 */
export type FeatureGridVariant =
  | "feature_grid_3up" | "feature_grid_4up" | "feature_grid_cards" | "feature_grid_checklist"
  | "feature_grid_dark" | "feature_grid_spacious"                    // premium family variants
  | "feature_spotlight"                                              // media + offer (price/CTA optional)
  | "default" | "cards" | "compact" | "icons-left"; // legacy aliases

/**
 * Variant for testimonialSection blocks.
 *
 * Canonical spec keys:
 *   testimonial_grid           — 3-col grid of bordered quote cards (default)
 *   testimonial_single         — full-width single centered quote
 *   testimonial_highlight      — featured large quote + smaller cards below
 *   testimonial_slider         — auto-advancing carousel of quote cards
 *   testimonial_featured_image — large featured quote with author photo alongside
 *
 * Legacy aliases:
 *   default    → testimonial_grid
 *   quote-card → testimonial_single
 */
export type TestimonialVariant =
  | "testimonial_grid" | "testimonial_single" | "testimonial_highlight"
  | "testimonial_slider" | "testimonial_featured_image"
  | "default" | "quote-card"; // legacy aliases

/**
 * Variant for faqSection blocks.
 *
 * Canonical spec keys:
 *   faq_default — single-column accordion (default)
 *   faq_split   — two-column accordion grid
 *
 * Legacy aliases:
 *   default → faq_default
 *   two-col → faq_split
 */
export type FaqSectionVariant =
  | "faq_default" | "faq_split"
  | "default" | "two-col"; // legacy aliases

/**
 * Variant for ctaSection content blocks.
 *
 * Canonical spec keys (full-section family):
 *   cta_banner         — full-width brand-coloured centred section (default)
 *   cta_split          — heading / body left, button group right
 *   cta_card           — CTA content inside an elevated card on a neutral section
 *   cta_media_first    — full-bleed background image with overlaid CTA content
 *
 * Canonical spec keys (compact banner family):
 *   cta_banner_default — compact horizontal bar on a neutral subtle background;
 *                        title + description left, 1–2 CTAs right. Good for
 *                        in-page promotional or informational banners.
 *   cta_banner_compact — notification-bar style on a brand background; title
 *                        (inline description) left, inverted CTA button(s) right.
 *                        Maximum vertical compactness for alert-style banners.
 *
 * Legacy aliases:
 *   default → cta_banner
 *   brand   → cta_banner (colour alias; same layout)
 *   dark    → cta_banner with dark neutral background (token-driven)
 */
/**
 * Additional CTA variants for premium style families:
 *
 *   cta_glow       — dark near-black section with a subtle brand-coloured radial glow
 *                   behind the headline; vivid primary CTA button. Dark AI family.
 *   cta_soft       — very light neutral section (bg-subtle); primary CTA + ghost secondary;
 *                   no dramatic background — lets copy carry weight. Clean Corporate.
 *   cta_newsletter — inline email capture; heading left, single email input + submit right;
 *                   no separate href-based CTA — form action driven. Content Blog family.
 */
export type CtaSectionVariant =
  | "cta_banner" | "cta_split" | "cta_card" | "cta_media_first" // full-section family
  | "cta_banner_default" | "cta_banner_compact"                  // compact banner family
  | "cta_glow" | "cta_soft" | "cta_newsletter"                  // premium / specialty variants
  | "default" | "brand" | "dark";                                // legacy aliases

/**
 * Variant for stats blocks.
 *
 *   default — row of large metric cards on a subtle-bg section
 *   compact — tight inline row; lower vertical footprint
 *   dark    — near-black section background with bright/vivid metric values;
 *             no card borders — colour contrast carries the separation.
 *             Dark AI / enterprise family variant.
 */
export type StatsVariant = "default" | "compact" | "dark";

/**
 * Variant for logoStrip blocks.
 *
 *   default   — logos at full contrast in a horizontal flex strip
 *   muted     — logos at reduced opacity; the classic "trusted by" treatment
 *   logo_grid — multi-row grid for larger logo clouds (6–12+ logos)
 */
/**
 * Variant for logoStrip blocks.
 *
 *   default         — logos at full contrast in a horizontal flex strip
 *   muted           — logos at reduced opacity; the classic "trusted by" treatment
 *   logo_grid       — multi-row grid for larger logo clouds (6–12+ logos)
 *   logo_wall_light — clean white background, full-colour logos; maximum brand
 *                     presence. Clean Corporate / light-bg family variant.
 */
export type LogoStripVariant = "default" | "muted" | "logo_grid" | "logo_wall_light";

/**
 * Variant for formSection blocks.
 *
 * Canonical spec keys:
 *   form_inline — full-width form on a subtle-bg section (default)
 *   form_split  — intro / heading left, form right
 *   form_panel  — form inside an elevated card container
 *
 * Legacy aliases:
 *   default → form_inline
 *   minimal → bare form with no section wrapper
 *   card    → form_panel
 */
export type FormSectionVariant =
  | "form_inline" | "form_split" | "form_panel"
  | "default" | "card" | "minimal"; // legacy aliases

/**
 * Variant for about / media-content blocks.
 *
 * Canonical spec keys (media family):
 *   media_right — text left, image right (default)
 *   media_left  — image left, text right
 *   media_full  — full-width image above text
 *
 * Legacy aliases + non-media variants:
 *   default   → editorial text section with optional image below
 *   split     → media_right
 *   team-grid → narrative copy above team member card grid
 */
export type AboutVariant =
  | "media_right" | "media_left" | "media_full"
  | "default" | "split" | "team-grid"; // legacy aliases

/**
 * Variant for newsList blocks.
 *
 *   default    — 3-col card grid (image + date + excerpt)
 *   grid       — explicit alias for card-grid layout
 *   list       — single-column row list
 *   featured   — first item displayed large; rest in smaller grid
 *   news_slider — horizontally scrolling card carousel
 */
export type NewsListVariant = "default" | "grid" | "list" | "featured" | "news_slider";

// ── Listing / detail variant unions ──────────────────────────────────────────

/**
 * Variant for listing blocks.
 *
 * Canonical spec keys:
 *   listing_cards   — 3-col card grid (default)
 *   listing_rows    — single-column row list
 *   listing_compact — dense list, reduced padding
 *   listing_slider  — horizontally scrolling card carousel
 *
 * Legacy aliases:
 *   default → listing_cards
 *   grid    → listing_cards
 *   list    → listing_rows
 *   compact → listing_compact
 */
export type ListingVariant =
  | "listing_cards" | "listing_rows" | "listing_compact" | "listing_slider"
  | "default" | "grid" | "list" | "compact"; // legacy aliases

/**
 * Variant for articleBody blocks.
 *
 *   default — standard prose column (~70ch)
 *   wide    — full content-column width
 */
export type ArticleBodyVariant = "default" | "wide";

/**
 * Variant for articleMeta blocks.
 *
 *   default — stacked metadata row below cover image
 *   compact — inline pill-row of metadata
 *   hero    — full-bleed cover image with overlaid metadata
 */
export type ArticleMetaVariant = "default" | "compact" | "hero";

/**
 * Variant for relatedContent blocks.
 *
 *   default        — 3-col card grid
 *   grid           — explicit alias for card-grid
 *   list           — single-column row list
 *   carousel       — horizontally scrolling card strip
 *   related_slider — CSS-scroll carousel matching the listing_slider pattern
 */
export type RelatedContentVariant = "default" | "grid" | "list" | "carousel" | "related_slider";

/**
 * Variant for vacancyMeta blocks.
 *
 *   default — metadata summary card centred on the page
 *   compact — condensed single-row badge strip
 *   sidebar — float-right card for two-column detail layout
 */
export type VacancyMetaVariant = "default" | "compact" | "sidebar";

/**
 * Variant for applyPanel blocks.
 *
 *   default — full-width application CTA section
 *   inline  — card embedded mid-page
 *   sticky  — sticky sidebar card (desktop)
 */
export type ApplyPanelVariant = "default" | "inline" | "sticky";

/**
 * Variant for filterBar blocks.
 *
 *   default  — full-width filter bar with labelled controls
 *   compact  — icon-driven collapsed filter bar
 *   expanded — all filters visible without interaction
 */
export type FilterBarVariant = "default" | "compact" | "expanded";

/**
 * Variant for searchResults blocks.
 *
 *   grid — card grid
 *   list — single-column row list
 */
export type SearchResultsVariant = "grid" | "list";

/**
 * Variant for pricingSection blocks.
 *
 *   pricing_tiers   — card grid, one elevated card per tier (default)
 *   pricing_compact — simplified row list; lower vertical footprint
 *   pricing_table   — comparison table layout; tiers as columns, features as rows
 */
export type PricingSectionVariant = "pricing_tiers" | "pricing_compact" | "pricing_table";

/**
 * Variant for contentSection blocks.
 *
 *   content_default — single left-aligned or centred column (default)
 *   content_split   — eyebrow/heading left, body/CTAs right (two-column)
 */
export type ContentSectionVariant = "content_default" | "content_split";

/**
 * Variant for teamSection blocks.
 *
 *   team_grid    — 3-col card grid (default)
 *   team_compact — tight single-column list: avatar + name + role inline
 */
export type TeamSectionVariant = "team_grid" | "team_compact";

// ── New core block variant unions ─────────────────────────────────────────────

/**
 * Variant for timeline blocks.
 *
 *   timeline_vertical   — stacked vertical timeline with line + alternating content (default)
 *   timeline_compact    — tight single-column list; lower vertical footprint
 *   timeline_milestones — icon + date emphasis; suitable for company history
 *   timeline_slider     — full-width slider: media left, title+text right, bottom nav bar
 */
export type TimelineVariant = "timeline_vertical" | "timeline_compact" | "timeline_milestones" | "timeline_slider";

/**
 * Variant for quickLinks blocks.
 *
 *   quicklinks_grid    — icon + label card grid (default)
 *   quicklinks_list    — single-column link list
 *   quicklinks_compact — dense tight grid, labels only (no descriptions)
 */
export type QuickLinksVariant = "quicklinks_grid" | "quicklinks_list" | "quicklinks_compact";

/**
 * Variant for textMedia blocks.
 *
 *   text_media_right   — text left, media right (default)
 *   text_media_left    — media left, text right
 *   text_media_stacked — media above, text below (full-width column)
 */
export type TextMediaVariant = "text_media_right" | "text_media_left" | "text_media_stacked";

/**
 * Variant for contactSection blocks.
 *
 *   contact_default — stacked contact cards on a subtle-bg section (default)
 *   contact_split   — contact details left, map / illustration right
 *   contact_minimal — compact inline contact row; no section background
 */
export type ContactSectionVariant = "contact_default" | "contact_split" | "contact_minimal";

// ── Careers / W6 variant unions ───────────────────────────────────────────────

/**
 * Variant for processSteps blocks.
 *
 *   default    — vertical numbered list with dividers
 *   accordion  — each step is a collapsible details/summary element
 *   compact    — tight inline numbered list
 *   horizontal — horizontal step track with connecting line and numbered nodes;
 *                ideal for short 3–5 step flows on landing pages.
 */
export type ProcessStepsVariant = "default" | "accordion" | "compact" | "horizontal";

/**
 * Variant for recruiterPanel blocks.
 *
 *   default — full card: avatar + name/role/bio + contact row
 *   compact — minimal inline bar: avatar + name + contact badges
 *   card    — elevated card style for standalone placement
 */
export type RecruiterPanelVariant = "default" | "compact" | "card";

// ═════════════════════════════════════════════════════════════════════════════
// VALID VARIANT SETS (content blocks)
// ═════════════════════════════════════════════════════════════════════════════
//
// Maps each block type to its complete set of valid variant keys (canonical
// spec names + legacy aliases).  Used by resolveBlockVariant() at runtime.
//
// `satisfies` gives a compile error if a key is in the union but missing from
// the set (or vice versa).

const BLOCK_VARIANT_SETS: Partial<Record<ContentBlockType, readonly string[]>> = {
  // ── Core marketing blocks ────────────────────────────────────────────────────
  textSection: [
    "text_single", "text_split", "text_lead",   // canonical
    "default", "centered",                        // legacy aliases
  ] satisfies readonly TextSectionVariant[],

  featureGrid: [
    "feature_grid_3up", "feature_grid_4up", "feature_grid_cards", "feature_grid_checklist", // canonical
    "feature_grid_dark", "feature_grid_spacious",                                            // premium family variants
    "feature_spotlight",                                                                     // media + offer
    "default", "cards", "compact", "icons-left",                                             // legacy aliases
  ] satisfies readonly FeatureGridVariant[],

  testimonialSection: [
    "testimonial_grid", "testimonial_single", "testimonial_highlight", // canonical
    "testimonial_slider", "testimonial_featured_image",                 // new variants
    "default", "quote-card",                                            // legacy aliases
  ] satisfies readonly TestimonialVariant[],

  faqSection: [
    "faq_default", "faq_split",   // canonical
    "default", "two-col",          // legacy aliases
  ] satisfies readonly FaqSectionVariant[],

  ctaSection: [
    "cta_banner", "cta_split", "cta_card", "cta_media_first", // canonical full-section
    "cta_banner_default", "cta_banner_compact",                // canonical compact banner
    "cta_glow", "cta_soft", "cta_newsletter",                 // premium / specialty variants
    "default", "brand", "dark",                                // legacy aliases
  ] satisfies readonly CtaSectionVariant[],

  // ── Social proof / media ─────────────────────────────────────────────────────
  stats:     ["default", "compact", "dark"]       satisfies readonly StatsVariant[],
  logoStrip: ["default", "muted", "logo_grid", "logo_wall_light"] satisfies readonly LogoStripVariant[],

  // ── Form ─────────────────────────────────────────────────────────────────────
  formSection: [
    "form_inline", "form_split", "form_panel",  // canonical
    "default", "card", "minimal",                // legacy aliases
  ] satisfies readonly FormSectionVariant[],

  // ── Content ──────────────────────────────────────────────────────────────────
  about: [
    "media_right", "media_left", "media_full",  // canonical (media family)
    "default", "split", "team-grid",             // legacy + non-media variants
  ] satisfies readonly AboutVariant[],

  newsList: ["default", "grid", "list", "featured", "news_slider"] satisfies readonly NewsListVariant[],

  // ── Listing / overview ────────────────────────────────────────────────────────
  listing: [
    "listing_cards", "listing_rows", "listing_compact", "listing_slider", // canonical
    "default", "grid", "list", "compact",                                  // legacy aliases
  ] satisfies readonly ListingVariant[],

  articleBody:    ["default", "wide"]                         satisfies readonly ArticleBodyVariant[],
  articleMeta:    ["default", "compact", "hero"]              satisfies readonly ArticleMetaVariant[],
  relatedContent: ["default", "grid", "list", "carousel", "related_slider"] satisfies readonly RelatedContentVariant[],
  vacancyMeta:    ["default", "compact", "sidebar"]           satisfies readonly VacancyMetaVariant[],
  applyPanel:     ["default", "inline", "sticky"]             satisfies readonly ApplyPanelVariant[],
  filterBar:      ["default", "compact", "expanded"]          satisfies readonly FilterBarVariant[],
  searchResults:  ["grid", "list"]                            satisfies readonly SearchResultsVariant[],

  // ── Careers / W6 ─────────────────────────────────────────────────────────────
  processSteps:  ["default", "accordion", "compact", "horizontal"] satisfies readonly ProcessStepsVariant[],
  recruiterPanel:["default", "compact", "card"]      satisfies readonly RecruiterPanelVariant[],

  // ── Conversion / pricing ──────────────────────────────────────────────────────
  pricingSection: ["pricing_tiers", "pricing_compact", "pricing_table"] satisfies readonly PricingSectionVariant[],

  // ── Content / editorial ───────────────────────────────────────────────────────
  contentSection: ["content_default", "content_split"] satisfies readonly ContentSectionVariant[],
  teamSection:    ["team_grid", "team_compact"]         satisfies readonly TeamSectionVariant[],

  // ── New core blocks ───────────────────────────────────────────────────────────
  timeline:       ["timeline_vertical", "timeline_compact", "timeline_milestones", "timeline_slider"] satisfies readonly TimelineVariant[],
  quickLinks:     ["quicklinks_grid", "quicklinks_list", "quicklinks_compact"]     satisfies readonly QuickLinksVariant[],
  textMedia:      ["text_media_right", "text_media_left", "text_media_stacked"]    satisfies readonly TextMediaVariant[],
  contactSection: ["contact_default", "contact_split", "contact_minimal"]          satisfies readonly ContactSectionVariant[],
} as const;

// ═════════════════════════════════════════════════════════════════════════════
// RESOLVERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Normalise a raw variant string for the given content block type.
 *
 * Returns the raw value when it is in the block's valid variant set.
 * Returns `"default"` when the value is absent, empty, or unrecognised.
 * Never throws — safe to call with untrusted CMS or config values.
 *
 * @example
 * resolveBlockVariant("featureGrid", "feature_grid_4up") // → "feature_grid_4up"
 * resolveBlockVariant("featureGrid", "cards")            // → "cards" (legacy alias)
 * resolveBlockVariant("featureGrid", "unknown")          // → "default"
 * resolveBlockVariant("featureGrid", undefined)          // → "default"
 * resolveBlockVariant("richText",    "anything")         // → "default" (no variants)
 */
export function resolveBlockVariant(
  blockType: ContentBlockType,
  rawVariant?: string,
): string {
  if (!rawVariant) return "default";
  const valid = BLOCK_VARIANT_SETS[blockType];
  if (!valid) return "default";
  return valid.includes(rawVariant) ? rawVariant : "default";
}

/**
 * Normalise a raw layout variant string for a context slot block.
 *
 * Context slot blocks (Hero, Proof, CTA, Header) use a separate variant
 * namespace from content blocks.  This resolver validates against that
 * namespace and returns the family-specific default when the input is
 * absent or unrecognised.
 *
 * Returns the raw value when it is registered for the given slot;
 * returns the family default otherwise. Never throws.
 *
 * @example
 * resolveContextBlockVariant("hero",  "hero_split")    // → "hero_split"
 * resolveContextBlockVariant("hero",  undefined)        // → "hero_default"
 * resolveContextBlockVariant("proof", "proof_logos")   // → "proof_logos"
 * resolveContextBlockVariant("proof", "unknown")       // → "proof_stats"
 * resolveContextBlockVariant("cta",   "cta_card")      // → "cta_card"
 */
export function resolveContextBlockVariant(
  slotId: "hero" | "proof" | "cta" | "header",
  rawVariant?: string,
): string {
  const fallback = CONTEXT_VARIANT_DEFAULTS[slotId] ?? "default";
  if (!rawVariant) return fallback;
  const valid = CONTEXT_VARIANT_SETS[slotId];
  if (!valid) return fallback;
  return valid.includes(rawVariant) ? rawVariant : fallback;
}

/**
 * Returns the ordered list of valid variant keys for a content block type.
 * Returns an empty tuple when the block has no variant support.
 *
 * Useful for building block-picker UIs that surface variant options.
 *
 * @example
 * getBlockValidVariants("featureGrid")
 * // → ["feature_grid_3up", "feature_grid_4up", "feature_grid_cards",
 * //    "feature_grid_checklist", "default", "cards", "compact", "icons-left"]
 *
 * getBlockValidVariants("richText")
 * // → []
 */
export function getBlockValidVariants(blockType: ContentBlockType): readonly string[] {
  return BLOCK_VARIANT_SETS[blockType] ?? [];
}
