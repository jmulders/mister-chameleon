/**
 * Curated -> gallery bridge (theme-switching-unification-plan.md, "Subsume").
 *
 * A curated themeKey is equivalent to a gallery preset with baseTheme = the key
 * and NO token overrides. The bridge expresses old curated selections in the
 * unified gallery model WITHOUT changing rendering, and untouched themeKey rules
 * keep working.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bridgeThemeKeyToGallery, curatedGalleryId, curatedKeyFromGalleryId,
  getDesignPreset, DESIGN_PRESET_GALLERY,
} from "../../tenant/design-presets-gallery.ts";
import { buildCompleteLookDesign } from "../../lib/design/complete-look.ts";
import { resolveThemeForTenant } from "../../tenant/resolve-theme.ts";
import type { TenantSettings, TenantDesignSettings } from "../../tenant/types.ts";

const KEY = "modern-saas";

describe("curated -> gallery bridge", () => {
  it("bridgeThemeKeyToGallery maps a curated key to its synthetic gallery selection", () => {
    assert.deepEqual(bridgeThemeKeyToGallery(KEY), { kind: "gallery", presetId: `curated:${KEY}` });
    assert.equal(curatedGalleryId(KEY), `curated:${KEY}`);
    assert.equal(curatedKeyFromGalleryId(`curated:${KEY}`), KEY);
  });

  it("returns null / undefined for non-curated inputs (backward-safe)", () => {
    assert.equal(bridgeThemeKeyToGallery("not-a-theme"), null);
    assert.equal(curatedKeyFromGalleryId("gallery:indigo-saas"), null);
    assert.equal(curatedKeyFromGalleryId("curated:not-a-theme"), null);
  });

  it("getDesignPreset resolves the synthetic id to a baseTheme card with no overrides", () => {
    const card = getDesignPreset(`curated:${KEY}`);
    assert.ok(card, "synthetic card resolved");
    assert.equal(card!.baseTheme, KEY);
    assert.deepEqual(card!.tokenOverrides, {});
    assert.equal(card!.id, `curated:${KEY}`);
  });

  it("still resolves real gallery cards and rejects unknown ids", () => {
    const real = DESIGN_PRESET_GALLERY[0];
    assert.equal(getDesignPreset(real.id)?.id, real.id);
    assert.equal(getDesignPreset("curated:definitely-not-a-theme"), undefined);
    assert.equal(getDesignPreset("totally-unknown"), undefined);
  });

  it("the bridged preset renders IDENTICALLY to selecting the curated themeKey", () => {
    // Curated selection: design.theme = KEY.
    const curated: TenantDesignSettings = { theme: KEY } as unknown as TenantDesignSettings;
    // Bridged selection: what the gallery injection builds for the synthetic card.
    const card = getDesignPreset(`curated:${KEY}`)!;
    const bridged = buildCompleteLookDesign(curated, card.tokenOverrides, card.baseTheme);

    const curatedVars = resolveThemeForTenant({ design: curated } as unknown as TenantSettings).vars;
    const bridgedVars = resolveThemeForTenant({ design: bridged } as unknown as TenantSettings).vars;
    assert.deepEqual(bridgedVars, curatedVars, "bridged preset must resolve to the same CSS vars");
  });
});
