/**
 * Visitor-id normalisation for the snippet decide endpoint.
 *
 * The snippet mints a stable first-party visitor id (localStorage `mc_vid`,
 * cookie fallback) and sends it on every pageview so the platform can key a
 * visitor's behavioural history to one id instead of treating each pageview as a
 * brand-new session. Because the value arrives from an untrusted client and is
 * used as a database key, it must be validated before use.
 *
 * Accepted: a bounded string of id-safe characters. Both a UUID v4 and the
 * snippet's `mc_<timestamp>_<rand>` fallback satisfy this. Everything else —
 * empty, oversized, or containing unexpected characters — is rejected so a
 * hostile client cannot inject arbitrary values (SQL/ío keys, huge payloads).
 */

const MIN_LEN = 8;
const MAX_LEN = 100;
const ID_SAFE = /^[A-Za-z0-9_-]+$/;

/**
 * Returns the trimmed id when it is safe to use as a session/visitor key,
 * or null when the input is missing or malformed.
 */
export function normaliseVisitorId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (id.length < MIN_LEN || id.length > MAX_LEN) return null;
  if (!ID_SAFE.test(id)) return null;
  return id;
}
