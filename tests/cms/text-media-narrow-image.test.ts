/**
 * A second image for a phone, in the block with a text beside an image.
 *
 * The sketch on /hoe-het-werkt is a wide drawing with labels. At the width of
 * a phone the labels are too small to read (22 Nov 2026). The editor can now
 * give the block a second image, drawn for a narrow screen.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapStatamicPageBlocksToSections } from "@/cms/mappers/statamic/statamic-mappers";

type Section = { _type: string; mediaUrl?: string; mediaUrlNarrow?: string };
const block = (extra: Record<string, unknown>) =>
  (mapStatamicPageBlocksToSections([{ id: "b1", type: "image", enabled: true, heading: "De techniek in één schets", media_type: "image", image: "/assets/breed.svg", ...extra }]) as unknown as Section[])
    .find((s) => s._type === "textMedia")!;

describe("the image for a narrow screen", () => {
  it("comes from the field image_mobile, next to the wide image", () => {
    const section = block({ image_mobile: "/assets/smal.svg" });
    assert.match(section.mediaUrl ?? "", /breed\.svg$/);
    assert.match(section.mediaUrlNarrow ?? "", /smal\.svg$/);
  });

  it("is absent for a block without one, as every block was before", () => {
    assert.equal(block({}).mediaUrlNarrow, undefined);
    assert.equal(block({ image_mobile: "" }).mediaUrlNarrow, undefined);
    assert.equal(block({ image_mobile: [] }).mediaUrlNarrow, undefined);
  });

  it("is ignored for a video", () => {
    const section = block({ media_type: "video", video_source: "youtube", video_id: "dQw4w9WgXcQ", image_mobile: "/assets/smal.svg" });
    assert.equal(section.mediaUrlNarrow, undefined);
  });

  it("reaches the block through the page config", () => {
    assert.match(readFileSync("cms/mappers/page-config-mapper.ts", "utf8"), /mediaUrlNarrow:\s*section\.mediaUrlNarrow/);
  });
});

describe("the block with a narrow image", () => {
  const source = readFileSync("components/blocks/sections/TextMediaBlock.tsx", "utf8");

  it("shows the narrow image on a phone and the wide one from a tablet up", () => {
    assert.match(source, /src=\{mediaUrlNarrow\}[\s\S]{0,200}className=\{cn\("block w-full md:hidden"/);
    assert.match(source, /mediaUrlNarrow \? "hidden md:block" : "block"/);
  });

  it("loads both lazily, so a visitor fetches only the one that is shown", () => {
    const images = source.slice(source.indexOf("{mediaUrlNarrow && ("), source.indexOf("</figure>", source.indexOf("{mediaUrlNarrow && (")));
    assert.equal((images.match(/loading="lazy"/g) ?? []).length, 2);
  });

  it("keeps each image a direct child of the frame, where the brand layer looks for it", () => {
    // The brand layer finds a house image with ":has(> img[src*=…])". A <picture>
    // around the images would take them out from under the frame.
    assert.doesNotMatch(source, /<picture/);
  });

  it("gives both images the same description", () => {
    const images = source.slice(source.indexOf("{mediaUrlNarrow && ("), source.indexOf("</figure>", source.indexOf("{mediaUrlNarrow && (")));
    assert.equal((images.match(/alt=\{mediaAlt \?\? ""\}/g) ?? []).length, 2);
  });
});
