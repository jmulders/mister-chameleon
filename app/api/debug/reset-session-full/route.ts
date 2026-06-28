/**
 * Debug Full-Reset API  —  app/api/debug/reset-session-full/route.ts
 *
 * Phase 5 — True Full Reset.
 *
 * The nuclear-option counterpart to /api/debug/reset-session.
 * Where the session-reset route expires a hardcoded list of known mc_*
 * cookies, THIS route reads every cookie name from the current request and
 * expires all of them.
 *
 * ─── Why a separate endpoint? ────────────────────────────────────────────────
 *
 *   The original /api/debug/reset-session was written to clear exactly the
 *   five cookies the platform manages (mc_session_id, mc_seen, mc_theme,
 *   mc_li, mc_cc).  Expiring unknown cookies from a shared route would be a
 *   breaking change.
 *
 *   The full-reset route is deliberately separate so that:
 *     • The existing "Reset session" UX is unchanged for everyday use.
 *     • The aggressive "Full reset" action is an explicit opt-in.
 *     • Any cookie written by a third-party script, an A/B test framework,
 *       or a future platform feature is wiped without needing a code change.
 *
 * ─── What it does ─────────────────────────────────────────────────────────────
 *
 *   1. Reads every cookie name from request.cookies.
 *
 *   2. Calls handleInvalidation({ type: "session-reset", sessionId }) on the
 *      current mc_session_id before expiring it.
 *
 *   3. Calls flushAllProviderCaches() to evict ALL IP/query-keyed provider
 *      caches so the next request hits live enrichment APIs.
 *
 *   4. Returns Set-Cookie: <name>=; Max-Age=0; HttpOnly headers for every
 *      cookie in the jar — including both httpOnly and non-httpOnly cookies.
 *      The browser applies them before the hard reload that follows.
 *
 * ─── What survives ────────────────────────────────────────────────────────────
 *
 *   Nothing from this origin's cookie jar.  After the hard reload:
 *     • mc_session_id   — reissued by the server as a fresh UUID
 *     • mc_seen         — reset to "new" visit type
 *     • mc_visitor_id   — not a cookie (localStorage), but cleared by the
 *                         client-side resetFull() before this endpoint is hit
 *     • Third-party cookies — re-set by scripts running on page load
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Only enabled in development or when ENABLE_DEBUG_RESET=true is set.
 *   Returns 403 in production without the opt-in env var.
 *
 * ─── Client usage ─────────────────────────────────────────────────────────────
 *
 *   await fetch("/api/debug/reset-session-full", { method: "POST" });
 *   window.location.href = window.location.pathname + "?";
 */

import { type NextRequest, NextResponse } from "next/server";
import { handleInvalidation }             from "@/cache/invalidation";
import { flushAllProviderCaches }         from "@/enrichment/flush-debug";

// ── Safety gate ────────────────────────────────────────────────────────────────

function isResetAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.ENABLE_DEBUG_RESET === "true") return true;
  // The full wipe is a Scenario Control action — allow it wherever the panel is
  // enabled, so it actually clears the httpOnly cookies (mc_lead, mc_session_id,
  // mc_li) on preview/demo deploys. Same gate as the panel itself.
  if (process.env.NEXT_PUBLIC_SHOW_SCENARIO_PANEL === "1") return true;
  return false;
}

// ── Cookie helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a Set-Cookie header string that expires the named cookie.
 *
 * We write BOTH HttpOnly and non-HttpOnly variants so that cookies set
 * without HttpOnly are also expired.  The browser ignores a Set-Cookie for
 * an HttpOnly attribute mismatch — the two independent expiry attempts are
 * harmless and ensure every cookie is covered.
 */
function expireCookieHeader(name: string, secure: boolean): string {
  const securePart = secure ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${securePart}`;
}

function expireCookieHeaderNoHttpOnly(name: string, secure: boolean): string {
  const securePart = secure ? "; Secure" : "";
  return `${name}=; Path=/; SameSite=Lax; Max-Age=0${securePart}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isResetAllowed()) {
    return NextResponse.json(
      { ok: false, error: "Debug reset is not enabled in this environment." },
      { status: 403 },
    );
  }

  // ── 1. Read all cookie names from the current request ─────────────────────
  //
  // request.cookies is a ReadonlyRequestCookies instance — iterate its
  // entries to collect every name the browser sent with this request.
  // This includes HttpOnly cookies (invisible to document.cookie client-side).
  const allCookieNames: string[] = [];
  for (const [name] of request.cookies) {
    if (name) allCookieNames.push(name);
  }

  // ── 2. Invalidate the current session's server-side caches ─────────────────
  const oldSessionId = request.cookies.get("mc_session_id")?.value ?? null;
  if (oldSessionId) {
    await handleInvalidation({ type: "session-reset", sessionId: oldSessionId });
  }

  // ── 3. Flush all IP/query-keyed provider caches ────────────────────────────
  //
  // Without this, the new session immediately re-populates from provider
  // caches (IP-keyed for Leadinfo/IPinfo, query-keyed for OpenKvK) and
  // context variables appear "stuck" in the Debug panel.
  flushAllProviderCaches();

  // ── 4. Build response — expire every known cookie ──────────────────────────
  const isSecure = process.env.NODE_ENV === "production";

  const response = NextResponse.json({
    ok:                   true,
    cookiesExpired:       allCookieNames,
    cookieCount:          allCookieNames.length,
    providerCachesFlushed: true,
    sessionInvalidated:   !!oldSessionId,
  });

  // Expire each cookie twice: with HttpOnly (for httpOnly cookies) and
  // without (for non-httpOnly cookies).  Browsers apply the matching variant
  // and ignore the other — no double-expiry side effects.
  for (const name of allCookieNames) {
    response.headers.append("Set-Cookie", expireCookieHeader(name,          isSecure));
    response.headers.append("Set-Cookie", expireCookieHeaderNoHttpOnly(name, isSecure));
  }

  // Also expire the known platform cookies even if they weren't in the request
  // (e.g. if the browser never sent them on this path).  Belt-and-suspenders.
  const KNOWN_PLATFORM_COOKIES = [
    "mc_session_id",
    "mc_seen",
    "mc_theme",
    "mc_li",
    "mc_cc",
    "mc_scenario",
    "mc_tz",
    "mc_attr",
    "mc_lead",     // ABM known-lead (httpOnly) — drives the known-lead indicator
    "mc_consent",  // consent — a brand-new visitor has not responded yet
  ];
  for (const name of KNOWN_PLATFORM_COOKIES) {
    if (!allCookieNames.includes(name)) {
      response.headers.append("Set-Cookie", expireCookieHeader(name,          isSecure));
      response.headers.append("Set-Cookie", expireCookieHeaderNoHttpOnly(name, isSecure));
    }
  }

  return response;
}
