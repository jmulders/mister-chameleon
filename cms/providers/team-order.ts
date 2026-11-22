/**
 * The order of team members in a listing.
 *
 * A team member has no date, so "newest first" means nothing for this
 * collection. The editor gives each member a number (`sort_order`) and the
 * listing follows it, lowest first.
 *
 * Found on 22 Nov 2026: the listing only looked at the number when the block
 * asked for ascending order, and then turned the result around again with
 * every other collection. With the default direction it showed the members as
 * the CMS returned them, which is by last change. Saving one member moved that
 * member to the end of the team page.
 */

/**
 * Returns the items lowest number first. A member without a number comes
 * last. Members with the same number keep the order they came in.
 */
export function inTeamOrder<T extends { id: string }>(
  items: T[],
  sortOrderOf: (id: string) => unknown,
): T[] {
  const numberOf = (id: string): number => {
    const raw = sortOrderOf(id);
    const n   = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  };
  return items
    .map((item, index) => ({ item, index, order: numberOf(item.id) }))
    .sort((a, b) => (a.order === b.order ? a.index - b.index : a.order - b.order))
    .map((entry) => entry.item);
}
