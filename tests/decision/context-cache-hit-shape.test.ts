/**
 * buildDecisionContext — a session-cache HIT must produce the same context shape
 * as a MISS. Previously the hit branch built its own context and returned early,
 * skipping the shared post-enrichment steps (mc_li Leadinfo merge, interest
 * scoring) and dropping `customAttributes`, so interest / attribute / Leadinfo
 * rules silently stopped matching from pageview 2 onward.
 *
 * The Supabase client is pointed at a stub host and `fetch` is stubbed, so the
 * interest-profile read returns one profile and every other request (session
 * cache L2, overrides) gets an empty answer. Env is set BEFORE the dynamic import
 * because lib/env reads it at module load.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL      = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY     = "stub-service-role";
process.env.SESSION_CACHE_TTL_SECONDS         = "3600";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type BuildMod = typeof import("../../decision/context/build-decision-context.ts");
type CacheMod = typeof import("../../enrichment/session-enrichment-cache.ts");
type StagedEnricher = import("../../enrichment/types.ts").StagedEnricher;

let build: BuildMod["buildDecisionContext"];
let cache: CacheMod;

const PROFILE_ROW = {
  id: "p-crm", key: "crm", name: "CRM", description: null,
  tags: [{ keyword: "crm", weight: 1 }],
  is_active: true, family: null, recommended_site_models: [], default_status: null,
  tenant_id: null, avatar: null,
};

const origFetch = globalThis.fetch;

const MC_LI = "mc_li=" + encodeURIComponent(JSON.stringify({ m: true, cn: "Nakatomi BV", cd: "nakatomi.example", co: "NL" }));
const IP = "203.0.113.7";
const TENANT = "t-cache-shape";

let seq = 0;
const sid = () => `sess-shape-${++seq}`;

function req(path = "/?utm_term=crm"): Request {
  return new Request(`http://tenant.example${path}`, {
    headers: new Headers({ "user-agent": "test", "x-forwarded-for": IP }),
  });
}

function spyStage(output: Record<string, unknown>): StagedEnricher & { calls: number } {
  const stage = {
    label: "Spy Stage",
    calls: 0,
    enricher: async () => {
      stage.calls++;
      return output;
    },
  };
  return stage as unknown as StagedEnricher & { calls: number };
}

describe("buildDecisionContext — session-cache hit shape", () => {
  before(async () => {
    // Minimal fetch stub for the Supabase REST client.
    globalThis.fetch = async (u: unknown) => {
      const url = String(u);
      const body = url.includes("/rest/v1/interest_profiles") ? [PROFILE_ROW] : [];
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
    ({ buildDecisionContext: build } = await import("../../decision/context/build-decision-context.ts"));
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  after(() => { globalThis.fetch = origFetch; });

  it("a cache hit keeps customAttributes, merges mc_li and scores interests — without re-running stages", async () => {
    const sessionId = sid();
    cache.setSessionEnrichment(sessionId, { countryCode: "NL", city: "Amsterdam" }, IP, TENANT);
    const stage = spyStage({ city: "SHOULD-NOT-RUN" });

    const ctx = await build({
      request: req(),
      cookieHeader: MC_LI,
      tenantId: TENANT,
      sessionId,
      stagedEnrichers: [stage],
      customAttributes: { plan: "pro" },
    });

    assert.equal(stage.calls, 0, "a cache hit must not re-run (paid) stages");
    assert.equal(ctx.enrichment?.city, "Amsterdam", "cached enrichment is served");
    assert.deepEqual(ctx.customAttributes, { plan: "pro" });
    assert.equal(ctx.enrichment?.leadinfoCompanyName, "Nakatomi BV");
    assert.equal(ctx.interestContext?.interestPrimary, "crm");
    assert.ok(ctx.interestScores && ctx.interestScores.length > 0);
  });

  it("hit and miss produce the same context keys", async () => {
    const params = { cookieHeader: MC_LI, tenantId: TENANT, customAttributes: { plan: "pro" } };
    const miss = await build({ request: req(), ...params, sessionId: sid(), stagedEnrichers: [spyStage({ city: "Utrecht" })] });

    const hitSession = sid();
    cache.setSessionEnrichment(hitSession, { city: "Utrecht" }, IP, TENANT);
    const hit = await build({ request: req(), ...params, sessionId: hitSession, stagedEnrichers: [spyStage({})] });

    assert.deepEqual(Object.keys(hit).sort(), Object.keys(miss).sort());
  });

  it("reports session-cache provenance via onDebugInfo exactly once on a hit", async () => {
    const sessionId = sid();
    cache.setSessionEnrichment(sessionId, { city: "Delft" }, IP, TENANT);
    const infos: { enrichmentSource: string; stageTrace: unknown[] }[] = [];
    await build({
      request: req(), tenantId: TENANT, sessionId, stagedEnrichers: [spyStage({})],
      onDebugInfo: (i) => { infos.push(i); },
    });
    assert.equal(infos.length, 1);
    assert.equal(infos[0]?.enrichmentSource, "session-cache");
    assert.deepEqual(infos[0]?.stageTrace, []);
  });
});

