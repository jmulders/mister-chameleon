/**
 * Server-Scenario Utility Tests
 *
 * Tests the cookie-based scenario override utilities:
 *
 *   parseScenarioCookie()      — extracts and validates the mc_scenario cookie
 *                                value from a raw HTTP Cookie header string.
 *
 *   applyScenarioToHistory()   — merges ScenarioOverrides into a VisitorHistory,
 *                                producing a new effective history without
 *                                mutating the original.
 *
 * These utilities form the bridge between the client-side ScenarioControlPanel
 * and the server-side decision pipeline.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  parseScenarioCookie,
  applyScenarioToHistory,
} from "@/lib/scenario/server-scenario";
import { emptyHistory } from "@/context/visitor-history";
import { emptyJourneyState } from "@/lib/journey/types";

// ── parseScenarioCookie ───────────────────────────────────────────────────────

describe("parseScenarioCookie", () => {

  it("returns null for null input", () => {
    assert.strictEqual(parseScenarioCookie(null), null);
  });

  it("returns null for undefined input", () => {
    assert.strictEqual(parseScenarioCookie(undefined), null);
  });

  it("returns null for empty string", () => {
    assert.strictEqual(parseScenarioCookie(""), null);
  });

  it("returns null when mc_scenario cookie is absent", () => {
    assert.strictEqual(parseScenarioCookie("session=abc; theme=dark"), null);
  });

  it("parses a valid URI-encoded JSON cookie", () => {
    const overrides = { funnelStage: "high_intent", intentScore: 80 };
    const cookieVal = encodeURIComponent(JSON.stringify(overrides));
    const header    = `mc_scenario=${cookieVal}; session=abc`;
    const result    = parseScenarioCookie(header);
    assert.ok(result !== null, "should return overrides object");
    assert.strictEqual((result as Record<string, unknown>).funnelStage, "high_intent");
    assert.strictEqual((result as Record<string, unknown>).intentScore, 80);
  });

  it("parses mc_scenario when it is the only cookie", () => {
    const overrides = { confidenceBand: "very_high" };
    const cookieVal = encodeURIComponent(JSON.stringify(overrides));
    const result    = parseScenarioCookie(`mc_scenario=${cookieVal}`);
    assert.ok(result !== null);
    assert.strictEqual((result as Record<string, unknown>).confidenceBand, "very_high");
  });

  it("parses mc_scenario when it appears after other cookies", () => {
    const overrides = { frictionScore: 75 };
    const cookieVal = encodeURIComponent(JSON.stringify(overrides));
    const header    = `session=xyz; other=foo; mc_scenario=${cookieVal}`;
    const result    = parseScenarioCookie(header);
    assert.ok(result !== null);
    assert.strictEqual((result as Record<string, unknown>).frictionScore, 75);
  });

  it("returns null for malformed JSON", () => {
    const header = "mc_scenario=not-valid-json";
    assert.strictEqual(parseScenarioCookie(header), null);
  });

  it("returns null when cookie value is an array (not a plain object)", () => {
    const cookieVal = encodeURIComponent(JSON.stringify(["a", "b"]));
    assert.strictEqual(parseScenarioCookie(`mc_scenario=${cookieVal}`), null);
  });

  it("returns null when cookie value is a primitive", () => {
    const cookieVal = encodeURIComponent(JSON.stringify("just-a-string"));
    assert.strictEqual(parseScenarioCookie(`mc_scenario=${cookieVal}`), null);
  });

  it("returns null for an empty object (no active overrides)", () => {
    const cookieVal = encodeURIComponent(JSON.stringify({}));
    assert.strictEqual(parseScenarioCookie(`mc_scenario=${cookieVal}`), null);
  });

  it("handles malformed URI encoding gracefully (returns null)", () => {
    // Deliberately corrupt the percent-encoding
    const header = "mc_scenario=%GG%invalid";
    assert.strictEqual(parseScenarioCookie(header), null);
  });
});

// ── applyScenarioToHistory ────────────────────────────────────────────────────

describe("applyScenarioToHistory", () => {

  it("does not mutate the original history", () => {
    const original = { ...emptyHistory(), pageViewCount: 3 };
    applyScenarioToHistory(original, { pageViewCount: 99 });
    assert.strictEqual(original.pageViewCount, 3, "original must not be mutated");
  });

  it("overrides pageViewCount when provided", () => {
    const history  = emptyHistory();
    const result   = applyScenarioToHistory(history, { pageViewCount: 7 });
    assert.strictEqual(result.pageViewCount, 7);
  });

  it("preserves original pageViewCount when override is absent", () => {
    const history  = { ...emptyHistory(), pageViewCount: 5 };
    const result   = applyScenarioToHistory(history, { funnelStage: "intent" } as Parameters<typeof applyScenarioToHistory>[1]);
    assert.strictEqual(result.pageViewCount, 5, "pageViewCount should pass through when not overridden");
  });

  it("overrides hasClickedCta when provided", () => {
    const history = emptyHistory();
    const result  = applyScenarioToHistory(history, { hasClickedCta: true });
    assert.strictEqual(result.hasClickedCta, true);
  });

  it("preserves original hasClickedCta when override is absent", () => {
    const history = { ...emptyHistory(), hasClickedCta: true };
    const result  = applyScenarioToHistory(history, { intentScore: 50 } as Parameters<typeof applyScenarioToHistory>[1]);
    assert.strictEqual(result.hasClickedCta, true);
  });

  it("overrides journey funnelStage via applyScenarioOverride", () => {
    const journey = emptyJourneyState();
    const history = { ...emptyHistory(), journey };
    const result  = applyScenarioToHistory(history, {
      funnelStage:  "high_intent",
      intentScore:  80,
    } as Parameters<typeof applyScenarioToHistory>[1]);
    assert.ok(result.journey !== null, "journey must be set");
    assert.strictEqual(result.journey!.funnelStage, "high_intent");
    assert.strictEqual(result.journey!.intentScore, 80);
  });

  it("sets an effective journey from overrides even when original journey is null", () => {
    // history.journey can be null for brand-new sessions
    const history = { ...emptyHistory(), journey: null };
    const result  = applyScenarioToHistory(history, {
      funnelStage: "consideration",
    } as Parameters<typeof applyScenarioToHistory>[1]);
    assert.ok(result.journey !== null, "effective journey must be created even from null");
    assert.strictEqual(result.journey!.funnelStage, "consideration");
  });

  it("reconstructs synthetic confidence from confidenceBand override", () => {
    const history = emptyHistory();
    const result  = applyScenarioToHistory(history, {
      confidenceBand:    "very_high",
      overallConfidence: 0.90,
    } as Parameters<typeof applyScenarioToHistory>[1]);
    assert.ok(result.journey !== null);
    assert.strictEqual(result.journey!.confidence.band, "very_high");
    assert.ok(result.journey!.confidence.overallConfidence >= 0.80,
      `expected >= 0.80, got ${result.journey!.confidence.overallConfidence}`);
  });

  it("round-trip: write overrides as cookie → parse → apply → correct journey state", () => {
    const overrides = {
      funnelStage:       "high_intent",
      intentScore:       78,
      confidenceBand:    "high",
      overallConfidence: 0.72,
      hasVisitedPricing: true,
      matchedSequences:  ["services_to_contact"],
    };

    // Simulate client writing cookie
    const cookieVal = encodeURIComponent(JSON.stringify(overrides));
    const header    = `mc_scenario=${cookieVal}; session=test`;

    // Server parses
    const parsed = parseScenarioCookie(header);
    assert.ok(parsed !== null, "cookie must parse successfully");

    // Server applies to history
    const history = emptyHistory();
    const result  = applyScenarioToHistory(history, parsed!);

    assert.ok(result.journey !== null);
    assert.strictEqual(result.journey!.funnelStage,       "high_intent");
    assert.strictEqual(result.journey!.intentScore,        78);
    assert.strictEqual(result.journey!.hasVisitedPricing,  true);
    assert.deepStrictEqual(result.journey!.matchedSequences, ["services_to_contact"]);
    assert.strictEqual(result.journey!.confidence.band,    "high");
  });
});
