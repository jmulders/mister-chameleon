/**
 * lib/rate-limiting/route-limit.ts
 *
 * Route-level rate-limit keys for the two visitor-facing personalization
 * endpoints. They are exempt from the proxy's generic per-IP limiter because
 * the right key needs the siteKey, which only the route knows:
 *
 *   /api/snippet/decide  → per siteKey + visitor IP   ("snippet" bucket)
 *   /api/v1/slot         → per siteKey                 ("slot" bucket)
 *
 * v1/slot is called server-to-server by the CMS adapter, so the request IP is
 * the CMS host's and is shared by every visitor of that site; keying it per IP
 * throttled whole sites. It gets a per-tenant ceiling instead.
 */

import type { RateLimitResult } from "./index";

/** Bound the untrusted siteKey so a giant value can't bloat the counter key. */
const MAX_KEY_PART = 128;

function part(v: string): string {
  return v.slice(0, MAX_KEY_PART);
}

/** Counter key for snippet decide: one budget per visitor IP per tenant. */
export function snippetRateLimitKey(siteKey: string, ip: string): string {
  return `${part(siteKey)}:${part(ip || "unknown")}`;
}

/** Counter key for v1/slot: one budget per tenant (CMS host IP is shared). */
export function slotRateLimitKey(siteKey: string): string {
  return part(siteKey);
}

/** Standard headers for a 429 from a route-level limit. */
export function rateLimitHeaders(rl: RateLimitResult): Record<string, string> {
  return {
    "Retry-After":           String(rl.retryAfterSeconds),
    "X-RateLimit-Limit":     String(rl.limit),
    "X-RateLimit-Remaining": String(Math.max(0, rl.limit - rl.count)),
    "X-RateLimit-Reset":     String(Math.floor(Date.now() / 1000) + rl.retryAfterSeconds),
  };
}
