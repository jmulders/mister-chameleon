/**
 * lib/locale.ts
 *
 * Locale helper used by Server Components to read the active locale from the
 * request cookie set by the proxy middleware.
 *
 * ─── Supported locales ────────────────────────────────────────────────────────
 *
 *   "en"  — English (default)
 *   "nl"  — Dutch
 *   "de"  — German
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   1. Visitor lands on a page with ?lang=nl in the URL.
 *   2. proxy.ts reads the ?lang= param, validates it, and writes a `locale`
 *      cookie (1-year TTL).
 *   3. On subsequent requests the browser sends the `locale` cookie.
 *   4. Server Components call getLocale() to get the active locale string.
 *      The result is used to:
 *        • fetch the locale-specific siteSettings from Sanity
 *        • fetch locale-specific page documents from Sanity
 *        • display the correct flag in the language switcher dropdown
 *
 * ─── Cookie lifetime ──────────────────────────────────────────────────────────
 *
 *   The `locale` cookie is set with maxAge = 31_536_000 (1 year).  It persists
 *   across browser sessions so the visitor's language preference is remembered.
 *   Selecting a new language from the dropdown overwrites the cookie.
 */

import { cookies } from "next/headers";

// ── Supported locales ─────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["en", "nl", "de"] as const;
export type  SupportedLocale   = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

/** True when the given string is a known supported locale. */
export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// ── Cookie name ───────────────────────────────────────────────────────────────

export const LOCALE_COOKIE = "locale";

// ── Server-side locale reader ─────────────────────────────────────────────────

/**
 * Read the active locale from the Next.js request cookie store.
 * Returns DEFAULT_LOCALE ("en") when the cookie is absent or invalid.
 *
 * Usage (in any Server Component or route handler):
 *   const locale = await getLocale();
 */
export async function getLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const value       = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
