/**
 * The page a form was submitted from (path + query), used to re-resolve the
 * contextual segment and to store the lead's target path.
 *
 * Cross-origin embeds (snippet / WP / Statamic) only send the ORIGIN as Referer
 * under the default referrer policy, so the snippet also sends the page as
 * `_mc_page` in the body. That value is visitor-controlled, so it is accepted
 * only as a plain root-relative path: a string starting with a single "/", at
 * most 512 characters, with no protocol or host once parsed. Otherwise the
 * Referer is used, as before.
 */

const MAX_PAGE_LENGTH = 512;
const BASE = "http://mc-page.invalid";

export function resolveSubmissionPageUrl(
  bodyPage: unknown,
  referer:  string | null | undefined,
): URL | null {
  if (
    typeof bodyPage === "string" &&
    bodyPage.length <= MAX_PAGE_LENGTH &&
    bodyPage.startsWith("/") &&
    !bodyPage.startsWith("//") &&
    !bodyPage.includes("\\")
  ) {
    try {
      const url = new URL(bodyPage, BASE);
      if (url.origin === BASE) return url;
    } catch {
      /* fall through to the referer */
    }
  }
  if (referer) {
    try {
      return new URL(referer);
    } catch {
      /* unparseable referer */
    }
  }
  return null;
}
