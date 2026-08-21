/**
 * BlockMedia helpers for the form contact panel: sanitize (load/save parsers),
 * legacy photoUrl backward-compat, and the editor round-trip conversion.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeBlockMedia,
  legacyPhotoUrlToBlockMedia,
  isRenderableMedia,
} from "../../lib/media/block-media.ts";
import {
  heroBannerMediaToBlockMedia,
  blockMediaToHeroBannerMedia,
} from "../../lib/media/hero-banner-to-block-media.ts";

describe("sanitizeBlockMedia (load/save parser input)", () => {
  it("accepts a valid asset image and drops unknown fields", () => {
    const m = sanitizeBlockMedia({ kind: "image", source: "asset", url: " https://x/p.jpg ", alt: "Face", fit: "cover", bogus: 1 });
    assert.deepEqual(m, { kind: "image", source: "asset", url: "https://x/p.jpg", alt: "Face", fit: "cover" });
  });

  it("accepts a youtube video by id and coerces autoplay", () => {
    const m = sanitizeBlockMedia({ kind: "video", source: "youtube", id: "dQw4w9WgXcQ", autoplay: true });
    assert.deepEqual(m, { kind: "video", source: "youtube", id: "dQw4w9WgXcQ", autoplay: true });
  });

  it("drops a non-renderable payload (image with no url)", () => {
    assert.equal(sanitizeBlockMedia({ kind: "image", source: "asset" }), undefined);
    assert.equal(sanitizeBlockMedia({ kind: "video", source: "youtube" }), undefined);
    assert.equal(sanitizeBlockMedia(null), undefined);
    assert.equal(sanitizeBlockMedia("nope"), undefined);
  });

  it("whitelists source and fit, defaulting source to asset", () => {
    const m = sanitizeBlockMedia({ kind: "image", source: "ftp", url: "https://x/p.jpg", fit: "weird" });
    assert.equal(m?.source, "asset");
    assert.equal(m?.fit, undefined);
  });

  it("caps overly long strings", () => {
    const long = "https://x/" + "a".repeat(5000);
    const m = sanitizeBlockMedia({ kind: "image", source: "asset", url: long });
    assert.equal((m?.url ?? "").length, 2000);
  });
});

describe("legacy photoUrl backward-compat", () => {
  it("maps a legacy photoUrl to an image BlockMedia", () => {
    const m = legacyPhotoUrlToBlockMedia("https://x/photo.jpg");
    assert.deepEqual(m, { kind: "image", source: "asset", url: "https://x/photo.jpg", fit: "cover" });
    assert.equal(isRenderableMedia(m), true);
  });

  it("returns undefined for an empty photoUrl", () => {
    assert.equal(legacyPhotoUrlToBlockMedia(""), undefined);
    assert.equal(legacyPhotoUrlToBlockMedia("   "), undefined);
    assert.equal(legacyPhotoUrlToBlockMedia(undefined), undefined);
  });

  it("a legacy photoUrl seeds the editor as a HeroBannerMedia image", () => {
    const seed = blockMediaToHeroBannerMedia(legacyPhotoUrlToBlockMedia("https://x/photo.jpg"));
    assert.deepEqual(seed, { kind: "image", url: "https://x/photo.jpg", alt: "" });
  });
});

describe("editor round-trip (BlockMedia <-> HeroBannerMedia)", () => {
  it("image round-trips", () => {
    const block = { kind: "image", source: "asset", url: "https://x/p.jpg", alt: "A", fit: "cover" } as const;
    const back = heroBannerMediaToBlockMedia(blockMediaToHeroBannerMedia(block));
    assert.equal(back?.kind, "image");
    assert.equal(back?.url, "https://x/p.jpg");
    assert.equal(back?.alt, "A");
  });

  it("youtube round-trips", () => {
    const block = { kind: "video", source: "youtube", id: "abc123", autoplay: true } as const;
    const back = heroBannerMediaToBlockMedia(blockMediaToHeroBannerMedia(block));
    assert.equal(back?.kind, "video");
    assert.equal(back?.source, "youtube");
    assert.equal(back?.id, "abc123");
    assert.equal(back?.autoplay, true);
  });

  it("uploaded video round-trips (poster preserved)", () => {
    const block = { kind: "video", source: "asset", url: "https://x/v.mp4", poster: "https://x/poster.jpg", autoplay: false } as const;
    const back = heroBannerMediaToBlockMedia(blockMediaToHeroBannerMedia(block));
    assert.equal(back?.kind, "video");
    assert.equal(back?.source, "asset");
    assert.equal(back?.url, "https://x/v.mp4");
    assert.equal(back?.poster, "https://x/poster.jpg");
  });
});
