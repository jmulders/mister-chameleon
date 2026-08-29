/**
 * analyzeAndGenerateSlots — visible fallback status
 *
 * The AI slot analyzer used to return a bare AiSlotDefinition[], so a fallback
 * (bad model, no key, unparseable response) was indistinguishable from "AI ran,
 * 0 slots" and surfaced only as a mysterious "1 slot". It now returns a
 * SlotAnalysisResult that says whether the AI ran, why it didn't, and which
 * model was used.
 *
 * This test pins the no-AI-call branch (empty HTML → no candidate elements),
 * which is deterministic and needs no network/API key.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { analyzeAndGenerateSlots } from "@/demo/ai-slot-analyzer";

describe("analyzeAndGenerateSlots — visible status", () => {

  it("returns a no_elements fallback (no AI call) for element-less HTML", async () => {
    const result = await analyzeAndGenerateSlots("<html><body></body></html>", {
      url:         "https://example.test",
      title:       "Example",
      category:    "general",
      description: "",
    });

    assert.equal(result.aiRan, false, "AI must not be marked as run");
    assert.equal(result.status, "no_elements");
    assert.deepEqual(result.slots, []);
    assert.equal(typeof result.model, "string");
    assert.ok(result.model.length > 0, "a model id is always reported");
  });
});
