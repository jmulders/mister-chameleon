/**
 * Whether a block variant has nothing to show.
 *
 * A page-owned section may leave its default variant empty. That is how a
 * section is made for some audiences only: the block holds a variant for the
 * agency owner, say, and nothing for the rest. A visitor without a variant
 * then gets the page without the section, not an empty frame.
 *
 * Empty means: no title, no intro and no item with a title or a text.
 */

import type { AdaptiveVariantContent } from "@/cms/types";

const filled = (value: unknown): boolean => typeof value === "string" && value.trim() !== "";

export function isEmptySection(content: AdaptiveVariantContent | null | undefined): boolean {
  if (!content) return true;
  if (filled(content.title) || filled(content.subtitle)) return false;
  return !(content.items ?? []).some((item) => filled(item.title) || filled(item.text) || filled(item.body));
}
