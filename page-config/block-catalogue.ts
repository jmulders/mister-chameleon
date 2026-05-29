/**
 * Block Catalogue — Admin UI Extensions
 *
 * Extends the structural block registry (page-config/registry.ts) with
 * admin-UI-specific metadata:
 *
 *   - Human-readable descriptions for the Allowed Blocks catalogue.
 *   - Storybook story slugs for deep-linking to autodocs pages.
 *   - Context block catalogue (adaptive slots) with display names and
 *     descriptions — separate from ContentBlockType because context blocks
 *     are not CMS-authored content sections.
 *
 * ─── Source alignment ─────────────────────────────────────────────────────────
 *
 *   Block story files follow the naming pattern:
 *     Component file:   {PascalKey}Block.tsx
 *     Story file:       {PascalKey}Block.stories.tsx
 *     Story meta title: "Blocks/Sections/{PascalKey}"  (drops "Block" suffix)
 *     Storybook slug:   "blocks-sections-{lowercase_pascal}"
 *
 *   The `storySlug()` helper computes slugs programmatically so that adding a
 *   new block to the registry and creating a matching `*.stories.tsx` file
 *   automatically yields a valid deep-link without manual catalogue maintenance.
 *
 * ─── What this is NOT ─────────────────────────────────────────────────────────
 *
 *   This file contains no React or Next.js dependencies — it is safe to import
 *   in both server components and client components.
 *
 *   Package entitlements and allow-lists live in tenant/packages.ts.
 *   Block variants (the per-block visual options) come from registry.ts
 *   `BlockDefinition.allowedVariants` — not duplicated here.
 */

import type { ContentBlockKey, ContextBlockKey } from "@/tenant";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockCatalogueEntry {
  /** Short human-readable description shown in the admin block catalogue. */
  readonly description: string;
  /**
   * Storybook docs slug for deep-linking to the autodocs page.
   * `null` when no story file exists yet for this block.
   *
   * Full URL is built by `buildStorybookUrl()`.
   *
   * @example "blocks-sections-featuregrid"
   */
  readonly storybookSlug: string | null;
}

export interface ContextBlockCatalogueEntry extends BlockCatalogueEntry {
  readonly key:         ContextBlockKey;
  readonly displayName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storybook slug derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives the Storybook docs slug from a content block key.
 *
 * Story files are named `{PascalKey}Block.stories.tsx` and their meta title
 * is `"Blocks/Sections/{PascalKey}"` — i.e. the "Block" suffix is stripped.
 * Storybook then converts the title to a kebab-case slug.
 *
 * @example
 *   storySlug("featureGrid")   → "blocks-sections-featuregrid"
 *   storySlug("checkoutBlock") → "blocks-sections-checkout"  ("Block" stripped)
 *   storySlug("ctaSection")    → "blocks-sections-ctasection"
 */
function storySlug(key: string): string {
  const pascal   = key.charAt(0).toUpperCase() + key.slice(1);
  const titlePart = pascal.endsWith("Block") ? pascal.slice(0, -5) : pascal;
  return `blocks-sections-${titlePart.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocks without Storybook stories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Content block keys that do not yet have a `*.stories.tsx` file.
 * These receive `storybookSlug: null` and the admin UI omits the Storybook link.
 */
const BLOCKS_WITHOUT_STORIES = new Set<ContentBlockKey>([
  "image",
  "video",
  "slider",
  "quote",
  "caseHighlight",
  "searchResults",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Content block descriptions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Short descriptions for every content block type.
 * Typed as `Record<ContentBlockKey, string>` — TypeScript ensures exhaustiveness.
 */
const DESCRIPTIONS: Record<ContentBlockKey, string> = {
  // ── Text ──────────────────────────────────────────────────────────────────
  textSection:        "Heading with rich text body — the standard paragraph section.",
  richText:           "Portable rich text with inline formatting, links, and embedded media.",
  articleBody:        "Rich text body renderer for blog posts and long-form articles.",

  // ── Media ─────────────────────────────────────────────────────────────────
  image:              "Full-width, contained, float-left, or float-right image placement.",
  video:              "Embedded video player — YouTube, Vimeo, or self-hosted.",
  slider:             "Multi-item image or media carousel with configurable slide layout.",

  // ── Social proof ──────────────────────────────────────────────────────────
  testimonialSection: "Customer quotes with author, role, and avatar — grid or slider layouts.",
  quote:              "Large pull-quote with optional source attribution.",
  logoStrip:          "Row of client or partner logos, optionally muted or in a grid.",
  stats:              "Key metrics displayed as large numbers in a compact strip.",

  // ── Features ──────────────────────────────────────────────────────────────
  featureGrid:        "Icon and text feature grid — 3-up, 4-up, checklist, and card variants.",
  productOverview:    "Product catalogue grid — cards, list, and filterable grid layouts.",

  // ── Content ───────────────────────────────────────────────────────────────
  faqSection:         "Accordion FAQ block — collapsed list and split-panel layouts.",
  about:              "Split media block — image or video alongside heading and body text.",
  newsList:           "Latest news or blog posts in grid, list, or slider form.",
  caseHighlight:      "Compact or expanded highlight card for a single customer case study.",
  listing:            "Paginated content listing — cards, rows, compact, or slider.",
  articleMeta:        "Publication date, author, reading time, and category metadata row.",
  relatedContent:     "Grid or carousel of related articles, posts, or pages.",
  vacancyMeta:        "Job details header — title, location, contract type, and department.",
  applyPanel:         "Apply button and application form trigger panel for vacancy pages.",
  filterBar:          "Filter chips or dropdowns for listing and search overview pages.",
  searchResults:      "Internal rendering block — populated automatically by the search provider.",
  search:             "Full-text search input with inline results from the configured provider.",
  processSteps:       "Numbered or visual steps for explaining a process or application workflow.",
  contentSection:     "Editorial content section — default and split-panel editorial layouts.",
  teamSection:        "Team member grid or compact list with names, roles, and photos.",
  timeline:           "Vertical or milestone timeline for history, roadmap, or process pages.",
  quickLinks:         "Navigation shortcuts — grid, list, or compact chip link layouts.",
  textMedia:          "Text alongside image or video — side-by-side or stacked variants.",
  productDetail:      "Single product detail — hero image, description, and add-to-cart.",

  // ── Conversion ────────────────────────────────────────────────────────────
  ctaSection:         "Full-section call-to-action banner — banner, split, card, and media variants.",
  formSection:        "Renders a registered platform form with heading, labels, and submit button.",
  recruiterPanel:     "Recruiter profile card with contact details and open vacancy list.",
  pricingSection:     "Pricing tier comparison table — tiers, compact, and full-table variants.",
  contactSection:     "Contact form with optional address block, map, or split-panel layout.",
  cartSummary:        "Shopping cart with line items, quantities, and order totals.",
  checkoutBlock:      "Multi-step checkout flow with payment and shipping forms.",
  mapBlock:           "Google Maps embed with office address, email, and phone contact details.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Content block catalogue  (built from descriptions + storySlug)
// ─────────────────────────────────────────────────────────────────────────────

const CONTENT_BLOCK_CATALOGUE: Record<ContentBlockKey, BlockCatalogueEntry> =
  Object.fromEntries(
    (Object.keys(DESCRIPTIONS) as ContentBlockKey[]).map((key) => [
      key,
      {
        description:   DESCRIPTIONS[key],
        storybookSlug: BLOCKS_WITHOUT_STORIES.has(key) ? null : storySlug(key),
      } satisfies BlockCatalogueEntry,
    ]),
  ) as Record<ContentBlockKey, BlockCatalogueEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// Context block catalogue  (adaptive slots)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catalogue entries for all context block keys.
 *
 * Context blocks ("hero", "proof", etc.) are adaptive slots populated by the
 * rules or AI engine at request time — they are not CMS content sections.
 * Their Storybook stories live outside `components/blocks/sections/` so
 * storybookSlug is null for all of them for now.
 */
export const CONTEXT_BLOCK_CATALOGUE: readonly ContextBlockCatalogueEntry[] = [
  {
    key:           "hero",
    displayName:   "Hero",
    description:   "Adaptive hero section — the rules/AI engine picks the best variant (heroVariant) for each visitor at request time.",
    storybookSlug: null,
  },
  {
    key:           "proof",
    displayName:   "Social proof",
    description:   "Adaptive social proof slot — rendered as testimonials, logos, or case studies based on visitor context signals.",
    storybookSlug: null,
  },
  {
    key:           "cta",
    displayName:   "Call to action",
    description:   "Adaptive CTA — the variant is selected at runtime to match the visitor's current conversion context.",
    storybookSlug: null,
  },
  {
    key:           "feature",
    displayName:   "Feature",
    description:   "Adaptive feature showcase slot — variant chosen based on the visitor's interest profile and browsing signals.",
    storybookSlug: null,
  },
  {
    key:           "conversion",
    displayName:   "Conversion",
    description:   "Adaptive conversion block — personalised to maximise engagement for each visitor segment.",
    storybookSlug: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns catalogue metadata for a content block type.
 *
 * Safe to call with any string — returns a fallback entry for unknown keys
 * instead of throwing.
 *
 * @example
 *   const entry = getBlockCatalogueEntry("featureGrid");
 *   entry.description    // "Icon and text feature grid…"
 *   entry.storybookSlug  // "blocks-sections-featuregrid"
 */
export function getBlockCatalogueEntry(key: ContentBlockKey): BlockCatalogueEntry {
  return (
    (CONTENT_BLOCK_CATALOGUE as Record<string, BlockCatalogueEntry>)[key] ?? {
      description:   "No description available.",
      storybookSlug: null,
    }
  );
}

/**
 * Builds the full Storybook autodocs URL for a block.
 *
 * Returns `null` when no story exists for this block.
 *
 * @param key       ContentBlockKey to look up.
 * @param baseUrl   Storybook base URL. Defaults to `"http://localhost:6006"`.
 *
 * @example
 *   buildStorybookUrl("featureGrid")
 *   // "http://localhost:6006/?path=/docs/blocks-sections-featuregrid--docs"
 *
 *   buildStorybookUrl("featureGrid", "https://storybook.example.com")
 *   // "https://storybook.example.com/?path=/docs/blocks-sections-featuregrid--docs"
 */
export function buildStorybookUrl(
  key:     ContentBlockKey,
  baseUrl = "http://localhost:6006",
): string | null {
  const entry = (CONTENT_BLOCK_CATALOGUE as Record<string, BlockCatalogueEntry>)[key];
  if (!entry?.storybookSlug) return null;
  return `${baseUrl}/?path=/docs/${entry.storybookSlug}--docs`;
}
