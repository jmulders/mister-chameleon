/**
 * resolve-theme parity fan-out (docs/design/root-token-propagation-audit.md).
 *
 * An admin color/radius group override must now re-derive the INCLUDED component
 * tokens (card / feature-grid / proof surfaces + borders, badge / secondary /
 * nav-dropdown accents, component radii), while the three EXCLUDED inverse-surface
 * texts stay preset/luminance-driven (not set by these overrides).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeForTenant } from "../../tenant/resolve-theme.ts";
import type { TenantSettings } from "../../tenant/types.ts";

const PRIMARY = "#aa0000", BG = "#f0f0f0", MUTED = "#e0e0e0", BORDER = "#cccccc", CARD = "#ffffff";

function settings(): TenantSettings {
  return {
    design: {
      theme: "default",
      tokenOverrides: {
        color: { primary: PRIMARY, background: BG, muted: MUTED, border: BORDER, card: CARD },
        radius: { card: "20px" },
      },
    },
  } as unknown as TenantSettings;
}

describe("parity fan-out — included component tokens follow the group override", () => {
  const { vars } = resolveThemeForTenant(settings());

  it("primary group re-derives brand-accent tokens", () => {
    assert.equal(vars["--card-quote"], PRIMARY);
    assert.equal(vars["--badge-primary-text"], PRIMARY);
    assert.equal(vars["--btn-secondary-text"], PRIMARY);
    assert.equal(vars["--nav-dropdown-link-hover-text"], PRIMARY);
  });

  it("muted group re-derives subtle surfaces + brand-tint accents", () => {
    for (const v of ["--feature-grid-bg", "--feature-grid-icon-bg", "--badge-primary-bg",
      "--btn-secondary-bg", "--btn-secondary-hover-bg", "--nav-dropdown-link-hover-bg"]) {
      assert.equal(vars[v], MUTED, v);
    }
  });

  it("border group re-derives feature-grid + nav-dropdown borders", () => {
    for (const v of ["--feature-grid-border", "--feature-grid-card-border", "--nav-dropdown-border"]) {
      assert.equal(vars[v], BORDER, v);
    }
  });

  it("card group re-derives nested card surfaces", () => {
    assert.equal(vars["--feature-grid-card-bg"], CARD);
    assert.equal(vars["--proof-card-bg"], CARD);
  });

  it("background group re-derives the proof section surface", () => {
    assert.equal(vars["--proof-bg"], BG);
  });

  it("radius.card re-derives the component radii", () => {
    assert.equal(vars["--card-radius"], "20px");
    assert.equal(vars["--proof-card-radius"], "20px");
    assert.equal(vars["--feature-grid-card-radius"], "20px");
  });
});

describe("parity fan-out — excluded inverse-surface texts stay preset-driven", () => {
  const { vars } = resolveThemeForTenant(settings());

  it("does NOT set the three excluded tokens from these overrides", () => {
    assert.equal(vars["--hero-title-color"], undefined);
    assert.equal(vars["--hero-subtitle-color"], undefined);
    assert.equal(vars["--section-cta-body"], undefined);
  });
});
