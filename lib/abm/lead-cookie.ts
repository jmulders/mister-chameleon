/**
 * The `mc_lead` cookie: who may write it and who may read it.
 *
 * /go/{token} recognises a named lead and stores the lead's id in this cookie
 * so later pages stay personal. That is recognising a person across pages and
 * visits, which is exactly what the visitor switches on or off with the
 * "personalization" choice, and where the cookie page lists this cookie.
 *
 * ─── The rule ────────────────────────────────────────────────────────────────
 *
 *   The cookie is written and read only with personalization consent.
 *   Without it /go/{token} still redirects to the lead's page, but stores
 *   nothing, and a cookie that is still in the browser (from before the visitor
 *   said no) is ignored by every reader and removed by the proxy.
 *
 *   A personal link is not a reason to skip the question. The page behind the
 *   link can be served without knowing who clicked, so the cookie is not
 *   strictly necessary for what the visitor asked for.
 *
 * Every reader goes through readLeadCookie(), so the rule lives in one place.
 *
 * Pure: no I/O and no Next.js imports, so the proxy can import it too.
 */

import type { ConsentState } from "@/tracking/consent-types";

/** Cookie that holds the id of the lead a personal link resolved to. */
export const LEAD_COOKIE = "mc_lead" as const;

/** 30 days, in seconds. */
export const LEAD_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** May the lead cookie be written or read under this consent? */
export function leadCookieAllowed(
  consent: Pick<ConsentState, "personalization"> | null | undefined,
): boolean {
  return consent?.personalization === true;
}

/**
 * The lead id a reader may use: the cookie's value with personalization
 * consent, undefined without it (or when there is no cookie).
 */
export function readLeadCookie(
  value: string | null | undefined,
  consent: Pick<ConsentState, "personalization"> | null | undefined,
): string | undefined {
  if (!value || !leadCookieAllowed(consent)) return undefined;
  return value;
}
