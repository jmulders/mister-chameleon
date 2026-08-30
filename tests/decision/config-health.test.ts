/**
 * Config-health analyzer (D7 spoor 1) — one case per check. Pure: field/operator
 * knowledge, variant catalogue and fire stats are all injected, so the test does
 * not depend on the real registry contents.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { analyzeRulesConfig, summarizeFindings, type ConfigHealthInput } from "../../decision/rules/config-health.ts";
import type { StoredRulesConfig, StoredRule } from "../../decision/rules/stored-rule.ts";

const plan = (hero = "hero_a", proof = "proof_a", cta = "cta_a") =>
  ({ heroKey: hero, proofKey: proof, ctaKey: cta }) as StoredRule["plan"];

const rule = (o: Partial<StoredRule>): StoredRule => ({
  id: "r", priority: 10, label: "R", condition: { type: "group", logic: "and", conditions: [] } as StoredRule["condition"],
  plan: plan(), reason: "", ...o,
});

const cfg = (rules: StoredRule[], defaultPlan = plan()): StoredRulesConfig => ({
  schemaVersion: 1, updatedAt: "2026-01-01", rules, defaultPlan: defaultPlan as StoredRulesConfig["defaultPlan"],
});

// Injected knowledge — decouples the test from the real registry.
const INPUT: ConfigHealthInput = {
  fieldKeys:    new Set(["source", "intentScore"]),
  operatorsFor: (f) => (f === "intentScore" ? ["equals", "gt", "lt"] : ["equals", "in", "not_in"]),
  variantKeys:  { hero: ["hero_a", "hero_dead"], proof: ["proof_a"], cta: ["cta_a"] },
};

const fieldCond = (field: string, operator?: string, value?: unknown) =>
  ({ type: "field", field, ...(operator ? { operator } : {}), ...(value !== undefined ? { value } : {}) }) as StoredRule["condition"];

describe("analyzeRulesConfig", () => {
  it("duplicate-priority → error for each rule sharing the priority", () => {
    const f = analyzeRulesConfig(cfg([rule({ id: "a", priority: 5 }), rule({ id: "b", priority: 5 })]), INPUT)
      .filter((x) => x.code === "duplicate-priority");
    assert.equal(f.length, 2);
    assert.equal(f[0].severity, "error");
  });

  it("unknown-field → error", () => {
    const f = analyzeRulesConfig(cfg([rule({ id: "a", condition: fieldCond("nope_field", "equals", "x") })]), INPUT)
      .filter((x) => x.code === "unknown-field");
    assert.equal(f.length, 1);
    assert.equal(f[0].subject, "nope_field");
  });

  it("invalid-operator → error (operator not allowed for the field)", () => {
    const f = analyzeRulesConfig(cfg([rule({ id: "a", condition: fieldCond("intentScore", "contains", "x") })]), INPUT)
      .filter((x) => x.code === "invalid-operator");
    assert.equal(f.length, 1);
  });

  it("empty-value-set → warning (in with no values can never be true)", () => {
    const f = analyzeRulesConfig(cfg([rule({ id: "a", condition: fieldCond("source", "in", []) })]), INPUT)
      .filter((x) => x.code === "empty-value-set");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "warning");
  });

  it("dead-variant → warning for a catalogue key no plan references", () => {
    const f = analyzeRulesConfig(cfg([rule({ id: "a", plan: plan("hero_a") })]), INPUT)
      .filter((x) => x.code === "dead-variant");
    assert.deepEqual(f.map((x) => x.subject), ["hero_dead"]);
  });

  it("shadowed-rule → warning when a lower-priority rule has an identical condition", () => {
    const c = fieldCond("source", "equals", "google");
    const f = analyzeRulesConfig(cfg([
      rule({ id: "hi", priority: 5, condition: c }),
      rule({ id: "lo", priority: 9, condition: c }),
    ]), INPUT).filter((x) => x.code === "shadowed-rule");
    assert.equal(f.length, 1);
    assert.equal(f[0].ruleId, "lo");
  });

  it("always-true-shadow → warning for rules under an always-true (empty AND) rule", () => {
    const f = analyzeRulesConfig(cfg([
      rule({ id: "catchall", priority: 5, condition: { type: "group", logic: "and", conditions: [] } as StoredRule["condition"] }),
      rule({ id: "below", priority: 9, condition: fieldCond("source", "equals", "google") }),
    ]), INPUT).filter((x) => x.code === "always-true-shadow");
    assert.equal(f.length, 1);
    assert.equal(f[0].ruleId, "below");
  });

  it("never-fired → info when fire stats show a rule idle past the threshold", () => {
    const withStats: ConfigHealthInput = {
      ...INPUT,
      neverFiredDays: 30,
      fireStats: {
        a: { fired: false, daysSinceLastFire: null },   // never fired
        b: { fired: true,  daysSinceLastFire: 45 },      // idle > 30d
        c: { fired: true,  daysSinceLastFire: 3 },       // active → no finding
      },
    };
    const f = analyzeRulesConfig(cfg([
      rule({ id: "a", condition: fieldCond("source", "equals", "x") }),
      rule({ id: "b", priority: 11, condition: fieldCond("source", "equals", "y") }),
      rule({ id: "c", priority: 12, condition: fieldCond("source", "equals", "z") }),
    ]), withStats).filter((x) => x.code === "never-fired");
    assert.deepEqual(f.map((x) => x.ruleId).sort(), ["a", "b"]);
    assert.ok(f.every((x) => x.severity === "info"));
  });

  it("a clean config yields no findings; summarize counts by severity", () => {
    const clean = cfg([rule({ id: "a", condition: fieldCond("source", "equals", "google"), plan: plan("hero_a") })]);
    const input: ConfigHealthInput = { ...INPUT, variantKeys: { hero: ["hero_a"], proof: ["proof_a"], cta: ["cta_a"] } };
    const f = analyzeRulesConfig(clean, input);
    assert.deepEqual(summarizeFindings(f), { error: 0, warning: 0, info: 0 });
  });

  it("orders findings most-severe first", () => {
    const f = analyzeRulesConfig(cfg([
      rule({ id: "a", priority: 5, condition: fieldCond("nope", "equals", "x") }), // error
      rule({ id: "b", priority: 5, condition: fieldCond("source", "in", []) }),     // dup(error) + empty(warning)
    ]), INPUT);
    // first finding is an error, and no warning precedes an error
    const severities = f.map((x) => x.severity);
    assert.equal(severities[0], "error");
    assert.ok(severities.indexOf("warning") > severities.lastIndexOf("error"));
  });
});
