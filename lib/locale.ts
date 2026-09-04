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

import { cookies, headers } from "next/headers";
// Deliberately the PURE registry lookup, not @/tenant/server: this module is
// also imported by proxy.ts (middleware), and tenant/server pulls in the
// Supabase client. resolveTenantOrNull() is a plain in-memory map lookup.
import { resolveTenantOrNull } from "@/tenant/resolve-tenant";
import { isSupportedLocale, DEFAULT_LOCALE, LOCALE_COOKIE } from "./locale-shared";
import type { SupportedLocale } from "./locale-shared";

// ── Supported locales / cookie name ───────────────────────────────────────────
//
// These live in ./locale-shared so Client Components can read them without
// pulling in next/headers (which resolves to a build-time throw inside a client
// bundle). Re-exported here so `@/lib/locale` stays the single import for
// server-side callers.

export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  readLocaleCookie,
} from "./locale-shared";
export type { SupportedLocale } from "./locale-shared";

// ── Server-side locale reader ─────────────────────────────────────────────────

/**
 * Read the active locale for this request.
 *
 * Resolution order:
 *   1. the `locale` cookie          — the visitor picked a language themselves
 *   2. the active tenant's defaultLocale — what this site is actually written in
 *   3. DEFAULT_LOCALE ("en")        — platform fallback
 *
 * ─── Why step 2 exists ───────────────────────────────────────────────────────
 *
 *   This used to fall straight from the cookie to "en". On a tenant whose CMS
 *   content is Dutch (misterchameleon.nl, defaultLocale "nl") that meant every
 *   FIRST-TIME visitor — and every search engine, which never carries a cookie —
 *   was served the CMS's English site: a different nav, a different footer, and
 *   whatever content happened to be in the en-gb tree. The tenant declared its
 *   language and nothing read it.
 *
 * Usage (in any Server Component or route handler):
 *   const locale = await getLocale();
 */
export async function getLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const value       = cookieStore.get(LOCALE_COOKIE)?.value ?? "";
  if (isSupportedLocale(value)) return value;

  // No explicit choice — fall back to the language this tenant's site is in.
  // Host-based registry lookup only (no DB), so this stays cheap and never
  // throws: an unresolvable host just leaves the platform default in place.
  try {
    const host          = (await headers()).get("host") ?? "";
    const tenantDefault = resolveTenantOrNull(host.toLowerCase())?.defaultLocale ?? "";
    if (isSupportedLocale(tenantDefault)) return tenantDefault;
  } catch {
    // Outside a request context (build-time, scripts) — use the default.
  }

  return DEFAULT_LOCALE;
}
