/**
 * lib/locale-shared.ts
 *
 * The parts of the locale helper that carry no server dependency: the supported
 * locale list, the cookie name, and a browser-side reader for that cookie.
 *
 * ─── Why this is a separate module ────────────────────────────────────────────
 *
 *   `lib/locale.ts` imports `next/headers`, which resolves to a build-time throw
 *   inside a Client Component bundle. Client Components that need to know the
 *   active locale (e.g. FormSectionBlock, for its default button copy) therefore
 *   import from here instead. `lib/locale.ts` re-exports everything below, so
 *   Server Components can keep importing `@/lib/locale` as before.
 */

// ── Supported locales ─────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["en", "nl", "de"] as const;
export type  SupportedLocale   = (typeof SUPPORTED_LOCALES)[number];

/**
 * Platform-wide fallback, used only when the active tenant declares no
 * defaultLocale of its own. A tenant's own defaultLocale always wins — see
 * getLocale() in `lib/locale.ts`.
 */
export const DEFAULT_LOCALE: SupportedLocale = "en";

/** True when the given string is a known supported locale. */
export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

// ── Cookie name ───────────────────────────────────────────────────────────────

export const LOCALE_COOKIE = "locale";

// ── Browser-side locale reader ────────────────────────────────────────────────

/**
 * Read the `locale` cookie from the browser, or undefined when it is absent,
 * unrecognised, or there is no `document` (SSR / tests). Callers decide their
 * own fallback: this deliberately does NOT default to DEFAULT_LOCALE, because
 * "no cookie" and "explicitly English" mean different things — a Dutch tenant's
 * first-time visitor has no cookie and should not be shown English copy.
 */
export function readLocaleCookie(): SupportedLocale | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`),
  );
  if (!match) return undefined;
  let value = match[1];
  try { value = decodeURIComponent(value); } catch { /* keep the raw value */ }
  return isSupportedLocale(value) ? value : undefined;
}
