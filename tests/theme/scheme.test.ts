/**
 * Dark or light, from the page background of the look a request gets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { schemeFor } from "../../lib/theme/scheme.ts";
import { getDesignPreset } from "../../tenant/design-presets-gallery.ts";

describe("schemeFor", () => {
  it("calls the four presets of the live site what they are", () => {
    // Measured on production on 15 Nov 2026: the site switches between these.
    const expected: Record<string, "light" | "dark"> = {
      "midnight-amber": "dark",
      "brand-playful-pop": "light",
      "ibiza-rush-bone": "light",
      "aubergine-camel": "light",
    };
    for (const [id, scheme] of Object.entries(expected)) {
      const card = getDesignPreset(id);
      assert.ok(card, `preset ${id} exists`);
      const background = (card!.tokenOverrides.color as Record<string, string>)["background"];
      assert.equal(schemeFor(background), scheme, `${id} (${background})`);
    }
  });

  it("is dark exactly where white text reads better than black", () => {
    assert.equal(schemeFor("#000000"), "dark");
    assert.equal(schemeFor("#1a171b"), "dark");
    assert.equal(schemeFor("#672180"), "dark");
    assert.equal(schemeFor("#808080"), "light");
    assert.equal(schemeFor("#ffffff"), "light");
  });

  it("takes the first candidate that is a colour", () => {
    assert.equal(schemeFor(undefined, null, "", "#101010", "#ffffff"), "dark");
    assert.equal(schemeFor("var(--x)", "#ffffff"), "light");
  });

  it("counts a page as light when it knows nothing", () => {
    assert.equal(schemeFor(), "light");
    assert.equal(schemeFor(undefined, "linear-gradient(#000, #111)"), "light");
  });
});
