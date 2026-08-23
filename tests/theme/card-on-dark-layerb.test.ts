/**
 * resolve-theme (Layer B): card-on-dark lift for custom/gallery colour overrides.
 *
 * A saved custom preset can set a dark color.card that barely separates from the
 * subtle section (color.muted). resolve-theme lifts --card-bg / --card-border at
 * render so the CTA card reads as elevated, without rewriting stored tenant data.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeForTenant } from "../../tenant/resolve-theme.ts";
import { contrastRatio, isLight } from "../../lib/color/index.ts";
import type { TenantSettings } from "../../tenant/types.ts";

function customWithColors(color: Record<string, string>): TenantSettings {
  return { design: { theme: "custom", tokenOverrides: { color } } } as unknown as TenantSettings;
}

describe("card-on-dark lift (Layer B)", () => {
  it("lifts a dark custom card that barely separates from the subtle section", () => {
    const { vars } = resolveThemeForTenant(customWithColors({
      card: "#111111", muted: "#0d0d0d", foreground: "#fafafa", border: "#222222",
    }));
    // Raw card #111111 vs subtle #0d0d0d is ~1.03; after the lift it must clear 1.25.
    assert.notEqual(vars["--card-bg"], "#111111", "card should be lifted off the section");
    assert.ok(!isLight(vars["--card-bg"]), "lifted card is still dark, just elevated");
    const sep = contrastRatio(vars["--card-bg"], "#0d0d0d")!;
    assert.ok(sep >= 1.25, `card should separate from the section, got ${sep.toFixed(2)}`);
    // Border strengthened relative to the lifted card.
    const borderSep = contrastRatio(vars["--card-border"], vars["--card-bg"])!;
    assert.ok(borderSep > 1.25, `card border should be visible, got ${borderSep.toFixed(2)}`);
  });

  it("leaves a light custom card untouched", () => {
    const { vars } = resolveThemeForTenant(customWithColors({
      card: "#ffffff", muted: "#f1f5f9", foreground: "#0f172a", border: "#e2e8f0",
    }));
    assert.equal(vars["--card-bg"], "#ffffff", "light card must not be lifted");
  });

  it("leaves an already-separated dark card untouched", () => {
    const { vars } = resolveThemeForTenant(customWithColors({
      card: "#2f3a4a", muted: "#0d0d0d", foreground: "#fafafa", border: "#556",
    }));
    // #2f3a4a vs #0d0d0d already separates (> 1.25), so the card is unchanged.
    assert.equal(vars["--card-bg"], "#2f3a4a");
  });
});
