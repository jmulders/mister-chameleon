/**
 * The themes of an entry in a listing.
 *
 * An article carries terms of the "theme" taxonomy. A listing shows them on
 * the card and can filter on them (ListingBlock with `filterable`). Statamic
 * gives the field in two shapes: its REST API gives term objects with a title,
 * its file reader gives the bare slugs.
 */

/** "leads-en-sales" becomes "Leads en sales": a title for a term that only has a slug. */
function titleFromSlug(slug: string): string {
  const words = slug.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

/** The titles of the theme terms of an entry, in the order the editor put them. */
export function themeTitles(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  const titles: string[] = [];
  for (const term of list) {
    let title = "";
    if (typeof term === "string") {
      // A term id can come as "theme::leads-en-sales".
      title = titleFromSlug(term.includes("::") ? term.slice(term.indexOf("::") + 2) : term);
    } else if (term && typeof term === "object") {
      const t = term as { title?: unknown; slug?: unknown };
      if (typeof t.title === "string" && t.title.trim()) title = t.title.trim();
      else if (typeof t.slug === "string") title = titleFromSlug(t.slug);
    }
    if (title && !titles.includes(title)) titles.push(title);
  }
  return titles;
}

/**
 * The tags a card shows: the themes first, then the free tags of the entry,
 * each once. Undefined when there are none, as the card expects.
 */
export function tagsWithThemes(tags: unknown, themes: unknown): string[] | undefined {
  const out = themeTitles(themes);
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string" && tag.trim() && !out.includes(tag.trim())) out.push(tag.trim());
    }
  }
  return out.length > 0 ? out : undefined;
}
