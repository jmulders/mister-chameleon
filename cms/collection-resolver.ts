/**
 * Collection resolver — runtime utility for collection-driven content blocks
 *
 * Provides typed helper functions that call CMSProvider.resolveCollection()
 * and convert the normalized CollectionItem[] into the specific item shapes
 * each block type expects (NewsItem, ListingItem, RelatedItem).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   In an RSC (React Server Component) or route handler, after assembling the
 *   PageConfig from the CMS, call these helpers to populate any collection-
 *   driven blocks before passing the page config to the renderer:
 *
 *   @example
 *   // In app/[slug]/page.tsx or a page assembler
 *   import { resolveListingBlockItems } from "@/cms/collection-resolver";
 *
 *   const block = pageConfig.contentBlocks.find(b => b.blockType === "listing");
 *   if (block && isCollectionSource(block.data.contentSource)) {
 *     const items = await resolveListingBlockItems(provider, block.data);
 *     // items is a readonly ListingItem[] in render order
 *   }
 *
 * ─── Design notes ─────────────────────────────────────────────────────────────
 *
 *   - These helpers are kept thin on purpose — they delegate all collection
 *     fetching to CMSProvider.resolveCollection() and only perform the shape
 *     conversion needed to match each block's item type.
 *
 *   - For "specific" mode, sortBySelectedIds() restores the editorial order
 *     AFTER the provider returns items (providers are not required to respect
 *     ID order).
 *
 *   - For "recent" mode, the provider is responsible for ordering by date;
 *     these helpers do not re-sort after the fact.
 *
 *   - All helpers return readonly arrays — callers must not mutate the result.
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   All helpers accept the block's full data object.  When contentSource is
 *   absent or manual, the helper returns the existing static items unchanged.
 *   This means callers can unconditionally pass the block data without checking
 *   the source type first.
 */

import type { CMSProvider }          from "@/cms/providers/cms-provider";
import type { NewsListBlockData,
              ListingBlockData,
              RelatedContentBlockData,
              NewsItem,
              ListingItem,
              RelatedItem }           from "@/page-config/types";
import {
  isCollectionSource,
  sortBySelectedIds,
  type CollectionItem,
}                                     from "@/page-config/collection-source";

// ─────────────────────────────────────────────────────────────────────────────
// Per-block resolution helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve items for a NewsListBlock.
 *
 * Returns the block's static `items` array unchanged when contentSource is
 * absent or manual.  When contentSource is a CollectionContentSource, fetches
 * from the CMSProvider and converts each CollectionItem to a NewsItem.
 *
 * @param provider  Active CMSProvider instance for this request
 * @param data      The NewsListBlockData from the assembled PageConfig
 * @returns         Readonly NewsItem[] in render order
 */
export async function resolveNewsListItems(
  provider: CMSProvider,
  data:     NewsListBlockData,
): Promise<readonly NewsItem[]> {
  const src = data.contentSource;

  if (!isCollectionSource(src)) {
    // Manual mode — return existing static items as-is
    return data.items;
  }

  let raw: CollectionItem[];
  try {
    raw = await provider.resolveCollection(src);
  } catch {
    return data.items; // graceful fallback to static items on error
  }

  // Re-order for specific mode
  const ordered = src.mode === "specific" && src.selectedIds?.length
    ? sortBySelectedIds(raw, src.selectedIds)
    : raw;

  // Convert CollectionItem → NewsItem
  return ordered.map((item): NewsItem => ({
    title:    item.title,
    url:      item.href,            // NewsItem uses `url`, not `href`
    excerpt:  item.excerpt,
    date:     item.date,
    imageUrl: item.imageUrl,
    category: item.category,
  }));
}

/**
 * Resolve items for a ListingBlock.
 *
 * Returns static items unchanged when contentSource is absent or manual.
 * For collection mode, fetches and converts to ListingItem[].
 *
 * @param provider  Active CMSProvider instance
 * @param data      The ListingBlockData from the assembled PageConfig
 * @returns         Readonly ListingItem[] in render order
 */
export async function resolveListingItems(
  provider: CMSProvider,
  data:     ListingBlockData,
): Promise<readonly ListingItem[]> {
  const src = data.contentSource;

  if (!isCollectionSource(src)) {
    return data.items;
  }

  let raw: CollectionItem[];
  try {
    raw = await provider.resolveCollection(src);
  } catch {
    return data.items;
  }

  const ordered = src.mode === "specific" && src.selectedIds?.length
    ? sortBySelectedIds(raw, src.selectedIds)
    : raw;

  // CollectionItem is structurally compatible with ListingItem
  return ordered.map((item): ListingItem => ({
    id:       item.id,
    title:    item.title,
    href:     item.href,
    excerpt:  item.excerpt,
    date:     item.date,
    imageUrl: item.imageUrl,
    imageAlt: item.imageAlt,
    category: item.category,
    tags:     item.tags,
  }));
}

/**
 * Resolve items for a RelatedContentBlock.
 *
 * Returns static items unchanged when contentSource is absent or manual.
 * For collection mode, fetches and converts to RelatedItem[].
 *
 * @param provider  Active CMSProvider instance
 * @param data      The RelatedContentBlockData from the assembled PageConfig
 * @returns         Readonly RelatedItem[] in render order
 */
export async function resolveRelatedContentItems(
  provider: CMSProvider,
  data:     RelatedContentBlockData,
): Promise<readonly RelatedItem[]> {
  const src = data.contentSource;

  if (!isCollectionSource(src)) {
    return data.items;
  }

  let raw: CollectionItem[];
  try {
    raw = await provider.resolveCollection(src);
  } catch {
    return data.items;
  }

  const ordered = src.mode === "specific" && src.selectedIds?.length
    ? sortBySelectedIds(raw, src.selectedIds)
    : raw;

  return ordered.map((item): RelatedItem => ({
    id:       item.id,
    title:    item.title,
    href:     item.href,
    excerpt:  item.excerpt,
    imageUrl: item.imageUrl,
    imageAlt: item.imageAlt,
    category: item.category,
    date:     item.date,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch resolution helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve all collection-driven blocks in an ordered ContentBlock[] in a single
 * pass, returning a map of block IDs to their resolved items.
 *
 * Prefer this over calling individual helpers in a loop — it allows providers
 * to batch multiple collection fetches when they support it, and reduces
 * sequential await chains.
 *
 * Returns only the blocks that have collection sources; manually-sourced blocks
 * are not included in the result map (callers fall back to block.data.items).
 *
 * @example
 * const resolved = await resolveAllCollectionBlocks(provider, pageConfig.contentBlocks);
 * // In renderer:
 * const items = resolved.newsItems[block.id] ?? block.data.items;
 */
export async function resolveAllCollectionBlocks(
  provider: CMSProvider,
  blocks:   readonly import("@/page-config").ContentBlock[],
): Promise<{
  newsItems:    Record<string, readonly NewsItem[]>;
  listingItems: Record<string, readonly ListingItem[]>;
  relatedItems: Record<string, readonly RelatedItem[]>;
}> {
  const newsItems:    Record<string, readonly NewsItem[]>    = {};
  const listingItems: Record<string, readonly ListingItem[]> = {};
  const relatedItems: Record<string, readonly RelatedItem[]> = {};

  await Promise.all(
    blocks.map(async (block) => {
      if (block.blockType === "newsList" && isCollectionSource(block.data.contentSource)) {
        newsItems[block.id] = await resolveNewsListItems(provider, block.data);
      } else if (block.blockType === "listing" && isCollectionSource(block.data.contentSource)) {
        listingItems[block.id] = await resolveListingItems(provider, block.data);
      } else if (block.blockType === "relatedContent" && isCollectionSource(block.data.contentSource)) {
        relatedItems[block.id] = await resolveRelatedContentItems(provider, block.data);
      }
    }),
  );

  return { newsItems, listingItems, relatedItems };
}
