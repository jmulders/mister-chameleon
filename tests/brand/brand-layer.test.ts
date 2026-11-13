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
    assert.ok(urls.length > 0, "the stylesheet uses images");
    for (const url of urls) {
      assert.doesNotThrow(() => readFileSync(`public${url}`), `missing public${url}`);
    }
  });

  it("leaves the footer alone", () => {
    // A line of dots above the footer was tried and taken out again on
    // 13 Nov 2026: it read as a garland, not as the logo.
    assert.doesNotMatch(css, /site-footer/);
  });

  it("switches its movement off for visitors who ask for less motion", () => {
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
});

describe("the hooks the stylesheet relies on", () => {
  // A hyphenated attribute such as data-part passes the type check on any
  // component, but a component only passes on the props it knows. On 13 Nov
  // 2026 `data-part="feature-card"` sat on <Stack>, never reached the page, and
  // every feature icon got the same fallback colour.
  const files = [
    "components/primitives/Text.tsx",
    "components/primitives/Section.tsx",
    "components/primitives/Stack.tsx",
    "components/blocks/sections/ProcessStepsBlock.tsx",
    "components/blocks/sections/FeatureGridBlock.tsx",
    "components/blocks/sections/CtaSectionBlock.tsx",
    "components/layout/footer/FooterCorporate.tsx",
    "components/layout/footer/FooterMinimal.tsx",
  ];

  it("never writes data-part on a component, only on a real element", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // The opening tag of a component (capital first letter) up to its data-part.
      const onComponent = /<([A-Z][A-Za-z0-9.]*)\b(?:(?!<[A-Za-z/]|\/>)[\s\S])*?\sdata-part=/g;
      // `Tag` is the primitives' own variable for the element they render
      // ("section", "div", "h2"), so an attribute on it does reach the page.
      const hits = [...source.matchAll(onComponent)].map((m) => m[1]).filter((name) => name !== "Tag");
      assert.deepEqual(hits, [], `${file}: data-part on <${hits.join(">, <")}> is dropped; use the part prop`);
    }
  });

  it("gives every part the stylesheet styles a place in the blocks", () => {
    const css      = readFileSync("app/brand/mister-chameleon.css", "utf8");
    const styled   = new Set([...css.matchAll(/data-part="([a-z-]+)"/g)].map((m) => m[1]!));
    const sources  = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const part of styled) {
      const provided =
        sources.includes(`data-part="${part}"`) ||
        sources.includes(`part="${part}"`)      ||
        sources.includes(`"data-part": "${part}"`);
      assert.ok(provided, `no block provides data-part="${part}"`);
    }
  });
});
