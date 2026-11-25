/**
 * buildDecisionContext — a company the mc_li cookie recognised reaches the
 * generic company fields, the derived signals and the rules on them.
 *
 * Found on 25 Nov 2026 on a tenant that recognises companies with Leadinfo only
 * (no IP company enrichment, no OpenKvK): the cookie merge set the leadinfo*
 * fields and left companyName / companyIndustry / companySize empty, so
 * companyType and industryGroup were null and a rule had to be written on
 * leadinfoBranchCode / leadinfoEmployeesTotal instead.
 *
 * The fill is conditional: only for a matched company, and only into a field
 * no other provider set.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

// The session cache reads a shared row through the Supabase client. Point it at
// a stub host and stub fetch, BEFORE the dynamic import: lib/env reads the
// environment at module load.
process.env.NEXT_PUBLIC_SUPABASE_URL          = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY         = "stub-service-role";
process.env.SESSION_CACHE_TTL_SECONDS         = "3600";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

import type { RuleCondition } from "../../decision/rules/stored-rule.ts";
import type { StagedEnricher } from "../../enrichment/types.ts";

type BuildMod = typeof import("../../decision/context/build-decision-context.ts");
type RuleMod  = typeof import("../../decision/rules/stored-rule.ts");
type TokenMod = typeof import("../../lib/tokens/parse-tokens.ts");

let buildDecisionContext: BuildMod["buildDecisionContext"];
let evaluateCondition: RuleMod["evaluateCondition"];
let buildTokenContextFromInput: TokenMod["buildTokenContextFromInput"];

const origFetch = globalThis.fetch;

const cookie = (payload: Record<string, unknown>) => "mc_li=" + encodeURIComponent(JSON.stringify(payload));

// Steets as production holds it: SBI 73110, "52" employees.
const MC_LI = cookie({ m: true, cn: "Steets B.V.", cd: "steets.nl", co: "NL", e: "52", et: 21, bc: "73110" });

const IP = "203.0.113.9";
const req = () => new Request("http://tenant.example/", {
  headers: new Headers({ "user-agent": "test", "x-forwarded-for": IP }),
});

function field(fieldKey: string, operator: string, value: unknown): RuleCondition {
  return { type: "field", field: fieldKey, operator, value } as unknown as RuleCondition;
}

function stage(output: Record<string, unknown>): StagedEnricher & { calls: number } {
  const s = {
    label: "Other provider",
    calls: 0,
    enricher: async () => { s.calls++; return output; },
  };
  return s as unknown as StagedEnricher & { calls: number };
}

describe("buildDecisionContext — generic company fields from the mc_li cookie", () => {
  before(async () => {
    globalThis.fetch = async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    ({ buildDecisionContext }       = await import("../../decision/context/build-decision-context.ts"));
    ({ evaluateCondition }          = await import("../../decision/rules/stored-rule.ts"));
    ({ buildTokenContextFromInput } = await import("../../lib/tokens/parse-tokens.ts"));
  });

  after(() => { globalThis.fetch = origFetch; });

  it("fills the empty generic fields from a matched Leadinfo company", async () => {
    const ctx = await buildDecisionContext({ request: req(), cookieHeader: MC_LI });
    assert.equal(ctx.enrichment?.companyName, "Steets B.V.");
    assert.equal(ctx.enrichment?.companyDomain, "steets.nl");
    assert.equal(ctx.enrichment?.companySize, "52");
    assert.equal(ctx.enrichment?.companyIndustry, "Activities of advertising agencies");
    assert.equal(ctx.enrichment?.companyMatchSource, "leadinfo");
    // the leadinfo* fields stay, so the rules written on them keep working
    assert.equal(ctx.enrichment?.leadinfoBranchCode, "73110");
    assert.equal(ctx.enrichment?.leadinfoEmployeesTotal, 21);
  });

  it("derives companyType and industryGroup for that company", async () => {
    const ctx = await buildDecisionContext({ request: req(), cookieHeader: MC_LI });
    assert.equal(ctx.derived?.companyType, "smb");
    assert.equal(ctx.derived?.industryGroup, "professional-services");
  });

  it("lets a rule on the generic and derived fields match", async () => {
    const ctx = await buildDecisionContext({ request: req(), cookieHeader: MC_LI });
    assert.equal(evaluateCondition(field("industryGroup", "equals", "professional-services"), ctx), true);
    assert.equal(evaluateCondition(field("companyType", "equals", "smb"), ctx), true);
    assert.equal(evaluateCondition(field("companyName", "equals", "Steets B.V."), ctx), true);
    // the rules written on Leadinfo's own fields on 25 Nov 2026 keep matching
    assert.equal(evaluateCondition(field("leadinfoBranchCode", "equals", "73110"), ctx), true);
    assert.equal(evaluateCondition(field("leadinfoEmployeesTotal", "greater_than_or_equal", 21), ctx), true);
    assert.equal(evaluateCondition(field("leadinfoEmployeesTotal", "greater_than_or_equal", 250), ctx), false);
  });

  it("reaches the company tokens", async () => {
    const ctx = await buildDecisionContext({ request: req(), cookieHeader: MC_LI });
    const tokens = buildTokenContextFromInput(ctx);
    assert.equal(tokens.companyName, "Steets B.V.");
    assert.equal(tokens.companyIndustry, "Activities of advertising agencies");
  });

  it("never overwrites what another provider resolved", async () => {
    const ctx = await buildDecisionContext({
      request: req(),
      cookieHeader: MC_LI,
      stagedEnrichers: [stage({
        companyName: "Acme BV", companyDomain: "acme.example",
        companyIndustry: "Software", companySize: "1001-5000",
        companyMatchSource: "openkvk", companyMatchConfidence: 0.9,
      })],
    });
    assert.equal(ctx.enrichment?.companyName, "Acme BV");
    assert.equal(ctx.enrichment?.companyDomain, "acme.example");
    assert.equal(ctx.enrichment?.companyIndustry, "Software");
    assert.equal(ctx.enrichment?.companySize, "1001-5000");
    assert.equal(ctx.enrichment?.companyMatchSource, "openkvk");
    assert.equal(ctx.enrichment?.companyMatchConfidence, 0.9);
    assert.equal(ctx.derived?.companyType, "enterprise");
    assert.equal(ctx.derived?.industryGroup, "tech");
    // Leadinfo's own answer is still there to compare with
    assert.equal(ctx.enrichment?.leadinfoCompanyName, "Steets B.V.");
  });

  it("fills only the fields the other provider left empty", async () => {
    const ctx = await buildDecisionContext({
      request: req(),
      cookieHeader: MC_LI,
      stagedEnrichers: [stage({ companyName: "Steets", companyMatchSource: "openkvk" })],
    });
    assert.equal(ctx.enrichment?.companyName, "Steets");
    assert.equal(ctx.enrichment?.companyMatchSource, "openkvk");
    assert.equal(ctx.enrichment?.companySize, "52");
    assert.equal(ctx.enrichment?.companyIndustry, "Activities of advertising agencies");
  });

  it("fills nothing when Leadinfo found no company", async () => {
    const ctx = await buildDecisionContext({ request: req(), cookieHeader: cookie({ m: false }) });
    assert.equal(ctx.enrichment?.leadinfoMatched, false);
    assert.equal(ctx.enrichment?.companyName ?? null, null);
    assert.equal(ctx.enrichment?.companyIndustry ?? null, null);
    assert.equal(ctx.derived?.companyType ?? null, null);
    assert.equal(ctx.derived?.industryGroup ?? null, null);
  });

  it("fills nothing without the cookie", async () => {
    const ctx = await buildDecisionContext({ request: req() });
    assert.equal(ctx.enrichment?.companyName ?? null, null);
    assert.equal(ctx.enrichment?.companyMatchSource ?? null, null);
    assert.equal(ctx.derived?.companyType ?? null, null);
  });

  it("keeps the filled values out of the session cache, so they leave with the cookie", async () => {
    const sessionId = "sess-leadinfo-fill-1";
    const tenantId  = "t-leadinfo-fill";
    const first = stage({ city: "Utrecht" });
    const withCookie = await buildDecisionContext({
      request: req(), cookieHeader: MC_LI, tenantId, sessionId, stagedEnrichers: [first],
    });
    assert.equal(first.calls, 1);
    assert.equal(withCookie.enrichment?.companyName, "Steets B.V.");

    // Next pageview in the same session, served from the session cache, with
    // the cookie gone (consent withdrawn, or the seven days are over).
    const second = stage({ city: "SHOULD-NOT-RUN" });
    const without = await buildDecisionContext({
      request: req(), tenantId, sessionId, stagedEnrichers: [second],
    });
    assert.equal(second.calls, 0, "the second pageview must be a session-cache hit");
    assert.equal(without.enrichment?.city, "Utrecht");
    assert.equal(without.enrichment?.companyName ?? null, null);
    assert.equal(without.enrichment?.companyIndustry ?? null, null);
    assert.equal(without.enrichment?.companyMatchSource ?? null, null);
    assert.equal(without.derived?.companyType ?? null, null);

    // And with the cookie back, the cache hit is filled again.
    const again = await buildDecisionContext({
      request: req(), cookieHeader: MC_LI, tenantId, sessionId, stagedEnrichers: [second],
    });
    assert.equal(second.calls, 0);
    assert.equal(again.enrichment?.companyName, "Steets B.V.");
    assert.equal(again.derived?.industryGroup, "professional-services");
  });

  it("reports where the filled fields came from", async () => {
    let trace: Record<string, { provider: string; source: string }> = {};
    await buildDecisionContext({
      request: req(), cookieHeader: MC_LI,
      onDebugInfo: (info) => { trace = info.enrichmentTrace as typeof trace; },
    });
    assert.equal(trace.companyName?.provider, "Leadinfo (client)");
    assert.equal(trace.companyIndustry?.source, "mc_li cookie");
  });
});
