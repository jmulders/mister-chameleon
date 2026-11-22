/**
 * The browser side shared by the loaders of Google's tags (GtmLoader and
 * Ga4TrackingProvider): the page's dataLayer, its one consent signal and the
 * way to add a script. Client only: call from an effect, never during render.
 */

import { createGoogleConsentSignal, type GoogleConsentSignal } from "@/tracking/google-consent";

type GoogleWindow = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/** The live dataLayer, created when it is not there yet. */
export function pageDataLayer(): unknown[] {
  const w = window as unknown as GoogleWindow;
  return (w.dataLayer = w.dataLayer || []);
}

// One signal for the life of the page, so the loaders agree on what Google was
// already told and the consent default is pushed once, by whoever starts first.
let signal: GoogleConsentSignal | null = null;

export function pageConsentSignal(): GoogleConsentSignal {
  return (signal ??= createGoogleConsentSignal(pageDataLayer));
}

export function insertAsyncScript(src: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src   = src;
  document.head.appendChild(script);
}

/**
 * Keeps the global `gtag()` that Google's snippet defines, for a tenant's own
 * tag or block that calls it. Left alone when something already defined it.
 */
export function ensureGlobalGtag(): void {
  const w = window as unknown as GoogleWindow;
  if (typeof w.gtag === "function") return;
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    pageDataLayer().push(arguments);
  };
}
