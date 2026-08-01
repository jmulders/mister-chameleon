/**
 * Unit tests for the pure form-overlay resolution logic (applyFormOverlay).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { applyFormOverlay } from "../../forms/context/resolve.ts";
import type { FormField } from "../../forms/types.ts";

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

  it("passes through a safe relative redirect path", () => {
    assert.equal(applyFormOverlay(base, "s", { redirectPath: "/thanks" }).redirectPath, "/thanks");
  });

  it("drops unsafe redirect paths (open-redirect guard)", () => {
    assert.equal(applyFormOverlay(base, "s", { redirectPath: "//evil.com" }).redirectPath, undefined);
    assert.equal(applyFormOverlay(base, "s", { redirectPath: "https://evil.com" }).redirectPath, undefined);
  });
});
