/**
 * lib/seo/icons.ts
 *
 * Browser and search-result icons for the <head> (via generateMetadata, so they
 * are in the server-rendered HTML that Google reads).
 *
 * A tenant with its own favicon keeps it. The platform default is the Mister
 * Chameleon dot mark, in the sizes Google and the browsers ask for:
 *   /favicon.svg          scalable
 *   /favicon-96.png       96x96 (Google wants a multiple of 48, at least 48)
 *   /favicon-192.png      192x192 (Android, PWA)
 *   /favicon.ico          16/32/48, from app/favicon.ico
 *   /apple-touch-icon.png 180x180, white background (iOS fills transparency black)
 *
 * The files live in public/ on purpose: an app/icon.* file would override every
 * tenant's own favicon.
 */

import type { Metadata } from "next";

export const DEFAULT_FAVICON_PATH = "/favicon.ico";

export function tenantIcons(faviconPath: string | undefined): Metadata["icons"] {
  if (faviconPath && faviconPath !== DEFAULT_FAVICON_PATH) return { icon: faviconPath };
  return {
    icon: [
      { url: "/favicon.svg",       type: "image/svg+xml" },
      { url: "/favicon-96.png",    sizes: "96x96",   type: "image/png" },
      { url: "/favicon-192.png",   sizes: "192x192", type: "image/png" },
      { url: DEFAULT_FAVICON_PATH, sizes: "48x48" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  };
}
