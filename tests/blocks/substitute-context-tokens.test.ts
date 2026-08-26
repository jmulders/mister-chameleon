/**
 * Copy-variable substitution + registry tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  substituteContextTokens,
  buildVariableCatalogue,
  variablesNeedingFallbackWarning,
  defaultCopyVariables,
  effectiveCopyVariables,
  BUILTIN_SOURCE_KEYS,
  SOURCE_DENYLIST,
} from "../../lib/blocks/substitute-context-tokens.ts";
import { FIELD_REGISTRY } from "../../decision/rules/field-registry.ts";
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
    // A bare strip now also tidies the dangling space before the punctuation.
    assert.equal(substituteContextTokens("Hi {companyName}!", empty, noFallback), "Hi!");
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

  // ── Conditional segments {?var}…{/var} ──────────────────────────────────────

  it("renders a {?var}…{/var} segment only when the variable is non-empty", () => {
    const empty = ctx({ enrichment: {} } as Partial<RuleEvaluationContext>);
    const s = "{?city}Nu ook beschikbaar in {city}{/city}";
    assert.equal(substituteContextTokens(s, ctx(), REG_BUILTIN), "Nu ook beschikbaar in Amsterdam");
    assert.equal(substituteContextTokens(s, empty, REG_BUILTIN), "");
  });

  it("drops the segment inside a sentence, keeping the rest", () => {
    const empty = ctx({ enrichment: {} } as Partial<RuleEvaluationContext>);
    const s = "Welkom{?city} in {city}{/city}!";
    assert.equal(substituteContextTokens(s, ctx(), REG_BUILTIN), "Welkom in Amsterdam!");
    assert.equal(substituteContextTokens(s, empty, REG_BUILTIN), "Welkom!");
  });

  it("a segment respects the value map (mapped-to-empty drops it)", () => {
    const reg: CopyVariable[] = [
      { token: "device", label: "D", source: { kind: "builtin", key: "device" }, valueMap: [{ from: "mobile", to: "" }] },
    ];
    assert.equal(substituteContextTokens("{?device}on {device}{/device}", ctx(), reg), "");
  });

  it("an unknown variable in a segment drops the segment", () => {
    assert.equal(substituteContextTokens("a{?nope}X{/nope}b", ctx(), REG_BUILTIN), "ab");
  });

  it("supports nested segments of different variables", () => {
    const reg: CopyVariable[] = [
      { token: "city", label: "City", source: { kind: "builtin", key: "city" } },
      { token: "companyName", label: "Co", source: { kind: "builtin", key: "companyName" } },
    ];
    const s = "{?companyName}{companyName}{?city} in {city}{/city}{/companyName}";
    assert.equal(substituteContextTokens(s, ctx(), reg), "Acme Corp in Amsterdam");
    const noCity = ctx({ enrichment: { companyName: "Acme Corp" } } as Partial<RuleEvaluationContext>);
    assert.equal(substituteContextTokens(s, noCity, reg), "Acme Corp");
  });

  it("keeps \\{?…} literal (escaped segment marker)", () => {
    assert.equal(substituteContextTokens("\\{?city}x{/city}", ctx(), REG_BUILTIN), "{?city}x{/city}");
  });

  // ── Whitespace cleanup around stripped bare tokens ──────────────────────────

  it("collapses the double space and dangling space a stripped bare token leaves", () => {
    const noFallback: CopyVariable[] = [{ token: "city", label: "C", source: { kind: "builtin", key: "city" } }];
    const empty = ctx({ enrichment: {} } as Partial<RuleEvaluationContext>);
    assert.equal(substituteContextTokens("Welkom {city} bezoeker", empty, noFallback), "Welkom bezoeker");
    assert.equal(substituteContextTokens("Klaar in {city}.", empty, noFallback), "Klaar in.");
  });

  it("does not disturb whitespace when the token resolves or when no token is involved", () => {
    const reg: CopyVariable[] = [{ token: "city", label: "C", source: { kind: "builtin", key: "city" } }];
    assert.equal(substituteContextTokens("Welkom {city} bezoeker", ctx(), reg), "Welkom Amsterdam bezoeker");
    assert.equal(substituteContextTokens("a  b", ctx(), reg), "a  b"); // author's double space preserved
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

  it("variablesNeedingFallbackWarning flags bare no-fallback tokens only", () => {
    const cat = buildVariableCatalogue([
      { token: "city", label: "City", source: { kind: "builtin", key: "city" } },                       // no fallback
      { token: "companyName", label: "Company", source: { kind: "builtin", key: "companyName" }, fallback: "your company" },
    ]);
    const warn = (s: string) => variablesNeedingFallbackWarning(s, cat).map((v) => v.token);
    assert.deepEqual(warn("Welkom in {city}!"), ["city"]);          // bare + no fallback → warn
    assert.deepEqual(warn("Welkom in {city|Amsterdam}!"), []);      // inline default → no warn
    assert.deepEqual(warn("Hi {companyName}"), []);                 // has a fallback → no warn
    assert.deepEqual(warn("No tokens here"), []);                    // not used → no warn
    assert.deepEqual(warn("literal \\{city}"), []);                 // escaped → no warn
    assert.deepEqual(warn(""), []);                                  // empty copy → no warn
  });

  it("buildVariableCatalogue tags each entry by source kind + fallback presence", () => {
    const cat = buildVariableCatalogue([
      { token: "companyName", label: "Company name", source: { kind: "builtin", key: "companyName" } },
      { token: "plan", label: "Plan", source: { kind: "custom", name: "plan" }, fallback: "your plan" },
      { token: "blank", label: "Blank", source: { kind: "custom", name: "blank" }, fallback: "  " },
    ]);
    assert.deepEqual(cat, [
      { token: "companyName", label: "Company name", source: "built-in", hasFallback: false },
      { token: "plan", label: "Plan", source: "custom", hasFallback: true },
      { token: "blank", label: "Blank", source: "custom", hasFallback: false }, // whitespace-only = no fallback
    ]);
  });
});

describe("BUILTIN_SOURCE_KEYS (scalar allowlist + denylist)", () => {
  const set = new Set(BUILTIN_SOURCE_KEYS);

  it("includes the broad scalar field set across kinds", () => {
    // Far more than the old 15 hand-picked keys.
    assert.ok(BUILTIN_SOURCE_KEYS.length > 100, `expected >100, got ${BUILTIN_SOURCE_KEYS.length}`);
    const expected = [
      "companyName",          // nullable_string
      "device", "source", "visitType", "contentInterestCategory", // categorical
      "countryCode", "leadinfoBranchCode", "primaryInterest",      // nullable_string
      "isReturningVisitor",   // boolean
      "gaSessionCount", "interestConfidence",                      // number
    ];
    for (const k of expected) assert.ok(set.has(k), `expected source to include "${k}"`);
  });

  it("excludes denylisted PII / opaque-id / collection fields", () => {
    const denied = ["latitude", "longitude", "audienceSegmentIds", "tenantId", "crmContactId", "leadinfoCocNumber", "templateKey"];
    for (const k of denied) {
      assert.ok(SOURCE_DENYLIST.has(k), `denylist should list "${k}"`);
      assert.ok(!set.has(k), `source must not include denylisted "${k}"`);
    }
  });

  it("only contains scalar-kind FIELD_REGISTRY fields", () => {
    const scalar = new Set(["categorical", "nullable_string", "number", "boolean"]);
    for (const k of BUILTIN_SOURCE_KEYS) {
      const def = FIELD_REGISTRY[k as keyof typeof FIELD_REGISTRY] as { kind?: string } | undefined;
      assert.ok(def, `"${k}" must exist in FIELD_REGISTRY`);
      assert.ok(scalar.has(def!.kind ?? ""), `"${k}" must have a scalar kind, got ${def!.kind}`);
    }
  });
});
