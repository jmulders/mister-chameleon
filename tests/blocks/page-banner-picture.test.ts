/**
 * The page banner shows its picture.
 *
 * The owner asked on 26 Nov 2026 for a picture in the banner of the inner
 * pages. The layout had a media column since it was written, but a picture in
 * it was zero pixels high: the image is drawn with `fill` and takes its size
 * from a box that had no height of its own. Only an embedded video showed,
 * because its wrapper brings an aspect ratio.
 *
 * The component is a .tsx file, which this test runner cannot import, so these
 * checks read the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/blocks/HeroBlock.tsx", "utf8");
const start  = source.indexOf('if (layout === "hero_page_banner") {');
const banner = source.slice(start, source.indexOf("// ── hero_", start + 10) > 0 ? source.indexOf("// ── hero_", start + 10) : undefined);
const box    = /data-part="page-banner-media"[\s\S]*?<\/div>\s*<\/div>/.exec(banner)?.[0] ?? "";

describe("page banner with a picture", () => {
  it("finds the layout and its media box", () => {
    assert.ok(start > 0, "the hero_page_banner layout is gone");
    assert.ok(box.length > 0, "the media box is gone");
  });

  it("gives the media box a height of its own", () => {
    const classes = /className="([^"]+)"/.exec(box)![1].split(" ");
    // 16:9, the shape the house images for a banner are drawn in.
    assert.ok(classes.includes("aspect-video"), "the box needs an aspect ratio");
    // The image is positioned absolutely, so the box must be its reference.
    assert.ok(classes.includes("relative") && classes.includes("overflow-hidden"));
  });

  it("lets the media fill that box", () => {
    assert.match(box, /<div className="absolute inset-0">\s*<HeroMediaPanel media=\{media\} className="h-full w-full" \/>/);
  });

  it("frames it with the theme tokens of the split hero", () => {
    for (const token of ["--block-media-radius", "--block-media-shadow", "--block-media-border", "--block-media-bg"]) {
      assert.ok(box.includes(`var(${token},`), token);
    }
    // No shadow unless the theme asks for one: a round picture on a
    // see-through sheet would get the shadow of a rectangle.
    assert.match(box, /boxShadow:\s+"var\(--block-media-shadow, none\)"/);
  });

  it("keeps the text beside the picture and below it on a phone", () => {
    assert.match(banner, /flex flex-col gap-8 md:flex-row md:items-center/);
    assert.match(banner, /className="w-full md:w-\[42%\] shrink-0"/);
  });

  it("still has one h1, and the centred layout for a banner without media", () => {
    assert.match(banner, /hasBannerMedia \? \(/);
    assert.match(banner, /align="center" className="text-center"/);
    assert.equal(banner.match(/as="h1"/g)?.length, 2, "one h1 in each of the two layouts");
  });
});
