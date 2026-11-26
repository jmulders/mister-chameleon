/**
 * The language versions of the booking page, for its hreflang links.
 *
 * The page exists in three languages: /demo (Dutch), /book-demo (English)
 * and /de/book-demo (German). Each names the others, so a search engine can
 * show a visitor the one in their language.
 *
 * On misterchameleon.nl there is no English one. That site got Dutch
 * addresses, and /book-demo redirects to /demo there (next.config.mjs,
 * siteMoves). The Dutch page still named /book-demo as its English version: a
 * link to an address that sends the visitor straight back. Search Console
 * reported it on 26 Nov 2026 as a page with a redirect.
 *
 * A language version is only named where its address answers with a page.
 *
 * Pure: no I/O.
 */

/**
 * The host on which /book-demo redirects to /demo. The same pattern as
 * `marketingHost` in next.config.mjs: a test holds the two together.
 */
export const DUTCH_ADDRESSES_HOST = "(www\\.)?misterchameleon\\.nl";

const ALL = { nl: "/demo", en: "/book-demo", de: "/de/book-demo" } as const;

/** `origin` is the request origin ("https://www.example.com") or a bare host. Null: unknown. */
export function bookDemoLanguages(origin: string | null | undefined): Record<string, string> {
  const host = (origin ?? "").replace(/^[a-z]+:\/\//i, "").replace(/[:/].*$/, "").toLowerCase();
  if (host && new RegExp(`^${DUTCH_ADDRESSES_HOST}$`).test(host)) {
    return { nl: ALL.nl, de: ALL.de };
  }
  return { ...ALL };
}
