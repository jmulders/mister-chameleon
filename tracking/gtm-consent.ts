/**
 * Google Tag Manager waits for the visitor's consent.
 *
 * A tag manager is a box of other people's scripts: what runs inside it is set
 * in the tenant's container, not here. Loading the container for every visitor
 * therefore runs those tags for visitors who never agreed to them, or who chose
 * "essential only". Found on 21 Nov 2026: a container with two Leadinfo tags
 * sent every visitor to Leadinfo before the banner was answered.
 *
 * The rule, for a tenant that shows the platform's banner:
 *   - no optional category that a tag can fall under is allowed → the
 *     container is not loaded at all;
 *   - at least one is allowed → the container loads, and the dataLayer is told
 *     exactly what was allowed, so a tag can be held to its own category.
 *
 * What the dataLayer is told, before the container starts and on every change:
 *   - Google's consent state (Consent Mode v2), which Google's own tags obey.
 *     That goes through the page's one consent signal, shared with the GA4
 *     loader (tracking/google-consent.ts), so it is said once;
 *   - an `mc_consent` event with one boolean per platform category, for
 *     triggers on tags that are not Google's.
 *
 * Personalisation is the platform's own category and unlocks nothing here.
 *
 * Kept free of `window` so the rule can be tested: the caller hands in the
 * dataLayer and the way to add a script.
 */

import type { ConsentState } from "./consent-types";
import { createGoogleConsentSignal, type GoogleConsentSignal } from "./google-consent";

export { googleConsentMode } from "./google-consent";

/** Name of the dataLayer event that carries the platform's consent categories. */
export const GTM_CONSENT_EVENT = "mc_consent";

/** True when at least one category a tag can fall under is allowed. */
export function gtmAllowed(state: ConsentState): boolean {
  return state.analytics === true || state.enrichment === true || state.advertising === true;
}

/** The visitor's choice per platform category, as one dataLayer entry. */
export function consentLayerEntry(state: ConsentState): Record<string, string | boolean> {
  return {
    event:                       GTM_CONSENT_EVENT,
    mc_consent_analytics:        state.analytics === true,
    mc_consent_personalization:  state.personalization === true,
    mc_consent_enrichment:       state.enrichment === true,
    mc_consent_advertising:      state.advertising === true,
  };
}

export interface GtmGateEnv {
  /** The live dataLayer. Read on every use, because others may replace it. */
  layer: () => unknown[];
  /** Adds the container's script to the page. */
  insertScript: (src: string) => void;
  now: () => number;
  /**
   * The page's one consent signal. Hand in the shared one when something else
   * on the page can start a Google tag too. Left out, the gate keeps its own.
   */
  signal?: GoogleConsentSignal;
}

/** Where the container's script lives. The id is validated by the layout. */
export function gtmScriptSrc(containerId: string): string {
  return `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
}

/**
 * Returns a function to call with the consent state: once at the start and
 * again on every change. It loads the container at most once.
 *
 * A container that is already running cannot be taken out of the page. When a
 * visitor withdraws consent it is told so, Google's tags stop, and from the
 * next page on it is not loaded any more.
 */
export function createGtmGate(containerId: string, env: GtmGateEnv): (state: ConsentState) => void {
  const signal = env.signal ?? createGoogleConsentSignal(env.layer);
  let loaded = false;

  return (state) => {
    if (!loaded) {
      if (!gtmAllowed(state)) return;
      loaded = true;
      signal(state);
      const layer = env.layer();
      layer.push(consentLayerEntry(state));
      layer.push({ "gtm.start": env.now(), event: "gtm.js" });
      env.insertScript(gtmScriptSrc(containerId));
      return;
    }
    signal(state);
    env.layer().push(consentLayerEntry(state));
  };
}
