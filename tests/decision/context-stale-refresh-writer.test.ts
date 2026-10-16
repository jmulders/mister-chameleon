/**
 * buildDecisionContext — the stale-while-revalidate background refresh must write
 * the same cache entry shape as the blocking path: normalised current* location
 * fields (currentCity / currentRegion / currentCountry / currentLocationSource).
 * Before the fix it stored the raw pipeline output, so every page view after the
 * first TTL expiry lost the current* fields.
 *
 * TTL = 0s with a long grace window: every entry is stale (but usable) the moment
 * real time advances, so the hit path schedules the background refresh.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL          = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY         = "stub-service-role";
process.env.SESSION_CACHE_TTL_SECONDS         = "0";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type BuildMod = typeof import("../../decision/context/build-decision-context.ts");
type CacheMod = typeof import("../../enrichment/session-enrichment-cache.ts");
type StagedEnricher = import("../../enrichment/types.ts").StagedEnricher;

let build: BuildMod["buildDecisionContext"];
let cache: CacheMod;
const origFetch = globalThis.fetch;

const IP = "203.0.113.9";
const TENANT = "t-stale";
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("buildDecisionContext — stale-refresh background writer", () => {
  before(async () => {
    // Minimal fetch stub for the Supabase REST client.
    globalThis.fetch = async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    ({ buildDecisionContext: build } = await import("../../decision/context/build-decision-context.ts"));
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  after(() => { globalThis.fetch = origFetch; });

  it("stores normalised current* location fields", async () => {
    const sessionId = "sess-stale-1";
    cache.setSessionEnrichment(sessionId, { city: "Old" }, IP, TENANT);
    await tick();

    const stage = {
      label: "Spy Stage",
      enricher: async () => ({ city: "Utrecht", region: "UT", countryCode: "NL" }),
    } as unknown as StagedEnricher;

    const jobs: (() => void | Promise<void>)[] = [];
    const ctx = await build({
      request: new Request("http://tenant.example/", { headers: new Headers({ "user-agent": "test", "x-forwarded-for": IP }) }),
      tenantId: TENANT,
      sessionId,
      stagedEnrichers: [stage],
      scheduleBackgroundWork: (fn) => { jobs.push(fn); },
    });
    assert.equal(ctx.enrichment?.city, "Old", "the stale entry is served for this render");
    assert.equal(jobs.length, 1, "a background refresh was scheduled");
    await jobs[0]!();

    const r = await cache.getSessionEnrichment(sessionId, IP, TENANT);
    assert.equal(r.hit, true);
    if (r.hit) {
      assert.equal(r.enrichment.city, "Utrecht");
      assert.equal(r.enrichment.currentCity, "Utrecht");
      assert.equal(r.enrichment.currentCountry, "NL");
      assert.equal(r.enrichment.currentLocationSource, "ip_geo");
    }
  });
});
