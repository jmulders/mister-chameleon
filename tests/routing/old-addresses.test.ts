/**
 * Old addresses of the marketing site keep working, in one hop.
 *
 * The cases were renamed twice: first they lost the name of an existing
 * company, then (21 Nov 2026) they became use cases and lost the word
 * "voorbeeld". An address from either round must land on the page of today
 * without passing through the address in between.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

type Redirect = { source: string; destination: string; permanent?: boolean; has?: unknown };
let redirects: Redirect[] = [];

describe("old addresses", () => {
  before(async () => {
    // Through a variable, so the type checker does not pull the config file
    // into the program: it is plain JavaScript and is not written to be checked.
    const file = "../../next.config.mjs";
    const config = (await import(file)).default as { redirects: () => Promise<Redirect[]> };
    redirects = await config.redirects();
  });

  const to = (source: string) => redirects.find((r) => r.source === source);

  it("sends every old case address to the use case of today", () => {
    const moves: [string, string][] = [
      ["/cases/case-payt",                 "/cases/drie-titels-voor-drie-doelgroepen"],
      ["/cases/voorbeeld-saas-facturatie", "/cases/drie-titels-voor-drie-doelgroepen"],
      ["/cases/case-sendcloud",            "/cases/testen-zonder-developer"],
      ["/cases/voorbeeld-verzendplatform", "/cases/testen-zonder-developer"],
      ["/cases/case-indie-agency",         "/cases/klantsites-in-een-omgeving"],
      ["/cases/voorbeeld-bureau",          "/cases/klantsites-in-een-omgeving"],
    ];
    for (const [source, destination] of moves) {
      const r = to(source);
      assert.ok(r, `no redirect for ${source}`);
      assert.equal(r.destination, destination);
      assert.equal(r.permanent, true);
      assert.ok(r.has, `${source} must be tied to the marketing host`);
    }
  });

  it("sends the replaced article to the one that took its place", () => {
    assert.equal(to("/blog/de-bedrijfsnaam-in-je-titel")?.destination, "/blog/van-bezoeker-naar-lead");
  });

  it("sends the name of the use case page to the page, without fixing that for good", () => {
    const r = to("/toepassingen");
    assert.ok(r, "no redirect for /toepassingen");
    assert.equal(r.destination, "/cases");
    // Temporary on purpose: the page may move to this address one day, and a
    // browser that kept a permanent redirect would never see it.
    assert.equal(r.permanent, false);
    assert.ok(r.has, "/toepassingen must be tied to the marketing host");
  });

  it("never needs a second hop", () => {
    const sources = new Set(redirects.map((r) => r.source));
    const chained = redirects.filter((r) => sources.has(r.destination)).map((r) => `${r.source} -> ${r.destination}`);
    assert.deepEqual(chained, []);
  });

  it("has no address twice", () => {
    const seen = new Set<string>();
    const twice = redirects.filter((r) => (seen.has(r.source) ? true : (seen.add(r.source), false))).map((r) => r.source);
    assert.deepEqual(twice, []);
  });
});
