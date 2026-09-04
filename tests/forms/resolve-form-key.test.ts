/**
 * resolveFormKey: tolerate Statamic snake_case handles vs the code's kebab-case
 * FormKey registry, without false matches.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { resolveFormKey, getFormDefinition } from "../../forms/registry.ts";

describe("resolveFormKey", () => {
  it("exact match still works", () => {
    assert.equal(resolveFormKey("locatie-test"), "locatie-test");
    assert.equal(resolveFormKey("contact"), "contact");
  });
  it("snake_case (Statamic handle) resolves to the kebab-case key", () => {
    assert.equal(resolveFormKey("locatie_test"), "locatie-test");
  });
  it("case-insensitive + separator-agnostic", () => {
    assert.equal(resolveFormKey("Locatie_Test"), "locatie-test");
    assert.equal(resolveFormKey("  locatie_test  "), "locatie-test");
  });
  it("resolves to a real, fetchable definition", () => {
    const key = resolveFormKey("locatie_test")!;
    const def = getFormDefinition(key);
    assert.equal(def?.key, "locatie-test");
    assert.ok(def?.fields.some((f) => f.key === "postcode"));
    assert.ok(def?.fields.some((f) => f.key === "huisnummer"));
  });
  it("unknown handle → undefined (no false matches)", () => {
    assert.equal(resolveFormKey("unknown_form"), undefined);
    assert.equal(resolveFormKey("locatie-test-extra"), undefined);
    assert.equal(resolveFormKey(""), undefined);
    assert.equal(resolveFormKey(null), undefined);
    assert.equal(resolveFormKey(undefined), undefined);
  });
});
