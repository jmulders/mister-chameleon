/**
 * Debug Reset API  —  app/api/debug/reset-session/route.ts
 *
 * Server-side session reset for the "Reset website session" and
 * "Reset session + visitor identity" actions in Scenario Control.
 *
 * ─── What it does ────────────────────────────────────────────────────────────
 *
 *   1. Reads the current mc_session_id from the incoming request cookies.
 *
 *   2. Calls handleInvalidation({ type: "session-reset", sessionId }) to
 *      explicitly evict the old session's enrichment + decision plan caches
 *      before the new session is issued.
 *
 *   3. Calls flushAllProviderCaches() to evict ALL IP-keyed / query-keyed
 *      provider caches (Leadinfo, IPinfo, OpenKvK, Seasonal, GA4, RevGeo).
 *      This is the critical step for true context reset: without it, the new
 *      session immediately re-populates from the same provider caches and
 *      context variables appear "stuck" in the Debug panel.
 *
 *   4. Returns Set-Cookie headers that expire ALL httpOnly enrichment and
 *      session cookies:
 *
 *        mc_session_id  — issues a fresh session UUID on next request
 *        mc_seen        — resets visit-type to "new"
 *        mc_theme       — forces theme-decision re-evaluation
 *        mc_li          — clears Leadinfo enrichment data (company/IP match)
 *        mc_cc          — clears client context snapshot (device/viewport/tz)
 *
 * ─── Why mc_li must be cleared ───────────────────────────────────────────────
 *
 *   buildDecisionContext() reads the mc_li (httpOnly, 7-day TTL) cookie and
 *   merges its Leadinfo company data AFTER the staged enrichment pipeline.
 *   This "client-side Leadinfo" merge gives Leadinfo data precedence over
 *   server-side enrichment because the client call uses the real browser IP.
 *
 *   If mc_li is not cleared, the old company identification persists regardless
 *   of provider cache flushes — the cookie carries the stale data directly into
 *   the context without going through any cache the server can flush.
 *
 * ─── Why mc_cc must be cleared server-side ───────────────────────────────────
 *
 *   mc_cc is httpOnly — JavaScript's document.cookie cannot delete it.  The
 *   debug-reset.ts client helper previously attempted `document.cookie =
 *   "mc_cc=; max-age=0"` which only created a non-httpOnly shadow; the real
 *   cookie persisted.  Clearing it here ensures the client context (device,
 *   viewport, timezone) is also refreshed on the post-reset render.
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *
 *   Only enabled in development or when ENABLE_DEBUG_RESET=true is set.
 *   Returns 403 in production without the opt-in env var.
 *
 * ─── Client usage ────────────────────────────────────────────────────────────
 *
 *   await fetch("/api/debug/reset-session", { method: "POST" });
 *   window.location.href = "?";   // trigger a fresh server-side render
 */

import { type NextRequest, NextResponse } from "next/server";
import { handleInvalidation }             from "@/cache/invalidation";
import { flushAllProviderCaches }         from "@/enrichment/flush-debug";

// ── Safety gate ────────────────────────────────────────────────────────────────

function isResetAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ENABLE_DEBUG_RESET === "true";
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a `Set-Cookie` header value that expires the named cookie.
 * HttpOnly must be set here — that is the whole point of this route.
 */
function expireCookieHeader(name: string, secure: boolean): string {
  const securePart = secure ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${securePart}`;
}

/**
 * Parse a single cookie value from a raw `Cookie:` header string.
 * Returns null if the cookie is not present.
 */
function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isResetAllowed()) {
    return NextResponse.json(
      { ok: false, error: "Debug reset is not enabled in this environment." },
      { status: 403 },
    );
  }

  // ── 1. Invalidate the current session's server-side caches ─────────────────
  //
  // Read the current mc_session_id before expiring it so we can explicitly
  // evict its enrichment + decision plan cache entries.  Without this step,
  // those cache entries sit until their TTL expires — not a problem for new
  // sessions (they get a new ID) but wasteful and potentially confusing.
  const cookieHeader  = request.headers.get("cookie");
  const oldSessionId  = parseCookieValue(cookieHeader, "mc_session_id");

  if (oldSessionId) {
    await handleInvalidation({ type: "session-reset", sessionId: oldSessionId });
  }

  // ── 2. Flush all IP/query-keyed provider caches ────────────────────────────
  //
  // This is the critical step for true context reset.  Even with a new
  // sessionId, the enrichment pipeline hits provider caches keyed by IP
  // address (Leadinfo, IPinfo) or company query (OpenKvK).  The developer's
  // IP hasn't changed, so the new session would immediately get the same
  // enrichment from provider caches — context variables appear "stuck".
  //
  // Flushing forces the next request to hit live enrichment APIs.
  flushAllProviderCaches();

  // ── 3. Build response with cookie expiry headers ────────────────────────────
  //
  // Expire all httpOnly cookies that carry enrichment or session state.
  // JavaScript document.cookie cannot delete httpOnly cookies — only a
  // server Set-Cookie: Max-Age=0 response can do this.
  const isSecure = process.env.NODE_ENV === "production";

  const response = NextResponse.json({
    ok:      true,
    cleared: [
      "mc_session_id",  // session UUID — new one issued on next request
      "mc_seen",        // visit-type flag — resets to "new"
      "mc_theme",       // session-locked theme — forces re-evaluation
      "mc_li",          // Leadinfo enrichment (company name/domain/IP match)
      "mc_cc",          // client context snapshot (device/viewport/tz)
    ],
    providerCachesFlushed: true,
    sessionInvalidated:    !!oldSessionId,
  });

  response.headers.append("Set-Cookie", expireCookieHeader("mc_session_id", isSecure));
  response.headers.append("Set-Cookie", expireCookieHeader("mc_seen",       isSecure));
  response.headers.append("Set-Cookie", expireCookieHeader("mc_theme",      isSecure));
  response.headers.append("Set-Cookie", expireCookieHeader("mc_li",         isSecure));
  response.headers.append("Set-Cookie", expireCookieHeader("mc_cc",         isSecure));

  return response;
}
