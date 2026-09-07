/**
 * tests/ai/rule-suggester.test.ts
 *
 * The AI rule suggester proposes ONE rule as a DRAFT — it must only ever hand
 * back a VALID rule with a unique id and a non-colliding priority, and it must
 * REJECT (never inject) anything that references an unknown field or variant key.
 * validateStoredConfig rejects the whole config on a single bad rule / duplicate
 * priority, so a bad suggestion reaching the editor would break the operator's
 * entire config — these tests make that guarantee executable.
 */

import { test, describe } from "node:test";
import assert             from "node:assert/strict";

import {
  suggestRule,
  coerceAndValidateRule,
  safeBaseConfig,
  type RuleSuggestionContext,
} from "@/ai/rule-suggester";
import {
  SEED_RULES_CONFIG,
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";
import { analyzeRulesConfig } from "@/decision/rules/config-health";
import type { AiGenerateResult } from "@/ai/providers/base-provider";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BRIEF = { audience: "returning visitors from Google", goal: "push a demo" };

/** A well-formed suggestion the coercer/validator accepts. */
const GOOD = {
  condition: { type: "field", field: "source", operator: "equals", value: "google" },
  plan:      { heroKey: "hero_google_problem", proofKey: "proof_default", ctaKey: "cta_default" },
  label:     "Google visitors",
  reason:    "Fires for visitors arriving from Google search.",
};

const okGen = (obj: unknown) => async (): Promise<AiGenerateResult> => ({ ok: true, text: JSON.stringify(obj) });

function makeCtx(over: Partial<RuleSuggestionContext> = {}): RuleSuggestionContext {
  return {
    catalogue: {
      heroKeys:  [...ALLOWED_HERO_KEYS],
      proofKeys: [...ALLOWED_PROOF_KEYS],
      ctaKeys:   [...ALLOWED_CTA_KEYS],
    },
    extraKeys:  {},
    baseConfig: SEED_RULES_CONFIG,
    ...over,
  };
}

// ── (a) A valid suggestion validates + gets a non-colliding id/priority ───────

describe("coerceAndValidateRule — valid suggestion", () => {
  test("assigns a unique id and a non-colliding priority, preserving condition + plan", () => {
    const takenPriorities = [...SEED_RULES_CONFIG.rules.map((r) => r.priority), 9999];
    const ctx = makeCtx({ takenPriorities, takenIds: ["ai.dupe_test"] });

    const res = coerceAndValidateRule(GOOD, ctx);
    assert.ok(res.ok, "a well-formed suggestion validates");
    if (!res.ok) return;

    // Priority is appended above every taken priority — never a duplicate.
    assert.ok(res.rule.priority > 9999, "priority sits above all taken priorities");
    assert.ok(
      !takenPriorities.includes(res.rule.priority),
      "assigned priority does not collide",
    );

    // Id is unique and namespaced.
    assert.ok(res.rule.id.startsWith("ai."), "id is namespaced");
    assert.notEqual(res.rule.id, "ai.dupe_test");

    // Condition + plan survive unchanged; source is tenant; enabled.
    assert.deepEqual(res.rule.condition, GOOD.condition);
    assert.equal(res.rule.plan.heroKey, "hero_google_problem");
    assert.equal(res.rule.plan.proofKey, "proof_default");
    assert.equal(res.rule.plan.ctaKey, "cta_default");
    assert.equal(res.rule.source, "tenant");
    assert.equal(res.rule.enabled, true);
  });

  test("suggestRule returns the validated draft via an injected generate fn", async () => {
    const res = await suggestRule(BRIEF, makeCtx(), { generate: okGen(GOOD) });
    assert.ok(res.ok);
    assert.ok(res.ok && res.rule.label === "Google visitors");
  });
});

// ── (b) Unknown field / variant key is rejected, not injected ─────────────────

describe("coerceAndValidateRule — invalid suggestions are rejected", () => {
  test("unknown condition field → rejected", () => {
    const bad = { ...GOOD, condition: { type: "field", field: "not_a_field", operator: "equals", value: "x" } };
    const res = coerceAndValidateRule(bad, makeCtx());
    assert.equal(res.ok, false);
    assert.ok(!res.ok && /ongeldige regel/i.test(res.error));
  });

  test("unknown heroKey → rejected", () => {
    const bad = { ...GOOD, plan: { heroKey: "hero_nope", proofKey: "proof_default", ctaKey: "cta_default" } };
    const res = coerceAndValidateRule(bad, makeCtx());
    assert.equal(res.ok, false);
  });

  test("missing plan → rejected before validation", () => {
    const bad = { condition: GOOD.condition, label: "x", reason: "y" };
    const res = coerceAndValidateRule(bad, makeCtx());
    assert.equal(res.ok, false);
  });

  test("suggestRule (no retry) surfaces the rejection and never returns a rule", async () => {
    const bad = { ...GOOD, condition: { type: "field", field: "not_a_field", operator: "equals", value: "x" } };
    const res = await suggestRule(BRIEF, makeCtx(), { generate: okGen(bad) });
    assert.equal(res.ok, false);
  });
});

// ── (e) The config-health linter stays green on the proposed rule ─────────────

describe("config-health linter accepts the suggested rule", () => {
  test("no error-severity finding references the new rule after merge", () => {
    const res = coerceAndValidateRule(GOOD, makeCtx());
    assert.ok(res.ok);
    if (!res.ok) return;

    const merged = { ...SEED_RULES_CONFIG, rules: [...SEED_RULES_CONFIG.rules, res.rule] };
    const findings = analyzeRulesConfig(merged, {
      variantKeys: {
        hero:  [...ALLOWED_HERO_KEYS],
        proof: [...ALLOWED_PROOF_KEYS],
        cta:   [...ALLOWED_CTA_KEYS],
      },
    });

    const errorsForNew = findings.filter((f) => f.severity === "error" && f.ruleId === res.rule.id);
    assert.equal(errorsForNew.length, 0, "the proposed rule introduces no linter errors");
  });
});

// ── safeBaseConfig ────────────────────────────────────────────────────────────

describe("safeBaseConfig", () => {
  test("returns the loaded config when valid", () => {
    assert.equal(safeBaseConfig(SEED_RULES_CONFIG, {}), SEED_RULES_CONFIG);
  });
  test("falls back to seed when the loaded config is null", () => {
    assert.equal(safeBaseConfig(null, {}), SEED_RULES_CONFIG);
  });
});
