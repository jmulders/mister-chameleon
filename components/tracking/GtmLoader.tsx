/**
 * GtmLoader
 *
 * Loads the tenant's Google Tag Manager container once the visitor has allowed
 * a category that tags can fall under, and keeps the dataLayer informed of the
 * choice. The rule itself lives in tracking/gtm-consent.ts.
 *
 * Rendered by the root layout for a tenant that shows the platform's banner. A
 * tenant that turned the banner off asks for consent in its own way and keeps
 * the plain snippet in the head.
 *
 * `containerId` is a public identifier, validated by the layout.
 */

"use client";

import { useEffect } from "react";
import { getConsent, onConsentChange } from "@/tracking/consent-store";
import { createGtmGate } from "@/tracking/gtm-consent";
import type { ConsentState } from "@/tracking/consent-types";
import { insertAsyncScript, pageConsentSignal, pageDataLayer } from "./google-tag-page";

// One gate per container for the life of the page, so a second mount (React
// strict mode, a layout that renders again) cannot load the container twice.
const gates = new Map<string, (state: ConsentState) => void>();

function gateFor(containerId: string): (state: ConsentState) => void {
  let gate = gates.get(containerId);
  if (!gate) {
    gate = createGtmGate(containerId, {
      layer:        pageDataLayer,
      signal:       pageConsentSignal(),
      insertScript: insertAsyncScript,
      now:          () => Date.now(),
    });
    gates.set(containerId, gate);
  }
  return gate;
}

export function GtmLoader({ containerId }: { containerId: string }): null {
  useEffect(() => {
    if (!containerId) return;
    const gate = gateFor(containerId);
    gate(getConsent());
    return onConsentChange(gate);
  }, [containerId]);

  return null;
}

export default GtmLoader;
