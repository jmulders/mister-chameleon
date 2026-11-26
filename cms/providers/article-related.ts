/**
 * What to read after an article.
 *
 * An article ended in its call to action and nothing else: a reader who was
 * not ready for a demo had nowhere to go but back to the listing. The owner
 * asked on 26 Nov 2026 for a "read on" at the foot of an article.
 *
 * The choice is made here and not by an editor. Articles of the same theme
 * come first, the newest of them first. When the theme has too few, articles
 * of other themes fill the row. So every article gets a full row without
 * anyone keeping lists, and a new article shows up under the others by itself.
 *
 * The fill does not start at the newest article for everyone: then one
 * article stood under nearly all the others. Each article starts at a place
 * of its own in the list, always the same place, so the row under an article
 * does not change between two visits.
 *
 * Pure: no I/O. The caller resolves the image addresses.
 */

import type { CmsRelatedItem, RelatedContentData } from "@/cms/types";
import { dateOnly, isPublishedBy, newestEntriesFirst } from "./listing-dates";
import { themeTitles } from "./listing-themes";

/** A row of three: the width of the card grid. */
export const RELATED_ARTICLES = 3;

export interface RelatedCandidate {
  id?:      string;
  slug?:    string;
  title?:   string | null;
  date?:    unknown;
  theme?:   unknown;
  excerpt?: string | null;
  /** The overview image and its hover image, already resolved to an address. */
  imageUrl?:      string | null;
  hoverImageUrl?: string | null;
}

/**
 * The articles to show under the article with `slug` and `theme`. Leaves out
 * the article itself, an article without a title or a slug, and one dated in
 * the future.
 */
export function relatedArticles(
  current:    { slug: string; theme?: unknown },
  candidates: readonly RelatedCandidate[],
  now:        Date,
  max:        number = RELATED_ARTICLES,
): RelatedCandidate[] {
  const own = new Set(themeTitles(current.theme));
  // On slug first: articles of the same moment keep that order below, so the
  // row does not depend on the order the CMS happens to give them in.
  const shown = newestEntriesFirst(candidates
    .filter((c) =>
      typeof c.slug === "string" && c.slug !== "" && c.slug !== current.slug &&
      typeof c.title === "string" && c.title.trim() !== "" &&
      isPublishedBy(c.date, now),
    )
    .sort((a, b) => (a.slug! < b.slug! ? -1 : a.slug! > b.slug! ? 1 : 0)));
  const shared = (c: RelatedCandidate) => themeTitles(c.theme).filter((t) => own.has(t)).length;
  const ranked = shown.map((candidate, index) => ({ candidate, index, shared: shared(candidate) }));
  // More themes in common first. Within that, the order of newestEntriesFirst.
  const akin  = ranked.filter((r) => r.shared > 0).sort((a, b) => (b.shared - a.shared) || (a.index - b.index));
  const other = ranked.filter((r) => r.shared === 0);
  const start = other.length > 0 ? placeOf(current.slug) % other.length : 0;
  return [...akin, ...other.slice(start), ...other.slice(0, start)]
    .slice(0, Math.max(0, max))
    .map(({ candidate }) => candidate);
}

/** A number that belongs to a slug: the same slug always gives the same number. */
function placeOf(slug: string): number {
  let sum = 0;
  for (let i = 0; i < slug.length; i++) sum = (sum * 31 + slug.charCodeAt(i)) % 100003;
  return sum;
}

/**
 * The section under an article, or null when there is nothing to show. It has
 * no heading of its own: the block prints the fixed words for a row of
 * articles in the language of the site.
 */
export function relatedSectionFor(
  current:    { slug: string; theme?: unknown },
  candidates: readonly RelatedCandidate[],
  now:        Date,
): RelatedContentData | null {
  const picked = relatedArticles(current, candidates, now);
  if (picked.length === 0) return null;
  const items = picked.map((c): CmsRelatedItem => {
    const theme   = themeTitles(c.theme)[0];
    const day     = dateOnly(c.date);
    const excerpt = typeof c.excerpt === "string" ? c.excerpt.trim() : "";
    return {
      _key:  `related-${c.slug}`,
      id:    c.id ?? c.slug,
      title: c.title!.trim(),
      href:  `/blog/${c.slug}`,
      ...(excerpt ? { excerpt } : {}),
      ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
      ...(c.hoverImageUrl ? { hoverImageUrl: c.hoverImageUrl } : {}),
      ...(theme ? { category: theme } : {}),
      ...(day ? { date: day } : {}),
    };
  });
  return { _key: "article-related", _type: "relatedContent", variant: "default", itemKind: "articles", items };
}

/**
 * Put the row before the call to action an article closes with, so the page
 * still ends in that call. An article without one gets the row at the end.
 */
export function beforeClosingCall<T extends { readonly _type: string }>(sections: readonly T[], row: T): T[] {
  let at = sections.length;
  while (at > 0 && sections[at - 1]!._type === "ctaSection") at--;
  return [...sections.slice(0, at), row, ...sections.slice(at)];
}
