/**
 * lib/rate-limiting/index.ts
 *
 * Sliding-window rate limiting backed by Supabase.
 *
 * ─── Algorithm ────────────────────────────────────────────────────────────────
 *
 * Uses a per-minute tumbling window (YYYY-MM-DDTHH:mm) rather than a true
 * sliding window, which is accurate enough for API protection and maps cleanly
 * onto a keyed counter row without a time-series log.
 *
 * Each request calls `increment_rate_limit(identifier, window_key)` — a
 * Postgres RPC that does:
 *   INSERT INTO rate_limit_counters(identifier, window_key, count)
 *   VALUES ($1, $2, 1)
 *   ON CONFLICT (identifier, window_key) DO UPDATE SET count = count + 1
 *   RETURNING count;
 *
 * If the returned count exceeds the configured limit for this endpoint type,
 * the request is rate-limited and should receive a 429 response.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In middleware or a route handler:
 *   const result = await checkRateLimit("track", clientIp);
 *   if (!result.allowed) {
 *     return new Response("Too Many Requests", {
 *       status: 429,
 *       headers: { "Retry-After": String(result.retryAfterSeconds) },
 *     });
 *   }
 *
 * ─── Endpoint types ──────────────────────────────────────────────────────────
 *
 *   "track"      60 req/min  — personalisation tracking pixel / event endpoint
 *   "api"       120 req/min  — all other /api/* routes
 *   "auth"       20 req/min  — login / token refresh (tighter for brute-force)
 *   "default"    60 req/min  — anything not explicitly categorised
 *
 * ─── Identifiers ─────────────────────────────────────────────────────────────
 *
 *   Identifier = "<endpoint_type>:<ip_or_tenant_id>"
 *   e.g. "track:203.0.113.42"  or  "api:tenant_abc123"
 *
 * ─── Edge-compatible ─────────────────────────────────────────────────────────
 *
 *   This module may run in the Next.js Edge Runtime (middleware).  It uses the
 *   Supabase REST API via fetch — no Node-only crypto or fs dependencies.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RateLimitEndpoint = "track" | "api" | "auth" | "default";

export interface RateLimitResult {
  /** Whether the request is allowed to proceed. */
  allowed:          boolean;
  /** Current request count in this window (after increment). */
  count:            number;
  /** Configured limit for this endpoint type. */
  limit:            number;
  /** How many seconds until the current window resets (≤ 60). */
  retryAfterSeconds: number;
}

// ── Limits ────────────────────────────────────────────────────────────────────

const LIMITS: Record<RateLimitEndpoint, number> = {
  track:   60,
  api:    120,
  auth:    20,
  default: 60,
};

// ── Window key ────────────────────────────────────────────────────────────────

/**
 * Returns the current minute as a string: "YYYY-MM-DDTHH:mm"
 * This forms the window key for the tumbling-window counter.
 */
export function currentWindowKey(): string {
  return new Date().toISOString().slice(0, 16); // "2025-01-15T14:37"
}

/**
 * Seconds remaining in the current minute window.
 * Used for the Retry-After header so clients know when to retry.
 */
export function secondsUntilWindowReset(): number {
  const now = new Date();
  return 60 - now.getSeconds();
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Check and increment the rate limit counter for an identifier.
 *
 * @param endpoint   The endpoint category determining the request limit.
 * @param identifier A stable caller identifier — typically the client IP or
 *                   a tenant ID for authenticated routes.
 *
 * @returns RateLimitResult — check `allowed` before proceeding.
 */
export async function checkRateLimit(
  endpoint:   RateLimitEndpoint,
  identifier: string,
): Promise<RateLimitResult> {
  const limit      = LIMITS[endpoint];
  const windowKey  = currentWindowKey();
  const key        = `${endpoint}:${identifier}`;
  const retryAfter = secondsUntilWindowReset();

  // ── Fast path: bypass in test environments ────────────────────────────────
  if (process.env.NODE_ENV === "test") {
    return { allowed: true, count: 0, limit, retryAfterSeconds: retryAfter };
  }

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey   = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !serviceKey) {
    // Missing config — fail open to avoid blocking all traffic.
    console.warn("[rate-limit] Missing Supabase env vars; skipping rate limit check.");
    return { allowed: true, count: 0, limit, retryAfterSeconds: retryAfter };
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_rate_limit`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "apikey":        serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        p_identifier: key,
        p_window_key: windowKey,
      }),
    });

    if (!response.ok) {
      // DB error — fail open (don't block legitimate traffic due to infra issues).
      console.error(`[rate-limit] RPC error ${response.status}: ${await response.text()}`);
      return { allowed: true, count: 0, limit, retryAfterSeconds: retryAfter };
    }

    const count: number = await response.json();

    return {
      allowed:           count <= limit,
      count,
      limit,
      retryAfterSeconds: retryAfter,
    };
  } catch (err) {
    // Network failure — fail open.
    console.error("[rate-limit] fetch error:", err);
    return { allowed: true, count: 0, limit, retryAfterSeconds: retryAfter };
  }
}

// ── IP extraction helpers ─────────────────────────────────────────────────────

/**
 * Extract the real client IP from Next.js request headers.
 *
 * Checks headers in order of trust:
 *   1. x-real-ip         — set by Vercel / Nginx
 *   2. x-forwarded-for   — first IP in the chain (leftmost = original client)
 *   3. cf-connecting-ip  — Cloudflare
 *
 * Falls back to "unknown" when none are present (e.g. local dev).
 */
export function extractClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/**
 * Determine the endpoint category from a URL pathname.
 *
 * @param pathname  The URL path, e.g. "/api/track" or "/api/decisions"
 */
export function endpointFromPath(pathname: string): RateLimitEndpoint {
  if (pathname.startsWith("/api/track"))   return "track";
  if (pathname.startsWith("/api/auth"))    return "auth";
  if (pathname.startsWith("/api/"))        return "api";
  return "default";
}
