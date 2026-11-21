/**
 * Google Tag Manager waits for the visitor's consent.
 *
 * Found on 21 Nov 2026 on a live site: the tenant's container was loaded for
 * every visitor, and two Leadinfo tags inside it sent each visitor to Leadinfo
 * before the banner was answered. The platform's own Leadinfo loader already
 * waited. What runs inside a container is the tenant's, so the platform holds
 * the container itself back and tells it what the visitor allowed.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GTM_CONSENT_EVENT,
  consentLayerEntry,
  createGtmGate,
  googleConsentMode,
  gtmAllowed,
  gtmScriptSrc,
} from "../../tracking/gtm-consent.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const state = (over: Partial<ConsentState> = {}): ConsentState => ({
  hasResponded: true,
  analytics: false,
  personalization: false,
  enrichment: false,
  advertising: false,
  ...over,
} as ConsentState);

function page() {
  const layer: unknown[] = [];
  const scripts: string[] = [];
  const gate = createGtmGate("GTM-TEST123", {
    layer: () => layer,
    insertScript: (src) => scripts.push(src),
    now: () => 1000,
  });
  return { layer, scripts, gate };
}

/** A gtag command is an arguments object, not an array. */
const commands = (layer: unknown[]) =>
  layer.filter((e) => Object.prototype.toString.call(e) === "[object Arguments]").map((e) => Array.from(e as ArrayLike<unknown>));
const events = (layer: unknown[]) =>
  layer.filter((e) => e !== null && typeof e === "object" && "event" in (e as object)) as Record<string, unknown>[];

describe("gtmAllowed", () => {
  it("says no before the banner is answered", () => {
    assert.equal(gtmAllowed(state({ hasResponded: false })), false);
  });

  it("says no when the visitor chose essential only", () => {
    assert.equal(gtmAllowed(state()), false);
  });

  it("says no for personalisation alone, which no tag falls under", () => {
    assert.equal(gtmAllowed(state({ personalization: true })), false);
  });

  it("says yes for each category a tag can fall under", () => {
    assert.equal(gtmAllowed(state({ analytics: true })), true);
    assert.equal(gtmAllowed(state({ enrichment: true })), true);
    assert.equal(gtmAllowed(state({ advertising: true })), true);
  });
});

describe("what the dataLayer is told", () => {
  it("puts the choice in Google's terms", () => {
    assert.deepEqual(googleConsentMode(state({ analytics: true })), {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    assert.deepEqual(googleConsentMode(state({ advertising: true })), {
      analytics_storage: "denied",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
  });

  it("names every platform category, so a tag can be held to its own", () => {
    assert.deepEqual(consentLayerEntry(state({ analytics: true, enrichment: true })), {
      event: GTM_CONSENT_EVENT,
      mc_consent_analytics: true,
      mc_consent_personalization: false,
      mc_consent_enrichment: true,
      mc_consent_advertising: false,
    });
  });
});

describe("the gate", () => {
  it("loads nothing and leaves the dataLayer alone without consent", () => {
    const p = page();
    p.gate(state({ hasResponded: false }));
    p.gate(state());
    assert.deepEqual(p.scripts, []);
    assert.deepEqual(p.layer, []);
  });

  it("loads the container when the visitor already agreed", () => {
    const p = page();
    p.gate(state({ analytics: true, enrichment: true }));
    assert.deepEqual(p.scripts, [gtmScriptSrc("GTM-TEST123")]);
  });

  it("tells the container the choice before it starts", () => {
    const p = page();
    p.gate(state({ analytics: true }));
    assert.deepEqual(commands(p.layer), [["consent", "default", googleConsentMode(state({ analytics: true }))]]);
    const names = events(p.layer).map((e) => e.event);
    assert.deepEqual(names, [GTM_CONSENT_EVENT, "gtm.js"]);
    // The consent command comes first of all.
    assert.equal(Object.prototype.toString.call(p.layer[0]), "[object Arguments]");
  });

  it("loads the container the moment the visitor agrees in the banner", () => {
    const p = page();
    p.gate(state({ hasResponded: false }));
    assert.deepEqual(p.scripts, []);
    p.gate(state({ analytics: true, enrichment: true, advertising: true, personalization: true }));
    assert.equal(p.scripts.length, 1);
  });

  it("loads the container once, however often the choice changes", () => {
    const p = page();
    p.gate(state({ analytics: true }));
    p.gate(state({ analytics: true, enrichment: true }));
    p.gate(state({ analytics: true }));
    assert.equal(p.scripts.length, 1);
    assert.equal(events(p.layer).filter((e) => e.event === "gtm.js").length, 1);
  });

  it("passes a later change on as an update", () => {
    const p = page();
    p.gate(state({ analytics: true }));
    p.gate(state({ analytics: true, enrichment: true }));
    const last = commands(p.layer).at(-1);
    assert.deepEqual(last, ["consent", "update", googleConsentMode(state({ analytics: true, enrichment: true }))]);
    assert.equal(events(p.layer).at(-1)?.mc_consent_enrichment, true);
  });

  it("tells a running container when consent is withdrawn", () => {
    const p = page();
    p.gate(state({ analytics: true, enrichment: true }));
    p.gate(state());
    assert.deepEqual(commands(p.layer).at(-1), ["consent", "update", googleConsentMode(state())]);
    assert.equal(events(p.layer).at(-1)?.mc_consent_enrichment, false);
    assert.equal(p.scripts.length, 1);
  });

  it("writes to the dataLayer that is live at that moment", () => {
    let layer: unknown[] = [];
    const gate = createGtmGate("GTM-TEST123", { layer: () => layer, insertScript: () => {}, now: () => 1 });
    gate(state({ analytics: true }));
    layer = [];
    gate(state({ analytics: true, enrichment: true }));
    assert.equal(layer.length, 2);
  });
});

describe("the layout", () => {
  const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");

  it("renders the plain snippet only for a tenant without the platform's banner", () => {
    const plain = layout.match(/\{gtmContainerId && ([^(]*)\(\s*<(script|noscript)/g) ?? [];
    assert.equal(plain.length, 2);
    for (const hit of plain) assert.match(hit, /!gtmWaitsForConsent/);
  });

  it("hands a tenant with the banner to the loader that waits", () => {
    assert.match(layout, /gtmContainerId && gtmWaitsForConsent && <GtmLoader containerId=\{gtmContainerId\} \/>/);
  });
});
