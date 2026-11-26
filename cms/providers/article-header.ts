/**
 * The header of an article that brings none of its own.
 *
 * A Statamic article is an entry with a title, a date, a theme, an excerpt and
 * an overview image, and a list of blocks. Until 26 Nov 2026 only the blocks
 * reached the page: an article was its title and a stack of text sections. The
 * listing showed the image, the date and the theme, the article itself did
 * not. The owner asked to make the articles more attractive to look at.
 *
 * Everything in the header is something the entry already has. Nothing is
 * written for it.
 *
 * Pure: no I/O.
 */

import type { ArticleMetaData } from "@/cms/types";
import { dateOnly } from "./listing-dates";
import { themeTitles } from "./listing-themes";

/** Words read per minute. A common figure for reading on a screen. */
const WORDS_PER_MINUTE = 220;

/** The words in a value from the CMS: tags and entities do not count. */
function wordsIn(value: unknown): number {
  if (typeof value === "string") {
    const text = value.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").trim();
    return text ? text.split(/\s+/).length : 0;
  }
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + wordsIn(item), 0);
  if (value && typeof value === "object") {
    // Only what a visitor reads: titles, texts and the items inside a block.
    const block = value as Record<string, unknown>;
    return ["heading", "title", "body", "text", "question", "answer", "items", "steps"]
      .reduce((sum, key) => sum + wordsIn(block[key]), 0);
  }
  return 0;
}

/** Minutes to read the blocks of an entry, at least one. */
export function readingMinutes(blocks: unknown): number {
  return Math.max(1, Math.round(wordsIn(blocks) / WORDS_PER_MINUTE));
}

export interface ArticleEntryFields {
  title?:   string | null;
  date?:    unknown;
  theme?:   unknown;
  excerpt?: string | null;
  /** The overview image, already resolved to an address. */
  coverImageUrl?: string | null;
}

/**
 * The header section for an article entry, or null when the entry has no
 * title. The date is the day it appeared: an article that was edited since
 * does not read "updated", because every edit of a comma would say so.
 */
export function articleHeaderFor(entry: ArticleEntryFields, blocks: unknown): ArticleMetaData | null {
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  if (!title) return null;
  const published = dateOnly(entry.date);
  const theme     = themeTitles(entry.theme)[0];
  const summary   = typeof entry.excerpt === "string" ? entry.excerpt.trim() : "";
  const cover     = typeof entry.coverImageUrl === "string" ? entry.coverImageUrl.trim() : "";
  return {
    _key:    "article-header",
    _type:   "articleMeta",
    variant: "split",
    title,
    ...(published ? { publishedAt: published } : {}),
    ...(theme ? { category: theme } : {}),
    ...(summary ? { summary } : {}),
    // The image is decoration beside a title that says what the article is.
    ...(cover ? { coverImageUrl: cover, coverImageAlt: "" } : {}),
    readingTime: readingMinutes(blocks),
  };
}
