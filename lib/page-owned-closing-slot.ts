/**
 * Pure helper for a page that gives up its own closing call to action for a
 * block the platform fills. Kept apart from lib/page-owned-variant.ts, which
 * reads the request and cannot be loaded in a test.
 */

import type { PageConfig, PageItem, ResolvedContextSlot } from "@/page-config";

/**
 * Put a page-owned closing block in the place of the page's last call to
 * action. Used by an article or a case when `resolveOwnBlockVariant` found a
 * variant for this visitor: the article's own closing block makes room for it.
 *
 * A page without a call-to-action block gets the slot at the end.
 */
export function withOwnClosingSlot(pageConfig: PageConfig, slot: ResolvedContextSlot): PageConfig {
  const items = pageConfig.pageItems;
  let last = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    if (item.kind === "block" && item.block.blockType === "ctaSection") { last = i; break; }
  }

  const slotItem: PageItem = { kind: "slot", slot };
  const pageItems: PageItem[] = last === -1
    ? [...items, slotItem]
    : [...items.slice(0, last), slotItem, ...items.slice(last + 1)];
  const removed = last === -1 ? null : (items[last] as Extract<PageItem, { kind: "block" }>).block;

  return {
    ...pageConfig,
    pageItems,
    contextSlots:  [...pageConfig.contextSlots, slot],
    contentBlocks: removed ? pageConfig.contentBlocks.filter((b) => b !== removed) : pageConfig.contentBlocks,
  };
}
