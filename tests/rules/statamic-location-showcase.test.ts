/**
 * Statamic location-showcase rules: prove they validate, are config-health clean
 * (unique priorities, known fields, no dead variants), and FIRE on their signals
 * (and only then). Pure — no DB.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  validateStoredConfig, evaluateCondition,
  type StoredRulesConfig, type StoredDefaultPlan,
} from "../../decision/rules/stored-rule.ts";
import { analyzeRulesConfig } from "../../decision/rules/config-health.ts";
import { STATAMIC_LOCATION_SHOWCASE_RULES } from "../../decision/rules/showcase/statamic-location-rules.ts";
import type { RuleEvaluationContext } from "../../decision/rules/field-registry.ts";
import type { EnrichmentOutput } from "../../enrichment/types.ts";

const defaultPlan: StoredDefaultPlan = {
  heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", reason: "fallback",
};
const config: StoredRulesConfig = {
  schemaVersion: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  rules: [...STATAMIC_LOCATION_SHOWCASE_RULES],
  defaultPlan,
};

const ctx = (enrichment: Partial<EnrichmentOutput>): RuleEvaluationContext =>
  ({ enrichment } as RuleEvaluationContext);

describe("statamic location-showcase rules — config", () => {
  it("passes validateStoredConfig (known fields + allowed variant keys)", () => {
    assert.deepEqual(validateStoredConfig(config), []);
  });
  it("is config-health clean (no error-severity findings)", () => {
    const errors = analyzeRulesConfig(config).filter((f) => f.severity === "error");
    assert.deepEqual(errors, [], `unexpected: ${JSON.stringify(errors)}`);
  });
  it("has unique priorities", () => {
    const prios = STATAMIC_LOCATION_SHOWCASE_RULES.map((r) => r.priority);
    assert.equal(new Set(prios).size, prios.length);
  });
});

describe("statamic location-showcase rules — firing", () => {
  const byId = Object.fromEntries(STATAMIC_LOCATION_SHOWCASE_RULES.map((r) => [r.id, r]));

  it("verduurzaming-B2B fires on office + high gas, and on office + low solar; not otherwise", () => {
    const c = byId["loc_showcase_verduurzaming_b2b"]!.condition;
    assert.equal(evaluateCondition(c, ctx({ locationBuildingUse: "kantoorfunctie", locationAvgGasUsage: 2800 })), true);
    assert.equal(evaluateCondition(c, ctx({ locationBuildingUse: "kantoorfunctie", locationSolarPct: 3 })), true);
    assert.equal(evaluateCondition(c, ctx({ locationBuildingUse: "woonfunctie", locationAvgGasUsage: 2800 })), false); // not an office
    assert.equal(evaluateCondition(c, ctx({ locationBuildingUse: "kantoorfunctie", locationAvgGasUsage: 500, locationSolarPct: 40 })), false); // office but efficient
  });
  it("business-services fires only on that sector", () => {
    const c = byId["loc_showcase_business_services"]!.condition;
    assert.equal(evaluateCondition(c, ctx({ locationDominantBusinessSector: "business_services" })), true);
    assert.equal(evaluateCondition(c, ctx({ locationDominantBusinessSector: "agriculture" })), false);
    assert.equal(evaluateCondition(c, ctx({})), false);
  });
  it("affluent fires on high income band OR high WOZ", () => {
    const c = byId["loc_showcase_affluent"]!.condition;
    assert.equal(evaluateCondition(c, ctx({ locationIncomeBand: "high" })), true);
    assert.equal(evaluateCondition(c, ctx({ locationAvgWozValue: 620000 })), true);
    assert.equal(evaluateCondition(c, ctx({ locationIncomeBand: "mid", locationAvgWozValue: 250000 })), false);
  });
  it("solar-rich fires above the threshold only", () => {
    const c = byId["loc_showcase_solar_rich"]!.condition;
    assert.equal(evaluateCondition(c, ctx({ locationSolarPct: 42 })), true);
    assert.equal(evaluateCondition(c, ctx({ locationSolarPct: 10 })), false);
  });
});
