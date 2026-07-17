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

/**
 * The billable web-session cookie.
 *
 * ─── Why this exists next to mc_session_id ───────────────────────────────────
 *
 *   mc_session_id lives for 30 days of inactivity. Despite the name it is a
 *   VISITOR key, not a session: someone who comes back six times in a month
 *   carries the same value all six times. Everything downstream that wants
 *   continuity — the enrichment cache, the journey history, visitor_profiles —
 *   depends on exactly that, so it must not be shortened.
 *
 *   Billing wants the opposite. A contextual session is one visit: the visitor
 *   arrives, looks at one or more pages, leaves. Keyed on mc_session_id, those
 *   six visits billed as one — the tenant got six adapted visits and paid for
 *   one. So the billing key is its own cookie, with the usual 30-minute
 *   inactivity window (the same definition GA4 uses, which is what tenants will
 *   compare their numbers against).
 */
export const WEB_SESSION_COOKIE = "mc_ws" as const;

// SEEN_COOKIE and SEEN_COOKIE_VALUE are defined in @/context/detect-context and
// re-exported here so consumers of @/data/session get a single import point.
export { SEEN_COOKIE, SEEN_COOKIE_VALUE };

// ── Cookie lifetimes ──────────────────────────────────────────────────────────

/** Session ID persists for 30 days of inactivity. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

/**
 * A web session ends after 30 minutes of inactivity.
 *
 * Refreshed on every request, so the window slides: continuous browsing stays
 * one session no matter how long it lasts. Returning after a 30-minute gap
 * starts a new one — and a new billable contextual session.
 */
export const WEB_SESSION_MAX_AGE = 60 * 30; // 30 minutes in seconds

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
  /**
   * Lowercase on purpose: this spec is spread straight into
   * NextResponse.cookies.set(), whose ResponseCookie type accepts
   * "lax" | "strict" | "none". The capitalised form typechecked nowhere and
   * only survived because next.config sets typescript.ignoreBuildErrors — it
   * worked at runtime because the cookie serializer is case-insensitive.
   */
  sameSite: "lax" | "strict" | "none";
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
   * UUID identifying this visitor's current WEB session — one visit, 30-minute
   * inactivity window. Always populated.
   *
   * This is the billing unit (one contextual session), not `sessionId`. See
   * WEB_SESSION_COOKIE.
   */
  webSessionId: string;

  /**
   * Whether a new web session started on this request — i.e. this is a fresh
   * visit rather than another pageview within one.
   */
  isNewWebSession: boolean;

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
      sameSite: "lax",
      secure: isSecure,
    });
  }

  // ── mc_ws (billable web session) ───────────────────────────────────────────
  //
  // Set on every request, not just when absent: that is what makes the 30-minute
  // window slide. Skipping the refresh would end the session 30 minutes after it
  // STARTED, mid-visit, and bill the same visitor twice for one sitting.

  const existingWebSessionId = cookies.get(WEB_SESSION_COOKIE);
  const isNewWebSession      = !existingWebSessionId;
  const webSessionId: string = existingWebSessionId ?? generateId();

  cookiesToSet.push({
    name: WEB_SESSION_COOKIE,
    value: webSessionId,
    maxAge: WEB_SESSION_MAX_AGE,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
  });

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
      sameSite: "lax",
      secure: isSecure,
    });
  }

  return { sessionId, isNewSession, webSessionId, isNewWebSession, visitType, cookiesToSet };
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
