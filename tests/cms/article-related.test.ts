/**
 * "Lees ook" at the foot of a Statamic article.
 *
 * The owner asked for it on 26 Nov 2026. An article ended in its call to
 * action: a reader who was not ready for a demo had nowhere to go. Now a row
 * of three other articles stands before that call, chosen by theme.
 *
 * The components are .tsx files, which this test runner cannot import, so
 * those checks read the source.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import { beforeClosingCall, relatedArticles, relatedSectionFor } from "@/cms/providers/article-related";
import type { RelatedCandidate } from "@/cms/providers/article-related";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";

const NOW = new Date(2026, 10, 26, 12, 0, 0);

const article = (slug: string, theme: string, day: string, extra: Partial<RelatedCandidate> = {}): RelatedCandidate => ({
  id: `id-${slug}`, slug, title: `Titel ${slug}`, date: `2026-11-${day} 09:00:00`, theme: [theme], ...extra,
});

// Six themes in the sizes the knowledge base has: 6, 4, 3, 3, 2 and 1.
const ALL: RelatedCandidate[] = [
  article("a1", "aan-de-slag", "25"), article("a2", "aan-de-slag", "24"), article("a3", "aan-de-slag", "23"),
  article("a4", "aan-de-slag", "22"), article("a5", "aan-de-slag", "21"), article("a6", "aan-de-slag", "20"),
  article("c1", "campagnes", "26"), article("c2", "campagnes", "21"), article("c3", "campagnes", "19"), article("c4", "campagnes", "17"),
  article("l1", "leads-en-sales", "25"), article("l2", "leads-en-sales", "20"), article("l3", "leads-en-sales", "18"),
  article("m1", "meten-en-ai", "25"), article("m2", "meten-en-ai", "21"), article("m3", "meten-en-ai", "16"),
  article("p1", "privacy-en-data", "21"), article("p2", "privacy-en-data", "19"),
  article("r1", "recruitment", "18"),
];
const slugs = (list: readonly RelatedCandidate[]) => list.map((c) => c.slug);
const under = (slug: string) => relatedArticles({ slug, theme: ALL.find((c) => c.slug === slug)!.theme }, ALL, NOW);

describe("relatedArticles", () => {
  it("shows three articles of the same theme, the newest first", () => {
    assert.deepEqual(slugs(under("a3")), ["a1", "a2", "a4"]);
    assert.deepEqual(slugs(under("c4")), ["c1", "c2", "c3"]);
  });

  it("never shows the article itself", () => {
    for (const c of ALL) assert.equal(slugs(under(c.slug!)).includes(c.slug), false, c.slug);
  });

  it("gives every article a full row", () => {
    for (const c of ALL) assert.equal(under(c.slug!).length, 3, c.slug);
  });

  it("fills the row from other themes when its own theme has too few", () => {
    const row = under("p1");
    assert.equal(row[0]!.slug, "p2");
    assert.equal(row.slice(1).every((c) => !slugs([row[0]!]).includes(c.slug) && (c.theme as string[])[0] !== "privacy-en-data"), true);
    assert.equal(new Set(slugs(row)).size, 3);
  });

  it("does not put one article under all the others", () => {
    // Filled with the newest article, c1 stood under 15 of the 19.
    const count = new Map<string, number>();
    for (const c of ALL) for (const s of slugs(under(c.slug!))) count.set(s!, (count.get(s!) ?? 0) + 1);
    const most = Math.max(...count.values());
    assert.ok(most <= 6, `one article stands under ${most} others`);
    assert.ok(count.size >= 15, `only ${count.size} of the 19 articles are ever shown`);
  });

  it("shows the same row on every visit", () => {
    for (const c of ALL) assert.deepEqual(slugs(under(c.slug!)), slugs(under(c.slug!)));
    // The order the CMS happens to give the articles in does not matter.
    const turned = [...ALL].reverse();
    for (const c of ALL) {
      assert.deepEqual(slugs(relatedArticles({ slug: c.slug!, theme: c.theme }, turned, NOW)), slugs(under(c.slug!)), c.slug);
    }
  });

  it("puts an article that shares more themes first", () => {
    const row = relatedArticles({ slug: "x", theme: ["campagnes", "meten-en-ai"] }, [
      article("one", "campagnes", "26"),
      { ...article("both", "campagnes", "10"), theme: ["meten-en-ai", "campagnes"] },
      article("none", "recruitment", "25"),
    ], NOW);
    assert.deepEqual(slugs(row), ["both", "one", "none"]);
  });

  it("reads the theme in both shapes Statamic gives", () => {
    const row = relatedArticles({ slug: "x", theme: [{ slug: "campagnes", title: "Campagnes" }] }, [
      article("other", "recruitment", "26"), article("same", "campagnes", "10"),
    ], NOW);
    assert.deepEqual(slugs(row), ["same", "other"]);
  });

  it("leaves out an article of tomorrow, one without a title and one without a slug", () => {
    const row = relatedArticles({ slug: "x", theme: ["campagnes"] }, [
      article("morgen", "campagnes", "27"),
      article("vandaag", "campagnes", "26"),
      { ...article("leeg", "campagnes", "20"), title: "  " },
      { ...article("", "campagnes", "20") },
      { ...article("geen", "campagnes", "20"), title: null },
    ], NOW);
    assert.deepEqual(slugs(row), ["vandaag"]);
  });

  it("shows fewer when there are fewer, and nothing when there is nothing", () => {
    assert.equal(relatedArticles({ slug: "a1" }, [article("a1", "x", "20"), article("a2", "x", "20")], NOW).length, 1);
    assert.deepEqual(relatedArticles({ slug: "a1" }, [article("a1", "x", "20")], NOW), []);
    assert.deepEqual(relatedArticles({ slug: "a1" }, [], NOW), []);
  });

  it("works for an article without a theme", () => {
    assert.equal(relatedArticles({ slug: "zonder" }, ALL, NOW).length, 3);
  });
});

describe("relatedSectionFor", () => {
  it("makes the cards from the fields of the entries", () => {
    const section = relatedSectionFor({ slug: "c2", theme: ["campagnes"] }, [
      article("c1", "campagnes", "26", {
        excerpt: " Een inleiding. ", imageUrl: "https://cms.example/assets/a.svg", hoverImageUrl: "https://cms.example/assets/b.svg",
      }),
      article("c2", "campagnes", "21"),
    ], NOW);
    assert.deepEqual(section, {
      _key:     "article-related",
      _type:    "relatedContent",
      variant:  "default",
      itemKind: "articles",
      items: [{
        _key:          "related-c1",
        id:            "id-c1",
        title:         "Titel c1",
        href:          "/blog/c1",
        excerpt:       "Een inleiding.",
        imageUrl:      "https://cms.example/assets/a.svg",
        hoverImageUrl: "https://cms.example/assets/b.svg",
        category:      "Campagnes",
        date:          "2026-11-26",
      }],
    });
  });

  it("leaves out what an entry does not have", () => {
    const section = relatedSectionFor({ slug: "x" }, [{ slug: "kaal", title: "Kaal", imageUrl: null, excerpt: "" }], NOW);
    assert.deepEqual(section?.items, [{ _key: "related-kaal", id: "kaal", title: "Kaal", href: "/blog/kaal" }]);
  });

  it("brings no heading: the block prints the fixed words", () => {
    const section = relatedSectionFor({ slug: "x" }, ALL, NOW);
    assert.equal(section?.heading, undefined);
    assert.equal(section?.itemKind, "articles");
  });

  it("is null when there is nothing to show", () => {
    assert.equal(relatedSectionFor({ slug: "a1" }, [article("a1", "x", "20")], NOW), null);
  });
});

describe("beforeClosingCall", () => {
  const s = (type: string) => ({ _type: type });
  const types = (list: readonly { _type: string }[]) => list.map((x) => x._type);
  const row = s("relatedContent");

  it("puts the row before the call to action an article ends with", () => {
    assert.deepEqual(types(beforeClosingCall([s("articleMeta"), s("textSection"), s("ctaSection")], row)),
      ["articleMeta", "textSection", "relatedContent", "ctaSection"]);
  });

  it("puts it at the end of an article without one", () => {
    assert.deepEqual(types(beforeClosingCall([s("articleMeta"), s("textSection")], row)),
      ["articleMeta", "textSection", "relatedContent"]);
    assert.deepEqual(types(beforeClosingCall([], row)), ["relatedContent"]);
  });

  it("leaves a call to action in the middle of the text where it is", () => {
    assert.deepEqual(types(beforeClosingCall([s("textSection"), s("ctaSection"), s("textSection")], row)),
      ["textSection", "ctaSection", "textSection", "relatedContent"]);
  });

  it("goes before two closing calls as well", () => {
    assert.deepEqual(types(beforeClosingCall([s("textSection"), s("ctaSection"), s("ctaSection")], row)),
      ["textSection", "relatedContent", "ctaSection", "ctaSection"]);
  });
});

describe("the fixed words", () => {
  it("says Lees ook in Dutch", () => {
    assert.equal(BLOCK_TEXTS.nl.relatedArticles, "Lees ook");
    assert.equal(BLOCK_TEXTS.en.relatedArticles, "Read on");
  });

  it("keeps the general words for any other row", () => {
    assert.equal(BLOCK_TEXTS.nl.relatedContent, "Ook interessant");
  });

  it("is chosen by the block when the row is one of articles and has no heading", () => {
    const block = readFileSync("components/blocks/sections/RelatedContentBlock.tsx", "utf8");
    assert.match(block, /const heading = data\.heading\s+\?\? \(data\.itemKind === "articles" \? BLOCK_TEXTS\[locale\]\.relatedArticles : BLOCK_TEXTS\[locale\]\.relatedContent\);/);
  });

  it("reaches the block: the mapper passes the kind on", () => {
    const mapper = readFileSync("cms/mappers/page-config-mapper.ts", "utf8");
    const at     = mapper.indexOf('case "relatedContent":');
    assert.match(mapper.slice(at, mapper.indexOf("case ", at + 10)), /itemKind:\s+section\.itemKind,/);
  });
});

describe("the Statamic provider", () => {
  const source = readFileSync("cms/providers/statamic-provider.ts", "utf8");
  const start  = source.indexOf("let related:");
  const wiring = source.slice(start, source.indexOf("return {", start));

  it("closes an article with the row, before its call to action", () => {
    assert.ok(start > 0, "the row is no longer made");
    assert.match(wiring, /const sections = related \? beforeClosingCall\(opened, related\) : opened;/);
  });

  it("does so for articles only, and not when an editor put a row in the blocks", () => {
    assert.match(wiring, /if \(collectionHandle === "blog" && !blockSections\.some\(\(s\) => s\?\._type === "relatedContent"\)\) \{/);
  });

  it("shows the article without the row when the other articles cannot be read", () => {
    const tried = wiring.slice(wiring.indexOf("try {"), wiring.indexOf("const sections"));
    assert.match(tried, /await this\.client\.fetchAll<RelatedEntry>\("blog", 100\)/);
    assert.match(tried, /\} catch \(relatedErr\) \{\s+logger\.warn\(/);
    // The catch must not leave the function: the article itself is fine.
    assert.doesNotMatch(tried.slice(tried.indexOf("} catch (relatedErr)")), /return |throw /);
  });

  it("takes the images of the listing card", () => {
    assert.match(wiring, /imageUrl:\s+this\.resolveAssetUrl\(other\.overview_image as AssetField\)/);
    assert.match(wiring, /hoverImageUrl: this\.resolveAssetUrl\(other\.overview_image_hover as AssetField\)/);
  });
});
