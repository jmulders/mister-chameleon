/**
 * Theme Session Stability
 *
 * Manages the per-session theme lock so the active theme does not change
 * erratically as a visitor moves between pages.
 *
 * ─── Strategy ─────────────────────────────────────────────────────────────────
 *
 *   On each server request the theme decision layer evaluates ThemeRules
 *   against the visitor context and resolves a theme key.  Without a stability
 *   mechanism this could produce different results on each page — for example if
 *   `timeOfDay` ticks from "evening" to "night" mid-session.
 *
 *   Solution: write the resolved theme into a short-lived httpOnly cookie
 *   (`mc_theme`) on the first page load.  Subsequent requests read that cookie
 *   and skip re-evaluation, preserving visual consistency.
 *
 * ─── Lock lifetime ────────────────────────────────────────────────────────────
 *
 *   Default: 4 hours (`THEME_SESSION_MAX_AGE`).
 *
 *   The lock expires after 4 hours so a visitor who arrives at 23:55 with a
 *   "night" theme will eventually receive a fresh evaluation (rather than being
 *   stuck with the dark theme indefinitely during a long working session).
 *
 *   Campaign overrides bypass the lock: if a new UTM campaign parameter arrives
 *   AND a campaign-priority rule (priority < 10) exists, the lock is cleared and
 *   rules are re-evaluated.  This is handled in resolveThemeDecision().
 *
 * ─── Cookie spec ──────────────────────────────────────────────────────────────
 *
 *   Name:     mc_theme
 *   Value:    ThemePresetKey string (validated before use)
 *   Path:     /
 *   HttpOnly: true  (no client-side read — prevent flicker from JS access)
 *   Secure:   true in production
 *   SameSite: Lax
 *   MaxAge:   14400 seconds (4 hours)
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 * Server component (RSC) usage:
 * ```ts
 * import { cookies } from "next/headers";
 * import { readThemeSessionCookie, writeThemeSessionCookie } from "@/lib/theme-session";
 *
 * // Read existing lock
 * const cookieStore = await cookies();
 * const sessionTheme = readThemeSessionCookie(cookieStore);
 *
 * // After resolving:
 * // const trace = resolveThemeDecision(config, ctx, tenantDefault, sessionTheme);
 * // if (!trace.sessionLocked) {
 * //   writeThemeSessionCookie(cookieStore, trace.resolvedTheme);
 * // }
 * ```
 *
 * Route handler / Server Action usage:
 * ```ts
 * import { cookies } from "next/headers";
 * const cookieStore = await cookies();
 * clearThemeSessionCookie(cookieStore);
 * ```
 */

import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { isThemePresetKey } from "@/design-system/theme/presets";
import type { ThemePresetKey } from "@/design-system/theme/presets";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cookie name for the session theme lock. */
export const THEME_SESSION_COOKIE = "mc_theme" as const;

/**
 * Lock lifetime in seconds.
 *
 * 4 hours — long enough to ensure a consistent session, short enough to
 * re-evaluate for visitors who stay a long time (e.g. overnight sessions).
 */
export const THEME_SESSION_MAX_AGE = 60 * 60 * 4; // 4 hours

// ── Cookie helpers ─────────────────────────────────────────────────────────────

/**
 * Read the locked theme key from the session cookie.
 *
 * Returns the locked ThemePresetKey, or null when:
 * - no cookie is present (new session)
 * - the cookie value is not a valid ThemePresetKey (stale / tampered)
 */
export function readThemeSessionCookie(
  cookieStore: ReadonlyRequestCookies,
): ThemePresetKey | null {
  const value = cookieStore.get(THEME_SESSION_COOKIE)?.value;
  if (!value) return null;
  return isThemePresetKey(value) ? value : null;
}

/**
 * Write the theme lock cookie onto the response.
 *
 * Only call this when the theme was freshly evaluated (trace.sessionLocked ===
 * false) — do not overwrite an existing lock with the same value unnecessarily.
 *
 * Note: Next.js 14+ requires `cookies()` to be called inside a Server Action
 * or Route Handler to write cookies.  In RSC you must use `cookies()` from
 * `next/headers` and the write is deferred to the response flush.
 */
export function writeThemeSessionCookie(
  cookieStore: ReturnType<typeof import("next/headers")["cookies"]> extends Promise<infer C> ? C : never,
  themeKey: ThemePresetKey,
): void {
  cookieStore.set(THEME_SESSION_COOKIE, themeKey, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   THEME_SESSION_MAX_AGE,
  });
}

/**
 * Clear the theme session lock.
 *
 * Call this from an admin Server Action when the operator changes the tenant's
 * active theme or updates theme rules, so the next page load re-evaluates.
 */
export function clearThemeSessionCookie(
  cookieStore: ReturnType<typeof import("next/headers")["cookies"]> extends Promise<infer C> ? C : never,
): void {
  cookieStore.delete(THEME_SESSION_COOKIE);
}

// ── Client-side stability helpers ─────────────────────────────────────────────

/**
 * CSS custom property name used to suppress theme flash on client navigation.
 *
 * When Next.js does a client-side navigation the new page HTML is rendered
 * without a round-trip, so the server-side cookie isn't consulted.  To prevent
 * a flash of the wrong theme, the root layout sets `data-theme-key` on <body>
 * and client components can read it:
 *
 *   const activeTheme = document.body.dataset.themeKey as ThemePresetKey;
 *
 * This is set server-side in the root layout and read by ThemeProvider (if
 * needed for client-side theme-aware behaviour).
 */
export const THEME_DATA_ATTRIBUTE = "data-theme-key" as const;
