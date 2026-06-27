/**
 * Image hosts that next/image is allowed to optimize.
 *
 * MUST stay in sync with `images.remotePatterns` in next.config.mjs. Passing a
 * src whose host is NOT in remotePatterns to next/image throws at render time
 * (a hard 500), so content-driven images (CMS assets, author-supplied logos)
 * must guard with `isOptimizableImageUrl()` and fall back to a plain <img> for
 * any host not listed here.
 *
 * Add a tenant's `cms.<domain>` here AND to next.config.mjs when it goes live.
 */
export const OPTIMIZABLE_IMAGE_HOSTS: readonly string[] = [
  "cms.misterchameleon.nl",
  "cms.steunles.nl",
];

/**
 * True when `src` is an absolute https URL on a host registered for next/image
 * optimization. Relative URLs, unknown hosts, and malformed values return false
 * so callers render a plain <img> instead (never a broken optimized request).
 */
export function isOptimizableImageUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && OPTIMIZABLE_IMAGE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}
