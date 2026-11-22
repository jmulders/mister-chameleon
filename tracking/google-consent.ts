/**
 * Telling Google's tags what the visitor allowed (Consent Mode v2).
 *
 * Two things on a page can start a Google tag: the platform's own GA4 loader
 * and the tenant's Tag Manager container. Google expects the consent state as a
 * `consent default` command before the first `config`, and every later change
 * as a `consent update`. Without a default, Google's tags treat everything as
 * allowed, advertising included.
 *
 * Found on 22 Nov 2026: only the Tag Manager loader pushed the default, and it
 * ran after the GA4 commands. The first hit still carried the right state on
 * that page because the default happened to land before gtag.js had loaded. A
 * tenant with GA4 and no container would have got no default at all.
 *
 * So the page has one signal, shared by whoever starts a Google tag. Whoever
 * comes first pushes the default, and the same choice is never pushed twice.
 *
 * Kept free of `window` so the rule can be tested: the caller hands in the
 * dataLayer.
 */

import type { ConsentState } from "./consent-types";

type Granted = "granted" | "denied";

/** The visitor's choice in Google's own terms (Consent Mode v2). */
export function googleConsentMode(state: ConsentState): Record<string, Granted> {
  const say = (allowed: boolean): Granted => (allowed === true ? "granted" : "denied");
  return {
    analytics_storage:  say(state.analytics),
    ad_storage:         say(state.advertising),
    ad_user_data:       say(state.advertising),
    ad_personalization: say(state.advertising),
  };
}

/**
 * A gtag command is recognised by Google's tags only when it is pushed as an
 * `arguments` object. A plain array is read as data and ignored.
 */
export function asCommand(..._parts: unknown[]): IArguments {
  // eslint-disable-next-line prefer-rest-params
  return arguments;
}

/** Call with the consent state: before a Google tag starts and on every change. */
export type GoogleConsentSignal = (state: ConsentState) => void;

/**
 * Returns the signal for one page. The first call pushes `consent default`,
 * a later call with a different choice pushes `consent update`, and a call
 * that changes nothing in Google's terms pushes nothing.
 *
 * @param layer The live dataLayer. Read on every use, because others may replace it.
 */
export function createGoogleConsentSignal(layer: () => unknown[]): GoogleConsentSignal {
  let told: string | null = null;

  return (state) => {
    const mode = googleConsentMode(state);
    const key  = JSON.stringify(mode);
    if (key === told) return;
    layer().push(asCommand("consent", told === null ? "default" : "update", mode));
    told = key;
  };
}
