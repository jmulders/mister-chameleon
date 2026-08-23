/**
 * notificationMediaHtml — the flat-slot notification media payload helper.
 * Reuses the block renderer (ctaMediaInner) so the client-toast / addon paths
 * can show the same image the block-HTML path renders.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notificationMediaHtml, renderBlockHtml } from "../../lib/snippet/render-block-html.ts";
import type { BlockMedia } from "../../lib/media/block-media.ts";

describe("notificationMediaHtml", () => {
  it("renders an <img> for an asset image", () => {
    const media: BlockMedia = { kind: "image", source: "asset", url: "https://cdn.example/x.png", alt: "hi" };
    const html = notificationMediaHtml(media);
    assert.match(html, /<img /);
    assert.match(html, /src="https:\/\/cdn\.example\/x\.png"/);
  });

  it("renders a <video> for an asset video", () => {
    const media: BlockMedia = { kind: "video", source: "asset", url: "https://cdn.example/v.mp4" };
    assert.match(notificationMediaHtml(media), /<video /);
  });

  it("renders a click-to-load facade for youtube", () => {
    const media: BlockMedia = { kind: "video", source: "youtube", id: "abc123" };
    assert.match(notificationMediaHtml(media), /data-mc-video-facade/);
  });

  it("returns empty string when there is no renderable media", () => {
    assert.equal(notificationMediaHtml(undefined), "");
    assert.equal(notificationMediaHtml(null), "");
    assert.equal(notificationMediaHtml({ kind: "image", source: "asset" } as BlockMedia), ""); // no url
  });

  it("block-HTML notification still embeds the media (unchanged path)", () => {
    const html = renderBlockHtml("notification", {
      message: "Hello",
      media: { kind: "image", source: "asset", url: "https://cdn.example/x.png" },
      mediaSide: "right",
    })!;
    assert.match(html, /<img /);
  });
});
