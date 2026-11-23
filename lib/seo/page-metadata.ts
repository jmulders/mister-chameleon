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

interface SeoFields {
  title?:          string | null;
  seoTitle?:       string | null;
  seoDescription?: string | null;
  canonicalUrl?:   string | null;
  ogTitle?:        string | null;
  ogDescription?:  string | null;
  ogImage?:        string | null;
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
 */
export function ownOpenGraph(page: SeoFields, siteName?: string | null): Pick<Metadata, "openGraph"> | Record<string, never> {
  if (!filled(page.ogTitle) && !filled(page.ogDescription) && !filled(page.ogImage)) return {};
  const title       = [page.ogTitle, page.seoTitle, page.title].find(filled);
  const description = [page.ogDescription, page.seoDescription].find(filled);
  return {
    openGraph: {
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(filled(page.ogImage) ? { images: [page.ogImage] } : {}),
      ...(filled(siteName) ? { siteName } : {}),
    },
  };
}
