/**
 * Onboarding with a gallery preset.
 *
 * When a gallery preset is chosen at onboarding, the new tenant must start fully
 * themed — the preset applied as a COMPLETE look, byte-identical to applying it
 * in the design tab (buildCompleteLookDesign). The gallery is ungated (available
 * on every package), and a curated choice keeps working unchanged.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  onboardingInputToTenantSettings, validateOnboardingInput, type OnboardingInput,
} from "../../onboarding/tenant-setup.ts";
import { buildCompleteLookDesign } from "../../lib/design/complete-look.ts";
import { DESIGN_PRESET_GALLERY, getDesignPreset } from "../../tenant/design-presets-gallery.ts";
import { EXAMPLE_SITE_DESIGN_TOKENS } from "../../design-system/theme/block-token-set-examples.ts";

const base: OnboardingInput = {
  tenantId:    "acme-co",
  tenantName:  "Acme Co",
  websiteUrl:  "https://acme.example.com",
  packageKey:  "starter",
  cmsProvider: "mock",
  themePreset: "default",
};

// A gallery preset with token overrides and no inherit-host / no hand-tuned example.
const PRESET = DESIGN_PRESET_GALLERY.find(
  (p) => p.id !== "aurora-purple-gold" && p.id !== "inherit-host" && !p.inheritHostStyle,
)!;

describe("onboarding — gallery preset applied as a complete look", () => {
  it("produces the same design as applying the preset in the design tab", () => {
    const settings = onboardingInputToTenantSettings({ ...base, galleryPresetId: PRESET.id });
    const expected = buildCompleteLookDesign({ theme: PRESET.baseTheme }, PRESET.tokenOverrides, PRESET.baseTheme);

    assert.equal(settings.design.theme, PRESET.baseTheme);
    assert.deepEqual(settings.design.tokenOverrides, expected.tokenOverrides);
    assert.deepEqual(settings.design.defaultTokens, expected.defaultTokens);
    assert.equal(settings.design.typographyOverrideEnabled, true);
    assert.equal(settings.design.inheritHostStyle, false);
  });

  it("is ungated — a gallery preset works on the starter package without a blocking issue", () => {
    const result = validateOnboardingInput({ ...base, packageKey: "starter", galleryPresetId: PRESET.id });
    assert.equal(result.valid, true);
    assert.equal(result.issues.some((i) => i.blocking), false);
  });

  it("uses the hand-tuned example tokens for aurora-purple-gold", () => {
    if (!getDesignPreset("aurora-purple-gold")) return; // preset present in this build
    const settings = onboardingInputToTenantSettings({ ...base, galleryPresetId: "aurora-purple-gold" });
    assert.deepEqual(settings.design.defaultTokens, EXAMPLE_SITE_DESIGN_TOKENS);
  });

  it("turns on inherit-host style for the inherit-host preset", () => {
    if (!getDesignPreset("inherit-host")) return;
    const settings = onboardingInputToTenantSettings({ ...base, galleryPresetId: "inherit-host" });
    assert.equal(settings.design.inheritHostStyle, true);
  });

  it("blocks an unknown gallery preset id", () => {
    const result = validateOnboardingInput({ ...base, galleryPresetId: "no-such-preset" });
    assert.equal(result.valid, false);
    assert.ok(result.issues.some((i) => i.blocking && i.field === "galleryPresetId"));
  });
});

describe("onboarding — curated choice unchanged (backward-compat)", () => {
  it("uses just the curated theme when no gallery preset is selected", () => {
    const settings = onboardingInputToTenantSettings({ ...base, themePreset: "default" });
    assert.equal(settings.design.theme, "default");
    assert.equal(settings.design.tokenOverrides, undefined);
    assert.equal(settings.design.defaultTokens, undefined);
  });
});
