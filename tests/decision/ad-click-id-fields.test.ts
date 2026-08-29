/**
 * Ad-click IDs (gclid / fbclid / msclkid / ttclid) are registered as context /
 * rule variables: resolvable in FIELD_REGISTRY (for rule conditions) and present
 * in CONTEXT_VARIABLES (for the /demo context table). Pure registry wiring — the
 * values already live on the RuleEvaluationContext (VisitorContext).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FIELD_REGISTRY } from "../../decision/rules/field-registry.ts";
import type { RuleEvaluationContext } from "../../decision/rules/field-registry.ts";
import { CONTEXT_VARIABLE_MAP } from "../../context/registry.ts";

const CLICK_IDS = ["gclid", "fbclid", "msclkid", "ttclid"] as const;

describe("ad-click-id context/rule variables", () => {
  it("each is in FIELD_REGISTRY (traffic group) and resolves from the context", () => {
    const ctx = {
      gclid: "g-1", fbclid: "f-2", msclkid: "m-3", ttclid: "t-4",
    } as unknown as RuleEvaluationContext;

    for (const key of CLICK_IDS) {
      const def = FIELD_REGISTRY[key];
      assert.ok(def, `${key} missing from FIELD_REGISTRY`);
      assert.equal(def.group, "traffic");
      assert.ok(def.operators.includes("exists"), `${key} must support "exists" (gclid is set)`);
      assert.equal(def.resolve(ctx), ctx[key as keyof RuleEvaluationContext]);
    }
  });

  it("a missing click ID resolves to null (rendered as — in the demo table)", () => {
    const ctx = { gclid: null } as unknown as RuleEvaluationContext;
    assert.equal(FIELD_REGISTRY.gclid.resolve(ctx), null);
  });

  it("each is in CONTEXT_VARIABLES as a request-source string, rules yes / AI no", () => {
    for (const key of CLICK_IDS) {
      const v = CONTEXT_VARIABLE_MAP[key];
      assert.ok(v, `${key} missing from CONTEXT_VARIABLES`);
      assert.equal(v.source, "request");
      assert.equal(v.type, "string");
      assert.equal(v.availableToRules, true);
      assert.equal(v.availableToAI, false, `${key} is an opaque tracking token — not for AI`);
    }
  });
});
