/**
 * Per-tenant built-in override layer: normalise, fold the legacy scenarioPanel
 * allowlist in, and apply (hide / reorder / relabel / deep-merge / reset / fail-open).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeScenarioOverrides, foldPanelIntoOverrides,
  applyPresetOverrides, applyRoleOverrides, effectivePresetOverrides,
} from "../../components/scenario/scenario-overrides.ts";
import type { ScenarioPreset } from "../../components/scenario/scenario-presets.ts";

const preset = (key: string, over: Record<string, unknown> = {}): ScenarioPreset => ({
  key, label: key, description: key, icon: "🔵", color: "blue", overrides: over,
});
const BASE = [preset("a", { funnelStage: "x" }), preset("b"), preset("c")];

describe("normalizeScenarioOverrides", () => {
  it("keeps valid fields, drops junk and all-empty entries (reset)", () => {
    const m = normalizeScenarioOverrides({
      a: { hidden: true, order: 2, label: "A!", icon: "🎯", color: "green", overrides: { funnelStage: "y" } },
      b: { color: "not-a-color", order: "nope" }, // color/order invalid → dropped → empty → removed
      c: 123,          // not an object → skipped
      "": { hidden: true }, // empty key → skipped
    });
    assert.deepEqual(m.a, { hidden: true, order: 2, label: "A!", icon: "🎯", color: "green", overrides: { funnelStage: "y" } });
    assert.equal("b" in m, false, "an override that normalises to empty is dropped");
    assert.equal("c" in m, false);
  });
  it("returns {} for non-objects", () => {
    assert.deepEqual(normalizeScenarioOverrides(null), {});
    assert.deepEqual(normalizeScenarioOverrides([1, 2]), {});
  });
});

describe("applyPresetOverrides", () => {
  it("hides, relabels, reorders and deep-merges simulated signals", () => {
    const ov = normalizeScenarioOverrides({
      b: { hidden: true },
      c: { order: -1, label: "C-first" },
      a: { overrides: { intent: "high" } },
    });
    const { presets, overridden } = applyPresetOverrides(ov, BASE);
    assert.deepEqual(presets.map((p) => p.key), ["c", "a"], "b hidden; c reordered before a");
    assert.equal(presets[0].label, "C-first");
    // 'a' keeps its default funnelStage and gains the tenant tweak (deep-merge).
    const a = presets.find((p) => p.key === "a")!;
    assert.deepEqual(a.overrides, { funnelStage: "x", intent: "high" });
    assert.deepEqual([...overridden].sort(), ["a", "b", "c"]);
  });

  it("fails open to the full list when every built-in is hidden", () => {
    const ov = normalizeScenarioOverrides({ a: { hidden: true }, b: { hidden: true }, c: { hidden: true } });
    const { presets } = applyPresetOverrides(ov, BASE);
    assert.equal(presets.length, 3, "never render an empty section");
  });

  it("no overrides → identity", () => {
    const { presets, overridden } = applyPresetOverrides({}, BASE);
    assert.deepEqual(presets.map((p) => p.key), ["a", "b", "c"]);
    assert.equal(overridden.size, 0);
  });
});

describe("foldPanelIntoOverrides — back-compat for scenarioPanel", () => {
  const keys = { preset: ["a", "b", "c"], role: [] as string[] };

  it("an allowlist hides the built-ins not on it", () => {
    const folded = foldPanelIntoOverrides({}, { presetKeys: ["c", "a"] }, keys);
    const { presets } = applyPresetOverrides(folded, BASE);
    assert.deepEqual(presets.map((p) => p.key), ["c", "a"], "b hidden; allowlist order preserved");
  });

  it("an explicit override wins over the folded allowlist", () => {
    const explicit = normalizeScenarioOverrides({ b: { label: "kept" } });
    const folded = foldPanelIntoOverrides(explicit, { presetKeys: ["a"] }, keys);
    const { presets } = applyPresetOverrides(folded, BASE);
    assert.ok(presets.some((p) => p.key === "b"), "b has an explicit override → not auto-hidden");
  });

  it("empty/absent allowlist leaves everything visible", () => {
    const folded = foldPanelIntoOverrides({}, { presetKeys: [] }, keys);
    assert.equal(applyPresetOverrides(folded, BASE).presets.length, 3);
    assert.equal(applyPresetOverrides(foldPanelIntoOverrides({}, null, keys), BASE).presets.length, 3);
  });
});

describe("applyRoleOverrides", () => {
  const ROLES = [
    { key: "demo_role_marketeer", label: "Marketer", icon: "📣" },
    { key: "demo_role_bureau", label: "Agency owner", icon: "🏢" },
  ];
  it("hides + relabels roles, fail-open", () => {
    const ov = normalizeScenarioOverrides({ demo_role_bureau: { hidden: true }, demo_role_marketeer: { label: "Marketeer NL" } });
    const { roles } = applyRoleOverrides(ov, ROLES);
    assert.deepEqual(roles.map((r) => r.key), ["demo_role_marketeer"]);
    assert.equal(roles[0].label, "Marketeer NL");
  });
});

describe("effectivePresetOverrides — role simulated-signal tweak", () => {
  it("deep-merges the tenant tweak over the real built-in preset overrides", () => {
    const ov = normalizeScenarioOverrides({ demo_role_marketeer: { overrides: { intent: "very-high" } } });
    const eff = effectivePresetOverrides("demo_role_marketeer", ov);
    assert.ok(eff, "demo_role_marketeer is a real built-in preset key");
    assert.equal((eff as Record<string, unknown>).intent, "very-high");
  });
  it("null for an unknown key", () => {
    assert.equal(effectivePresetOverrides("nope_not_a_key", {}), null);
  });
});
