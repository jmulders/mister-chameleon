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
  it("does debug work only for the debug screen", () => {
    // The owner on 16 Nov 2026: debug starts when the debug screen is opened,
    // and that screen must be switched on first. The homepage never read the
    // snapshot or the journey events; with the tenant's debug level on "full"
    // it built the one and paid a database read for the other on every pageview.
    assert.match(code, /contextSnapshot = \(includeDebug && debugLevel === "full"\)/);
    assert.match(code, /journeyDebugEvents = \(includeDebug && debugLevel === "full"\)/);
    assert.match(code, /includeDebug = false/, "the default must be off");
    // Nothing else in the pipeline may do work for the debug level alone.
    const uses = code.match(/debugLevel === "full"/g) ?? [];
    assert.equal(uses.length, 2, "a new use of the debug level must go behind includeDebug too");

    const debugPage = readFileSync("app/(site)/engine-debug/page.tsx", "utf8");
    assert.match(debugPage, /runHomepagePipeline\(\{ params, includeDebug: true \}\)/);
    // The debug screen itself stays behind the tenant's switch in the admin.
    assert.match(debugPage, /if \(!debugOverlayEnabled\)/);
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

  it("starts the tenant's audience segments before the decision context is built", () => {
    // Same list for every visitor, and it needs only the tenant. The evaluation
    // itself stays where it was: after the context is built and patched.
    const start   = at("const audienceSegmentsPromise");
    const context = at("await buildDecisionContext(");
    assert.ok(start < context, "the read must be under way while the context is built");
    // The control group gets no segments, so it pays for no read.
    assert.match(code, /audienceSegmentsPromise = isControl\s*\? null\s*: startActiveAudienceSegments\(tenantConfig\.tenantId\)/);
    const evaluate = at("await evaluateAudienceSegments(postScenarioInput, tenantConfig.tenantId, audienceSegmentsPromise ?? undefined)");
    assert.ok(evaluate > context, "segments are evaluated against the finished context");
    // The other pages decide in lib/cms-page-decision.ts and do the same.
    const pages = readFileSync("lib/cms-page-decision.ts", "utf8");
    const pStart = pages.indexOf("const audienceSegmentsPromise = isControl ? null : startActiveAudienceSegments(tenantId);");
    const pBuild = pages.indexOf("await buildDecisionContext(");
    const pEval  = pages.indexOf("await evaluateAudienceSegments(postScenarioInput, tenantId, audienceSegmentsPromise ?? undefined)");
    assert.ok(pStart > 0 && pStart < pBuild && pBuild < pEval, "the other pages start the read early too");
    // The helper never rejects, so a read that nobody picks up cannot go unhandled.
    const helper = readFileSync("audience-segments/evaluate.ts", "utf8");
    assert.match(helper, /export function startActiveAudienceSegments[\s\S]*?listActiveAudienceSegments\(tenantId\)\.catch\(/);
  });

  it("reads the interest profiles only when there is a keyword to score", () => {
    // Without a search term in the address and without keywords from earlier
    // pages nothing can score, whatever the profiles say. That is most first
    // pageviews, and each paid two database reads in a row for it.
    const context = readFileSync("decision/context/build-decision-context.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const cloud = context.indexOf("const cloud: Record<string, number> = {};");
    const gate  = context.indexOf("if (Object.keys(cloud).length > 0) {", cloud);
    const read  = context.indexOf("await listActiveInterestProfiles(tenantId)");
    assert.ok(cloud > 0 && gate > cloud && read > gate, "the keyword cloud must be built and checked before the read");
    assert.equal(context.match(/listActiveInterestProfiles\(tenantId\)/g)?.length, 1, "one place reads the profiles");
    // Nothing between the check and the read may leave the block.
    assert.doesNotMatch(context.slice(gate, read), /\n {4}\}/);
  });
});
