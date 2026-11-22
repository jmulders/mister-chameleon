/**
 * GA4 starts with the consent state in front of it.
 *
 * GA4 is analytics: it starts only when the visitor allowed analytics. Before
 * its `config` goes into the dataLayer, Google is told what was allowed, so a
 * visitor who said yes to analytics and no to advertising never has a hit sent
 * with advertising treated as allowed. See tracking/google-consent.ts.
 *
 * Kept free of `window` so the order can be tested: the caller hands in the
 * dataLayer, the page's consent signal and the way to add a script.
 */

import type { ConsentState } from "./consent-types";
import { asCommand, type GoogleConsentSignal } from "./google-consent";

export interface Ga4Stream {
  /** GA4 Measurement ID, e.g. "G-XXXXXXXXXX". */
  measurementId: string;
  /** The platform's visitor id, sent as a GA4 user property. */
  visitorId: string;
  /** Name of the user property (a user-scoped custom dimension in GA4). */
  visitorIdParamName: string;
}

export interface Ga4GateEnv {
  /** The live dataLayer. Read on every use, because others may replace it. */
  layer: () => unknown[];
  /** The page's one consent signal, shared with the Tag Manager loader. */
  signal: GoogleConsentSignal;
  /** Adds gtag.js to the page. */
  insertScript: (src: string) => void;
  now: () => Date;
}

/** GA4 Measurement IDs: "G-" followed by letters and digits. */
const SAFE_MEASUREMENT_ID = /^G-[A-Z0-9]+$/i;
/** UUID: hex digits and hyphens (the mc_session_id format). */
const SAFE_VISITOR_ID = /^[0-9a-f-]{32,36}$/i;
/** Custom dimension names: letters, digits, underscores only. */
const SAFE_PARAM_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,99}$/;

/** False for a stream whose values are not what they should be. Such a stream never starts. */
export function ga4StreamIsValid(stream: Ga4Stream): boolean {
  return (
    SAFE_MEASUREMENT_ID.test(stream.measurementId) &&
    SAFE_VISITOR_ID.test(stream.visitorId) &&
    SAFE_PARAM_NAME.test(stream.visitorIdParamName)
  );
}

/** Where gtag.js lives for this stream. */
export function gtagScriptSrc(measurementId: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
}

/**
 * Returns a function to call with the consent state: once at the start and
 * again on every change. It starts GA4 at most once.
 *
 * The order in the dataLayer when it starts:
 *   1. the consent state (unless the page was already told the same);
 *   2. `js`, the start time;
 *   3. `set` with the visitor id as a user property, so it rides on every
 *      event, the first page_view included;
 *   4. `config`, which starts the stream and sends the page_view.
 *
 * A gtag.js that is already running cannot be taken out of the page. When a
 * visitor withdraws consent it is told so, and from the next page on it is not
 * loaded any more.
 */
export function createGa4Gate(stream: Ga4Stream, env: Ga4GateEnv): (state: ConsentState) => void {
  let started = false;

  return (state) => {
    if (started) {
      env.signal(state);
      return;
    }
    if (state.analytics !== true || !ga4StreamIsValid(stream)) return;
    started = true;
    env.signal(state);
    const layer = env.layer();
    layer.push(asCommand("js", env.now()));
    layer.push(asCommand("set", { user_properties: { [stream.visitorIdParamName]: stream.visitorId } }));
    layer.push(asCommand("config", stream.measurementId));
    env.insertScript(gtagScriptSrc(stream.measurementId));
  };
}
