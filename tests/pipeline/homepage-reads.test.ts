/**
 * The homepage pipeline makes its database reads in as few steps as it can.
 *
 * Measured on production on 16 Nov 2026: one homepage request made about twenty
 * Supabase requests in nine steps one after another, and the content of the
 * page waited for all of them. See docs/performance/. These tests hold the
 * steps that were taken out. They read the source, because the pipeline itself
 * needs a request, a tenant and a database to run.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

const pipeline = readFileSync("lib/pipeline/homepage-pipeline.ts", "utf8");
const code     = pipeline.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const at       = (needle: string) => {
  const i = code.indexOf(needle);
  assert.ok(i >= 0, `not found in the pipeline: ${needle}`);
  return i;
};

describe("homepage pipeline: database reads", () => {
  it("loads the debug journey events only for the page that shows them", () => {
    // The homepage never read them. With the tenant's debug level on "full" it
    // paid one read per pageview.
    assert.match(code, /journeyDebugEvents = \(includeJourneyDebug && debugLevel === "full"\)/);
    assert.match(code, /includeJourneyDebug = false/, "the default must be off");
    assert.match(readFileSync("app/(site)/engine-debug/page.tsx", "utf8"), /runHomepagePipeline\(\{ params, includeJourneyDebug: true \}\)/);
    assert.match(readFileSync("app/(site)/page.tsx", "utf8"), /runHomepagePipeline\(\{ params \}\)/);
  });

  it("starts both reads of the stored profile with the other reads, not after them", () => {
    const kicks   = at("const historyPromise");
    const context = at("await buildDecisionContext(");
    for (const name of ["seedFirmographicsPromise =", "returningSignalsPromise ="]) {
      const i = at(name);
      assert.ok(i > kicks && i < context, `${name} must start with the parallel reads`);
    }
    // One wait for the two of them, where their results are first needed.
    assert.match(code, /\[seedFirmographics, returningSignals\] = await Promise\.all\(\[\s*seedFirmographicsPromise,\s*returningSignalsPromise,\s*\]\)/);
    assert.doesNotMatch(code, /await getReturningProfileSignals\(/);
    assert.doesNotMatch(code, /await getKnownFirmographics\(/);
  });

  it("does not look for a returning visitor without consent to recognise one", () => {
    // Without personalization consent the session id is a fresh anon_… id. No
    // stored profile can carry it, so the read could only come back empty.
    assert.match(code, /sessionId = consent\.personalization \? persistentSessionId : `anon_\$\{crypto\.randomUUID\(\)\}`/);
    assert.match(code, /returningSignalsPromise = \(consent\.personalization && sessionId\)\s*\? getReturningProfileSignals\(/);
    // Reusing firmographics stays behind enrichment consent, as it was.
    assert.match(code, /seedFirmographicsPromise = \(consent\.enrichment && sessionId\)\s*\? getKnownFirmographics\(/);
  });

  it("starts the adaptive blocks for the AI's candidates before the decision context is built", () => {
    const start   = at("const candidateBlocksPromise");
    const context = at("await buildDecisionContext(");
    assert.ok(start < context, "the read must be under way while the context is built");
    // Still only when an AI provider is active and the visitor is not in the
    // default experience.
    assert.match(code, /aiProviderActive = !isControl && \(\s*decisionProvider instanceof AiDecisionProvider \|\|\s*decisionProvider instanceof ShadowAiDecisionProvider\s*\)/);
    assert.match(code, /candidateBlocksPromise = aiProviderActive\s*\?/);
    // The provider is final by then: nothing assigns it afterwards.
    assert.equal(code.slice(start).match(/\bdecisionProvider = /g), null);
    // A failed read falls back to platform-only candidates, as before.
    assert.match(code, /adaptiveBlocksToResolveInput\(blocks \?\? \[\]\)/);
    assert.equal(code.match(/listAdaptiveBlocks\(tenantConfig\.tenantId, true\)/g)?.length, 1, "the list is read once");
  });
});
