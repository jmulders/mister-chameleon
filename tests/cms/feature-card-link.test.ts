/**
 * "Lees meer" under a feature card.
 *
 * The cards on /functies say in a few sentences what a feature is. The longer
 * explanation is in an article or a use case. The owner asked on 23 Nov 2026
 * whether each feature needs a page of its own. A link to what already exists
 * does the same without eleven thin pages.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { featureLinkHref, mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic/statamic-mappers";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";

describe("featureLinkHref", () => {
  it("keeps a path on this site and a web address", () => {
    assert.equal(featureLinkHref("/blog/regels-of-ai-wie-kiest"), "/blog/regels-of-ai-wie-kiest");
    assert.equal(featureLinkHref("  /cases/klantsites-in-een-omgeving "), "/cases/klantsites-in-een-omgeving");
    assert.equal(featureLinkHref("https://example.org/artikel"), "https://example.org/artikel");
  });

  it("gives no link for anything else", () => {
    for (const raw of ["", "   ", "blog/zonder-schuine-streep", "//example.org/ander-domein", "javascript:alert(1)", "mailto:iemand@example.org", null, undefined, 12, { url: "/x" }]) {
      assert.equal(featureLinkHref(raw), undefined, `"${String(raw)}" became a link`);
    }
  });
});

describe("the feature grid from the CMS", () => {
  type Feature = { title: string; linkHref?: string; linkLabel?: string };
  const features = (items: Array<Record<string, unknown>>) =>
    ((mapStatamicPageBlocksToSections([{ id: "g1", type: "feature_grid", enabled: true, heading: "Alle functies", items }]) as unknown as Array<{ _type: string; features: Feature[] }>)
      .find((s) => s._type === "featureGrid")!).features;

  it("gives a card its link, and leaves a card without one as it was", () => {
    const [withLink, without] = features([
      { type: "feature", title: "Context verrijken", body: "…", link_href: "/blog/dataverrijking-wat-weet-je-van-een-bezoeker" },
      { type: "feature", title: "A/B-testen", body: "…" },
    ]);
    assert.equal(withLink!.linkHref, "/blog/dataverrijking-wat-weet-je-van-een-bezoeker");
    assert.equal(withLink!.linkLabel, undefined, "no text of its own: the site's Lees meer");
    assert.equal(without!.linkHref, undefined);
  });

  it("takes the editor's own link text when there is one", () => {
    const [card] = features([{ type: "feature", title: "Voor bureaus", body: "…", link_href: "/cases/klantsites-in-een-omgeving", link_label: "  Bekijk de toepassing " }]);
    assert.equal(card!.linkLabel, "Bekijk de toepassing");
  });

  it("carries the link through the page config to the block", () => {
    assert.match(readFileSync("cms/mappers/page-config-mapper.ts", "utf8"), /linkHref:\s*f\.linkHref,\s*linkLabel:\s*f\.linkLabel,/);
  });
});

describe("the feature grid block", () => {
  const block = readFileSync("components/blocks/sections/FeatureGridBlock.tsx", "utf8");
  const link  = readFileSync("components/blocks/sections/feature/FeatureLink.tsx", "utf8");

  it("shows the link in every card layout, under the description", () => {
    const cards = (block.match(/<InlineRichText source=\{feature\.description\} \/>/g) ?? []).length;
    const links = (block.match(/\{feature\.linkHref && \(\s*<FeatureLink href=\{feature\.linkHref\} label=\{feature\.linkLabel\} title=\{feature\.title\} \/>\s*\)\}/g) ?? []).length;
    assert.ok(cards >= 7, `only found ${cards} card layouts`);
    assert.equal(links, cards, "a card layout shows no link");
  });

  it("says Lees meer in Dutch and Read more in English when the editor gave no text", () => {
    assert.equal(BLOCK_TEXTS.nl.readMore, "Lees meer");
    assert.equal(BLOCK_TEXTS.en.readMore, "Read more");
    assert.match(link, /label && label\.trim\(\) !== "" \? label\.trim\(\) : t\.readMore/);
  });

  it("reads the card's title out after the link text, so eight links can be told apart", () => {
    assert.match(link, /<span className="sr-only">: \{title\}<\/span>/);
  });
});
