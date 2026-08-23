/**
 * Preset colour matching + custom-look derivation.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  rankPresets, matchLabel, buildCustomLookTokens, NO_MATCH_THRESHOLD,
  presetIsLight, presetHueFamily,
} from "../../lib/design/preset-colour-match.ts";
import type { DesignPresetCard } from "../../tenant/design-presets-gallery.ts";

function card(id: string, swatch: DesignPresetCard["swatch"], over: Partial<DesignPresetCard> = {}): DesignPresetCard {
  return {
    id, name: id, description: "", category: "General", baseTheme: "custom",
    swatch,
    tokenOverrides: {
      color: { primary: swatch.primary },
      typography: { fontHeading: "'Lora', Georgia, serif", fontBody: "'Inter', system-ui, sans-serif", headingWeight: "700" },
      radius: { card: "16px" }, shadow: { md: "0 10px 30px rgba(0,0,0,.1)" },
      // Seed chrome: a light header + a geometry token. The colour tokens must be
      // overridden by the palette; the geometry token (navLinkWeight) inherited.
      layout: { headerBg: "#efe9dd", headerFg: "#3a352d", navLinkWeight: "600" },
    },
    ...over,
  } as DesignPresetCard;
}

const RED    = card("red",    { primary: "#d13b3b", background: "#fff7f5", foreground: "#2b1512", accent: "#e08a7a" });
const BLUE   = card("blue",   { primary: "#2563eb", background: "#f5f8ff", foreground: "#0f1e3a", accent: "#7aa7f0" });
const GREIGE = card("greige", { primary: "#8a7d68", background: "#efe9dd", foreground: "#3a352d", accent: "#b8a98f" });

describe("rankPresets", () => {
  it("ranks the closest primary first", () => {
    const r = rankPresets([RED, BLUE, GREIGE], { primary: "#2a66e0" });
    assert.equal(r[0].preset.id, "blue");
    assert.ok(r[0].deltaE < r[1].deltaE);
  });

  it("averages over the roles provided (role-aware)", () => {
    const r = rankPresets([RED, BLUE], { primary: "#d0402f", background: "#fff6f4" });
    assert.equal(r[0].preset.id, "red");
    assert.ok(r[0].deltaE <= 8);
  });

  it("returns empty when no valid colour is given", () => {
    assert.deepEqual(rankPresets([RED], { primary: "nope" }), []);
  });

  it("flags no-good-match when the best exceeds the threshold", () => {
    // A vivid green against only red/blue/greige presets: best average is large.
    const r = rankPresets([RED, BLUE, GREIGE], { primary: "#00b140" });
    assert.ok(r[0].deltaE > NO_MATCH_THRESHOLD);
  });

  it("labels by distance band", () => {
    assert.equal(matchLabel(3), "Very close");
    assert.equal(matchLabel(9), "Close");
    assert.equal(matchLabel(18), "Loose");
    assert.equal(matchLabel(40), "Distant");
  });
});

describe("facets", () => {
  it("derives light/dark and hue family from the swatch", () => {
    assert.equal(presetIsLight(RED), true);
    assert.equal(presetHueFamily(BLUE), "blue");
    assert.equal(presetHueFamily(GREIGE), "neutral");
  });
});

describe("buildCustomLookTokens", () => {
  it("derives colours and emits all four font vars", () => {
    const { tokens, swatch } = buildCustomLookTokens(
      { primary: "#2563eb", background: "#0b1020", accent: "#f59e0b" },
      GREIGE,
      "'Playfair Display', Georgia, serif",
      "'Work Sans', system-ui, sans-serif",
    );
    const color = (tokens.color ?? {}) as Record<string, string>;
    const typo = (tokens.typography ?? {}) as Record<string, string>;
    assert.equal(tokens.theme, "custom");
    assert.equal(color.primary, "#2563eb");
    assert.equal(color.background, "#0b1020");
    assert.equal(color.accent, "#f59e0b");
    // dark background -> readable (light) foreground when not provided
    assert.equal(color.foreground, "#ffffff");
    assert.equal(color.onPrimary, "#ffffff");
    assert.ok(color.gradient.includes("#2563eb"));
    // all four font vars, body == sans == ui
    assert.equal(typo.fontHeading, "'Playfair Display', Georgia, serif");
    assert.equal(typo.fontBody, "'Work Sans', system-ui, sans-serif");
    assert.equal(typo.fontSans, typo.fontBody);
    assert.equal(typo.fontUI, typo.fontBody);
    // non-colour groups seeded from the base preset
    assert.deepEqual(tokens.radius, { card: "16px" });
    assert.ok((tokens.shadow as Record<string, string>).md);
    // swatch for preview
    assert.equal(swatch.primary, "#2563eb");
  });

  it("defaults background to white and foreground to readable dark", () => {
    const { tokens } = buildCustomLookTokens(
      { primary: "#7c3aed" }, GREIGE, "'Inter', system-ui, sans-serif", "'Inter', system-ui, sans-serif",
    );
    const color = (tokens.color ?? {}) as Record<string, string>;
    assert.equal(color.background, "#ffffff");
    assert.equal(color.foreground, "#111111");
    assert.equal(color.accent, "#7c3aed"); // falls back to primary
  });

  it("derives chrome from the palette (not copied from the seed), header/footer text via readableText, top band = header bg", () => {
    // Seed GREIGE has its own light chrome; the chosen palette is a dark green look.
    const { tokens } = buildCustomLookTokens(
      { primary: "#16a34a", background: "#052e16", accent: "#facc15", foreground: "#ecfdf5" },
      GREIGE, "'Inter', system-ui, sans-serif", "'Inter', system-ui, sans-serif",
    );
    const layout = (tokens.layout ?? {}) as Record<string, string>;
    // Chrome tracks the chosen (dark) background, NOT the seed's light #efe9dd.
    assert.equal(layout.headerBg, "#052e16");
    assert.notEqual(layout.headerBg, "#efe9dd");
    // Header text picked for contrast on the dark header.
    assert.equal(layout.headerFg, "#ffffff");
    // Top band defaults to the header background.
    assert.equal(layout.headerTopbandBg, layout.headerBg);
    // Scrolled header stays consistent with the header colour.
    assert.equal(layout.headerBgScrolled, layout.headerBg);
    // Footer is a recessed shade of the background, with readable text.
    assert.ok(layout.footerBg && layout.footerBg !== layout.headerBg);
    assert.equal(layout.footerFg, "#ffffff");
    // Geometry/type layout tokens are still inherited from the seed.
    assert.equal(layout.navLinkWeight, "600");
  });

  it("applies explicit chrome overrides verbatim; empty fields stay derived", () => {
    const { tokens } = buildCustomLookTokens(
      { primary: "#16a34a", background: "#f0fdf4", foreground: "#052e16" },
      BLUE, "'Inter', system-ui, sans-serif", "'Inter', system-ui, sans-serif",
      { headerBg: "#facc15" }, // explicit header only
    );
    const layout = (tokens.layout ?? {}) as Record<string, string>;
    assert.equal(layout.headerBg, "#facc15");          // explicit wins
    assert.equal(layout.headerFg, "#111111");          // readable dark on yellow
    assert.equal(layout.headerTopbandBg, "#facc15");   // top band follows header (default)
    // footer was left empty -> derived from the palette background, not #facc15.
    assert.notEqual(layout.footerBg, "#facc15");
  });
});
