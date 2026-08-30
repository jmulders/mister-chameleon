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

import { analyzeAndGenerateSlots, analyzeRegionsToSlots, attachRegionScenarios } from "@/demo/ai-slot-analyzer";
import type { AiSlotDefinition } from "@/demo/ai-slot-analyzer";

const sixScenarios = (p: string) => ({
  awareness: `${p}-a`, consideration: `${p}-c`, high_intent: `${p}-h`,
  form_dropout: `${p}-f`, customer: `${p}-cu`, expansion: `${p}-e`,
});
const aiSlot = (slotKey: string, matchText: string): AiSlotDefinition =>
  ({ slotKey, matchText, tag: "h1", scenarios: sixScenarios(slotKey) });

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

describe("analyzeRegionsToSlots — screenshot region variants", () => {
  it("returns a no_elements fallback (no AI call) when regions have no usable text", async () => {
    const result = await analyzeRegionsToSlots(
      [{ slotKey: "hero-title", originalText: "" }, { slotKey: "hero-cta", originalText: "hi" }],
      { url: "https://example.test", title: "Example", category: "general", description: "" },
    );
    assert.equal(result.aiRan, false);
    assert.equal(result.status, "no_elements");
    // The regions are echoed back with empty scenarios so the caller falls open.
    assert.equal(result.regions.length, 2);
    assert.deepEqual(result.regions[0].scenarios, {});
    assert.ok(result.model.length > 0);
  });
});

describe("attachRegionScenarios — the region↔slot join (the empty-variants bug)", () => {
  const regions = [
    { slotKey: "hero-title", originalText: "Just do it" },
    { slotKey: "hero-cta",   originalText: "Shop now" },
  ];

  it("attaches the 6 scenarios to each region when the AI reuses the slotKeys", () => {
    const { regions: out, matched } = attachRegionScenarios(regions, [
      aiSlot("hero-title", "Just do it"),
      aiSlot("hero-cta",   "Shop now"),
    ]);
    assert.equal(matched, 2);
    assert.equal(Object.keys(out[0].scenarios).length, 6, "hero-title got all 6 variants");
    assert.equal(out[0].scenarios.high_intent, "hero-title-h");
    assert.equal(out[1].scenarios.awareness, "hero-cta-a");
  });

  it("is case-insensitive on slotKey", () => {
    const { matched } = attachRegionScenarios(regions, [aiSlot("HERO-TITLE", "x"), aiSlot("Hero-CTA", "y")]);
    assert.equal(matched, 2);
  });

  it("falls back to original-text matching when slotKeys differ", () => {
    const { regions: out, matched } = attachRegionScenarios(regions, [
      aiSlot("headline", "Just do it"),   // different slotKey, same text
    ]);
    assert.equal(matched, 1);
    assert.equal(Object.keys(out[0].scenarios).length, 6);
    assert.deepEqual(out[1].scenarios, {}, "unmatched region keeps empty scenarios");
  });

  it("reports 0 matches when neither slotKey nor text lines up", () => {
    const { matched } = attachRegionScenarios(regions, [aiSlot("something-else", "totally different copy")]);
    assert.equal(matched, 0);
  });
});
