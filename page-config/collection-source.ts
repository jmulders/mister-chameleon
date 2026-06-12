/**
 * Collection content source model — platform-internal, CMS-agnostic
 *
 * This module defines the platform's reusable editorial model for blocks that
 * can display items from a content collection rather than (or in addition to)
 * manually authored inline items.
 *
 * ─── Architecture role ────────────────────────────────────────────────────────
 *
 *   This model lives in page-config (the CMS-agnostic platform layer) so it is
 *   not tied to any particular CMS implementation.  CMSProvider implementations
 *   map CMS-specific collection concepts (Sanity document types, Statamic
 *   collections, Storyblok stories) into the normalized CollectionItem shape.
 *
 *   Flow:
 *     CMS (CmsContentSource authored in block)
 *       ↓  CMS mapper (mapCmsContentSource → ContentSource)
 *     ContentBlock.data.contentSource   ← YOU ARE HERE
 *       ↓  collection-resolver (resolveXxxItems at render time)
 *     Block items ready for rendering
 *
 * ─── Collection keys ──────────────────────────────────────────────────────────
 *
 *   Collection keys are stable platform identifiers.  Each CMS provider maps
 *   these keys to its own collection/content-type concept:
 *
 *     "articles"   — news articles / blog posts
 *     "vacancies"  — job vacancies / careers listings
 *     "cases"      — case studies / client highlights
 *     "news"       — short news items (alias of articles for CMS providers that
 *                    do not distinguish between long-form posts and news items)
 *     "companies"  — company / client profiles
 *
 *   Providers SHOULD handle all keys; they MAY return [] for keys they do not
 *   support rather than throwing.
 *
 * ─── Modes ────────────────────────────────────────────────────────────────────
 *
 *   "recent"   — fetch the N most recently published items from the collection.
 *                Ordered by publication date descending (or ascending when
 *                sortDir === "asc").  `limit` caps the result count.
 *
 *   "specific" — fetch specific items by ID, returned in the same order as
 *                `selectedIds`.  The provider fetches by IDs and the resolver
 *                re-sorts to match the authored order.  `limit` is ignored in
 *                specific mode; selectedIds length implicitly limits the set.
 *
 * ─── Manual ordering ──────────────────────────────────────────────────────────
 *
 *   In "specific" mode, `selectedIds` is the single source of truth for render
 *   order.  The array is stored as-authored, never re-sorted by the platform.
 *   Editors change order by editing selectedIds (e.g. via the drag-to-reorder
 *   CollectionSourcePicker in the admin UI).
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   All blocks that support ContentSource continue to work with their existing
 *   manual `items` array when `contentSource` is absent or `{ source: "manual" }`.
 *   No existing blocks or data are affected.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Collection keys
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-internal identifier for a content collection.
 *
 * CMS providers map each key to their own collection/content-type concept.
 * Use these keys in ContentSource — never use CMS-specific type names.
 */
export type CollectionKey =
  | "articles"      // news articles / blog posts
  | "vacancies"     // job openings / careers listings
  | "cases"         // case studies / client highlights
  | "news"          // short news items (alias of articles for some providers)
  | "companies"     // company / client profiles
  | "team_members"; // team member profiles

/**
 * Human-readable labels for collection keys.
 * Used in the admin UI CollectionSourcePicker.
 */
export const COLLECTION_KEY_LABELS: Record<CollectionKey, string> = {
  articles:     "Articles / Blog posts",
  vacancies:    "Vacancies",
  cases:        "Case studies",
  news:         "News items",
  companies:    "Companies",
  team_members: "Team members",
};

// ─────────────────────────────────────────────────────────────────────────────
// Source modes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How items are selected from the collection.
 *
 *   "recent"   — N most recent items; ordered by publication date
 *   "specific" — exact items chosen by the editor; order preserved from selectedIds
 */
export type CollectionSourceMode = "recent" | "specific";

/**
 * Sort direction for "recent" mode.
 * Has no effect in "specific" mode (order comes from selectedIds).
 */
export type CollectionSortDir = "desc" | "asc";

// ─────────────────────────────────────────────────────────────────────────────
// ContentSource union
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manual source — items are authored inline in the block.
 *
 * This is the default (backward-compatible) mode.  When `contentSource` is
 * absent on a block data type, this source is implied.
 */
export interface ManualContentSource {
  readonly source: "manual";
}

/**
 * Collection-driven source — items are resolved at render time from the
 * CMSProvider's collection methods.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   source        "collection" — discriminant
 *   collection    Which content collection to draw from (see CollectionKey)
 *   mode          "recent" or "specific" — how items are selected
 *   limit         Maximum items to fetch/display
 *                   recent mode:   hard cap on the API fetch + display
 *                   specific mode: ignored; selectedIds.length is the cap
 *   sortDir       "desc" (newest first, default) or "asc"
 *                   Only meaningful for recent mode
 *   selectedIds   Stable CMS document IDs in explicit editorial order
 *                   Only used in specific mode; MUST be preserved as-authored
 *                   The provider fetches these IDs and the resolver re-orders
 *                   the results to match this array
 */
export interface CollectionContentSource {
  readonly source:       "collection";
  readonly collection:   CollectionKey;
  readonly mode:         CollectionSourceMode;
  /** Max items (recent mode) or display cap (specific mode is capped by selectedIds) */
  readonly limit?:       number;
  /** Sort direction for recent mode; defaults to "desc" */
  readonly sortDir?:     CollectionSortDir;
  /**
   * Ordered list of stable CMS document IDs.
   * Only relevant in specific mode.  The order is the render order.
   */
  readonly selectedIds?: readonly string[];
}

/**
 * The platform's unified editorial content source for collection-capable blocks.
 *
 * When stored on a block data type:
 *   { source: "manual" }     → use the inline items array (default behaviour)
 *   { source: "collection" } → resolve items from CMSProvider at render time
 */
export type ContentSource = ManualContentSource | CollectionContentSource;

// ─────────────────────────────────────────────────────────────────────────────
// Normalized collection item
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized item returned by CMSProvider.resolveCollection().
 *
 * This is the platform-internal, CMS-agnostic shape for a single item from
 * any collection.  CMS providers map their entity types to this shape.
 *
 * Intentionally a superset of ListingItem / RelatedItem / NewsItem so that
 * collection-resolver helpers can convert to any of those shapes without loss.
 *
 * ─── ID ───────────────────────────────────────────────────────────────────────
 *
 *   `id` is the provider-stable document identifier used for:
 *     - React key props
 *     - Matching against selectedIds in specific mode
 *     - Deduplication
 *
 *   The provider must always populate `id`; the value should correspond to the
 *   CMS document's stable ID (Sanity `_id`, Storyblok `id`, Statamic `id`).
 */
export interface CollectionItem {
  readonly id:        string;
  readonly title:     string;
  /** Absolute or root-relative URL to the item's detail page */
  readonly href:      string;
  readonly excerpt?:  string;
  /** ISO 8601 publication date, e.g. "2024-09-01" */
  readonly date?:     string;
  /**
   * Whether to display the date on the card. Defaults to `true` when absent.
   * Set to `false` via the CMS "Show date" card toggle to hide the date for a
   * specific item without clearing the date value itself.
   */
  readonly showDate?: boolean;
  readonly imageUrl?:      string;
  /** Image shown on card hover — optional, falls back to imageUrl when absent */
  readonly hoverImageUrl?: string;
  readonly imageAlt?:      string;
  readonly category?:      string;
  readonly tags?:          readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Narrows a ContentSource to a CollectionContentSource.
 *
 * @example
 * if (isCollectionSource(block.data.contentSource)) {
 *   const items = await resolveListingItems(provider, block.data.contentSource, []);
 * }
 */
export function isCollectionSource(src: ContentSource | undefined): src is CollectionContentSource {
  return src?.source === "collection";
}

/**
 * Returns true when the ContentSource instructs the renderer to use inline items.
 * This covers both the explicit manual source and the absent-source case.
 */
export function isManualSource(src: ContentSource | undefined): src is ManualContentSource | undefined {
  return !src || src.source === "manual";
}

/** Returns true when the string is a recognised CollectionKey. */
export function isCollectionKey(key: string): key is CollectionKey {
  return ["articles", "vacancies", "cases", "news", "companies"].includes(key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Listing filters (taxonomy-driven)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single selectable value in a filter group.
 *
 * `value` is the taxonomy term slug / URL-safe identifier used as the URL
 * query-param value (e.g. ?sector=saas).  `label` is the human-readable
 * display text.  `count` is an optional item count hint.
 */
export interface FilterOption {
  readonly value:  string;
  readonly label:  string;
  readonly count?: number;
}

/**
 * A named group of filter options.
 *
 * Each group corresponds to one taxonomy (e.g. "Sector", "Location").
 * `handle` is the taxonomy slug used to build URL query params and to
 * identify the group across provider implementations.
 *
 * @example
 * { handle: "sector", label: "Sector", options: [{ value: "saas", label: "SaaS" }] }
 */
export interface FilterGroup {
  readonly handle:  string;
  readonly label:   string;
  readonly options: readonly FilterOption[];
}

/**
 * All filter groups available for a given collection listing page.
 *
 * Returned by `CMSProvider.getListingFilters(collection)`.  An empty array
 * means no filters are available (provider does not support this collection
 * or the collection has no taxonomy terms yet).
 *
 * The FilterBar block reads this at page-render time and passes each group's
 * options to the corresponding filter dropdown.
 *
 * @example
 * const filters = await provider.getListingFilters("vacancies");
 * // [
 * //   { handle: "sector",          label: "Sector",         options: [...] },
 * //   { handle: "employment_type", label: "Employment type", options: [...] },
 * //   { handle: "location",        label: "Location",        options: [...] },
 * // ]
 */
export type ListingFilters = readonly FilterGroup[];

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-orders a CollectionItem[] to match the editorial selectedIds order.
 *
 * Items whose ID is not in selectedIds are appended at the end in their
 * original order (safe fallback for IDs that have been unpublished since the
 * editor last saved the block).
 *
 * Called by the collection resolver after fetching specific items.
 *
 * @param items       Items returned by the provider (may be in any order)
 * @param selectedIds Authoritative editorial order from CollectionContentSource
 */
export function sortBySelectedIds(
  items:       readonly CollectionItem[],
  selectedIds: readonly string[],
): CollectionItem[] {
  const indexMap = new Map(selectedIds.map((id, i) => [id, i]));
  const inOrder:    CollectionItem[] = [];
  const unmatched:  CollectionItem[] = [];

  for (const item of items) {
    if (indexMap.has(item.id)) {
      inOrder.push(item);
    } else {
      unmatched.push(item);
    }
  }

  inOrder.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
  return [...inOrder, ...unmatched];
}
