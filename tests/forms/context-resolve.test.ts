/**
 * Unit tests for the pure contextual-forms resolution logic.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { resolveFormSegment, ruleMatches, applyFormOverlay } from "../../forms/context/resolve.ts";
import type { FormContextRule } from "../../forms/context/types.ts";
import type { FormField } from "../../forms/types.ts";

const rule = (over: Partial<FormContextRule>): FormContextRule => ({
  id: "r", label: "r", segment: "s", priority: 100, conditions: {}, ...over,
});

describe("ruleMatches", () => {
  it("matches pathStartsWith case-insensitively", () => {
    assert.equal(ruleMatches({ pathStartsWith: "/Pricing" }, { path: "/pricing/pro" }), true);
    assert.equal(ruleMatches({ pathStartsWith: "/pricing" }, { path: "/about" }), false);
  });

  it("matches pathExact", () => {
    assert.equal(ruleMatches({ pathExact: "/contact" }, { path: "/contact" }), true);
    assert.equal(ruleMatches({ pathExact: "/contact" }, { path: "/contact/us" }), false);
  });

  it("matches utm params", () => {
    assert.equal(ruleMatches({ utmSource: "google" }, { query: { utm_source: "Google" } }), true);
    assert.equal(ruleMatches({ utmMedium: "cpc" }, { query: { utm_medium: "email" } }), false);
  });

  it("matches an arbitrary query key/value", () => {
    assert.equal(ruleMatches({ queryKey: "plan", queryValue: "pro" }, { query: { plan: "PRO" } }), true);
    assert.equal(ruleMatches({ queryKey: "plan", queryValue: "pro" }, { query: { plan: "lite" } }), false);
  });

  it("matches country", () => {
    assert.equal(ruleMatches({ country: "NL" }, { country: "nl" }), true);
    assert.equal(ruleMatches({ country: "NL" }, { country: "BE" }), false);
  });

  it("ANDs multiple conditions", () => {
    const c = { pathStartsWith: "/pricing", utmSource: "google" };
    assert.equal(ruleMatches(c, { path: "/pricing", query: { utm_source: "google" } }), true);
    assert.equal(ruleMatches(c, { path: "/pricing", query: { utm_source: "bing" } }), false);
  });

  it("empty conditions match anything", () => {
    assert.equal(ruleMatches({}, { path: "/whatever" }), true);
  });
});

describe("resolveFormSegment", () => {
  it("returns the first match by priority", () => {
    const rules = [
      rule({ id: "a", segment: "catchall", priority: 100, conditions: {} }),
      rule({ id: "b", segment: "paid", priority: 10, conditions: { utmMedium: "cpc" } }),
    ];
    assert.equal(resolveFormSegment(rules, { query: { utm_medium: "cpc" } }), "paid");
    assert.equal(resolveFormSegment(rules, { query: {} }), "catchall");
  });

  it("breaks priority ties on array order", () => {
    const rules = [
      rule({ id: "first", segment: "one", priority: 5, conditions: {} }),
      rule({ id: "second", segment: "two", priority: 5, conditions: {} }),
    ];
    assert.equal(resolveFormSegment(rules, {}), "one");
  });

  it("skips disabled rules", () => {
    const rules = [
      rule({ id: "a", segment: "off", priority: 1, conditions: {}, enabled: false }),
      rule({ id: "b", segment: "on", priority: 2, conditions: {} }),
    ];
    assert.equal(resolveFormSegment(rules, {}), "on");
  });

  it("returns null when nothing matches", () => {
    const rules = [rule({ segment: "x", conditions: { country: "US" } })];
    assert.equal(resolveFormSegment(rules, { country: "NL" }), null);
  });
});

describe("applyFormOverlay", () => {
  const baseFields: FormField[] = [
    { key: "name", type: "text", label: "Name" },
    { key: "email", type: "email", label: "Email" },
  ];
  const base = { fields: baseFields };

  it("returns no copy overrides and base fields when overlay is undefined", () => {
    const r = applyFormOverlay(base, null, undefined);
    assert.equal(r.title, undefined);
    assert.equal(r.intro, undefined);
    assert.equal(r.fields.length, 2);
    assert.equal(r.segment, null);
  });

  it("overrides copy and fields when overlay present", () => {
    const r = applyFormOverlay(base, "paid", {
      title: "Book a demo", submitLabel: "Get my demo", successMessage: "We'll call you.",
      fields: [{ key: "email", type: "email", label: "Work email" }],
    });
    assert.equal(r.title, "Book a demo");
    assert.equal(r.submitLabel, "Get my demo");
    assert.equal(r.successMessage, "We'll call you.");
    assert.equal(r.fields.length, 1);
    assert.equal(r.fields[0].label, "Work email");
    assert.equal(r.segment, "paid");
  });

  it("keeps base fields when overlay.fields is empty", () => {
    const r = applyFormOverlay(base, "x", { title: "T", fields: [] });
    assert.equal(r.fields.length, 2);
    assert.equal(r.title, "T");
  });
});
