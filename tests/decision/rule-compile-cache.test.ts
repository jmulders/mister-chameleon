/**
 * Rule-compile cache — correctness + reuse.
 *
 *   (a) the decision is byte-for-byte identical whether the compiled rules came
 *       fresh or from the cache;
 *   (b) rules are compiled ONCE per config version, not per request;
 *   (c) a new config version (bumped updatedAt) invalidates cleanly and recompiles.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  RulesDecisionProvider,
  __getRuleCompileCount,
  __resetRuleCompileCache,
} from "../../decision/providers/rules-decision-provider.ts";
import { buildInput, buildJourney, RULES_CONFIG } from "../personalization/_fixtures.ts";

type Cfg = ConstructorParameters<typeof RulesDecisionProvider>[0];

function cfg(updatedAt: string, reason: string): Cfg {
  return {
    schemaVersion: 1,
    rulesEnabled:  true,
    updatedAt,
    defaultPlan:   RULES_CONFIG.defaultPlan,
    rules: [{
      id: "r", priority: 10, label: "direct",
      condition: { type: "field", field: "source", operator: "equals", value: "direct" },
      plan: { ...RULES_CONFIG.defaultPlan }, reason,
    }],
  } as unknown as Cfg;
}

const input = () => buildInput(buildJourney({}));

beforeEach(() => __resetRuleCompileCache());

describe("rule-compile cache", () => {
  it("(a) is byte-for-byte identical across a cache miss and hit", async () => {
    const c = cfg("2026-01-01T00:00:00Z", "WON");
    const first  = await new RulesDecisionProvider(c, false, "t1").getHomepagePlan(input());  // miss → compile
    const second = await new RulesDecisionProvider(c, false, "t1").getHomepagePlan(input());  // hit
    assert.deepEqual(second, first);
    assert.equal(first.reason, "WON");
  });

  it("(b) compiles once per config version, not per request", async () => {
    const c = cfg("2026-01-01T00:00:00Z", "WON");
    for (let i = 0; i < 5; i++) {
      await new RulesDecisionProvider(c, false, "t1").getHomepagePlan(input());
    }
    assert.equal(__getRuleCompileCount(), 1, "expected a single compile across 5 requests of one version");
  });

  it("(c) a bumped updatedAt invalidates and recompiles (and reflects the new config)", async () => {
    const v1 = cfg("2026-01-01T00:00:00Z", "V1");
    const v2 = cfg("2026-02-01T00:00:00Z", "V2");
    const p1 = await new RulesDecisionProvider(v1, false, "t1").getHomepagePlan(input());
    assert.equal(__getRuleCompileCount(), 1);
    const p2 = await new RulesDecisionProvider(v2, false, "t1").getHomepagePlan(input());
    assert.equal(__getRuleCompileCount(), 2, "new version must recompile");
    assert.equal(p1.reason, "V1");
    assert.equal(p2.reason, "V2");
    // The old version is still served from cache without recompiling.
    await new RulesDecisionProvider(v1, false, "t1").getHomepagePlan(input());
    assert.equal(__getRuleCompileCount(), 2);
  });

  it("different tenants with the same config each get their own cache entry", async () => {
    const c = cfg("2026-01-01T00:00:00Z", "WON");
    await new RulesDecisionProvider(c, false, "tenant-a").getHomepagePlan(input());
    await new RulesDecisionProvider(c, false, "tenant-b").getHomepagePlan(input());
    assert.equal(__getRuleCompileCount(), 2);
  });

  it("the returned default plan is a fresh object each call (mutation-safe)", async () => {
    // rulesEnabled:false forces the default-plan path.
    const c = {
      schemaVersion: 1, rulesEnabled: false, updatedAt: "2026-01-01T00:00:00Z",
      defaultPlan: RULES_CONFIG.defaultPlan, rules: [],
    } as unknown as Cfg;
    const a = await new RulesDecisionProvider(c, false, "t1").getHomepagePlan(input());
    a.reason = "MUTATED";
    const b = await new RulesDecisionProvider(c, false, "t1").getHomepagePlan(input());
    assert.notEqual(b.reason, "MUTATED");
  });
});
