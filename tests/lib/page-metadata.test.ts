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
import { readFileSync, readdirSync } from "node:fs";
import { ownCanonical, ownOpenGraph, articleOpenGraph } from "@/lib/seo/page-metadata";
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
      openGraph: { type: "website", title: "Website personalisatie software", description: "Alle functies.", images: ["https://example.org/delen.png"], siteName: "Mister Chameleon" },
    });
  });

  it("prefers the Open Graph title and description over the search ones", () => {
    const og = ownOpenGraph({ title: "A", seoTitle: "B", seoDescription: "C", ogTitle: "Voor delen", ogDescription: "Kort" });
    // The object replaces the layout's as a whole, so it repeats the type and,
    // without an image of the editor's, the site's own card (26 Nov 2026).
    assert.deepEqual(og, { openGraph: { type: "website", title: "Voor delen", description: "Kort", images: [{ url: "/share-image", width: 1200, height: 630 }] } });
  });
});

describe("articleOpenGraph", () => {
  const article = { title: "A/B-testen", seoDescription: "Zo werkt een test.", publishedAt: "2026-11-25", modifiedAt: "2026-11-26" };

  it("marks the page as an article, with its days and the site's card", () => {
    assert.deepEqual(articleOpenGraph(article, "Mister Chameleon"), {
      openGraph: {
        type: "article", title: "A/B-testen", description: "Zo werkt een test.",
        publishedTime: "2026-11-25", modifiedTime: "2026-11-26",
        images: [{ url: "/share-image", width: 1200, height: 630 }], siteName: "Mister Chameleon",
      },
    });
  });

  it("leaves the days out when the CMS gives none, and keeps the editor's image", () => {
    const og = articleOpenGraph({ title: "Zonder datum", ogImage: "https://example.org/beeld.png" }).openGraph as Record<string, unknown>;
    assert.equal(og.type, "article");
    assert.equal("publishedTime" in og, false);
    assert.equal("modifiedTime" in og, false);
    assert.deepEqual(og.images, ["https://example.org/beeld.png"]);
  });
});

describe("the pages and the layout", () => {
  // Every page under app/(site), found on disk. A list by hand missed four
  // page types the first time (vacancies, jobs, companies and contact).
  const pages = (readdirSync("app/(site)", { recursive: true }) as string[])
    .filter((file) => file.endsWith("page.tsx"))
    .map((file) => ({ file, source: readFileSync(`app/(site)/${file}`, "utf8") }));

  it("no page hands the layout an empty canonical or Open Graph", () => {
    assert.ok(pages.length > 15, `only found ${pages.length} pages`);
    for (const { file, source } of pages) {
      assert.doesNotMatch(source, /alternates:\s*[^,\n]*: undefined/, `${file} can wipe the canonical`);
      assert.doesNotMatch(source, /openGraph:[\s\S]{0,400}?: undefined,\n\s*\}/, `${file} can wipe the Open Graph tags`);
    }
  });

  it("a page that sets alternates of its own names its canonical too", () => {
    // An alternates object replaces the layout's as a whole. A page that only
    // lists its translations there loses its canonical.
    for (const { file, source } of pages) {
      const own = /^\s*alternates:\s*\{([\s\S]*?)\n  \}/m.exec(source);
      if (own) assert.match(own[1]!, /canonical:/, `${file} sets alternates without a canonical`);
    }
  });

  it("every page type that reads its metadata from the CMS uses the shared rule", () => {
    // A page type that reads the editor's robots choice builds its metadata from a CMS entry.
    const fromCms = pages.filter(({ source }) => /generateMetadata/.test(source) && /page\.robots\?\.noindex/.test(source));
    assert.ok(fromCms.length >= 10, `only found ${fromCms.length} CMS page types`);
    for (const { file, source } of fromCms) assert.match(source, /\.\.\.ownCanonical\(page\)/, `${file} does not use the shared rule`);
  });

  it("the layout gives every page a type, the site's card and the large card on X", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    assert.match(layout, /type:\s+"website"/);
    // Only with a known host: the card's address has to be absolute.
    assert.match(layout, /\.\.\.\(origin \? \{ images: \[shareImageEntry\(\)\] \} : \{\}\)/);
    assert.match(layout, /twitter:\s+\{ card: "summary_large_image" \}/);
  });

  it("a blog article says it is an article", () => {
    const blog = readFileSync("app/(site)/blog/[slug]/page.tsx", "utf8");
    assert.match(blog, /\.\.\.articleOpenGraph\(page, /);
    assert.match(blog, /articleJsonLd\(\{/);
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
