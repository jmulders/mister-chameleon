/**
 * lib/seo/page-metadata.ts
 *
 * What a page adds to the site's own metadata, and what it leaves alone.
 *
 * The root layout gives every page two things: its own address as the
 * canonical, and Open Graph tags filled from the page's title and description.
 * A page only has to say something when the editor filled in a canonical or an
 * Open Graph field in the CMS.
 *
 * Found on 23 Nov 2026: every CMS page returned `alternates: undefined` and
 * `openGraph: undefined` when the editor had filled in nothing. A key that is
 * present with the value undefined still replaces what the layout gives. So
 * the pages had no canonical and no Open Graph tags at all, and only the
 * coded pages, which return neither key, had them.
 *
 * Both builders therefore return an object to spread: with the key when there
 * is something to say, and empty when there is not.
 */

import type { Metadata } from "next";
import { shareImageEntry } from "@/lib/seo/share-image";

interface SeoFields {
  title?:          string | null;
  seoTitle?:       string | null;
  seoDescription?: string | null;
  canonicalUrl?:   string | null;
  ogTitle?:        string | null;
  ogDescription?:  string | null;
  ogImage?:        string | null;
  publishedAt?:    string | null;
  modifiedAt?:     string | null;
}

const filled = (value: string | null | undefined): value is string => typeof value === "string" && value.trim() !== "";

/** The canonical the editor filled in. Without one the page keeps its own address, from the layout. */
export function ownCanonical(page: SeoFields): Pick<Metadata, "alternates"> | Record<string, never> {
  return filled(page.canonicalUrl) ? { alternates: { canonical: page.canonicalUrl } } : {};
}

/**
 * The Open Graph fields the editor filled in. Without any the page keeps the
 * layout's, which Next fills from the page's own title and description.
 *
 * @param siteName The site's name, repeated here because a page's Open Graph
 *                 object replaces the layout's as a whole.
 *
 * For the same reason the type and the image are repeated: the page is a
 * "website" page, and without an image of its own it shows the site's card.
 */
export function ownOpenGraph(page: SeoFields, siteName?: string | null): Pick<Metadata, "openGraph"> | Record<string, never> {
  if (!filled(page.ogTitle) && !filled(page.ogDescription) && !filled(page.ogImage)) return {};
  const title       = [page.ogTitle, page.seoTitle, page.title].find(filled);
  const description = [page.ogDescription, page.seoDescription].find(filled);
  return {
    openGraph: {
      type: "website",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      images: [filled(page.ogImage) ? page.ogImage : shareImageEntry()],
      ...(filled(siteName) ? { siteName } : {}),
    },
  };
}

/**
 * Open Graph for an article: og:type "article", with the day it appeared and
 * the day it last changed when the CMS knows them.
 *
 * Always returns the key, so it replaces the layout's object as a whole. Title,
 * description, image and site name are therefore all given here.
 */
export function articleOpenGraph(page: SeoFields, siteName?: string | null): Pick<Metadata, "openGraph"> {
  const title       = [page.ogTitle, page.seoTitle, page.title].find(filled);
  const description = [page.ogDescription, page.seoDescription].find(filled);
  return {
    openGraph: {
      type: "article",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(filled(page.publishedAt) ? { publishedTime: page.publishedAt } : {}),
      ...(filled(page.modifiedAt) ? { modifiedTime: page.modifiedAt } : {}),
      images: [filled(page.ogImage) ? page.ogImage : shareImageEntry()],
      ...(filled(siteName) ? { siteName } : {}),
    },
  };
}
