/**
 * Applying a blueprint writes a rules config the engine accepts.
 *
 * It used to write one the engine rejected (a JSON string, no schemaVersion,
 * colliding priorities). A rejected config shows no error: the tenant silently
 * runs on the platform's built-in rules.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { ALL_BLUEPRINTS } from "../../blueprints/blueprint-registry.ts";
import { buildBlueprintRulesConfig } from "../../blueprints/build-rules-config.ts";
import { SEED_RULES_CONFIG, validateStoredConfig } from "../../decision/rules/stored-rule.ts";

const NOW = "2026-11-12T12:00:00.000Z";

describe("buildBlueprintRulesConfig", () => {
  it("there are blueprints to check", () => {
    assert.ok(ALL_BLUEPRINTS.length >= 5);
  });

  for (const blueprint of ALL_BLUEPRINTS) {
    it(`${blueprint.key}: valid on a tenant without a config`, () => {
      const r = buildBlueprintRulesConfig(null, blueprint, false, NOW);
      assert.deepEqual(r.errors, []);
      assert.equal(r.config.schemaVersion, 1);
      assert.equal(typeof r.config, "object");
      assert.equal(r.rulesCreated, blueprint.rules.length);
      assert.ok(r.config.defaultPlan.reason);
    });

    it(`${blueprint.key}: valid on top of existing rules, which are kept`, () => {
      const r = buildBlueprintRulesConfig(SEED_RULES_CONFIG, blueprint, false, NOW);
      assert.deepEqual(r.errors, []);
      for (const rule of SEED_RULES_CONFIG.rules) {
        assert.ok(r.config.rules.some((x) => x.id === rule.id && x.priority === rule.priority), `kept ${rule.id}`);
      }
      const priorities = r.config.rules.map((x) => x.priority);
      assert.equal(new Set(priorities).size, priorities.length, "no two rules share a priority");
    });
  }

  it("applying the same blueprint twice adds nothing the second time", () => {
    const blueprint = ALL_BLUEPRINTS[0];
    const first  = buildBlueprintRulesConfig(null, blueprint, false, NOW);
    const second = buildBlueprintRulesConfig(first.config, blueprint, false, NOW);
    assert.equal(second.rulesCreated, 0);
    assert.equal(second.rulesSkipped, blueprint.rules.length);
    assert.equal(second.config.rules.length, first.config.rules.length);
    assert.deepEqual(second.errors, []);
  });

  it("force replaces the existing rules with the blueprint's", () => {
    const blueprint = ALL_BLUEPRINTS[0];
    const r = buildBlueprintRulesConfig(SEED_RULES_CONFIG, blueprint, true, NOW);
    assert.equal(r.config.rules.length, blueprint.rules.length);
    assert.deepEqual(r.config.defaultPlan, SEED_RULES_CONFIG.defaultPlan);
    assert.deepEqual(r.errors, []);
  });

  it("the old way of writing it is what validation rejects", () => {
    const blueprint = ALL_BLUEPRINTS[0];
    const asString = JSON.stringify(buildBlueprintRulesConfig(null, blueprint, false, NOW).config);
    assert.ok(validateStoredConfig(asString, undefined, { allowUnknownVariantKeys: true }).length > 0);
  });
});

describe("unwrapStoredConfig", () => {
  it("returns an object as it is", async () => {
    const { unwrapStoredConfig } = await import("../../decision/rules/load-tenant-rules.ts");
    const obj = { schemaVersion: 1, rules: [] };
    assert.equal(unwrapStoredConfig(obj), obj);
  });

  it("reads a config that an older writer stored as a JSON string", async () => {
    const { unwrapStoredConfig } = await import("../../decision/rules/load-tenant-rules.ts");
    assert.deepEqual(unwrapStoredConfig(JSON.stringify({ schemaVersion: 1, rules: [] })), { schemaVersion: 1, rules: [] });
  });

  it("returns null for anything else", async () => {
    const { unwrapStoredConfig } = await import("../../decision/rules/load-tenant-rules.ts");
    for (const bad of ["not json", "[1,2]", "7", null, undefined, 7]) assert.equal(unwrapStoredConfig(bad), null);
  });
});
