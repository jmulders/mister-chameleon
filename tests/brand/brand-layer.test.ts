/**
 * Only Mister Chameleon's own marketing site carries the brand layer.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandLayerFor } from "@/lib/brand/brand-layer";

describe("brand layer per tenant", () => {
  it("is on for the marketing-site tenant", () => {
    assert.equal(brandLayerFor("statamic", {}), "mister-chameleon");
  });

  it("is off for every other tenant", () => {
    for (const tenant of ["nascita", "another-statamic", "mister-chameleon", "demo", "workengine"]) {
      assert.equal(brandLayerFor(tenant, {}), null, tenant);
    }
  });

  it("is off without a tenant", () => {
    assert.equal(brandLayerFor(null, {}), null);
    assert.equal(brandLayerFor(undefined, {}), null);
    assert.equal(brandLayerFor("", {}), null);
  });

  it("follows MARKETING_SITE_TENANT when it is set", () => {
    assert.equal(brandLayerFor("site-nl", { MARKETING_SITE_TENANT: "site-nl" }), "mister-chameleon");
    assert.equal(brandLayerFor("statamic", { MARKETING_SITE_TENANT: "site-nl" }), null);
    assert.equal(brandLayerFor("statamic", { MARKETING_SITE_TENANT: "  " }), "mister-chameleon");
  });
});

describe("the brand stylesheet", () => {
  const css = readFileSync("app/brand/mister-chameleon.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("scopes every rule to the brand attribute, so no other tenant is touched", () => {
    const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)]
      .map((m) => m[2]!.trim())
      .filter(Boolean);
    assert.ok(selectors.length > 10, "the stylesheet has rules");
    for (const selector of selectors) {
      for (const part of selector.split(",")) {
        assert.ok(
          part.trim().startsWith('[data-brand="mister-chameleon"]'),
          `unscoped selector: ${part.trim()}`,
        );
      }
    }
  });

  it("only uses images that exist", () => {
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]!);
    assert.ok(urls.length >= 3);
    for (const url of urls) {
      assert.doesNotThrow(() => readFileSync(`public${url}`), `missing public${url}`);
    }
  });

  it("switches its movement off for visitors who ask for less motion", () => {
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
});
