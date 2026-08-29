/**
 * screenshot-vision — parseVisionRegions (the fraction-box parser/validator).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseVisionRegions } from "@/demo/screenshot-vision";

describe("parseVisionRegions", () => {

  it("parses valid regions with fraction boxes", () => {
    const raw = JSON.stringify({ regions: [
      { slotKey: "hero-title", tag: "h1", box: { x: 0.1, y: 0.05, w: 0.6, h: 0.08 }, originalText: "Just do it" },
      { slotKey: "hero-cta",   tag: "button", box: { x: 0.1, y: 0.2, w: 0.2, h: 0.05 }, originalText: "Shop now" },
    ] });
    const out = parseVisionRegions(raw);
    assert.equal(out.length, 2);
    assert.equal(out[0].slotKey, "hero-title");
    assert.deepEqual(out[0].box, { x: 0.1, y: 0.05, w: 0.6, h: 0.08 });
  });

  it("strips ```json fences", () => {
    const out = parseVisionRegions('```json\n{"regions":[{"slotKey":"proof","tag":"div","box":{"x":0,"y":0.9,"w":1,"h":0.1},"originalText":"4.8/5"}]}\n```');
    assert.equal(out.length, 1);
    assert.equal(out[0].slotKey, "proof");
  });

  it("clamps out-of-range fractions to [0,1] and keeps the box inside the image", () => {
    const out = parseVisionRegions(JSON.stringify({ regions: [
      { slotKey: "hero-title", tag: "h1", box: { x: 0.8, y: -0.2, w: 0.9, h: 2 }, originalText: "X" },
    ] }));
    assert.equal(out.length, 1);
    const b = out[0].box;
    assert.ok(b.x >= 0 && b.x <= 1 && b.y >= 0 && b.y <= 1);
    assert.ok(b.x + b.w <= 1.0001, "width clamped inside the image");
    assert.ok(b.y + b.h <= 1.0001, "height clamped inside the image");
  });

  it("drops unknown slotKeys, duplicates, missing box, and empty text", () => {
    const out = parseVisionRegions(JSON.stringify({ regions: [
      { slotKey: "nav",        tag: "a",  box: { x: 0, y: 0, w: 0.1, h: 0.1 }, originalText: "Home" }, // unknown slot
      { slotKey: "hero-title", tag: "h1", box: { x: 0, y: 0, w: 0.5, h: 0.1 }, originalText: "A" },
      { slotKey: "hero-title", tag: "h1", box: { x: 0, y: 0, w: 0.5, h: 0.1 }, originalText: "dup" }, // duplicate slot
      { slotKey: "hero-cta",   tag: "button", originalText: "Go" },                                    // missing box
      { slotKey: "proof",      tag: "div", box: { x: 0, y: 0, w: 0.5, h: 0.1 }, originalText: "" },    // empty text
    ] }));
    assert.equal(out.length, 1);
    assert.equal(out[0].slotKey, "hero-title");
    assert.equal(out[0].originalText, "A");
  });

  it("returns [] on invalid JSON or a non-array regions field", () => {
    assert.deepEqual(parseVisionRegions("not json"), []);
    assert.deepEqual(parseVisionRegions('{"regions":"nope"}'), []);
    assert.deepEqual(parseVisionRegions("{}"), []);
  });
});
