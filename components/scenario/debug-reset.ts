/**
 * Debug Reset Utilities
 *
 * Client-side utilities for resetting website session state during
 * local development and demo scenarios.
 *
 * ─── Reset levels ────────────────────────────────────────────────────────────
 *
 *   resetWebsiteSession()
 *     Clears everything that accumulates within a visit/session:
 *       • HttpOnly server cookies (mc_session_id, mc_seen, mc_theme, mc_li,
 *         mc_cc) — cleared via POST /api/debug/reset-session, which responds
 *         with Set-Cookie: Max-Age=0.  JS document.cookie cannot clear HttpOnly
 *         cookies.
 *       • Scenario Control overrides — clearScenario() fires store listeners
 *         so subscribed React components update before the reload.
 *       • ALL mc_* sessionStorage keys — including mc_cc_sent and mc_li_sent
 *         so ClientContextCollector and LeadinfoProvider re-run on the next load.
 *       • Journey event store in-memory (window.__journey.events array)
 *       • Non-httpOnly client cookies — mc_scenario, mc_tz, mc_attr
 *     Result: the site behaves exactly like a first visit in a clean browser tab.
 *     Visitor identity (mc_visitor_id) is preserved.
 *
 *   resetWebsiteSessionAndVisitor()   ← TRUE FULL WIPE (Phase 5)
 *     The nuclear option.  Delegates to resetFull() which wipes EVERYTHING:
 *       • ALL cookies the server can see — via /api/debug/reset-session-full,
 *         which reads request.cookies and expires every name it finds.
 *       • ALL JS-accessible cookies — document.cookie enumeration.
 *       • ENTIRE sessionStorage — every key for this origin.
 *       • ENTIRE localStorage   — every key for this origin (incl. mc_visitor_id).
 *       • Scenario Control overrides — store listeners fired before wipe.
 *       • window.__journey — deleted entirely, re-initialised on next load.
 *       • Server provider caches — flushed so enrichment re-runs from live APIs.
 *     Result: completely anonymous first-ever visit — no history, no identity,
 *     no journey contamination, no third-party cookie residue.
 *
 * ─── httpOnly cookie clearing ─────────────────────────────────────────────────
 *
 *   HttpOnly cookies are set with HttpOnly=true.  JavaScript's document.cookie
 *   cannot delete them; it only creates a non-httpOnly shadow with the same name.
 *   The browser then sends BOTH — the server sees the original value and behaves
 *   as if nothing changed.
 *
 *   resetWebsiteSession() uses POST /api/debug/reset-session (expires known five).
 *   resetWebsiteSessionAndVisitor() uses POST /api/debug/reset-session-full which
 *   reads every cookie name from request.cookies and expires them all.
 *
 * ─── Why mc_cc_sent and mc_li_sent MUST be cleared ────────────────────────────
 *
 *   ClientContextCollector writes "mc_cc_sent" to sessionStorage after it fires.
 *   LeadinfoProvider writes "mc_li_sent" after Leadinfo resolves.  Both flags
 *   prevent re-running on navigations within the same tab.  sessionStorage
 *   persists across hard reloads (tab not closed).  If these survive, the Debug
 *   panel shows stale / missing context variables after reset.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   • Guards all window / document access (SSR-safe).
 *   • Returns a plain object so the caller can display a summary toast.
 *   • Both server routes are guarded by NODE_ENV !== "production" || ENABLE_DEBUG_RESET.
 *
 * ─── Storage / cookie inventory ───────────────────────────────────────────────
 *
 *   httpOnly Cookie   Purpose                               Cleared by
 *   ────────────────  ────────────────────────────────────  ──────────────────────────────
 *   mc_session_id     Server-issued session UUID            full-reset API (all cookies)
 *   mc_seen           "Has this browser been seen?" flag    full-reset API (all cookies)
 *   mc_theme          Session-locked theme key              full-reset API (all cookies)
 *   mc_li             Leadinfo company match result         full-reset API (all cookies)
 *   mc_cc             Client-context snapshot               full-reset API (all cookies)
 *   <any future>      Any platform cookie added later       full-reset API (all cookies)
 *
 *   JS Cookie         Purpose                               Cleared by
 *   ────────────────  ────────────────────────────────────  ──────────────────────────────
 *   mc_scenario       Scenario override payload             expireAllAccessibleCookies()
 *   mc_tz             IANA timezone string                  expireAllAccessibleCookies()
 *   mc_attr           First-touch UTM / referrer            expireAllAccessibleCookies()
 *   <any third-party> Any cookie set by external scripts    expireAllAccessibleCookies()
 *
 *   sessionStorage    Purpose                               Cleared by
 *   ────────────────  ────────────────────────────────────  ──────────────────────────────
 *   mc_scenario_v1    Scenario Control store                clearScenario() + sessionStorage.clear()
 *   mc_client_session Client session ID                     sessionStorage.clear()
 *   mc_cc_sent        ClientContextCollector sent-flag      sessionStorage.clear()
 *   mc_li_sent        LeadinfoProvider sent-flag            sessionStorage.clear()
 *   <any other>       Third-party SDK keys, A/B keys, etc.  sessionStorage.clear()
 *
 *   localStorage      Purpose                               Cleared by
 *   ────────────────  ────────────────────────────────────  ──────────────────────────────
 *   mc_visitor_id     Stable visitor identity UUID          localStorage.clear()
 *   <any other>       Any key written by any script         localStorage.clear()
 */

"use client";

import { clearScenario } from "./scenario-store";

// ── Cookie names (must stay in sync with data/session.ts and journey-store.ts) ─
//
// Only non-httpOnly cookies can be expired here (via document.cookie).
// httpOnly cookies (mc_session_id, mc_seen, mc_theme, mc_li, mc_cc) are
// cleared server-side by POST /api/debug/reset-session.
//
// mc_cc and mc_li are httpOnly — expiring them via document.cookie has NO effect.
// They are listed here as comments only; the server route clears them via
// Set-Cookie: Max-Age=0.

const SCENARIO_COOKIE     = "mc_scenario";  // NOT httpOnly — JS-clearable
const TIMEZONE_COOKIE     = "mc_tz";        // NOT httpOnly — JS-clearable
const ATTRIBUTION_COOKIE  = "mc_attr";      // NOT httpOnly — JS-clearable

// ── Server reset API ──────────────────────────────────────────────────────────

const RESET_API_URL      = "/api/debug/reset-session";
const FULL_RESET_API_URL = "/api/debug/reset-session-full";

/**
 * Call the server-side reset route to expire httpOnly cookies
 * (mc_session_id, mc_seen, mc_theme, mc_li, mc_cc) via proper Set-Cookie
 * response headers.
 *
 * JavaScript's document.cookie cannot write or delete HttpOnly cookies.
 * Failing silently is intentional — if the route is unavailable (e.g. not
 * found in production without opt-in), the client-side cleanup still runs.
 */
async function expireHttpOnlyCookiesViaServer(): Promise<void> {
  try {
    await fetch(RESET_API_URL, { method: "POST" });
  } catch {
    // Silently ignore — network errors or 403 (production without opt-in)
    // don't prevent client-side storage cleanup.
  }
}

/**
 * Call the full-reset route which expires EVERY cookie the server sees in
 * the current request — not just the known mc_* set.  This ensures that
 * any cookie written by a third-party script, a previous experiment, or a
 * future platform feature is also wiped.
 *
 * Fails silently for the same reasons as expireHttpOnlyCookiesViaServer().
 */
async function expireAllCookiesViaServer(): Promise<void> {
  try {
    await fetch(FULL_RESET_API_URL, { method: "POST" });
  } catch {
    // Silently ignore
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Expire a non-httpOnly cookie by name (path=/, SameSite=Lax). */
function expireCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; SameSite=Lax; max-age=0`;
}

/**
 * Remove ALL sessionStorage keys whose names begin with "mc_".
 *
 * This catches every mister-chameleon session-scoped key in one pass — including
 * mc_scenario_v1, mc_client_session, mc_cc_sent, mc_li_sent, and any future
 * keys added to the codebase without updating this list.
 *
 * NOTE: Call clearScenario() BEFORE this function.  clearScenario() fires the
 * scenario-store listeners so React components update before the page reload;
 * removing mc_scenario_v1 via removeItem() alone does NOT fire those listeners.
 */
function clearAllMcSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("mc_")) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* storage blocked (private mode, storage quota, etc.) */ }
}

/**
 * Wipe the ENTIRE sessionStorage for this origin.
 *
 * Used for Phase 5 "full reset" — clears every key, not just mc_* ones.
 * This ensures that any third-party SDK, A/B test framework, or future
 * platform key does not survive the reset.
 *
 * Call clearScenario() BEFORE this so the scenario store fires its
 * listeners synchronously before all storage is wiped.
 */
function clearEntireSessionStorage(): void {
  if (typeof window === "undefined") return;
  try { sessionStorage.clear(); } catch { /* storage blocked */ }
}

/**
 * Wipe the ENTIRE localStorage for this origin.
 *
 * Used for Phase 5 "full reset".  Removes mc_visitor_id and every other
 * key that any script has written to localStorage, forcing all identity
 * and preference stores to be re-initialised on the next page load.
 */
function clearEntireLocalStorage(): void {
  if (typeof window === "undefined") return;
  try { localStorage.clear(); } catch { /* storage blocked */ }
}

/**
 * Enumerate and expire every cookie the browser exposes to JavaScript
 * (i.e. cookies without the HttpOnly flag that were set on the current
 * origin).
 *
 * HttpOnly cookies are NOT visible to document.cookie — they must be
 * expired server-side (handled by expireAllCookiesViaServer()).  The two
 * mechanisms together cover 100 % of the cookie jar.
 */
function expireAllAccessibleCookies(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie.split(";").forEach((pair) => {
      const name = pair.split("=")[0]?.trim();
      if (name) {
        // Expire on the current path and on "/" to catch any path-scoped cookies.
        document.cookie = `${name}=; Path=/; SameSite=Lax; max-age=0`;
        const currentPath = window.location.pathname;
        if (currentPath !== "/") {
          document.cookie = `${name}=; Path=${currentPath}; SameSite=Lax; max-age=0`;
        }
      }
    });
  } catch { /* cookie access blocked */ }
}

/** Reset window.__journey to an empty events array (keeps IDs intact). */
function clearJourneyStoreEvents(): void {
  if (typeof window === "undefined") return;
  if (window.__journey) {
    window.__journey.events = [];
  }
}

// ── Result type ───────────────────────────────────────────────────────────────

export interface DebugResetResult {
  /** What the reset cleared (for display in a confirmation toast). */
  cleared: string[];
  /** Whether the visitor identity was also reset. */
  visitorIdentityReset: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resets the current website session to a clean first-visit state.
 *
 * Async: awaits the server-side cookie-clear route before navigating so that
 * the browser receives the Set-Cookie: Max-Age=0 headers before the reload.
 *
 * Clears:
 *   - HttpOnly cookies (mc_session_id, mc_seen, mc_theme, mc_li, mc_cc) — via server API
 *   - Scenario Control overrides (fires store listeners, then removes sessionStorage key)
 *   - Journey event store events (window.__journey.events)
 *   - ALL mc_* sessionStorage keys — including mc_cc_sent and mc_li_sent so
 *     ClientContextCollector and LeadinfoProvider re-run on the next page load
 *   - Non-httpOnly client cookies (mc_scenario, mc_tz, mc_attr)
 *
 * Does NOT clear the visitor identity (mc_visitor_id in localStorage).
 * Use resetWebsiteSessionAndVisitor() to also wipe visitor identity.
 *
 * @returns  Summary of what was cleared.
 */
export async function resetWebsiteSession(): Promise<DebugResetResult> {
  if (typeof window === "undefined") {
    return { cleared: [], visitorIdentityReset: false };
  }

  const cleared: string[] = [];

  // 1. Expire httpOnly cookies server-side FIRST.
  //    mc_session_id, mc_seen, mc_theme, mc_li, mc_cc are all httpOnly — only
  //    a server Set-Cookie: Max-Age=0 response can delete them.  Must be awaited
  //    so the browser processes the response headers before we navigate.
  await expireHttpOnlyCookiesViaServer();
  cleared.push("Server httpOnly cookies (session, seen, theme, li, cc)");

  // 2. Fire scenario store listeners BEFORE wiping sessionStorage so React
  //    components that subscribe to scenario state get an "inactive" update.
  clearScenario();
  cleared.push("Scenario overrides");

  // 3. Clear journey event store events (keep IDs, just wipe events array).
  //    The in-memory IDs are irrelevant after the hard reload below.
  clearJourneyStoreEvents();
  cleared.push("Journey event store");

  // 4. Wipe ALL mc_* sessionStorage keys in one pass.
  //    This includes mc_scenario_v1, mc_client_session, mc_cc_sent, mc_li_sent,
  //    and any future keys — preventing the client collectors (ClientContextCollector,
  //    LeadinfoProvider) from skipping their first post-reset execution.
  clearAllMcSessionStorage();
  cleared.push("All mc_* sessionStorage keys (incl. collector sent-flags)");

  // 5. Expire JS-accessible (non-httpOnly) cookies.
  //    mc_cc and mc_li are httpOnly — they were expired by the server in step 1.
  expireCookie(SCENARIO_COOKIE);    // scenario override cookie
  expireCookie(TIMEZONE_COOKIE);    // IANA timezone cache
  expireCookie(ATTRIBUTION_COOKIE); // first-touch UTM/referrer attribution
  cleared.push("Client cookies (scenario, timezone, attribution)");

  return { cleared, visitorIdentityReset: false };
}

/**
 * True Full Reset — wipes EVERYTHING the browser has stored for this origin.
 *
 * This is the Phase 5 upgrade to "Reset session + visitor identity".  It
 * delegates to resetFull() which clears all cookies (httpOnly via the server
 * full-reset API, JS-accessible via document.cookie enumeration), the entire
 * localStorage, the entire sessionStorage, the scenario store, and the
 * in-memory journey object — then flushes all server-side provider caches.
 *
 * Compared to the old implementation:
 *   Before — only mc_visitor_id was removed from localStorage; only mc_*
 *            keys were removed from sessionStorage; only the five known
 *            httpOnly cookies were expired.
 *   After  — every key in localStorage and sessionStorage is wiped; every
 *            cookie the server can see is expired; all JS-accessible cookies
 *            are expired via document.cookie enumeration.
 *
 * Result: a completely anonymous, first-ever visit — no history, no
 * remembered identity, no journey contamination, no third-party cookie
 * residue, no cached enrichment data.
 *
 * @returns  Summary of what was cleared.
 */
export async function resetWebsiteSessionAndVisitor(): Promise<DebugResetResult> {
  return resetFull();
}

/**
 * Phase 5 — True Full Reset.
 *
 * The nuclear option.  Wipes EVERYTHING the browser has stored for this
 * origin and forces the server to expire every cookie it can see, including
 * non-mc_* cookies written by third-party scripts or A/B test frameworks.
 *
 * Clears:
 *   - ALL cookies accessible to JavaScript (document.cookie enumeration)
 *   - ALL httpOnly cookies the server knows about — via a dedicated full-reset
 *     route that reads `request.cookies` and expires every name it sees
 *   - ALL sessionStorage (not just mc_* keys) — every key for this origin
 *   - ALL localStorage (not just mc_visitor_id) — every key for this origin
 *   - Scenario Control overrides (fires store listeners before storage wipe)
 *   - Journey event store (in-memory window.__journey deleted entirely)
 *   - window.__journey — re-initialised with fresh IDs on next page load
 *
 * What will reappear after the hard reload (and why):
 *   - mc_visitor_id   — Platform generates a fresh UUID when it detects absence
 *   - mc_session_id   — Server issues a new session UUID on the first request
 *   - mc_seen         — Reset to "new" by the server
 *   - Third-party cookies — Re-set by scripts that run on page load (expected)
 *
 * When to use:
 *   Use when a session or visitor reset does not fully clear a stuck context
 *   variable, or when testing a completely blank-slate interaction where no
 *   trace of the previous visit should survive.
 *
 * @returns  Summary of what was cleared.
 */
export async function resetFull(): Promise<DebugResetResult> {
  if (typeof window === "undefined") {
    return { cleared: [], visitorIdentityReset: true };
  }

  const cleared: string[] = [];

  // 1. Fire scenario store listeners FIRST so React components get a clean
  //    "inactive" update before we wipe sessionStorage underneath them.
  clearScenario();
  cleared.push("Scenario overrides (store listeners fired)");

  // 2. Destroy the in-memory journey store BEFORE clearing storage so that
  //    any code path that runs between now and the reload starts fresh.
  if (window.__journey) {
    delete window.__journey;
  }
  cleared.push("Journey store (in-memory, deleted)");

  // 3. Ask the server to expire every httpOnly cookie it can see in the
  //    current request.  Must be awaited so Set-Cookie headers arrive before
  //    we navigate.  This covers ALL httpOnly cookies — not just the known
  //    five — so future-added platform cookies are automatically included.
  await expireAllCookiesViaServer();
  cleared.push("All server-visible cookies (httpOnly + js-accessible, via full-reset API)");

  // 4. Expire every JavaScript-accessible cookie for this origin.
  //    HttpOnly cookies can't be seen or expired from JS — step 3 covers those.
  expireAllAccessibleCookies();
  cleared.push("All JS-accessible cookies (document.cookie enumeration)");

  // 5. Wipe entire sessionStorage — catches every key, not just mc_* ones.
  clearEntireSessionStorage();
  cleared.push("Entire sessionStorage (all keys)");

  // 6. Wipe entire localStorage — catches mc_visitor_id plus every other key
  //    written by any script on this origin.
  clearEntireLocalStorage();
  cleared.push("Entire localStorage (all keys, including mc_visitor_id)");

  return { cleared, visitorIdentityReset: true };
}
