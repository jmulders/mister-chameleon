/**
 * Item 9 PR 1 — explorer contrast warnings.
 *
 * The colour explorer shows a non-blocking WCAG warning when a chosen palette
 * has low contrast. This locks the threshold logic (yellow < 4.5:1, red < 3:1)
 * and the exact dev-check palettes:
 *   - green background + white text + yellow primary  -> flags (red)
 *   - a well-contrasting palette                       -> no warning
 */

import { describe, it } from "node:test";
import assert            from "node:assert/strict";
import { contrastLevel, worstLevel, paletteContrast } from "../../lib/design/contrast-warn.ts";

describe("contrast level thresholds", () => {
  it("maps ratios to ok / warn / fail at the WCAG boundaries", () => {
    assert.equal(contrastLevel(7.0),  "ok");
    assert.equal(contrastLevel(4.5),  "ok");   // AA boundary is inclusive
    assert.equal(contrastLevel(4.49), "warn"); // just below AA -> yellow
    assert.equal(contrastLevel(3.0),  "warn"); // 3:1 boundary -> still yellow
    assert.equal(contrastLevel(2.99), "fail"); // below 3:1 -> red
    assert.equal(contrastLevel(1.0),  "fail");
    assert.equal(contrastLevel(null), "ok");   // unparseable colour: no warning
  });

  it("worstLevel picks fail over warn over ok", () => {
    assert.equal(worstLevel("ok", "warn", "ok"),  "warn");
    assert.equal(worstLevel("ok", "warn", "fail"), "fail");
    assert.equal(worstLevel("ok", "ok"),           "ok");
  });
});

describe("paletteContrast dev-check palettes", () => {
  it("flags a low-contrast palette (green bg + white text + yellow primary)", () => {
    const c = paletteContrast({ primaryHex: "#facc15", backgroundHex: "#22c55e", foregroundHex: "#ffffff" });
    assert.equal(c.worst, "fail", "the overall palette must warn (red)");
    // White text on the bright-green background is unreadable (below 3:1).
    assert.equal(contrastLevel(c.fgOnBg), "fail");
    // The yellow primary on the green background is also unreadable.
    assert.equal(contrastLevel(c.primaryOnBg), "fail");
  });

  it("does not warn for a well-contrasting palette (white bg, dark text, blue primary)", () => {
    const c = paletteContrast({ primaryHex: "#1d4ed8", backgroundHex: "#ffffff", foregroundHex: "#111827" });
    assert.equal(c.worst, "ok", "a legible palette shows no warning");
    assert.equal(contrastLevel(c.fgOnBg), "ok");
    assert.equal(contrastLevel(c.primaryOnBg), "ok");
    assert.equal(contrastLevel(c.onPrimary), "ok");
  });

  it("surfaces a yellow (warn) level for a mid-contrast pair", () => {
    // Foreground grey on white sits between 3:1 and 4.5:1 -> yellow, not red.
    const c = paletteContrast({ primaryHex: "#1d4ed8", backgroundHex: "#ffffff", foregroundHex: "#8a8a8a" });
    assert.equal(contrastLevel(c.fgOnBg), "warn");
  });

  it("falls back to a white background when none is chosen", () => {
    const c = paletteContrast({ primaryHex: "#2563eb", backgroundHex: null, foregroundHex: null });
    assert.equal(c.fgOnBg, null, "no foreground chosen -> no text/bg pair");
    assert.equal(contrastLevel(c.primaryOnBg), "ok"); // blue on the default white
  });
});
