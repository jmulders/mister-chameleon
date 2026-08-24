/**
 * Ad-account gallery theme mapping.
 *
 * A gallery preset chosen for the ad account must apply as a COMPLETE look —
 * byte-identical to applying it in the design tab (buildCompleteLookDesign),
 * including the aurora example and the inherit-host flag. Curated values are not
 * treated as gallery values.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAdGalleryValue, adGalleryPresetId, buildAdGalleryDesign,
} from "../../lib/design/ad-theme.ts";
import { buildCompleteLookDesign } from "../../lib/design/complete-look.ts";
import { DESIGN_PRESET_GALLERY, getDesignPreset } from "../../tenant/design-presets-gallery.ts";
import { EXAMPLE_SITE_DESIGN_TOKENS } from "../../design-system/theme/block-token-set-examples.ts";
import type { TenantDesignSettings } from "../../tenant/types.ts";

const CURRENT: TenantDesignSettings = { theme: "default" };
const PRESET = DESIGN_PRESET_GALLERY.find(
  (p) => p.id !== "aurora-purple-gold" && p.id !== "inherit-host" && !p.inheritHostStyle,
)!;

describe("ad gallery value parsing", () => {
  it("recognises and strips the gallery: prefix", () => {
    assert.equal(isAdGalleryValue("gallery:bold-dark"), true);
    assert.equal(isAdGalleryValue("corporate-blue"), false);
    assert.equal(isAdGalleryValue("default"), false);
    assert.equal(adGalleryPresetId("gallery:bold-dark"), "bold-dark");
  });
});

describe("buildAdGalleryDesign", () => {
  it("produces the same complete look as applying the preset in the design tab", () => {
    const design = buildAdGalleryDesign(CURRENT, PRESET.id);
    const expected = {
      ...buildCompleteLookDesign(CURRENT, PRESET.tokenOverrides, PRESET.baseTheme),
      inheritHostStyle: false,
    };
    assert.deepEqual(design, expected);
  });

  it("returns null for an unknown preset id", () => {
    assert.equal(buildAdGalleryDesign(CURRENT, "no-such-preset"), null);
  });

  it("uses the hand-tuned example tokens for aurora-purple-gold", () => {
    if (!getDesignPreset("aurora-purple-gold")) return;
    const design = buildAdGalleryDesign(CURRENT, "aurora-purple-gold");
    assert.deepEqual(design?.defaultTokens, EXAMPLE_SITE_DESIGN_TOKENS);
  });

  it("turns on inherit-host style only for the inherit-host preset", () => {
    if (getDesignPreset("inherit-host")) {
      assert.equal(buildAdGalleryDesign(CURRENT, "inherit-host")?.inheritHostStyle, true);
    }
    assert.equal(buildAdGalleryDesign(CURRENT, PRESET.id)?.inheritHostStyle, false);
  });

  it("preserves unrelated current-design fields", () => {
    const design = buildAdGalleryDesign({ theme: "default", inheritHostStyle: true, defaultEffects: [{ effect: "reveal" }] } as TenantDesignSettings, PRESET.id);
    // effects carried through; theme + inheritHostStyle driven by the preset.
    assert.deepEqual(design?.defaultEffects, [{ effect: "reveal" }]);
    assert.equal(design?.theme, PRESET.baseTheme);
  });
});
