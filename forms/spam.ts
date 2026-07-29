/**
 * Form spam protection
 *
 * Two complementary, dependency-free guards:
 *
 *   1. Honeypot field detection — catches basic bots that auto-fill all inputs.
 *   2. IP-based rate limiting   — limits burst submissions per IP per form.
 *
 * ─── Honeypot ─────────────────────────────────────────────────────────────────
 *
 *   A visually hidden field named `HONEYPOT_FIELD` is rendered by the
 *   FormSectionBlock client component.  The field is:
 *     - Positioned off-screen (not display:none — some bots skip those)
 *     - aria-hidden="true" — hidden from assistive technologies
 *     - tabIndex={-1}       — unreachable by keyboard navigation
 *     - autoComplete="off"  — not filled by password managers
 *
 *   Real users never see or fill it.  Bots that blindly populate all inputs
 *   will fill it — and `checkHoneypot()` will detect the non-empty value.
 *
 *   When the honeypot fires, the server returns a fake 200 success response
 *   rather than an error.  This prevents bots from learning they were detected
 *   and trying to adapt.
 *
 * ─── Rate limiting ────────────────────────────────────────────────────────────
 *
 *   `checkRateLimit()` limits each (IP address × form key) pair to
 *   RATE_LIMIT_MAX per RATE_LIMIT_WINDOW_MS.  Default: 5 per 10 minutes.
 *
 *   Implementation: a module-level Map stores submission timestamps per key.
 *   Timestamps older than the window are pruned on every check so memory
 *   does not grow unboundedly.
 *
 *   IMPORTANT — serverless note:
 *     This store is process-local.  In serverless/edge deployments (Vercel,
 *     Cloudflare) each cold-started instance has its own empty Map.  The
 *     limit therefore applies per-instance, not globally.
 *
 *     This is intentional — the complexity cost of a shared Redis/Upstash
 *     store is not justified at this stage.  Per-instance limiting still
 *     prevents a single browser from hammering one instance, catches naive
 *     bots, and provides a meaningful safety floor for small-to-medium traffic.
 *
 *     If global rate limiting becomes necessary, replace the Map with an
 *     Upstash Redis KV call inside `checkRateLimit()` — the function
 *     signature and all call sites remain unchanged.
 *
 * ─── Module structure ────────────────────────────────────────────────────────
 *
 *   HONEYPOT_FIELD     — shared field name constant (used by server + client)
 *   checkHoneypot()    — returns true when honeypot is filled (bot detected)
 *   checkRateLimit()   — checks + records a submission; returns allowed/blocked
 *   RateLimitResult    — typed result from checkRateLimit()
 */

import "server-only";

import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The name attribute of the hidden honeypot input field.
 *
 * Must match the `name` rendered by FormSectionBlock on the client.
 * Intentionally generic — not obviously named "honeypot" or "trap".
 */
export const HONEYPOT_FIELD = "_hp" as const;

/**
 * Sliding window duration for rate limiting in milliseconds.
 * Default: 10 minutes.
 */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Maximum number of submissions allowed per (IP × formKey) per window.
 * Default: 5.
 */
const RATE_LIMIT_MAX = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Honeypot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when the honeypot field is non-empty — bot is detected.
 *
 * Call this before validation so the fake success response is returned
 * before the bot learns anything about the form's validation rules.
 *
 * @param body  Parsed request body (may or may not contain the honeypot key).
 */
export function checkHoneypot(body: Record<string, string>): boolean {
  return Boolean(body[HONEYPOT_FIELD]?.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed result of a rate limit check.
 *
 *   allowed: true  — submission is within the limit; it has been recorded.
 *   allowed: false — limit exceeded; `retryAfterSeconds` is set.
 */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Module-level submission timestamp store.
 * Key:   `${ip}:${formKey}`
 * Value: ordered array of Unix timestamps (ms) within the current window.
 *
 * @internal
 */
const rateLimitStore = new Map<string, number[]>();

/**
 * Checks whether a submission from the given IP is within the rate limit,
 * and records it if so.
 *
 * Prunes stale timestamps on every call so memory stays bounded — no
 * separate cleanup timer needed.
 *
 * @param ip       Client IP address string. Use "anonymous" as a fallback.
 * @param formKey  The form being submitted. Limits are scoped per-form.
 * @returns        RateLimitResult — { allowed: true } or { allowed: false, retryAfterSeconds }.
 *
 * @example
 * const result = checkRateLimit(clientIp, "contact");
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { ok: false, error: "Too many submissions. Please try again later." },
 *     { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
 *   );
 * }
 */
export function checkRateLimit(ip: string, formKey: string): RateLimitResult {
  const key         = `${ip}:${formKey}`;
  const now         = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  // Prune timestamps outside the window
  const existing = (rateLimitStore.get(key) ?? []).filter(t => t > windowStart);

  if (existing.length >= RATE_LIMIT_MAX) {
    // Find how long until the oldest entry drops out of the window
    const oldest           = Math.min(...existing);
    const retryAfterMs     = oldest + RATE_LIMIT_WINDOW_MS - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    logger.warn("[forms/spam] Rate limit exceeded", { ip, formKey, count: existing.length });
    return { allowed: false, retryAfterSeconds };
  }

  // Record this submission and persist the pruned list
  existing.push(now);
  rateLimitStore.set(key, existing);
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// IP resolution helper
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Turnstile (CAPTCHA)
// ─────────────────────────────────────────────────────────────────────────────

/** Cloudflare Turnstile server-side verification endpoint. */
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile token server-side.
 *
 * POSTs the token + secret to Cloudflare's siteverify endpoint. Returns true
 * only when Cloudflare confirms the challenge was solved. Never throws — any
 * network/parse error returns false so the caller can reject the submission.
 *
 * @param token   The `cf-turnstile-response` value from the submitted form.
 * @param secret  The tenant's decrypted Turnstile secret key.
 * @param ip      Optional client IP (sent as `remoteip` for extra validation).
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  ip?: string | null,
): Promise<boolean> {
  if (!token || !secret) return false;
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip && ip !== "anonymous") body.set("remoteip", ip);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      logger.warn("[forms/spam] Turnstile siteverify HTTP error", { status: res.status });
      return false;
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) {
      logger.warn("[forms/spam] Turnstile verification failed", { errors: data["error-codes"] });
    }
    return Boolean(data.success);
  } catch (err) {
    logger.error("[forms/spam] Turnstile verify error", { error: String(err) });
    return false;
  }
}

/**
 * Resolves the best-effort client IP from request headers.
 *
 * Reads standard proxy/CDN forwarding headers in priority order:
 *   1. X-Forwarded-For (first entry — the original client)
 *   2. X-Real-IP
 *   3. "anonymous" fallback when no IP is available
 *
 * Never throws — always returns a non-empty string suitable for use as a
 * rate-limit Map key.
 *
 * @param headers  The `Headers` object from the incoming `NextRequest`.
 */
export function resolveClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get("x-real-ip")?.trim();
  if (xri) return xri;
  return "anonymous";
}
