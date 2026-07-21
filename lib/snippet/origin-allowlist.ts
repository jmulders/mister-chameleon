/**
 * Snippet origin allowlist
 *
 * The snippet site key is a PUBLIC identifier (it ships in the `<script>` tag on
 * the tenant's site). Without an origin check anyone could replay it from any
 * page to run up a tenant's usage. `TenantSnippetSettings.allowedSnippetOrigins`
 * lets an operator restrict `/api/snippet/decide` to the hostnames the snippet
 * actually runs on.
 *
 * Helpers here normalise operator input and request headers to a comparable
 * hostname, and decide whether a request is allowed.
 *
 * Design:
 *   • Opt-in: an empty allowlist means "no restriction" (never break tenants
 *     that haven't configured it).
 *   • Strict once set: a non-empty allowlist rejects anything not on it.
 *   • www-insensitive: a leading "www." is treated as equivalent to the apex,
 *     so listing "nascita.nl" also allows "www.nascita.nl" and vice-versa. Every
 *     OTHER subdomain (staging., app.) must be listed explicitly.
 *
 * Not a guarantee: the Origin header can be forged by a non-browser client, so
 * this is defence-in-depth against browser-based abuse, layered on the per-key
 * rate limiting.
 */

/**
 * Reduce any operator entry or request header value to a bare, comparable host:
 *   "https://WWW.Nascita.nl:443/path" → "nascita.nl"
 *   "nascita.nl/"                      → "nascita.nl"
 * Returns "" when nothing usable can be extracted.
 */
export function normalizeOriginHost(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";
  let s = input.trim().toLowerCase();
  if (!s || s === "null") return "";

  // Strip scheme if present, then take everything before the first "/".
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split("/")[0] ?? "";
  // Drop any userinfo and port.
  s = s.split("@").pop() ?? s;
  s = s.split(":")[0] ?? s;
  // Treat www. as equivalent to the apex.
  s = s.replace(/^www\./, "");
  return s.trim();
}

/**
 * Normalise + de-duplicate an operator-entered list of allowed domains into bare
 * hostnames. Blanks and unusable entries are dropped. Order is preserved.
 */
export function sanitizeAllowedOrigins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const host = normalizeOriginHost(typeof entry === "string" ? entry : "");
    if (host && !seen.has(host)) { seen.add(host); out.push(host); }
  }
  return out;
}

/**
 * Decide whether a decide-request is allowed given the tenant's allowlist.
 *
 * @param requestOrigin  the request's `Origin` header (preferred)
 * @param requestReferer the request's `Referer` header (fallback when Origin is
 *                       absent — e.g. some privacy configurations)
 * @param allowlist      the tenant's configured allowed origins (any format)
 *
 * @returns `true` when the request may proceed. An EMPTY allowlist always
 *          returns `true` (opt-in). With a non-empty allowlist, the request is
 *          allowed only when the Origin (or, failing that, the Referer) host is
 *          on the list; a missing/unparyseable host is rejected.
 */
export function isSnippetOriginAllowed(
  requestOrigin:  string | null | undefined,
  requestReferer: string | null | undefined,
  allowlist:      readonly string[] | undefined,
): boolean {
  const allowed = sanitizeAllowedOrigins(allowlist as unknown);
  if (allowed.length === 0) return true; // opt-in: not configured → no restriction

  const originHost  = normalizeOriginHost(requestOrigin);
  const refererHost = originHost ? "" : normalizeOriginHost(requestReferer);
  const host = originHost || refererHost;
  if (!host) return false; // allowlist set but no verifiable host → reject

  return allowed.includes(host);
}
