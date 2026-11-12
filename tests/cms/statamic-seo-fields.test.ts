/**
 * A CMS page's own title, noindex switch and social card reach the page.
 *
 * The provider read only the description for pages. A title written for Google
 * in the control panel never showed, and a page set to noindex still told
 * search engines it could be indexed.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import { mapStatamicSeoFields } from "../../cms/mappers/statamic/seo-fields.ts";

const asset = (f: unknown) => (typeof f === "string" && f ? `https://cdn.example/${f}` : undefined);

describe("mapStatamicSeoFields", () => {
  it("maps every field of the SEO tab", () => {
    assert.deepEqual(
      mapStatamicSeoFields({
        seo_title: "Prijzen website personalisatie | Mister Chameleon",
        seo_description: "Vanaf 149 euro per maand.",
        robots_noindex: true,
        robots_nofollow: false,
        canonical_url: "https://www.misterchameleon.nl/prijzen",
        og_title: "Prijzen",
        og_description: "Drie pakketten.",
        og_image: "card.png",
      }, asset),
      {
        seoTitle: "Prijzen website personalisatie | Mister Chameleon",
        seoDescription: "Vanaf 149 euro per maand.",
        robots: { noindex: true, nofollow: false },
        canonicalUrl: "https://www.misterchameleon.nl/prijzen",
        ogTitle: "Prijzen",
        ogDescription: "Drie pakketten.",
        ogImage: "https://cdn.example/card.png",
      },
    );
  });

  it("treats an emptied field as not set", () => {
    const r = mapStatamicSeoFields({ seo_title: "", seo_description: "   ", canonical_url: null, og_title: undefined }, asset);
    assert.equal(r.seoTitle, undefined);
    assert.equal(r.seoDescription, undefined);
    assert.equal(r.canonicalUrl, undefined);
    assert.equal(r.ogTitle, undefined);
    assert.equal(r.robots, undefined);
    assert.equal(r.ogImage, undefined);
  });

  it("emits robots only when a switch is on", () => {
    assert.equal(mapStatamicSeoFields({ robots_noindex: false, robots_nofollow: false }, asset).robots, undefined);
    assert.deepEqual(mapStatamicSeoFields({ robots_noindex: true }, asset).robots, { noindex: true, nofollow: false });
    assert.deepEqual(mapStatamicSeoFields({ robots_nofollow: "true" }, asset).robots, { noindex: false, nofollow: true });
  });
});

describe("the Statamic provider", () => {
  it("uses the mapper for pages and for collection entries", () => {
    const src = fs.readFileSync("cms/providers/statamic-provider.ts", "utf8");
    assert.equal((src.match(/\.\.\.mapStatamicSeoFields\(/g) ?? []).length, 2);
  });
});
