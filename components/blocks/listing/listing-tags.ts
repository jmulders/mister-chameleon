/**
 * The tags a listing can filter on, and their place in the address.
 *
 * Kept apart from the filter component, which runs in the browser: the block
 * that renders on the server needs the same list to decide whether a filter
 * is worth showing.
 */

/** The query parameter that carries the chosen tag: /kennisbank?thema=campagnes */
export const TAG_PARAM = "thema";

/** "Leads en sales" becomes "leads-en-sales". */
export function tagSlug(tag: string): string {
  return tag
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Every tag once, in the order of first appearance. The listing is sorted
 * newest first, so the theme of the newest article comes first.
 */
export function distinctTags(items: readonly { readonly tags?: readonly string[] }[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      if (tag && !seen.includes(tag)) seen.push(tag);
    }
  }
  return seen;
}

/** The tag that a value from the address stands for, or null. */
export function tagFromParam(tags: readonly string[], value: string | null | undefined): string | null {
  if (!value) return null;
  return tags.find((tag) => tagSlug(tag) === value) ?? null;
}
