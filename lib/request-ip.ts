/**
 * Extract the visitor's IP address from standard proxy headers.
 *
 * Priority:
 *   1. x-forwarded-for  — set by most CDNs and load balancers; first value = client IP
 *                         (subsequent values are intermediate proxies)
 *   2. x-real-ip        — set by nginx and some reverse proxies (single IP)
 *   3. null             — no IP header present (local dev, edge cold-boot edge cases)
 *
 * Vercel sets x-forwarded-for on every request; the first value is the original
 * client IP. Shared so the decision-context builder (the ip_company_cache READ
 * side) and any WRITE side (e.g. the client-Leadinfo cache warm) resolve the exact
 * same raw IP — otherwise the ip_hash key would not match.
 */
export function extractIpFromRequest(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? null;
}
