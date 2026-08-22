/**
 * Curated colour-name resolution (nearest by CIEDE2000).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nearestColorName, CURATED_COLOR_NAMES } from "../../lib/color/color-names.ts";

describe("nearestColorName", () => {
  it("resolves exact curated hexes to their name", () => {
    assert.equal(nearestColorName("#ff0000").name, "Red");
    assert.equal(nearestColorName("#4682b4").name, "Steel Blue");
    assert.equal(nearestColorName("#ffd700").name, "Gold");
    assert.equal(nearestColorName("#000000").name, "Black");
    assert.equal(nearestColorName("#ffffff").name, "White");
    assert.equal(nearestColorName("#2f4f4f").name, "Dark Slate Gray");
  });

  it("resolves a near hex to the closest name with a small deltaE", () => {
    const r = nearestColorName("#fe0201"); // almost pure red
    assert.equal(r.name, "Red");
    assert.ok(r.deltaE < 2, `expected small deltaE, got ${r.deltaE}`);
    assert.equal(nearestColorName("#4884b6").name, "Steel Blue");
  });

  it("returns an exact match with deltaE 0", () => {
    assert.equal(nearestColorName("#ffd700").deltaE, 0);
  });

  it("falls back to the raw hex for invalid input", () => {
    assert.deepEqual(nearestColorName("nope"), { name: "nope", hex: "nope", deltaE: Infinity });
  });

  it("bundles a curated list with unique hexes", () => {
    assert.ok(CURATED_COLOR_NAMES.length > 100);
    const hexes = new Set(CURATED_COLOR_NAMES.map((c) => c.hex));
    assert.equal(hexes.size, CURATED_COLOR_NAMES.length);
  });
});
