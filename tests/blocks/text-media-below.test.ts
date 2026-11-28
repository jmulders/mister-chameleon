/**
 * text_media_below: the stacked text-and-media block with the heading and the
 * text above the image. Asked for on 28 Nov 2026, for the drawings on
 * /integraties: a reader first needs to know what he is looking at.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCK_REGISTRY } from "@/page-config/registry";

const component = readFileSync("components/blocks/sections/TextMediaBlock.tsx", "utf8");

describe("text_media_below", () => {
  it("is a variant the text-and-media block allows", () => {
    const block = BLOCK_REGISTRY.textMedia;
    assert.ok(block, "the textMedia block is registered");
    assert.ok((block.allowedVariants as readonly string[]).includes("text_media_below"));
    assert.match(readFileSync("page-config/block-variants.ts", "utf8"), /textMedia:\s+\[[^\]]*"text_media_below"\]/);
  });

  it("draws the text first and the media under it", () => {
    const start = component.indexOf('if (variant === "text_media_below")');
    assert.ok(start > 0);
    const part = component.slice(start, component.indexOf("// ── text_media_left", start));
    assert.ok(part.indexOf("{text}") > 0 && part.indexOf("{text}") < part.indexOf("{media}"));
  });

  it("leaves the stacked variant as it was: media first", () => {
    const start = component.indexOf('if (variant === "text_media_stacked")');
    const part = component.slice(start, component.indexOf("// ── text_media_below", start));
    assert.ok(part.indexOf("{media}") > 0 && part.indexOf("{media}") < part.indexOf("{text}"));
  });

  it("can be chosen in both editors", () => {
    assert.match(readFileSync("provisioning/statamic/fieldsets/mrc_image_block.yaml", "utf8"), /text_media_below: 'Stacked \(text above media\)'/);
    assert.match(readFileSync("cms/schemas/objects/textMedia.ts", "utf8"), /value: "text_media_below"/);
  });
});
