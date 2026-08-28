/**
 * Per-tenant custom scenario presets — normalisation, merge, key namespacing.
 *
 * The panel is fail-open: an invalid or built-in-shadowing custom preset must be
 * dropped, never break the panel. Custom presets are marked `custom: true` and
 * merged AFTER the built-ins.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeCustomPresets, mergePresetList, newCustomPresetKey,
} from "../../components/scenario/custom-presets.ts";
import { SCENARIO_PRESET_LIST, SCENARIO_PRESETS } from "../../components/scenario/scenario-presets.ts";

describe("normalizeCustomPresets", () => {
  it("normalises a valid preset with defaults + custom marker", () => {
    const [p] = normalizeCustomPresets([
      { key: "custom_a", label: "My Persona", overrides: { intentScore: 80 } },
    ]);
    assert.equal(p.key, "custom_a");
    assert.equal(p.label, "My Persona");
    assert.equal(p.icon, "⭐");         // default
    assert.equal(p.color, "purple");    // default
    assert.equal(p.custom, true);
    assert.deepEqual(p.overrides, { intentScore: 80 });
  });

  it("keeps a valid icon/color and description", () => {
    const [p] = normalizeCustomPresets([
      { key: "custom_b", label: "L", icon: "🚀", color: "green", description: "d", overrides: {} },
    ]);
    assert.equal(p.icon, "🚀");
    assert.equal(p.color, "green");
    assert.equal(p.description, "d");
  });

  it("fails open: drops items missing key/label/overrides", () => {
    const out = normalizeCustomPresets([
      { label: "no key", overrides: {} },
      { key: "custom_c", overrides: {} },              // no label
      { key: "custom_d", label: "no overrides" },       // no overrides
      { key: "custom_e", label: "ok", overrides: {} },  // valid
      "garbage", null, 42,
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].key, "custom_e");
  });

  it("drops a key that shadows a built-in preset", () => {
    const builtinKey = Object.keys(SCENARIO_PRESETS)[0];
    const out = normalizeCustomPresets([{ key: builtinKey, label: "shadow", overrides: {} }]);
    assert.equal(out.length, 0);
  });

  it("de-dupes duplicate custom keys (first wins)", () => {
    const out = normalizeCustomPresets([
      { key: "custom_x", label: "first", overrides: {} },
      { key: "custom_x", label: "second", overrides: {} },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].label, "first");
  });

  it("returns [] for non-array / absent input", () => {
    assert.deepEqual(normalizeCustomPresets(undefined), []);
    assert.deepEqual(normalizeCustomPresets(null), []);
    assert.deepEqual(normalizeCustomPresets({}), []);
  });
});

describe("mergePresetList", () => {
  it("built-ins first, then customs", () => {
    const customs = normalizeCustomPresets([{ key: "custom_z", label: "Z", overrides: {} }]);
    const merged = mergePresetList(customs);
    assert.equal(merged.length, SCENARIO_PRESET_LIST.length + 1);
    assert.equal(merged[0].key, SCENARIO_PRESET_LIST[0].key);
    assert.equal(merged[merged.length - 1].key, "custom_z");
  });
});

describe("newCustomPresetKey", () => {
  it("is prefixed and unique across many calls, never a built-in", () => {
    const builtins = new Set(Object.keys(SCENARIO_PRESETS));
    const keys = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const k = newCustomPresetKey();
      assert.match(k, /^custom_/);
      assert.ok(!builtins.has(k));
      keys.add(k);
    }
    assert.equal(keys.size, 1000);
  });
});
