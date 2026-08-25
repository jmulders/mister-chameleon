/**
 * "Bed Head Bold" gallery preset — registration + token validity.
 *
 * Locks that the preset is resolvable by id (so it is a valid themePresetId) and
 * that its grouped token overrides pass the same validator the upload path uses.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getDesignPreset } from "../../tenant/design-presets-gallery.ts";
import { validateDesignTokenUpload } from "../../tenant/design-token-validator.ts";

describe("Bed Head Bold gallery preset", () => {
  const card = getDesignPreset("bed-head-bold");

  it("is registered in the gallery as a Bold & Vivid custom card", () => {
    assert.ok(card, "expected getDesignPreset('bed-head-bold') to resolve");
    assert.equal(card!.name, "Bed Head Bold");
    assert.equal(card!.category, "Bold & Vivid");
    assert.equal(card!.baseTheme, "custom");
  });

  it("carries the signature colours", () => {
    assert.equal(card!.swatch.primary, "#9B2583");
    assert.equal(card!.swatch.background, "#F4C40F");
    assert.equal(card!.tokenOverrides.color?.accent, "#FBE38A");
    assert.equal(card!.tokenOverrides.color?.gradientHero, "linear-gradient(180deg, #3F0D35 0%, #9B2583 55%, #E4117C 100%)");
    assert.equal(card!.tokenOverrides.layout?.headerFg, "#F4C40F");
    assert.equal(card!.tokenOverrides.focus?.ringColor, "#9B2583");
  });

  it("its grouped token overrides pass validateDesignTokenUpload", () => {
    const res = validateDesignTokenUpload(card!.tokenOverrides);
    assert.equal(res.ok, true, res.ok ? "" : `errors: ${JSON.stringify((res as { errors: unknown }).errors)}`);
  });
});
