"use client";

/**
 * useActiveLocale
 *
 * Client-side counterpart to getLocale(): reads the `locale` cookie the proxy
 * middleware writes, so a Client Component can pick locale-appropriate default
 * copy (button labels and the like) without a server round-trip.
 *
 * ─── Why the cookie is read in an effect, not during render ──────────────────
 *
 *   `document.cookie` does not exist during SSR. Reading it while rendering
 *   would make the server produce the fallback locale and the client produce
 *   the cookie's locale, which React reports as a hydration mismatch. Instead
 *   the first client render matches the server (fallback), and the effect
 *   swaps in the real locale immediately after mount.
 *
 * ─── Why the fallback is "nl", not DEFAULT_LOCALE ────────────────────────────
 *
 *   DEFAULT_LOCALE ("en") is the platform-wide fallback for tenant resolution.
 *   The tenant sites this renders on are Dutch, and a visitor who never picked
 *   a language carries no cookie — so "no cookie" must mean Dutch copy here,
 *   not English. Callers that know better can pass their own `fallback`
 *   (e.g. a `locale` prop threaded down from a Server Component).
 */

import { useEffect, useState } from "react";
import { readLocaleCookie } from "@/lib/locale-shared";
import type { SupportedLocale } from "@/lib/locale-shared";

export function useActiveLocale(fallback: SupportedLocale = "nl"): SupportedLocale {
  const [locale, setLocale] = useState<SupportedLocale>(fallback);

  useEffect(() => {
    const fromCookie = readLocaleCookie();
    if (fromCookie) setLocale(fromCookie);
  }, []);

  return locale;
}
