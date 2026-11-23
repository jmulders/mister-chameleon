/**
 * What a CMS page adds to the site's own metadata.
 *
 * Found on 23 Nov 2026: the live CMS pages had no canonical and no Open Graph
 * tags, while the coded pages had both. A CMS page returned `alternates:
 * undefined` and `openGraph: undefined`, and a key with the value undefined
 * replaces what the layout gives.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownCanonical, ownOpenGraph } from "@/lib/seo/page-metadata";
import { sitemapPathsFor } from "@/lib/seo/sitemap";

describe("ownCanonical", () => {
  it("adds nothing when the editor filled in no canonical, so the layout's stays", () => {
    assert.deepEqual(ownCanonical({ title: "Hoe het werkt" }), {});
    assert.deepEqual(ownCanonical({ canonicalUrl: "" }), {});
    assert.deepEqual(ownCanonical({ canonicalUrl: "   " }), {});
    assert.equal("alternates" in ownCanonical({ canonicalUrl: null }), false, "a key with undefined would wipe the layout's canonical");
  });

  it("gives the canonical the editor filled in", () => {
    assert.deepEqual(ownCanonical({ canonicalUrl: "https://example.org/origineel" }), { alternates: { canonical: "https://example.org/origineel" } });
  });
});

describe("ownOpenGraph", () => {
  it("adds nothing when the editor filled in no Open Graph field", () => {
    const page = { title: "Functies", seoTitle: "Website personalisatie software", seoDescription: "Alle functies." };
    assert.deepEqual(ownOpenGraph(page), {});
    assert.equal("openGraph" in ownOpenGraph(page), false, "a key with undefined would wipe the layout's Open Graph");
  });

  it("fills the rest from the page when the editor filled in one field", () => {
    const page = { title: "Functies", seoTitle: "Website personalisatie software", seoDescription: "Alle functies.", ogImage: "https://example.org/delen.png" };
    assert.deepEqual(ownOpenGraph(page, "Mister Chameleon"), {
      openGraph: { title: "Website personalisatie software", description: "Alle functies.", images: ["https://example.org/delen.png"], siteName: "Mister Chameleon" },
    });
  });

  it("prefers the Open Graph title and description over the search ones", () => {
    const og = ownOpenGraph({ title: "A", seoTitle: "B", seoDescription: "C", ogTitle: "Voor delen", ogDescription: "Kort" });
    assert.deepEqual(og, { openGraph: { title: "Voor delen", description: "Kort" } });
  });
});

describe("the pages and the layout", () => {
  const pages = ["[slug]", "blog/[slug]", "cases/[slug]", "team/[slug]", "careers/[slug]", "news/[slug]", "events/[slug]"];

  it("no CMS page hands the layout an empty canonical or Open Graph", () => {
    for (const page of pages) {
      const source = readFileSync(`app/(site)/${page}/page.tsx`, "utf8");
      assert.doesNotMatch(source, /alternates:\s*[^,\n]*: undefined/, `${page} can wipe the canonical`);
      assert.doesNotMatch(source, /openGraph:[\s\S]{0,400}?: undefined,\n\s*\}/, `${page} can wipe the Open Graph tags`);
      assert.match(source, /\.\.\.ownCanonical\(page\),\s*\.\.\.ownOpenGraph\(page\),/, `${page} does not use the shared rule`);
    }
  });

  it("the layout gives every page its own address as the canonical", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    assert.match(layout, /metadataBase: new URL\(origin\), alternates: \{ canonical: "\.\/" \}/);
    // Never the homepage for every page: that tells a search engine the whole site is one page.
    assert.doesNotMatch(layout, /canonical:\s*(origin|"\/"|`\$\{origin\}\/?`)/);
  });
});

describe("the sitemap of the marketing site", () => {
  it("lists the coded pages the CMS does not know, the cookie statement among them", () => {
    const paths = sitemapPathsFor("https://www.misterchameleon.nl", [{ path: "/hoe-het-werkt" }]).map((p) => p.path);
    for (const path of ["/prijzen", "/demo", "/cookies"]) assert.ok(paths.includes(path), `${path} is missing`);
  });

  it("leaves another tenant's sitemap to its CMS", () => {
    assert.deepEqual(sitemapPathsFor("https://www.example.org", [{ path: "/over" }]).map((p) => p.path), ["/over"]);
  });
});
