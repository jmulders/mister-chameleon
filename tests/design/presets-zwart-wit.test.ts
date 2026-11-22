/**
 * Two presets in ink only: "Zwart-wit" (black pages, white text) and
 * "Wit-zwart" (white pages, black text).
 *
 * They follow the Mister Chameleon house style without its colour. Building
 * them showed three places where a preset with a light primary or a dark
 * ground was unreadable, in any dark preset:
 *   - the header's button had a fixed white label, white on a white button;
 *   - a light closing band took its text from the foreground, white on white;
 *   - form labels kept the default dark colour on a dark ground.
 * The tests below hold the two presets and those three repairs.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESIGN_PRESET_GALLERY, getDesignPreset } from "../../tenant/design-presets-gallery.ts";
import { blockTokensFromOverrides } from "../../design-system/theme/preset-to-block-tokens.ts";
import { contrastRatio } from "../../lib/color/index.ts";

const zwart = getDesignPreset("zwart-wit")!;
const wit   = getDesignPreset("wit-zwart")!;
const INK   = "#1a171b";

/** A colour without colour: red, green and blue within a few steps of each other. */
function isGrey(hex: string): boolean {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((v) => parseInt(v, 16));
  return Math.max(r!, g!, b!) - Math.min(r!, g!, b!) <= 6;
}
const ratio = (a: string | undefined, b: string | undefined) => contrastRatio(a ?? "", b ?? "") ?? 0;

describe("the two presets in ink only", () => {
  it("are in the gallery, with the house style", () => {
    for (const preset of [zwart, wit]) {
      assert.ok(preset, "preset missing from the gallery");
      assert.equal(preset.category, "House style");
      assert.equal(preset.baseTheme, "custom");
    }
    assert.equal(DESIGN_PRESET_GALLERY.filter((p) => p.id === "zwart-wit" || p.id === "wit-zwart").length, 2);
  });

  it("are each other's opposite", () => {
    assert.equal(zwart.tokenOverrides.color?.background, INK);
    assert.equal(zwart.tokenOverrides.color?.foreground, "#ffffff");
    assert.equal(wit.tokenOverrides.color?.background, "#ffffff");
    assert.equal(wit.tokenOverrides.color?.foreground, INK);
  });

  it("use no colour, apart from a form's green and red", () => {
    for (const preset of [zwart, wit]) {
      const colours = preset.tokenOverrides.color as Record<string, string>;
      for (const [key, value] of Object.entries(colours)) {
        if (key === "success" || key === "danger") continue;
        for (const hex of value.match(/#[0-9a-f]{6}\b/gi) ?? []) {
          assert.equal(isGrey(hex), true, `${preset.id} ${key} ${hex} carries colour`);
        }
      }
      for (const hex of JSON.stringify(preset.tokenOverrides.layout).match(/#[0-9a-f]{6}\b/gi) ?? []) {
        assert.equal(isGrey(hex), true, `${preset.id} layout ${hex} carries colour`);
      }
    }
  });

  it("carry no brand layer of their own, so the circles stay where a site already has them", () => {
    assert.equal(zwart.brandLayer, undefined);
    assert.equal(wit.brandLayer, undefined);
  });

  it("set the same type, shapes and room as the house style", () => {
    const house = getDesignPreset("mister-chameleon")!;
    for (const preset of [zwart, wit]) {
      assert.deepEqual(preset.tokenOverrides.typography, house.tokenOverrides.typography);
      assert.deepEqual(preset.tokenOverrides.radius, house.tokenOverrides.radius);
      assert.deepEqual(preset.tokenOverrides.spacing, house.tokenOverrides.spacing);
    }
  });
});

describe("what a visitor has to be able to read", () => {
  for (const preset of [zwart, wit]) {
    const c = preset.tokenOverrides.color as Record<string, string>;
    const t = blockTokensFromOverrides(preset.tokenOverrides) as Record<string, string>;

    it(`${preset.id}: text on the page, on a card and on a button`, () => {
      assert.ok(ratio(c.foreground, c.background) >= 7);
      assert.ok(ratio(c.mutedForeground, c.background) >= 4.5);
      assert.ok(ratio(c.cardForeground, c.card) >= 7);
      assert.ok(ratio(c.onPrimary, c.primary) >= 7);
    });

    it(`${preset.id}: the hero`, () => {
      const ground = /#[0-9a-f]{6}/i.exec(c.gradientHero!)![0];
      assert.ok(ratio(t.heroTitleColor, ground) >= 7);
    });

    it(`${preset.id}: the closing band, its text and its button`, () => {
      const band = /#[0-9a-f]{6}/i.exec(c.gradient!)![0];
      // On a dark band the heading and body are white by default.
      const heading = t.textInverse ?? "#ffffff";
      assert.ok(ratio(heading, band) >= 7, "heading on the band");
      if (t.ctaButtonBg) {
        assert.ok(ratio(t.ctaButtonBg, band) >= 3, "the button has to stand out from the band");
        assert.ok(ratio(t.ctaButtonText, t.ctaButtonBg) >= 7, "label on the button");
      }
    });

    it(`${preset.id}: a form's labels and fields`, () => {
      assert.ok(ratio(t.formLabelColor, c.muted) >= 7);
      assert.ok(ratio(t.formInputText, t.formInputBg) >= 7);
      assert.ok(ratio(t.formHelpColor, c.muted) >= 4.5);
    });
  }
});

describe("the three repairs, for any preset", () => {
  it("gives a light band in a dark preset dark text and a dark button", () => {
    const t = blockTokensFromOverrides({
      color: { primary: "#ffffff", onPrimary: "#111111", background: "#111111", foreground: "#ffffff", mutedForeground: "#cccccc",
               gradient: "linear-gradient(135deg, #ffffff 0%, #ffffff 100%)" },
    } as never) as Record<string, string>;
    assert.equal(t.textInverse, "#111111");
    assert.equal(t.ctaBodyText, "#111111");
    assert.equal(t.ctaButtonBg, "#111111");
    assert.equal(t.ctaButtonText, "#ffffff");
  });

  it("leaves a light band in a light preset as it was", () => {
    const t = blockTokensFromOverrides({
      color: { primary: "#672180", onPrimary: "#ffffff", background: "#ffffff", foreground: "#1a171b", mutedForeground: "#5c585d",
               gradient: "linear-gradient(135deg, #f5f4f5 0%, #f5f4f5 100%)" },
    } as never) as Record<string, string>;
    assert.equal(t.textInverse, "#1a171b");
    assert.equal(t.ctaBodyText, "#5c585d");
    assert.equal(t.ctaButtonBg, "#672180");
    assert.equal(t.ctaButtonText, "#ffffff");
  });

  it("hands a form the preset's own colours", () => {
    const t = blockTokensFromOverrides({
      color: { background: "#0a0a0f", foreground: "#f4f4f5", mutedForeground: "#a1a1aa", card: "#15151f", cardForeground: "#f4f4f5", border: "#27272a" },
    } as never) as Record<string, string>;
    assert.equal(t.formLabelColor, "#f4f4f5");
    assert.equal(t.formInputBg, "#15151f");
    assert.equal(t.formInputText, "#f4f4f5");
    assert.equal(t.formInputBorder, "#27272a");
  });

  it("gives the header's button the label colour of the primary fill, not a fixed white", () => {
    for (const file of ["components/layout/NavBar.tsx", "components/layout/Header.tsx"]) {
      const source = readFileSync(file, "utf8");
      assert.match(source, /text-\[var\(--btn-text,var\(--primary-text,#fff\)\)\] shadow-sm/);
      assert.doesNotMatch(source, /font-semibold text-white shadow-sm/);
    }
  });
});
