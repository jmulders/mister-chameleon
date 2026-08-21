/**
 * Context token substitution + catalogue tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  substituteContextTokens,
  buildVariableCatalogue,
} from "../../lib/blocks/substitute-context-tokens.ts";
import type { RuleEvaluationContext } from "../../decision/rules/field-registry.ts";

/** Minimal context: companyName/city resolve from enrichment; custom from customAttributes. */
function ctx(over: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    enrichment: { companyName: "Acme Corp", city: "Amsterdam" },
    customAttributes: { plan: "Enterprise" },
    ...over,
  } as unknown as RuleEvaluationContext;
}

describe("substituteContextTokens", () => {
  it("replaces a known built-in token with its value", () => {
    assert.equal(substituteContextTokens("Hi {companyName}!", ctx()), "Hi Acme Corp!");
    assert.equal(substituteContextTokens("in {city}", ctx()), "in Amsterdam");
  });

  it("replaces a custom-attribute token with its value", () => {
    assert.equal(substituteContextTokens("Plan: {plan}", ctx(), ["plan"]), "Plan: Enterprise");
  });

  it("uses the default when a known value is missing, else strips cleanly", () => {
    const c = ctx({ enrichment: {} } as Partial<RuleEvaluationContext>);
    assert.equal(substituteContextTokens("Hi {companyName|there}!", c), "Hi there!");
    // No default, missing value: strip the token (no raw brace on the live site).
    assert.equal(substituteContextTokens("Hi {companyName}!", c), "Hi !");
  });

  it("leaves unknown / hand-typed braces literal", () => {
    assert.equal(substituteContextTokens("keep {notAVariable} as is", ctx()), "keep {notAVariable} as is");
  });

  it("honors \\{ as a literal brace", () => {
    assert.equal(substituteContextTokens("a literal \\{ brace", ctx()), "a literal { brace");
    assert.equal(substituteContextTokens("\\{companyName}", ctx()), "{companyName}");
  });

  it("HTML-escaping is deferred, but markup characters in values are neutralized", () => {
    // A spoofed company name with markup/HTML characters.
    const spoof = ctx({ enrichment: { companyName: "A*b[c]\\d <x>" } } as Partial<RuleEvaluationContext>);
    const out = substituteContextTokens("{companyName}", spoof);
    // Markup-significant chars stripped; the < > & remain for the escape-first compiler to HTML-escape.
    assert.equal(out, "Abcd <x>");
  });

  it("returns empty string for nullish input", () => {
    assert.equal(substituteContextTokens(undefined, ctx()), "");
    assert.equal(substituteContextTokens(null, ctx()), "");
  });
});

describe("buildVariableCatalogue", () => {
  it("includes the built-in subset with labels and tags", () => {
    const cat = buildVariableCatalogue();
    const company = cat.find((e) => e.token === "companyName");
    assert.ok(company, "companyName should be in the catalogue");
    assert.equal(company!.source, "built-in");
    assert.ok(company!.label.length > 0);
    // All 11 built-ins present.
    assert.equal(cat.filter((e) => e.source === "built-in").length, 11);
  });

  it("merges string-typed custom attributes and drops non-string ones", () => {
    const cat = buildVariableCatalogue([
      { name: "plan", type: "string", label: "Plan tier" },
      { name: "score", type: "number" },
      { name: "flag", type: "boolean" },
    ] as never);
    const custom = cat.filter((e) => e.source === "custom");
    assert.deepEqual(custom.map((e) => e.token), ["plan"]);
    assert.equal(custom[0].label, "Plan tier");
  });
});
