/**
 * Pure extraction of the recommended CNAME target from a Vercel /v6 domain-config
 * response body. Kept free of "server-only" (unlike lib/vercel-domains.ts) so it
 * is unit-testable and reusable.
 *
 * Vercel has returned `recommendedCNAME` as a bare string in some API versions
 * and as an array of `{ rank, value }` in others, so both are handled; anything
 * else falls back to scanning the payload for the first vercel-dns hostname.
 */

/** True for a "*.vercel-dns.com" or "*.vercel-dns-NNN.com" hostname. */
function isVercelDns(s: unknown): s is string {
  return typeof s === "string" && /(^|\.)vercel-dns(-\d+)?\.com$/i.test(s.trim());
}

/** Extract the recommended CNAME target, or null when the body carries none. */
export function extractVercelCname(body: Record<string, unknown>): string | null {
  const rec = body.recommendedCNAME;
  if (isVercelDns(rec)) return rec.trim();
  if (Array.isArray(rec)) {
    for (const item of rec) {
      if (isVercelDns(item)) return item.trim();
      const v = (item as { value?: unknown } | null)?.value;
      if (isVercelDns(v)) return v.trim();
    }
  }
  // Last resort: scan the whole payload for the first vercel-dns hostname.
  const match = JSON.stringify(body).match(/[a-z0-9-]+\.vercel-dns(?:-\d+)?\.com/i);
  return match ? match[0] : null;
}
