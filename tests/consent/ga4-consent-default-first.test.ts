/**
 * Google hears what the visitor allowed before GA4 starts.
 *
 * Found on 22 Nov 2026 on a live site: the dataLayer began with GA4's `js`,
 * `set` and `config`, and the `consent default` came after them, pushed by the
 * Tag Manager loader. A tenant with GA4 and no container got no default at all,
 * and without one Google treats advertising as allowed. Now the page has one
 * consent signal: whoever starts a Google tag first pushes the default, in
 * front of its own commands, and nobody pushes it a second time.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createGoogleConsentSignal, googleConsentMode } from "../../tracking/google-consent.ts";
import { createGa4Gate, ga4StreamIsValid, gtagScriptSrc } from "../../tracking/ga4-consent.ts";
import { createGtmGate, gtmScriptSrc } from "../../tracking/gtm-consent.ts";
import type { ConsentState } from "../../tracking/consent-types.ts";

const state = (over: Partial<ConsentState> = {}): ConsentState => ({
  hasResponded: true,
  analytics: false,
  personalization: false,
  enrichment: false,
  advertising: false,
  ...over,
} as ConsentState);

const STREAM = {
  measurementId: "G-TEST123",
  visitorId: "0f8fad5b-d9cb-469f-a165-70867728950e",
  visitorIdParamName: "visitor_id",
};
const STARTED = new Date("2026-11-22T12:00:00Z");

/** One page: one dataLayer, one consent signal, GA4 and a Tag Manager container. */
function page(stream = STREAM) {
  const layer: unknown[] = [];
  const scripts: string[] = [];
  const signal = createGoogleConsentSignal(() => layer);
  const ga4 = createGa4Gate(stream, {
    layer: () => layer,
    signal,
    insertScript: (src) => scripts.push(src),
    now: () => STARTED,
  });
  const gtm = createGtmGate("GTM-TEST123", {
    layer: () => layer,
    signal,
    insertScript: (src) => scripts.push(src),
    now: () => 1000,
  });
  return { layer, scripts, signal, ga4, gtm };
}

const isCommand = (e: unknown) => Object.prototype.toString.call(e) === "[object Arguments]";
/** A gtag command is an arguments object, not an array. */
const commands = (layer: unknown[]) => layer.filter(isCommand).map((e) => Array.from(e as ArrayLike<unknown>));
const names = (layer: unknown[]) => commands(layer).map((c) => (c[0] === "consent" ? `consent ${c[1]}` : c[0]));
const defaults = (layer: unknown[]) => commands(layer).filter((c) => c[0] === "consent" && c[1] === "default");

describe("the consent signal", () => {
  it("says default the first time", () => {
    const layer: unknown[] = [];
    createGoogleConsentSignal(() => layer)(state({ analytics: true }));
    assert.deepEqual(commands(layer), [["consent", "default", googleConsentMode(state({ analytics: true }))]]);
  });

  it("says update when the choice changes", () => {
    const layer: unknown[] = [];
    const signal = createGoogleConsentSignal(() => layer);
    signal(state({ analytics: true }));
    signal(state({ analytics: true, advertising: true }));
    assert.deepEqual(commands(layer).at(-1), ["consent", "update", googleConsentMode(state({ analytics: true, advertising: true }))]);
    assert.equal(defaults(layer).length, 1);
  });

  it("stays quiet when nothing changed in Google's terms", () => {
    const layer: unknown[] = [];
    const signal = createGoogleConsentSignal(() => layer);
    signal(state({ analytics: true }));
    signal(state({ analytics: true }));
    // Enrichment and personalisation are the platform's categories, not Google's.
    signal(state({ analytics: true, enrichment: true, personalization: true }));
    assert.equal(layer.length, 1);
  });

  it("pushes a command, not a plain array, or Google reads it as data", () => {
    const layer: unknown[] = [];
    createGoogleConsentSignal(() => layer)(state());
    assert.equal(isCommand(layer[0]), true);
  });
});

describe("GA4", () => {
  it("starts nothing without analytics consent", () => {
    const p = page();
    p.ga4(state({ hasResponded: false }));
    p.ga4(state());
    p.ga4(state({ enrichment: true, advertising: true, personalization: true }));
    assert.deepEqual(p.layer, []);
    assert.deepEqual(p.scripts, []);
  });

  it("puts the consent default in front of its config", () => {
    const p = page();
    p.ga4(state({ analytics: true }));
    assert.deepEqual(names(p.layer), ["consent default", "js", "set", "config"]);
    assert.deepEqual(p.scripts, [gtagScriptSrc("G-TEST123")]);
  });

  it("says no to advertising for a visitor who allowed analytics only", () => {
    const p = page();
    p.ga4(state({ analytics: true }));
    assert.deepEqual(commands(p.layer)[0], ["consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    }]);
  });

  it("sends the visitor id as a user property, set before the config", () => {
    const p = page();
    p.ga4(state({ analytics: true }));
    const [, js, set, config] = commands(p.layer);
    assert.deepEqual(js, ["js", STARTED]);
    assert.deepEqual(set, ["set", { user_properties: { visitor_id: STREAM.visitorId } }]);
    assert.deepEqual(config, ["config", "G-TEST123"]);
  });

  it("starts the moment the visitor agrees in the banner", () => {
    const p = page();
    p.ga4(state({ hasResponded: false }));
    assert.deepEqual(p.scripts, []);
    p.ga4(state({ analytics: true, advertising: true }));
    assert.deepEqual(names(p.layer), ["consent default", "js", "set", "config"]);
    assert.equal(p.scripts.length, 1);
  });

  it("starts once, however often the choice changes", () => {
    const p = page();
    p.ga4(state({ analytics: true }));
    p.ga4(state({ analytics: true, advertising: true }));
    p.ga4(state({ analytics: true }));
    assert.equal(p.scripts.length, 1);
    assert.equal(names(p.layer).filter((n) => n === "config").length, 1);
  });

  it("tells a running GA4 when consent is withdrawn", () => {
    const p = page();
    p.ga4(state({ analytics: true, advertising: true }));
    p.ga4(state());
    assert.deepEqual(commands(p.layer).at(-1), ["consent", "update", googleConsentMode(state())]);
  });

  it("starts nothing for a value that is not what it should be", () => {
    for (const bad of [
      { ...STREAM, measurementId: "G-1');alert(1);//" },
      { ...STREAM, visitorId: "not a uuid" },
      { ...STREAM, visitorIdParamName: "a b" },
    ]) {
      assert.equal(ga4StreamIsValid(bad), false);
      const p = page(bad);
      p.ga4(state({ analytics: true }));
      assert.deepEqual(p.layer, []);
      assert.deepEqual(p.scripts, []);
    }
    assert.equal(ga4StreamIsValid(STREAM), true);
  });
});

describe("GA4 and Tag Manager on one page", () => {
  const visitor = state({ analytics: true });

  it("has one default, in front of the config, when GA4 starts first", () => {
    const p = page();
    p.ga4(visitor);
    p.gtm(visitor);
    assert.deepEqual(names(p.layer), ["consent default", "js", "set", "config"]);
    assert.deepEqual(p.scripts, [gtagScriptSrc("G-TEST123"), gtmScriptSrc("GTM-TEST123")]);
  });

  it("has one default, in front of the config, when Tag Manager starts first", () => {
    const p = page();
    p.gtm(visitor);
    p.ga4(visitor);
    assert.deepEqual(names(p.layer), ["consent default", "js", "set", "config"]);
    assert.equal(isCommand(p.layer[0]), true);
  });

  it("still tells the container the platform's categories", () => {
    const p = page();
    p.ga4(visitor);
    p.gtm(visitor);
    const events = p.layer.filter((e) => !isCommand(e)).map((e) => (e as { event: string }).event);
    assert.deepEqual(events, ["mc_consent", "gtm.js"]);
  });

  it("passes a change on once, though both are listening", () => {
    const p = page();
    p.ga4(visitor);
    p.gtm(visitor);
    const changed = state({ analytics: true, advertising: true });
    p.ga4(changed);
    p.gtm(changed);
    assert.deepEqual(names(p.layer).slice(-1), ["consent update"]);
    assert.equal(names(p.layer).filter((n) => n === "consent update").length, 1);
    assert.equal(defaults(p.layer).length, 1);
  });

  it("puts an update, not a second default, in front of a GA4 that starts later", () => {
    const p = page();
    // Enrichment alone loads the container. GA4 has to wait for analytics.
    p.gtm(state({ enrichment: true }));
    p.ga4(state({ enrichment: true }));
    assert.deepEqual(names(p.layer), ["consent default"]);
    const later = state({ enrichment: true, analytics: true });
    p.ga4(later);
    p.gtm(later);
    assert.deepEqual(names(p.layer), ["consent default", "consent update", "js", "set", "config"]);
    assert.equal(commands(p.layer)[1][2] && (commands(p.layer)[1][2] as Record<string, string>).analytics_storage, "granted");
  });
});

describe("the wiring", () => {
  const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
  const ga4 = read("components/tracking/Ga4TrackingProvider.tsx");
  const gtm = read("components/tracking/GtmLoader.tsx");

  it("gives both loaders the page's one signal and one dataLayer", () => {
    for (const source of [ga4, gtm]) {
      assert.match(source, /signal:\s+pageConsentSignal\(\)/);
      assert.match(source, /layer:\s+pageDataLayer/);
    }
  });

  it("starts GA4 through the gate, with no script text of its own", () => {
    assert.match(ga4, /createGa4Gate\(/);
    assert.doesNotMatch(ga4, /dangerouslySetInnerHTML|next\/script/);
  });

  it("lets GA4 follow the visitor's choice while the page is open", () => {
    assert.match(ga4, /gate\(getConsent\(\)\)/);
    assert.match(ga4, /onConsentChange\(gate\)/);
  });
});
