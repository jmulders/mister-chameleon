/**
 * Copy-variable substitution + registry tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  substituteContextTokens,
  buildVariableCatalogue,
  defaultCopyVariables,
  effectiveCopyVariables,
} from "../../lib/blocks/substitute-context-tokens.ts";
import type { RuleEvaluationContext } from "../../decision/rules/field-registry.ts";
import type { CopyVariable } from "../../tenant/types.ts";

/** Minimal context: companyName/city resolve from enrichment; device is a machine value. */
function ctx(over: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    enrichment: { companyName: "Acme Corp", city: "Amsterdam" },
    device: "mobile",
    customAttributes: { plan: "enterprise", occasion: true },
    ...over,
  } as unknown as RuleEvaluationContext;
}

const REG_BUILTIN: CopyVariable[] = defaultCopyVariables();

describe("substituteContextTokens (registry-driven)", () => {
  it("replaces a known built-in token with its value", () => {
    assert.equal(substituteContextTokens("Hi {companyName}!", ctx(), REG_BUILTIN), "Hi Acme Corp!");
    assert.equal(substituteContextTokens("in {city}", ctx(), REG_BUILTIN), "in Amsterdam");
  });

  it("applies a value map (exact match) for a machine-value built-in", () => {
    const reg: CopyVariable[] = [
      { token: "device", label: "Device", source: { kind: "builtin", key: "device" }, valueMap: [{ from: "mobile", to: "mobiel" }, { from: "desktop", to: "desktop" }] },
    ];
    assert.equal(substituteContextTokens("Op je {device}", ctx(), reg), "Op je mobiel");
  });

  it("uses the * default when no exact map row matches", () => {
    const reg: CopyVariable[] = [
      { token: "device", label: "Device", source: { kind: "builtin", key: "device" }, valueMap: [{ from: "desktop", to: "desktop" }, { from: "*", to: "een apparaat" }] },
    ];
    assert.equal(substituteContextTokens("{device}", ctx(), reg), "een apparaat");
  });

  it("maps a custom attribute (coercing boolean) and falls back when empty", () => {
    const reg: CopyVariable[] = [
      { token: "occasion", label: "Occasion", source: { kind: "custom", name: "occasion" }, valueMap: [{ from: "true", to: "Ja" }, { from: "false", to: "Nee" }] },
      { token: "plan", label: "Plan", source: { kind: "custom", name: "plan" }, fallback: "onbekend" },
    ];
    assert.equal(substituteContextTokens("{occasion}", ctx(), reg), "Ja");
    // empty value uses the entry fallback
    const empty = ctx({ customAttributes: {} } as Partial<RuleEvaluationContext>);
    assert.equal(substituteContextTokens("{plan}", empty, reg), "onbekend");
  });

  it("prefers an inline {token|default} over the entry fallback, else strips", () => {
    const reg: CopyVariable[] = [
      { token: "companyName", label: "Company", source: { kind: "builtin", key: "companyName" }, fallback: "your company" },
    ];
    const empty = ctx({ enrichment: {} } as Partial<RuleEvaluationContext>);
    assert.equal(substituteContextTokens("Hi {companyName|there}!", empty, reg), "Hi there!");
    assert.equal(substituteContextTokens("Hi {companyName}!", empty, reg), "Hi your company!");
    const noFallback: CopyVariable[] = [{ token: "companyName", label: "C", source: { kind: "builtin", key: "companyName" } }];
    assert.equal(substituteContextTokens("Hi {companyName}!", empty, noFallback), "Hi !");
  });

  it("leaves unknown / hand-typed braces literal", () => {
    assert.equal(substituteContextTokens("keep {notAVariable} as is", ctx(), REG_BUILTIN), "keep {notAVariable} as is");
  });

  it("honors \\{ as a literal brace", () => {
    assert.equal(substituteContextTokens("a literal \\{ brace", ctx(), REG_BUILTIN), "a literal { brace");
  });

  it("neutralizes markup characters in resolved and mapped values", () => {
    const spoof = ctx({ enrichment: { companyName: "A*b[c]\\d <x>" } } as Partial<RuleEvaluationContext>);
    assert.equal(substituteContextTokens("{companyName}", spoof, REG_BUILTIN), "Abcd <x>");
    const reg: CopyVariable[] = [
      { token: "device", label: "D", source: { kind: "builtin", key: "device" }, valueMap: [{ from: "mobile", to: "mo*biel[!]" }] },
    ];
    assert.equal(substituteContextTokens("{device}", ctx(), reg), "mobiel!");
  });

  it("returns empty string for nullish input", () => {
    assert.equal(substituteContextTokens(undefined, ctx(), REG_BUILTIN), "");
    assert.equal(substituteContextTokens(null, ctx(), REG_BUILTIN), "");
  });
});

describe("registry defaults + catalogue", () => {
  it("default registry has the 11 built-ins and string custom attributes only", () => {
    const reg = defaultCopyVariables([
      { name: "plan", type: "string", label: "Plan tier" },
      { name: "score", type: "number" },
      { name: "flag", type: "boolean" },
    ] as never);
    assert.equal(reg.filter((v) => v.source.kind === "builtin").length, 11);
    const custom = reg.filter((v) => v.source.kind === "custom");
    assert.deepEqual(custom.map((v) => v.token), ["plan"]);
  });

  it("effectiveCopyVariables uses the managed registry when present, else the default", () => {
    const managed: CopyVariable[] = [{ token: "device", label: "Device", source: { kind: "builtin", key: "device" } }];
    assert.deepEqual(effectiveCopyVariables(managed, []), managed);
    assert.equal(effectiveCopyVariables([], []).length, 11);
    assert.equal(effectiveCopyVariables(undefined, []).length, 11);
  });

  it("buildVariableCatalogue tags each entry by source kind", () => {
    const cat = buildVariableCatalogue([
      { token: "companyName", label: "Company name", source: { kind: "builtin", key: "companyName" } },
      { token: "plan", label: "Plan", source: { kind: "custom", name: "plan" } },
    ]);
    assert.deepEqual(cat, [
      { token: "companyName", label: "Company name", source: "built-in" },
      { token: "plan", label: "Plan", source: "custom" },
    ]);
  });
});
