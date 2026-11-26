/**
 * The header of a Statamic article.
 *
 * The owner asked on 26 Nov 2026 to make the knowledge articles more
 * attractive to look at. An article was its title, centred, and a stack of
 * text sections 832 px wide: no image, no date, no theme, although the entry
 * has all three and the listing shows them.
 *
 * The header is made from what the entry already has. The components are
 * .tsx files, which this test runner cannot import, so those checks read the
 * source.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import { articleHeaderFor, readingMinutes } from "@/cms/providers/article-header";
import { pageNeedsTitleHeading }            from "@/lib/page-title";
import { getBlockValidVariants }            from "@/page-config/block-variants";

const words = (n: number) => Array.from({ length: n }, () => "woord").join(" ");

describe("readingMinutes", () => {
  it("is never less than a minute", () => {
    assert.equal(readingMinutes([]), 1);
    assert.equal(readingMinutes(undefined), 1);
    assert.equal(readingMinutes([{ type: "text_single", body: "<p>Kort.</p>" }]), 1);
  });

  it("counts 220 words to the minute, over all blocks", () => {
    assert.equal(readingMinutes([{ body: words(440) }]), 2);
    assert.equal(readingMinutes([{ body: words(220) }, { body: words(220) }, { body: words(220) }]), 3);
  });

  it("counts what a visitor reads: titles, texts and the items in a block", () => {
    const blocks = [{
      type:    "faq",
      heading: words(110),
      items:   [{ question: words(55), answer: `<p>${words(55)}</p>` }, { title: words(110), text: words(110) }],
    }];
    assert.equal(readingMinutes(blocks), 2);
  });

  it("does not count markup, entities, addresses or settings", () => {
    const blocks = [{
      type:  "text_single",
      id:    words(600),
      image: { url: words(600), alt: words(600) },
      body:  `<p class="${words(300)}">een&nbsp;twee &amp; drie</p><ul><li>vier</li></ul>`,
    }];
    assert.equal(readingMinutes(blocks), 1);
  });
});

describe("articleHeaderFor", () => {
  const entry = {
    title:         "Van advertentie naar pagina",
    date:          "2026-11-21 00:00:00",
    theme:         [{ slug: "campagnes", title: "Campagnes" }, { slug: "aan-de-slag", title: "Aan de slag" }],
    excerpt:       " Een goede advertentie belooft iets. ",
    coverImageUrl: "https://cms.example/assets/mc-open-stekker-kaart-3.svg",
  };

  it("makes the header from the fields of the entry", () => {
    assert.deepEqual(articleHeaderFor(entry, [{ body: words(440) }]), {
      _key:          "article-header",
      _type:         "articleMeta",
      variant:       "split",
      title:         "Van advertentie naar pagina",
      publishedAt:   "2026-11-21",
      category:      "Campagnes",
      summary:       "Een goede advertentie belooft iets.",
      coverImageUrl: "https://cms.example/assets/mc-open-stekker-kaart-3.svg",
      coverImageAlt: "",
      readingTime:   2,
    });
  });

  it("uses a variant the block knows", () => {
    assert.ok(getBlockValidVariants("articleMeta").includes("split"));
  });

  it("reads the theme in the shape of the file reader too", () => {
    assert.equal(articleHeaderFor({ ...entry, theme: ["meten-en-ai"] }, [])?.category, "Meten en ai");
  });

  it("leaves out what the entry does not have", () => {
    const header = articleHeaderFor({ title: "Alleen een titel" }, []);
    assert.deepEqual(header, {
      _key: "article-header", _type: "articleMeta", variant: "split", title: "Alleen een titel", readingTime: 1,
    });
    const empty = articleHeaderFor({ title: "Titel", date: "geen datum", theme: [], excerpt: "  ", coverImageUrl: "" }, []);
    for (const key of ["publishedAt", "category", "summary", "coverImageUrl", "coverImageAlt"]) {
      assert.equal(key in (empty as object), false, key);
    }
  });

  it("never says the article was updated", () => {
    // Every edit of a comma would show as "updated".
    assert.equal("updatedAt" in (articleHeaderFor(entry, []) as object), false);
  });

  it("gives an image beside the title an empty alt text", () => {
    // The title says what the article is. A screen reader skips the image.
    assert.equal(articleHeaderFor(entry, [])?.coverImageAlt, "");
  });

  it("makes no header for an entry without a title", () => {
    assert.equal(articleHeaderFor({ ...entry, title: "" }, []), null);
    assert.equal(articleHeaderFor({ ...entry, title: "   " }, []), null);
    assert.equal(articleHeaderFor({ ...entry, title: null }, []), null);
  });
});

describe("the page prints its title once", () => {
  it("leaves the h1 to the header", () => {
    assert.equal(pageNeedsTitleHeading([], [{ blockType: "articleMeta" }, { blockType: "textSection" }]), false);
    assert.equal(pageNeedsTitleHeading([], [{ blockType: "textSection" }]), true);
  });
});

describe("the Statamic provider", () => {
  const source = readFileSync("cms/providers/statamic-provider.ts", "utf8");
  const start  = source.indexOf("const header = collectionHandle");
  const wiring = source.slice(start, source.indexOf("return {", start));

  it("opens an article with the header", () => {
    assert.ok(start > 0, "the header is no longer made");
    assert.match(wiring, /const opened = header \? \[header, \.\.\.blockSections\] : blockSections;/);
  });

  it("does so for articles only", () => {
    // A case, a team member and a vacancy go through the same function.
    assert.match(wiring, /collectionHandle === "blog" &&/);
  });

  it("keeps the header an editor put in the blocks", () => {
    assert.match(wiring, /!blockSections\.some\(\(s\) => s\?\._type === "articleMeta"\)/);
  });

  it("takes the image of the listing card", () => {
    assert.match(wiring, /coverImageUrl: this\.resolveAssetUrl\(\s*entry\.overview_image/);
  });
});

describe("the split header", () => {
  const source = readFileSync("components/blocks/sections/ArticleMetaBlock.tsx", "utf8");
  const start  = source.indexOf('if (variant === "split") {');
  const split  = source.slice(start, source.indexOf('if (variant === "hero") {', start));

  it("exists", () => {
    assert.ok(start > 0 && split.length > 0, "the split variant is gone");
    assert.match(split, /<header\s+data-part="article-header"/);
  });

  it("has one h1 and prints the theme, the summary and the meta row", () => {
    assert.equal(split.match(/<h1/g)?.length, 1);
    assert.match(split, /<CategoryBadge category=\{data\.category\} \/>/);
    assert.match(split, /data-part="article-summary"/);
    assert.match(split, /<MetaRow/);
  });

  it("puts the image beside the text, and below it on a phone", () => {
    assert.match(split, /flex flex-col gap-8 md:flex-row md:items-center/);
    assert.match(split, /className="w-full shrink-0 md:w-\[42%\]"/);
    // Text that cannot shrink would push the page wider than a phone.
    assert.match(split, /className="min-w-0 flex-1"/);
  });

  it("gives the image a box of 16:9 that holds its place while it loads", () => {
    assert.match(split, /data-part="article-cover"/);
    assert.match(split, /aspectRatio:\s+"16 \/ 9"/);
  });

  it("lets a tenant take the ground away from under a see-through image", () => {
    assert.match(split, /background:\s+"var\(--article-cover-bg, var\(--bg-subtle\)\)"/);
  });

  it("honours an empty alt text", () => {
    // `||` would turn the empty string into the title, read out twice.
    assert.match(split, /alt=\{data\.coverImageAlt \?\? data\.title \?\? t\.articleCover\}/);
  });

  it("works without an image", () => {
    assert.match(split, /\{data\.coverImageUrl && \(/);
  });
});

describe("the house style of Mister Chameleon", () => {
  const css     = readFileSync("app/brand/mister-chameleon.css", "utf8");
  const article = '[data-brand="mister-chameleon"] main[data-page-kind="article"] [data-part="text-section"]';
  const rule    = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    assert.ok(at >= 0, `no rule for ${selector}`);
    return css.slice(at, css.indexOf("}", at));
  };

  it("sets an article as a reading column", () => {
    assert.match(rule(`${article} > div`), /max-width: 46rem;/);
    assert.match(rule(`${article} :is(p, li)`), /font-size: 1\.125rem;/);
    assert.match(rule(`${article} :is(p, li)`), /line-height: 1\.7;/);
  });

  it("makes a section title smaller than on a landing page", () => {
    assert.match(rule(`${article} h2`), /font-size: clamp\(1\.5rem, 2\.4vw, 1\.875rem\);/);
  });

  it("draws the bullets of a list as circles in the logo colours", () => {
    assert.match(rule(`${article} ul`), /list-style: none;/);
    const bullet = rule(`${article} ul > li::before`);
    assert.match(bullet, /border-radius: 50%;/);
    assert.match(bullet, /background: var\(--mc-magenta\);/);
    for (const [n, colour] of [[2, "sky"], [3, "lime"], [4, "orange"], [5, "teal"]] as const) {
      assert.match(rule(`${article} ul > li:nth-child(5n + ${n})::before`), new RegExp(`background: var\\(--mc-${colour}\\);`));
    }
  });

  it("leaves a numbered list its numbers", () => {
    assert.equal(css.includes(`${article} ol`), false);
    assert.equal(css.includes(`${article} li::before`), false);
  });

  it("shows the house image without a ground or rounded corners", () => {
    assert.match(rule('[data-brand="mister-chameleon"] [data-part="article-header"]'), /--article-cover-bg: transparent;/);
    assert.match(rule('[data-brand="mister-chameleon"] [data-part="article-cover"]'), /border-radius: 0;/);
  });

  it("names only colours the brand layer defines", () => {
    for (const colour of ["magenta", "sky", "lime", "orange", "teal"]) {
      assert.match(css, new RegExp(`--mc-${colour}:\\s+#[0-9a-f]{6};`));
    }
  });
});
