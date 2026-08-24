/**
 * Secondary-button readability (light-on-light fix).
 *
 * The secondary button pairs --btn-secondary-bg (a light brand tint) with
 * --btn-secondary-text (the brand primary). On a light tint plus a light/amber
 * primary that pairing is light-on-light (the "Lees cases" hero button was the
 * visible symptom). The fix keeps the brand text only while it stays legible on
 * the tint (>= 4.5:1), else flips to a readable colour. It is applied in all
 * three surfaces that emit the token: the curated path (tenant-theme
 * buildThemeVarsArray), the custom/gallery override path (resolve-theme) and the
 * block-token layer (blockTokensFromOverrides -> blockTokensToStyle).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeForTenant } from "../../tenant/resolve-theme.ts";
import { tenantThemeToVarsRecord } from "../../design-system/theme/tenant-theme.ts";
import { THEME_PRESETS, isThemePresetKey } from "../../design-system/theme/presets.ts";
import {
  blockTokensFromOverrides,
} from "../../design-system/theme/preset-to-block-tokens.ts";
import { resolveBlockTokenStyle } from "../../design-system/theme/block-token-set.ts";
import { contrastRatio } from "../../lib/color/index.ts";
import type { TenantSettings } from "../../tenant/types.ts";

function customWithColors(color: Record<string, string>): TenantSettings {
  return { design: { theme: "custom", tokenOverrides: { color } } } as unknown as TenantSettings;
}

// Amber brand on its own light tint: brand text is illegible on the tint.
const AMBER = { primary: "#f0b429", muted: "#fdf6e3", accent: "#fdf6e3" };
// Dark brand on a light tint: brand text stays legible.
const DARKBRAND = { primary: "#8a1c1c", muted: "#f4f4f5", accent: "#f4f4f5" };

describe("secondary button — resolve-theme (custom/gallery override path)", () => {
  it("flips light-on-light brand text to a readable colour on the tint", () => {
    const { vars } = resolveThemeForTenant(customWithColors(AMBER));
    const bg = vars["--btn-secondary-bg"];
    assert.equal(bg, "#fdf6e3", "the tint surface itself stays the sensible brand tint");
    assert.notEqual(vars["--btn-secondary-text"], "#f0b429", "illegible brand text must be replaced");
    const ratio = contrastRatio(vars["--btn-secondary-text"], bg)!;
    assert.ok(ratio >= 4.5, `secondary button text should be legible, got ${ratio.toFixed(2)}`);
  });

  it("keeps the brand text when it already contrasts with the tint", () => {
    const { vars } = resolveThemeForTenant(customWithColors(DARKBRAND));
    assert.equal(vars["--btn-secondary-text"], "#8a1c1c", "legible brand text is kept");
  });
});

describe("secondary button — curated path (buildThemeVarsArray)", () => {
  it("every preset resolves a legible secondary button (>= 4.5:1)", () => {
    const fails: string[] = [];
    for (const k of Object.keys(THEME_PRESETS).filter(isThemePresetKey)) {
      const vars = tenantThemeToVarsRecord(THEME_PRESETS[k]);
      const bg = vars["--btn-secondary-bg"], text = vars["--btn-secondary-text"];
      const ratio = contrastRatio(text, bg);
      if (ratio === null || ratio < 4.5) fails.push(`${k}: ${ratio?.toFixed(2)} (${bg}/${text})`);
    }
    assert.deepEqual(fails, [], `secondary button below 4.5 on:\n${fails.join("\n")}`);
  });
});

describe("secondary button — block-token layer (site-default scope)", () => {
  it("flips the derived light-on-light brand text so the site-default scope stays legible", () => {
    const tokens = blockTokensFromOverrides({ color: AMBER } as never);
    const style = resolveBlockTokenStyle({ tokens }, null) as Record<string, string>;
    const bg = style["--btn-secondary-bg"];
    assert.equal(bg, "#fdf6e3", "the tint surface is unchanged");
    assert.notEqual(style["--btn-secondary-text"], "#f0b429");
    const ratio = contrastRatio(style["--btn-secondary-text"], bg)!;
    assert.ok(ratio >= 4.5, `block-layer secondary button should be legible, got ${ratio.toFixed(2)}`);
  });

  it("keeps a legible brand text untouched in the block-token layer", () => {
    const tokens = blockTokensFromOverrides({ color: DARKBRAND } as never);
    const style = resolveBlockTokenStyle({ tokens }, null) as Record<string, string>;
    assert.equal(style["--btn-secondary-text"], "#8a1c1c");
  });
});
