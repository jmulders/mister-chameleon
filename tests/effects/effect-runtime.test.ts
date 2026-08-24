/**
 * Shared effect runtime: registry-derived group map, canonical CSS, vanilla
 * player, and its use in the snippet. Guards against drift between the snippet
 * CSS and the platform CSS (app/globals.css), which must stay in sync.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { EFFECT_GROUP_MAP, EFFECT_RUNTIME_CSS, effectRuntimeJs } from "../../design-system/effects/effect-runtime.ts";
import { EFFECT_DEFINITIONS } from "../../design-system/effects/effect-defs.ts";
import { buildSnippetSource } from "../../lib/snippet/snippet-source.ts";

describe("EFFECT_GROUP_MAP", () => {
  it("covers every registry effect id with its group", () => {
    for (const d of EFFECT_DEFINITIONS) assert.equal(EFFECT_GROUP_MAP[d.id], d.group);
    assert.equal(Object.keys(EFFECT_GROUP_MAP).length, EFFECT_DEFINITIONS.length);
  });
});

describe("EFFECT_RUNTIME_CSS", () => {
  it("has a class hook for every registry effect id", () => {
    for (const d of EFFECT_DEFINITIONS) {
      assert.ok(EFFECT_RUNTIME_CSS.includes(`.mc-fx-${d.id}`), `missing .mc-fx-${d.id}`);
    }
  });

  it("fully disables advanced effects under prefers-reduced-motion", () => {
    assert.match(EFFECT_RUNTIME_CSS, /prefers-reduced-motion/);
    assert.match(EFFECT_RUNTIME_CSS, /animation:\s*none\s*!important/);
    assert.match(EFFECT_RUNTIME_CSS, /position:\s*static\s*!important/);
  });

  it("stays in sync with the platform CSS in app/globals.css (no drift)", () => {
    const globals = fs.readFileSync(path.resolve(process.cwd(), "app/globals.css"), "utf8");
    // Every effect selector line in the canonical CSS must also appear in globals.
    const selectors = [
      ".mc-fx-reveal", ".mc-fx-fade-in", ".mc-fx-slide-in-up", ".mc-fx-slide-in-left",
      ".mc-fx-slide-in-right", ".mc-fx-zoom-in", ".mc-fx-in", ".mc-fx-hover-lift",
      ".mc-fx-slide-in-down", ".mc-fx-blur-in", ".mc-fx-pop", ".mc-fx-flip-in", ".mc-fx-wipe-reveal",
      ".mc-fx-pulse", "mc-fx-pulse", ".mc-fx-glow-pulse", "mc-fx-glow-pulse",
      ".mc-fx-stagger", ".mc-fx-scroll-fade", ".mc-fx-scroll-scale",
      ".mc-fx-parallax", ".mc-fx-sticky.mc-fx-sticky-on", ".mc-fx-ken-burns", "mc-fx-kenburns",
    ];
    for (const s of selectors) assert.ok(globals.includes(s), `globals.css missing ${s}`);
  });
});

describe("effectRuntimeJs", () => {
  it("inlines the registry group map and the guard checks", () => {
    const js = effectRuntimeJs();
    assert.ok(js.includes("__mcFxPlay"));
    assert.ok(js.includes("prefers-reduced-motion"));
    assert.ok(js.includes("IntersectionObserver"));
    assert.ok(js.includes('CSS.supports'));
    assert.ok(js.includes('"parallax"') && js.includes('"reveal"')); // group map inlined
  });
});

describe("snippet embeds the effect runtime", () => {
  const src = buildSnippetSource("https://app.example.com/api/snippet/decide");
  it("includes the player, the CSS injector, and applies block.fx", () => {
    assert.ok(src.includes("__mcFxPlay"), "player embedded");
    assert.ok(src.includes("mc-fx-style"), "CSS injector present");
    assert.ok(src.includes("mc-fx-ready"), "ready flag added");
    assert.ok(src.includes("block.fx"), "applyBlock consumes fx");
    assert.ok(src.includes("mcSetupEffects"), "setup called");
  });
});
