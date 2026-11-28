/**
 * Which visitor cookies a page response may carry.
 *
 * The proxy has two responses that carry visitor cookies: the normal page
 * response and the `?lang=` redirect. Both take their cookies from here, so the
 * consent rule cannot be applied on one and forgotten on the other (the
 * redirect used to set mc_session_id and mc_seen without looking at consent).
 *
 * ─── The rule ────────────────────────────────────────────────────────────────
 *
 *   Always (strictly necessary):
 *     mc_ws          the 30-minute web session, the billing unit.
 *
 *   Only with personalization consent (they remember a visitor across visits):
 *     mc_session_id  the 30-day visitor key.
 *     mc_seen        the "has been here before" marker.
 *     mc_attr        the campaign and referrer the visitor came in with.
 *
 *   Removed without personalization consent, when the browser still sends them:
 *     mc_attr, mc_lead. Both were set without asking before this rule existed,
 *     and both are httpOnly, so the visitor cannot delete them from the cookie
 *     page. Saying no has to take them away.
 *
 * mc_lead is written by /go/{token}, not here; see lib/abm/lead-cookie.ts.
 * tracking/cookie-registry.ts tells the visitor the same story.
 *
 * Pure: no I/O and no Next.js imports. Safe in the proxy and in unit tests.
 */

import type { ConsentState } from "@/tracking/consent-types";
import { SESSION_COOKIE, SEEN_COOKIE, type CookieSpec, type SessionResolution } from "@/data/session";
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  type AttributionResolution,
} from "@/context/attribution";
import { readCookies } from "@/context/helpers";
import { LEAD_COOKIE } from "@/lib/abm/lead-cookie";

/** Cookies the proxy sets that need personalization consent. */
export const PERSONALIZATION_GATED_COOKIES: readonly string[] = [
  SESSION_COOKIE,
  SEEN_COOKIE,
  ATTRIBUTION_COOKIE,
];

/** Cookies the proxy removes when the browser sends them without consent. */
export const REMOVED_WITHOUT_CONSENT: readonly string[] = [
  ATTRIBUTION_COOKIE,
  LEAD_COOKIE,
];

export interface VisitorCookiePlan {
  /** Cookies to set on the response. */
  set: CookieSpec[];
  /** Names of cookies to expire on the response. */
  expire: string[];
}

export function planVisitorCookies(input: {
  session:      Pick<SessionResolution, "cookiesToSet">;
  attribution:  Pick<AttributionResolution, "shouldSetCookie" | "serialized">;
  consent:      Pick<ConsentState, "personalization">;
  /** The request's Cookie header: tells which cookies the browser still holds. */
  cookieHeader: string | null;
  /** Secure flag for the attribution cookie (true in production). */
  secure:       boolean;
}): VisitorCookiePlan {
  const { session, attribution, consent, cookieHeader, secure } = input;
  const allowed = consent.personalization === true;

  const set = session.cookiesToSet.filter(
    (spec) => allowed || !PERSONALIZATION_GATED_COOKIES.includes(spec.name),
  );

  if (allowed && attribution.shouldSetCookie && attribution.serialized) {
    set.push({
      name:     ATTRIBUTION_COOKIE,
      value:    attribution.serialized,
      maxAge:   ATTRIBUTION_MAX_AGE,
      path:     "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
    });
  }

  const present = readCookies(cookieHeader);
  const expire  = allowed ? [] : REMOVED_WITHOUT_CONSENT.filter((name) => present.has(name));

  return { set, expire };
}
