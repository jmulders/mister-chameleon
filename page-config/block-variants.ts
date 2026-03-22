/**
 * Block Variant Definitions
 *
 * Typed variant unions for each content block type that supports visual
 * variation, plus helpers for resolving raw variant strings to known-valid
 * values.
 *
 * ─── Model ───────────────────────────────────────────────────────────────────
 *
 *   A block TYPE  governs data shape, CMS schema, and block identity.
 *   A block VARIANT governs visual presentation only — it NEVER changes the
 *   data shape, the block type, or the slot structure.
 *
 *   Variants are optional.  Every block that supports variants must also
 *   support a "default" variant so that components can fall back safely when
 *   no variant is specified or an unrecognised value is stored in the CMS.
 *
 * ─── Resolving variants ───────────────────────────────────────────────────────
 *
 *   ContentBlockRenderer passes `block.variant` directly to the component.
 *   The component resolves it to a typed value using `resolveBlockVariant()`.
 *   Unknown or absent values always resolve to `"default"`.
 *
 * ─── Adding a new variant ────────────────────────────────────────────────────
 *
 *   1. Add the new key to the appropriate *Variant union below.
 *   2. Add it to the corresponding entry in BLOCK_VARIANT_SETS.
 *   3. Implement the rendering branch in the component.
 *   4. Update the BlockDefinition allowedVariants in registry.ts.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 * @example
 * // Inside a block component:
 * import { resolveBlockVariant } from "@/page-config/block-variants";
 * import type { FeatureGridVariant } from "@/page-config/block-variants";
 *
 * const variant = resolveBlockVariant("featureGrid", rawVariant) as FeatureGridVariant;
 *
 * // ContentBlockRenderer just passes block.variant as-is:
 * <FeatureGridBlock data={block.data} variant={block.variant} />
 */

import type { ContentBlockType } from "./types";

// ── Per-block variant unions ──────────────────────────────────────────────────
//
// Only blocks with implemented visual variants are enumerated here.
// Blocks without variant support always render their single "default" layout.

/**
 * Visual variant for textSection blocks.
 *
 *   default  — left-aligned text, standard container width
 *   centered — center-aligned text with reduced max-width for readability
 */
export type TextSectionVariant = "default" | "centered";

/**
 * Visual variant for featureGrid blocks.
 *
 *   default    — 3-col bordered card grid on a subtle-bg section
 *   cards      — elevated card grid on white; no section border
 *   compact    — 2-col dense grid; tighter padding; good for long lists
 *   icons-left — horizontal icon + text rows; scans like a checklist
 */
export type FeatureGridVariant = "default" | "cards" | "compact" | "icons-left";

/**
 * Visual variant for testimonialSection blocks.
 *
 *   default    — 3-col grid of bordered quote cards
 *   quote-card — full-width single-column centered quote layout
 *                with large attribution and prominent quote mark
 */
export type TestimonialVariant = "default" | "quote-card";

/**
 * Visual variant for faqSection blocks.
 *
 *   default — single-column accordion on a subtle-bg section
 *   two-col — two-column accordion grid; efficient for dense FAQ sets
 */
export type FaqSectionVariant = "default" | "two-col";

/**
 * Background/visual variant for ctaSection blocks.
 *
 *   default — uses var(--section-cta-bg); standard brand-coloured background
 *   brand   — explicit brand accent (alias for default; useful for CMS clarity)
 *   dark    — dark neutral background; pairs well with lighter page sections
 */
export type CtaSectionVariant = "default" | "brand" | "dark";

/**
 * Visual variant for stats blocks.
 *
 *   default — row of large metric cards on a subtle-bg section; full spacing
 *   compact — tight inline row; lower vertical footprint for mid-page embeds
 */
export type StatsVariant = "default" | "compact";

/**
 * Visual variant for logoStrip blocks.
 *
 *   default — logos at full contrast
 *   muted   — logos at reduced opacity; the classic "trusted by" treatment
 */
export type LogoStripVariant = "default" | "muted";

/**
 * Visual variant for formSection blocks.
 *
 *   default — form on a subtle-bg section with top/bottom border separator.
 *             Matches the visual weight of featureGrid and faqSection.
 *
 *   card    — form inside an elevated card container on a plain-bg section.
 *             Draws attention to the form; ideal for standalone form pages.
 *
 *   minimal — no section background or border; form floats directly on the
 *             page surface.  Best for embedding within article or editorial
 *             content where a full section wrapper feels too heavy.
 */
export type FormSectionVariant = "default" | "card" | "minimal";

/**
 * Visual variant for about / split-media blocks.
 *
 *   default   — narrative text section with optional feature image above
 *   split     — image and text side-by-side (image right by default)
 *   team-grid — team member card grid below the narrative copy
 */
export type AboutVariant = "default" | "split" | "team-grid";

/**
 * Visual variant for newsList blocks.
 *
 *   default  — 3-col card grid with image, date, and excerpt
 *   grid     — explicit alias for the card-grid layout
 *   list     — single-column row list; more info per item
 *   featured — first item displayed large; remaining items in a smaller grid
 */
export type NewsListVariant = "default" | "grid" | "list" | "featured";

// ── Listing / detail variant unions ──────────────────────────────────────────

/**
 * Visual variant for listing blocks.
 *
 *   default — 3-col card grid; the standard overview layout
 *   grid    — explicit alias for the card-grid layout
 *   list    — single-column row list; more info per item, less scanning
 *   compact — dense list with reduced card padding; good for sidebar embeds
 */
export type ListingVariant = "default" | "grid" | "list" | "compact";

/**
 * Visual variant for articleBody blocks.
 *
 *   default — standard prose column (~70ch); optimised for reading
 *   wide    — full content-column width; for image-heavy long-form content
 */
export type ArticleBodyVariant = "default" | "wide";

/**
 * Visual variant for articleMeta blocks.
 *
 *   default — stacked metadata row below a cover image; standard blog layout
 *   compact — inline pill-row of metadata; good for list items and sidebars
 *   hero    — full-bleed cover image with overlaid metadata; magazine style
 */
export type ArticleMetaVariant = "default" | "compact" | "hero";

/**
 * Visual variant for relatedContent blocks.
 *
 *   default  — 3-col card grid (matches listing/default)
 *   grid     — explicit alias for the card-grid layout
 *   list     — single-column row list
 *   carousel — horizontally scrolling card strip; good for mobile
 */
export type RelatedContentVariant = "default" | "grid" | "list" | "carousel";

/**
 * Visual variant for vacancyMeta blocks.
 *
 *   default — metadata summary card centred on the page
 *   compact — condensed single-row badge strip; good below the article title
 *   sidebar — float-right card intended for a two-column detail layout
 */
export type VacancyMetaVariant = "default" | "compact" | "sidebar";

/**
 * Visual variant for applyPanel blocks.
 *
 *   default — full-width application CTA section; standard vacancy footer
 *   inline  — card embedded mid-page, e.g. between body sections
 *   sticky  — sticky sidebar card that follows the reader on desktop
 */
export type ApplyPanelVariant = "default" | "inline" | "sticky";

/**
 * Visual variant for filterBar blocks.
 *
 *   default  — full-width filter bar with labelled controls
 *   compact  — icon-driven collapsed filter bar; expands on interaction
 *   expanded — all filters visible without needing interaction
 */
export type FilterBarVariant = "default" | "compact" | "expanded";

/**
 * Visual variant for searchResults blocks.
 *
 *   grid — card grid (matches listing/grid)
 *   list — single-column row list
 */
export type SearchResultsVariant = "grid" | "list";

// ── Careers / W6 variant unions ───────────────────────────────────────────────

/**
 * Visual variant for processSteps blocks.
 *
 *   default   — vertical numbered list with dividers
 *   accordion — each step is a collapsible <details>/<summary> element
 *   compact   — tight inline numbered list; lower vertical footprint
 */
export type ProcessStepsVariant = "default" | "accordion" | "compact";

/**
 * Visual variant for recruiterPanel blocks.
 *
 *   default — full card: avatar + name/role/bio + contact row
 *   compact — minimal inline bar: avatar + name + contact badges
 *   card    — elevated card style for standalone placement
 */
export type RecruiterPanelVariant = "default" | "compact" | "card";

// ── Valid variant sets ────────────────────────────────────────────────────────
//
// Internal registry mapping each block type to its allowed variant strings.
// Using `satisfies` to get a compile error if a variant is added to the union
// but not added to the set (and vice versa).

const BLOCK_VARIANT_SETS: Partial<Record<ContentBlockType, readonly string[]>> = {
  // ── Live blocks ─────────────────────────────────────────────────────────────
  textSection:        ["default", "centered"]                         satisfies readonly TextSectionVariant[],
  featureGrid:        ["default", "cards", "compact", "icons-left"]   satisfies readonly FeatureGridVariant[],
  testimonialSection: ["default", "quote-card"]                       satisfies readonly TestimonialVariant[],
  faqSection:         ["default", "two-col"]                          satisfies readonly FaqSectionVariant[],
  ctaSection:         ["default", "brand", "dark"]                    satisfies readonly CtaSectionVariant[],
  stats:              ["default", "compact"]                          satisfies readonly StatsVariant[],
  logoStrip:          ["default", "muted"]                            satisfies readonly LogoStripVariant[],
  formSection:        ["default", "card", "minimal"]                  satisfies readonly FormSectionVariant[],
  about:              ["default", "split", "team-grid"]               satisfies readonly AboutVariant[],
  newsList:           ["default", "grid", "list", "featured"]         satisfies readonly NewsListVariant[],
  // ── Listing / detail blocks ──────────────────────────────────────────────────
  listing:            ["default", "grid", "list", "compact"]          satisfies readonly ListingVariant[],
  articleBody:        ["default", "wide"]                             satisfies readonly ArticleBodyVariant[],
  articleMeta:        ["default", "compact", "hero"]                  satisfies readonly ArticleMetaVariant[],
  relatedContent:     ["default", "grid", "list", "carousel"]         satisfies readonly RelatedContentVariant[],
  vacancyMeta:        ["default", "compact", "sidebar"]               satisfies readonly VacancyMetaVariant[],
  applyPanel:         ["default", "inline", "sticky"]                 satisfies readonly ApplyPanelVariant[],
  filterBar:          ["default", "compact", "expanded"]              satisfies readonly FilterBarVariant[],
  searchResults:      ["grid", "list"]                                satisfies readonly SearchResultsVariant[],
  // ── Careers / W6 blocks ─────────────────────────────────────────────────────
  processSteps:       ["default", "accordion", "compact"]             satisfies readonly ProcessStepsVariant[],
  recruiterPanel:     ["default", "compact", "card"]                  satisfies readonly RecruiterPanelVariant[],
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a raw variant string for the given block type.
 *
 * Returns the raw value when it is in the block's valid variant set;
 * returns `"default"` when the value is absent, empty, or unrecognised.
 * Never throws — safe to call with untrusted CMS or config values.
 *
 * @example
 * resolveBlockVariant("featureGrid", "icons-left")  // → "icons-left"
 * resolveBlockVariant("featureGrid", "unknown")     // → "default"
 * resolveBlockVariant("featureGrid", undefined)     // → "default"
 * resolveBlockVariant("richText",    "anything")    // → "default" (no variants)
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
 * Returns the ordered list of valid variant keys for a block type.
 * Returns an empty tuple when the block has no variant support.
 *
 * Useful for building block-picker UIs that surface variant options.
 *
 * @example
 * getBlockValidVariants("featureGrid")
 * // → ["default", "cards", "compact", "icons-left"]
 *
 * getBlockValidVariants("richText")
 * // → []
 */
export function getBlockValidVariants(blockType: ContentBlockType): readonly string[] {
  return BLOCK_VARIANT_SETS[blockType] ?? [];
}
