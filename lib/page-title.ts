/**
 * Does a CMS page need its title printed as the heading?
 *
 * A page with a hero opens with that hero's heading, which is the h1. A page
 * without one (a privacy statement, an article, a vacancy) had no h1 at all: it went
 * straight into its blocks, whose headings are h2. Such a page gets its own
 * title as the h1.
 *
 * Pure: no I/O.
 */

type Slot  = { readonly slotId: string; readonly variantKey: string | null };
type Block = { readonly blockType: string };

/** Blocks that print the page title as an h1 themselves. */
const TITLE_BLOCKS = new Set(["articleMeta"]);

export function pageNeedsTitleHeading(
  slots:  readonly Slot[],
  blocks: readonly Block[] = [],
): boolean {
  if (slots.some((slot) => slot.slotId === "hero" && slot.variantKey !== null)) return false;
  return !blocks.some((block) => TITLE_BLOCKS.has(block.blockType));
}
