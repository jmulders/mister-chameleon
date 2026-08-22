/**
 * Colour maths: hex parsing, Lab conversion, CIEDE2000, palette helpers.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hexToRgb, rgbToHex, rgbToLab, hexToLab, deltaE2000, deltaEHex,
  mix, darken, lighten, readableText, isLight, hueFamily, relativeLuminance,
} from "../../lib/color/index.ts";

describe("hex parsing", () => {
  it("parses #rrggbb and #rgb, with or without #", () => {
    assert.deepEqual(hexToRgb("#ffffff"), { r: 255, g: 255, b: 255 });
    assert.deepEqual(hexToRgb("000000"), { r: 0, g: 0, b: 0 });
    assert.deepEqual(hexToRgb("#f00"), { r: 255, g: 0, b: 0 });
    assert.equal(hexToRgb("nope"), null);
    assert.equal(hexToRgb("#12345"), null);
  });
  it("round-trips rgbToHex", () => {
    assert.equal(rgbToHex({ r: 255, g: 0, b: 0 }), "#ff0000");
    assert.equal(rgbToHex({ r: 300, g: -5, b: 128 }), "#ff0080");
  });
});

describe("Lab conversion", () => {
  it("white and black land on expected L", () => {
    const white = hexToLab("#ffffff")!;
    assert.ok(Math.abs(white.L - 100) < 0.1);
    assert.ok(Math.abs(white.a) < 0.01 && Math.abs(white.b) < 0.01);
    const black = rgbToLab({ r: 0, g: 0, b: 0 });
    assert.ok(Math.abs(black.L) < 0.01);
  });
});

describe("deltaE2000 (Sharma reference pairs)", () => {
  const cases: Array<[[number, number, number], [number, number, number], number]> = [
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
    [[50, 2.8361, -74.02],   [50, 0, -82.7485], 3.4412],
    [[50, -1.3802, -84.2814],[50, 0, -82.7485], 1.0000],
    [[50, 2.5, 0],           [50, 0, -2.5],     4.3065],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  ];
  it("matches the reference within tolerance", () => {
    for (const [l1, l2, expected] of cases) {
      const got = deltaE2000({ L: l1[0], a: l1[1], b: l1[2] }, { L: l2[0], a: l2[1], b: l2[2] });
      assert.ok(Math.abs(got - expected) < 0.02, `expected ~${expected}, got ${got}`);
    }
  });
  it("is zero for identical colours and grows with difference", () => {
    assert.equal(deltaEHex("#3366cc", "#3366cc"), 0);
    const near = deltaEHex("#3366cc", "#3466cc");
    const far  = deltaEHex("#3366cc", "#cc6633");
    assert.ok(near < far);
    assert.ok(near < 3 && far > 30);
  });
  it("returns Infinity for invalid input", () => {
    assert.equal(deltaEHex("nope", "#000000"), Infinity);
  });
});

describe("palette helpers", () => {
  it("mixes, darkens, lightens", () => {
    assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
    assert.equal(darken("#808080", 0.5), "#404040");
    assert.equal(lighten("#808080", 0.5), "#c0c0c0");
  });
  it("picks readable text and detects light surfaces", () => {
    assert.equal(readableText("#ffffff"), "#111111");
    assert.equal(readableText("#111111"), "#ffffff");
    assert.equal(isLight("#f5f5f0"), true);
    assert.equal(isLight("#101014"), false);
    assert.ok(relativeLuminance({ r: 255, g: 255, b: 255 }) > 0.99);
  });
  it("classifies hue families and neutrals", () => {
    assert.equal(hueFamily("#d13b3b"), "red");
    assert.equal(hueFamily("#2f8f6a"), "green");
    assert.equal(hueFamily("#2563eb"), "blue");
    assert.equal(hueFamily("#8a7d68"), "neutral"); // low-saturation greige
    assert.equal(hueFamily("#efe9dd"), "neutral");
  });
});
