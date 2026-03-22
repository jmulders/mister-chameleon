/**
 * Session Resolution
 *
 * Pure, side-effect-free helper that derives the current visitor's session
 * state from their Cookie request header.
 *
 * ─── Cookie model ─────────────────────────────────────────────────────────────
 *
 *   mc_session_id   First-party UUID identifying this visitor's current session.
 *                   Created on the first request; persists for SESSION_MAX_AGE.
 *                   httpOnly so it is invisible to client JavaScript.
 *
 *   mc_seen         Presence marker written after the first visit.
 *                   If absent → visitor is "new".
 *                   If present → visitor is "returning".
 *                   Intentionally NOT forwarded to the page on the first visit
 *                   so the visit-type classification in detectVisitorContext()
 *                   stays correct on the very first render.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // In middleware (reads from request, applies to response):
 *   const session = resolveSession(request.headers.get("cookie"));
 *   session.cookiesToSet.forEach(spec => {
 *     response.cookies.set(spec.name, spec.value, spec);
 *   });
 *
 *   // In a Server Component (read-only, session already set by middleware):
 *   const session = resolveSession(headersList.get("cookie"));
 *   // session.sessionId is always populated after middleware has run.
 *
 * ─── No Next.js dependency ────────────────────────────────────────────────────
 *
 *   This module is safe to import from the Edge runtime, Node.js runtime, and
 *   unit tests without any Next.js-specific APIs.
 *
 *   Imports are taken from the specific context sub-modules rather than the
 *   @/context barrel export.  The barrel re-exports fetchVisitorHistory which
 *   transitively imports lib/logger.ts → process.stdout, a Node.js-only API
 *   that is not available in the Edge runtime.  Bypassing the barrel breaks
 *   that dependency chain while leaving everything else unchanged.
 */

import { readCookies }                   from "@/context/helpers";
import { SEEN_COOKIE, SEEN_COOKIE_VALUE } from "@/context/detect-context";

// ── Cookie names ──────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "mc_session_id" as const;

// SEEN_COOKIE and SEEN_COOKIE_VALUE are defined in @/context/detect-context and
// re-exported here so consumers of @/data/session get a single import point.
export { SEEN_COOKIE, SEEN_COOKIE_VALUE };

// ── Cookie lifetimes ──────────────────────────────────────────────────────────

/** Session ID persists for 30 days of inactivity. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

/**
 * "Seen" marker persists for 1 year — long enough that a returning
 * visitor is reliably classified as returning across browser restarts.
 */
export const SEEN_MAX_AGE = 60 * 60 * 24 * 365; // 365 days in seconds

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Describes a cookie that should be set on the response.
 * Shape is compatible with the `ResponseCookies.set()` options accepted
 * by NextResponse (middleware) and Next.js Server Actions.
 */
export interface CookieSpec {
  name: string;
  value: string;
  /** Lifetime in seconds from the moment the response is sent. */
  maxAge: number;
  path: string;
  httpOnly: boolean;
  sameSite: "Lax" | "Strict" | "None";
  /** true in production (requires HTTPS); false in local dev. */
  secure: boolean;
}

/**
 * The resolved session state for the current request.
 *
 * `cookiesToSet` lists the cookies that must be applied to the response.
 * It is empty when both `mc_session_id` and `mc_seen` were already present
 * in the incoming Cookie header (fully established returning visitor).
 */
export interface SessionResolution {
  /** UUID identifying this visitor's session. Always populated. */
  sessionId: string;

  /**
   * Whether a new `mc_session_id` was generated on this request.
   * true  → first request from this browser; a DB session row should be created.
   * false → cookie was already present; the DB row was created on an earlier request.
   */
  isNewSession: boolean;

  /**
   * Visit type derived from the `mc_seen` cookie:
   *   "new"       → mc_seen was absent in the incoming request (first visit)
   *   "returning" → mc_seen was present (has visited before)
   *
   * Mirrors the value detectVisitorContext() produces from the same cookie —
   * both read the same source so they always agree.
   */
  visitType: "new" | "returning";

  /**
   * Cookies to write onto the response.
   *
   * Middleware iterates this array and calls response.cookies.set() for each.
   * Empty when no new cookies need to be set (all were already present).
   */
  cookiesToSet: CookieSpec[];
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Resolves the session state for the current request from its Cookie header.
 *
 * This function is pure — it reads from the provided string and generates
 * any missing values in memory. All side effects (setting cookies, writing
 * to the database) are the responsibility of the caller.
 *
 * @param cookieHeader  The raw value of the `Cookie` request header, or null.
 * @returns             A fully resolved `SessionResolution`.
 */
export function resolveSession(cookieHeader: string | null): SessionResolution {
  const cookies = readCookies(cookieHeader);
  const isSecure = process.env.NODE_ENV === "production";

  const cookiesToSet: CookieSpec[] = [];

  // ── mc_session_id ──────────────────────────────────────────────────────────

  const existingSessionId = cookies.get(SESSION_COOKIE);
  const isNewSession = !existingSessionId;

  const sessionId: string = existingSessionId ?? generateId();

  if (isNewSession) {
    cookiesToSet.push({
      name: SESSION_COOKIE,
      value: sessionId,
      maxAge: SESSION_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
    });
  }

  // ── mc_seen ────────────────────────────────────────────────────────────────

  const seenValue = cookies.get(SEEN_COOKIE);
  const visitType: SessionResolution["visitType"] =
    seenValue === SEEN_COOKIE_VALUE ? "returning" : "new";

  if (visitType === "new") {
    // Write mc_seen=1 to the response so the NEXT visit is classified as returning.
    // We do NOT inject mc_seen into the forwarded request headers — the page must
    // see its absence so detectVisitorContext() classifies this visit as "new".
    cookiesToSet.push({
      name: SEEN_COOKIE,
      value: SEEN_COOKIE_VALUE,
      maxAge: SEEN_MAX_AGE,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecure,
    });
  }

  return { sessionId, isNewSession, visitType, cookiesToSet };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random UUID v4.
 *
 * Uses the Web Crypto API (`crypto.randomUUID()`) which is available in:
 *   - Node.js ≥ 14.17 (used by Next.js ≥ 12)
 *   - Edge runtime (Cloudflare Workers / Vercel Edge Functions)
 *   - All modern browsers
 */
function generateId(): string {
  return crypto.randomUUID();
}
