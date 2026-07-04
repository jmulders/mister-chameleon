/**
 * resolvePublicBaseUrl
 *
 * Returns the site's absolute base URL, ALWAYS with a scheme and no trailing
 * slash — safe to build links (`${base}/demo/x`) and server-side fetch targets.
 *
 * Why this exists: `process.env.VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL`
 * are BARE hostnames (no `https://`). Building a link from them directly yields
 * a scheme-less string that the browser treats as a RELATIVE path — producing
 * 404s like `/admin/platform/<host>/demo/<id>` — and makes `fetch()` throw
 * "Failed to parse URL". This helper guarantees a scheme is present.
 *
 * Resolution order (first defined wins):
 *   1. NEXT_PUBLIC_SITE_URL            — explicit, stable, canonical site URL.
 *   2. VERCEL_PROJECT_PRODUCTION_URL   — stable production host (not the
 *                                        ephemeral per-deployment preview host).
 *   3. VERCEL_URL                      — the current deployment host (ephemeral).
 *   4. http://localhost:3000          — local dev fallback.
 */
export function resolvePublicBaseUrl(): string {
  const raw =
    process.env["NEXT_PUBLIC_SITE_URL"] ??
    process.env["VERCEL_PROJECT_PRODUCTION_URL"] ??
    process.env["VERCEL_URL"] ??
    "http://localhost:3000";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/**
 * Request-aware base URL — the host the current request is being served on
 * (the admin/deployment domain the operator is actually on). Prefer this for
 * building demo/share links so they never point at an unrelated tenant domain
 * (which `VERCEL_PROJECT_PRODUCTION_URL` can be in a multi-tenant project).
 * Falls back to resolvePublicBaseUrl() outside a request context.
 */
export async function resolveRequestBaseUrl(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  } catch {
    /* not in a request context — fall through */
  }
  return resolvePublicBaseUrl();
}
