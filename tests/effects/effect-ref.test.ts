/**
 * Declarative block effects: three-tier resolution + SSR attribute emission.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveBlockEffects, effectsToAttrs, hasEffects,
  type EffectSet, type BlockEffectConfig,
} from "../../design-system/effects/effect-ref.ts";
import {
  EFFECT_DEFINITIONS, EFFECT_SCHEMA_VERSION, effectDefinition, isKnownEffect,
  effectGroup, isAdvancedEffect,
} from "../../design-system/effects/effect-defs.ts";

const SETS: EffectSet[] = [
  { id: "s1", key: "gentle", name: "Gentle", effects: [{ effect: "fade-in" }] },
];
const TENANT_DEFAULT: BlockEffectConfig[] = [{ effect: "reveal" }];

describe("effect registry", () => {
  it("has a stable version and unique ids with valid triggers", () => {
    assert.equal(EFFECT_SCHEMA_VERSION, 1);
    const ids = EFFECT_DEFINITIONS.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length, "ids must be unique");
    for (const d of EFFECT_DEFINITIONS) {
      assert.ok(["scroll", "hover", "load"].includes(d.trigger), `${d.id} trigger`);
      assert.ok(["entrance", "emphasis", "continuous"].includes(d.group), `${d.id} group`);
    }
    assert.ok(isKnownEffect("reveal"));
    assert.equal(isKnownEffect("nope"), false);
    assert.ok(effectDefinition("hover-lift"));
  });

  it("advanced effects are default-off + feature-detected + continuous", () => {
    for (const id of ["parallax", "sticky", "ken-burns"]) {
      const d = effectDefinition(id)!;
      assert.ok(d, `${id} registered`);
      assert.equal(d.defaultOff, true, `${id} default-off`);
      assert.equal(d.featureDetect, true, `${id} feature-detected`);
      assert.equal(d.group, "continuous", `${id} continuous`);
      assert.equal(isAdvancedEffect(id), true);
      assert.equal(effectGroup(id), "continuous");
    }
    // Entrance/emphasis effects are NOT default-off.
    assert.equal(isAdvancedEffect("reveal"), false);
    assert.equal(effectGroup("reveal"), "entrance");
    assert.equal(effectGroup("hover-lift"), "emphasis");
  });
});

describe("resolveBlockEffects (three tiers)", () => {
  it("inline wins over set and tenant default", () => {
    const r = resolveBlockEffects({ effectSet: "gentle", effects: [{ effect: "zoom-in" }] }, SETS, TENANT_DEFAULT);
    assert.deepEqual(r.map((e) => e.effect), ["zoom-in"]);
  });

  it("named set wins over tenant default when no inline", () => {
    const r = resolveBlockEffects({ effectSet: "gentle" }, SETS, TENANT_DEFAULT);
    assert.deepEqual(r.map((e) => e.effect), ["fade-in"]);
  });

  it("falls back to tenant default when the block has no ref", () => {
    const r = resolveBlockEffects(undefined, SETS, TENANT_DEFAULT);
    assert.deepEqual(r.map((e) => e.effect), ["reveal"]);
  });

  it("disabled turns everything off", () => {
    const r = resolveBlockEffects({ disabled: true, effects: [{ effect: "reveal" }] }, SETS, TENANT_DEFAULT);
    assert.deepEqual(r, []);
  });

  it("drops unknown ids and de-duplicates by effect id", () => {
    const r = resolveBlockEffects({ effects: [{ effect: "reveal" }, { effect: "nope" }, { effect: "reveal" }] }, null);
    assert.deepEqual(r.map((e) => e.effect), ["reveal"]);
  });

  it("hasEffects reflects resolution", () => {
    assert.equal(hasEffects({ effects: [{ effect: "reveal" }] }, null), true);
    assert.equal(hasEffects({ disabled: true }, null, TENANT_DEFAULT), false);
    assert.equal(hasEffects(undefined, null, null), false);
  });
});

describe("effectsToAttrs", () => {
  it("emits class hooks, versioned data attrs, and triggers", () => {
    const a = effectsToAttrs([{ effect: "reveal" }, { effect: "hover-lift" }])!;
    assert.ok(a.className.includes("mc-fx"));
    assert.ok(a.className.includes("mc-fx-reveal"));
    assert.ok(a.className.includes("mc-fx-hover-lift"));
    assert.equal(a.data["data-mc-fx"], "1");
    assert.equal(a.data["data-mc-fx-v"], String(EFFECT_SCHEMA_VERSION));
    assert.ok(a.data["data-mc-fx-trigger"].includes("scroll"));
    assert.ok(a.data["data-mc-fx-trigger"].includes("hover"));
  });

  it("fills param defaults and clamps overrides to the declared range", () => {
    const a = effectsToAttrs([{ effect: "reveal", params: { duration: 999999, distance: 40 } }])!;
    assert.equal(a.style["--mc-fx-distance"], "40px");
    assert.equal(a.style["--mc-fx-duration"], "2000ms"); // clamped to max
    assert.equal(a.style["--mc-fx-delay"], "0ms");        // default
  });

  it("emits data-mc-fx-ids and advanced params for continuous effects", () => {
    const a = effectsToAttrs([{ effect: "parallax", params: { speed: 0.4 } }, { effect: "ken-burns" }])!;
    assert.ok(a.className.includes("mc-fx-parallax"));
    assert.ok(a.className.includes("mc-fx-ken-burns"));
    assert.equal(a.data["data-mc-fx-ids"], "parallax ken-burns");
    assert.equal(a.style["--mc-fx-parallax-speed"], "0.4");
    assert.equal(a.style["--mc-fx-kb-scale"], "1.15");     // default
    assert.equal(a.style["--mc-fx-kb-duration"], "12000ms"); // default
  });

  it("ignores unknown params and returns null for no known effects", () => {
    const a = effectsToAttrs([{ effect: "fade-in", params: { bogus: 5 } }])!;
    assert.equal(a.style["bogus" as string], undefined);
    assert.equal(effectsToAttrs([{ effect: "nope" }]), null);
    assert.equal(effectsToAttrs([]), null);
  });
});
