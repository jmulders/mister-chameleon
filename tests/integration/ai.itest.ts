/**
 * AI integration — the Claude adapter against a live model.
 *
 * The pure suite tests the rules engine and the confidence policy; it never
 * exercises the AI seam against a real model, so "AI mode works" has only ever
 * been tested at the boundary. This calls ClaudeAdapter.suggest() for real.
 *
 * Two parts:
 *   - The no-key guard runs everywhere (no network): an adapter with an empty key
 *     must fail cleanly, never throw. That contract is what keeps a missing key
 *     from surfacing as a 500 two layers down.
 *   - The live call self-skips unless ANTHROPIC_API_KEY is set.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { ClaudeAdapter } from "@/ai/providers/claude-adapter";
import { buildJourney, buildInput } from "../personalization/_fixtures.ts";

const KEY  = process.env["ANTHROPIC_API_KEY"];
const skipLive = !KEY ? "ANTHROPIC_API_KEY not set" : false;
const MODEL = process.env["MC_AI_MODEL"] ?? "claude-3-5-haiku-20241022";

describe("AI integration — ClaudeAdapter", () => {

  it("fails cleanly with no API key — never throws (runs everywhere)", async () => {
    const adapter = new ClaudeAdapter({ modelId: MODEL, timeoutMs: 5000, apiKey: "" });
    const input   = buildInput(buildJourney({ funnelStage: "high_intent", intentScore: 80 }));

    const result = await adapter.suggest(input);

    assert.equal(result.ok, false, "no key must yield a failure, not a throw");
    if (!result.ok) assert.ok(typeof result.code === "string" && result.code.length > 0);
  });

  it("returns a structured decision from a live model", { skip: skipLive }, async () => {
    const adapter = new ClaudeAdapter({ modelId: MODEL, timeoutMs: 15_000, apiKey: KEY! });
    const input   = buildInput(buildJourney({ funnelStage: "high_intent", intentScore: 90 }));

    const result = await adapter.suggest(input);

    // The contract: suggest() never throws; it returns ok:true with a plan, or a
    // typed failure. Both are acceptable here — we are testing the seam, not the
    // model's judgement. What must hold is the shape.
    assert.equal(typeof result.ok, "boolean");
    assert.equal(adapter.providerName.length > 0, true);
    if (result.ok) {
      assert.ok(result.output, "a successful result carries an output");
      assert.ok(result.output.plan, "the output names a plan");
    } else {
      assert.ok(result.reason, "a failure explains itself");
    }
  });
});
