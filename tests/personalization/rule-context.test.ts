/**
 * Rule-Context Unit Tests — "regels die context schrijven"
 *
 * Targeted coverage for the new primitives:
 *   1. Overlay-override resolver (resolveFieldValue) — valid override wins;
 *      a type-invalid override falls back to the normal derivation.
 *   2. Flag matcher (evaluateCondition on a FlagCondition) — equals / exists.
 *   3. Monotone write-once persistence (mergeStickyWrites) across two views,
 *      plus the engine's 2-phase applyContextWrites path.
 *   4. setContext + FlagCondition validation (validateStoredConfig).
 *   5. Bot exclusion — clear UA bots out of SERVING (forceDefaultPlan /
 *      isBotUserAgent); cloud-provider IPs only out of MEASUREMENT (detectIsBot).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { resolveFieldValue, FIELD_REGISTRY } from "@/decision/rules/field-registry";
import type { RuleEvaluationContext }        from "@/decision/rules/field-registry";
import { evaluateCondition, validateStoredConfig } from "@/decision/rules/stored-rule";
import type { StoredRulesConfig }            from "@/decision/rules/stored-rule";
import { mergeStickyWrites }                 from "@/lib/journey/persist-rule-context";
import { isBotUserAgent, detectIsBot }       from "@/decision/context/detect-bot";
import { RulesDecisionProvider }             from "@/decision/providers/rules-decision-provider";
import { buildJourney, buildInput, RULES_CONFIG } from "./_fixtures";

// Build a minimal RuleEvaluationContext for resolver/flag tests.
function ctxWith(fields: Partial<RuleEvaluationContext>): RuleEvaluationContext {
  return fields as unknown as RuleEvaluationContext;
}

// ── 1. Overlay-override resolver ────────────────────────────────────────────────

describe("rule-context — overlay-override resolver", () => {
  const def = FIELD_REGISTRY.funnelStage; // categorical: awareness/consideration/intent/decision

  it("a valid override wins over the normal derivation", () => {
    const ctx = ctxWith({
      derived:     { funnelStage: "awareness" } as RuleEvaluationContext["derived"],
      ruleContext: { funnelStage: "decision" },
    });
    assert.strictEqual(resolveFieldValue("funnelStage", def, ctx), "decision");
  });

  it("a type-invalid override (boolean on categorical) falls back to derivation", () => {
    const ctx = ctxWith({
      derived:     { funnelStage: "awareness" } as RuleEvaluationContext["derived"],
      ruleContext: { funnelStage: true }, // wrong kind
    });
    assert.strictEqual(resolveFieldValue("funnelStage", def, ctx), "awareness");
  });

  it("an out-of-allowedValues override falls back to derivation", () => {
    const ctx = ctxWith({
      derived:     { funnelStage: "awareness" } as RuleEvaluationContext["derived"],
      ruleContext: { funnelStage: "banana" }, // not an allowed value
    });
    assert.strictEqual(resolveFieldValue("funnelStage", def, ctx), "awareness");
  });

  it("no overlay → normal derivation", () => {
    const ctx = ctxWith({
      derived:     { funnelStage: "intent" } as RuleEvaluationContext["derived"],
      ruleContext: null,
    });
    assert.strictEqual(resolveFieldValue("funnelStage", def, ctx), "intent");
  });
});

// ── 2. Flag matcher ─────────────────────────────────────────────────────────────

describe("rule-context — flag matcher", () => {
  it("equals matches a written flag", () => {
    const ctx = ctxWith({ ruleContext: { gericht_binnengekomen: true } });
    assert.strictEqual(
      evaluateCondition({ type: "flag", name: "gericht_binnengekomen", operator: "equals", value: true }, ctx),
      true,
    );
    assert.strictEqual(
      evaluateCondition({ type: "flag", name: "gericht_binnengekomen", operator: "equals", value: false }, ctx),
      false,
    );
  });

  it("exists / not_exists test flag presence", () => {
    const present = ctxWith({ ruleContext: { hoge_intentie: true } });
    const absent  = ctxWith({ ruleContext: {} });
    assert.strictEqual(evaluateCondition({ type: "flag", name: "hoge_intentie", operator: "exists" }, present), true);
    assert.strictEqual(evaluateCondition({ type: "flag", name: "hoge_intentie", operator: "not_exists" }, present), false);
    assert.strictEqual(evaluateCondition({ type: "flag", name: "hoge_intentie", operator: "exists" }, absent), false);
    assert.strictEqual(evaluateCondition({ type: "flag", name: "hoge_intentie", operator: "not_exists" }, absent), true);
  });

  it("absent overlay reads as not present", () => {
    const ctx = ctxWith({ ruleContext: null });
    assert.strictEqual(evaluateCondition({ type: "flag", name: "whatever", operator: "not_exists" }, ctx), true);
    assert.strictEqual(evaluateCondition({ type: "flag", name: "whatever", operator: "equals", value: true }, ctx), false);
  });
});

// ── 3. Monotone write-once persistence ──────────────────────────────────────────

describe("rule-context — monotone write-once (mergeStickyWrites)", () => {
  it("a monotone write latches: a later view cannot overwrite it", () => {
    // View 1 — nothing persisted yet.
    const v1 = mergeStickyWrites({}, [{ key: "gericht_binnengekomen", value: true, monotone: true }]);
    assert.deepStrictEqual(v1, { gericht_binnengekomen: true });

    // View 2 — entry conditions gone; a monotone rewrite to false must NOT downgrade.
    const v2 = mergeStickyWrites(v1, [{ key: "gericht_binnengekomen", value: false, monotone: true }]);
    assert.strictEqual(v2.gericht_binnengekomen, true);
  });

  it("a non-monotone sticky write stays last-write-wins", () => {
    const v1 = mergeStickyWrites({}, [{ key: "funnelStage", value: "intent" }]);
    const v2 = mergeStickyWrites(v1, [{ key: "funnelStage", value: "decision" }]);
    assert.strictEqual(v2.funnelStage, "decision");
  });

  it("write-once also holds within a single batch", () => {
    const merged = mergeStickyWrites({}, [
      { key: "flag", value: true, monotone: true },
      { key: "flag", value: false, monotone: true }, // ignored — already set this batch
    ]);
    assert.strictEqual(merged.flag, true);
  });

  it("keys not in the batch are preserved", () => {
    const merged = mergeStickyWrites({ a: 1, b: "keep" }, [{ key: "a", value: 2 }]);
    assert.deepStrictEqual(merged, { a: 2, b: "keep" });
  });
});

describe("rule-context — engine 2-phase applyContextWrites", () => {
  const TAG_CONFIG = {
    rulesEnabled: true,
    defaultPlan: RULES_CONFIG.defaultPlan,
    rules: [
      {
        id:       "tag_entry",
        priority: 1,
        label:    "tag on entry",
        condition: { type: "field", field: "source", operator: "equals", value: "direct" },
        plan: {
          ...RULES_CONFIG.defaultPlan,
          setContext: [{ key: "gericht_binnengekomen", value: true, monotone: true }],
        },
        reason: "tag-only",
      },
    ],
  } as unknown as StoredRulesConfig;

  it("view 1 applies the write to the overlay and collects it as sticky", async () => {
    const provider = new RulesDecisionProvider(TAG_CONFIG);
    const input    = buildInput(buildJourney({})); // source defaults to "direct"
    await provider.getHomepagePlan(input);

    assert.strictEqual(provider.lastStickyContextWrites.length, 1);
    assert.strictEqual(provider.lastStickyContextWrites[0].key, "gericht_binnengekomen");
    // The overlay on the input was mutated so later rules in-pass would see it.
    assert.strictEqual(
      (input as unknown as RuleEvaluationContext).ruleContext?.gericht_binnengekomen,
      true,
    );
  });

  it("view 2 with the flag already set is a monotone no-op (no re-collection, no downgrade)", async () => {
    const provider = new RulesDecisionProvider(TAG_CONFIG);
    const input = buildInput(buildJourney({}));
    (input as unknown as RuleEvaluationContext).ruleContext = { gericht_binnengekomen: true };

    await provider.getHomepagePlan(input);

    assert.strictEqual(provider.lastStickyContextWrites.length, 0);
    assert.strictEqual(
      (input as unknown as RuleEvaluationContext).ruleContext?.gericht_binnengekomen,
      true,
    );
  });
});

// ── 4. setContext + FlagCondition validation ────────────────────────────────────

describe("rule-context — validation", () => {
  function errorsFor(config: unknown): string[] {
    return validateStoredConfig(config).map((e) => `${e.field}: ${e.message}`);
  }

  it("rejects an empty flag name", () => {
    const config = {
      schemaVersion: 1,
      rulesEnabled: true,
      defaultPlan: RULES_CONFIG.defaultPlan,
      rules: [
        {
          id: "bad_flag", priority: 1, label: "bad flag",
          condition: { type: "flag", name: "", operator: "equals", value: true },
          plan: RULES_CONFIG.defaultPlan,
          reason: "x",
        },
      ],
    };
    const errs = errorsFor(config);
    assert.ok(errs.some((e) => /condition\.name/.test(e)), `expected flag name error, got: ${errs.join(" | ")}`);
  });

  it("rejects an array operator on a flag (scalar-only)", () => {
    const config = {
      schemaVersion: 1,
      rulesEnabled: true,
      defaultPlan: RULES_CONFIG.defaultPlan,
      rules: [
        {
          id: "bad_flag_op", priority: 1, label: "bad flag op",
          condition: { type: "flag", name: "gericht_binnengekomen", operator: "in", value: ["a"] },
          plan: RULES_CONFIG.defaultPlan,
          reason: "x",
        },
      ],
    };
    const errs = errorsFor(config);
    assert.ok(errs.some((e) => /condition\.operator/.test(e)), `expected flag operator error, got: ${errs.join(" | ")}`);
  });

  it("rejects a non-scalar setContext value and a type-incompatible override", () => {
    const config = {
      schemaVersion: 1,
      rulesEnabled: true,
      defaultPlan: RULES_CONFIG.defaultPlan,
      rules: [
        {
          id: "bad_setctx", priority: 1, label: "bad setContext",
          condition: { type: "field", field: "source", operator: "equals", value: "direct" },
          plan: {
            ...RULES_CONFIG.defaultPlan,
            setContext: [
              { key: "" , value: true },                 // empty key
              { key: "own_flag", value: { x: 1 } },       // non-scalar value
              { key: "funnelStage", value: true },        // override categorical with boolean
              { key: "ok_flag", value: "yes", monotone: "nope" }, // bad monotone type
            ],
          },
          reason: "x",
        },
      ],
    };
    const errs = errorsFor(config);
    assert.ok(errs.some((e) => /setContext\[0\]\.key/.test(e)),   `empty key: ${errs.join(" | ")}`);
    assert.ok(errs.some((e) => /setContext\[1\]\.value/.test(e)), `non-scalar value: ${errs.join(" | ")}`);
    assert.ok(errs.some((e) => /setContext\[2\]\.value/.test(e)), `override mismatch: ${errs.join(" | ")}`);
    assert.ok(errs.some((e) => /setContext\[3\]\.monotone/.test(e)), `bad monotone: ${errs.join(" | ")}`);
  });

  it("accepts a valid tag-only rule with a monotone sticky write", () => {
    const config = {
      schemaVersion: 1,
      rulesEnabled: true,
      defaultPlan: RULES_CONFIG.defaultPlan,
      rules: [
        {
          id: "good_tag", priority: 1, label: "good tag",
          condition: { type: "flag", name: "gericht_binnengekomen", operator: "equals", value: true },
          plan: {
            ...RULES_CONFIG.defaultPlan,
            setContext: [{ key: "hoge_intentie", value: true, sticky: true, monotone: true }],
          },
          reason: "valid",
        },
      ],
    };
    // No errors that mention setContext or the flag condition.
    const errs = errorsFor(config).filter((e) => /setContext|condition\.(name|operator|value)/.test(e));
    assert.deepStrictEqual(errs, []);
  });
});

// ── 5. Bot exclusion — serving vs measurement ───────────────────────────────────

describe("rule-context — bot exclusion", () => {
  const CLEAN_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.0 Safari/537.36";
  const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

  it("isBotUserAgent flags crawler UAs and clears real browsers / absent UA", () => {
    assert.strictEqual(isBotUserAgent(BOT_UA), true);
    assert.strictEqual(isBotUserAgent(CLEAN_UA), false);
    assert.strictEqual(isBotUserAgent(null), false);
    assert.strictEqual(isBotUserAgent("python-requests/2.31"), true);
  });

  it("cloud-provider IP counts only for MEASUREMENT, never for serving", () => {
    // Serving signal (UA only) ignores the cloud flag.
    assert.strictEqual(isBotUserAgent(CLEAN_UA), false);
    // Measurement signal (UA OR cloud) catches the datacenter visitor.
    assert.strictEqual(detectIsBot(CLEAN_UA, true), true);
    assert.strictEqual(detectIsBot(CLEAN_UA, false), false);
    // A clear UA bot is caught by both.
    assert.strictEqual(detectIsBot(BOT_UA, false), true);
  });

  it("forceDefaultPlan (the flag the pipeline sets from isBotUserAgent) serves the default", async () => {
    // A LinkedIn visitor would normally match homepage.linkedin.
    const input = buildInput(buildJourney({}), { source: "linkedin", utmSource: "linkedin" });

    const normal = new RulesDecisionProvider(RULES_CONFIG);
    const normalPlan = await normal.getHomepagePlan(input);
    assert.strictEqual(normalPlan.heroKey, "hero_linkedin_vision"); // personalized

    const botServed = new RulesDecisionProvider(RULES_CONFIG, /* forceDefaultPlan */ true);
    const botPlan   = await botServed.getHomepagePlan(input);
    assert.strictEqual(botPlan.heroKey, RULES_CONFIG.defaultPlan.heroKey); // default
    assert.strictEqual(botServed.lastMatchedRuleInfo, null);               // no rule fired
  });
});
