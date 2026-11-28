/**
 * buildDecisionContext with `reuseSessionEnrichment` and no staged chain (the
 * inner-page pipeline): a stale entry is served, and no refresh is scheduled.
 *
 * The staged path refreshes a stale entry in the background by re-running its
 * chain. A caller without a chain has nothing to re-run. It must still serve
 * the entry, so the visitor keeps the city and the company of the homepage for
 * the grace window, and it must not schedule work that could only fail.
 *
 * TTL = 0s with a long grace window, as in context-stale-refresh-writer.test.ts:
 * every entry is stale (but usable) the moment real time advances.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL          = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY         = "stub-service-role";
process.env.SESSION_CACHE_TTL_SECONDS         = "0";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type BuildMod = typeof import("../../decision/context/build-decision-context.ts");
type CacheMod = typeof import("../../enrichment/session-enrichment-cache.ts");

let build: BuildMod["buildDecisionContext"];
let cache: CacheMod;
const origFetch = globalThis.fetch;

const IP     = "203.0.113.31";
const TENANT = "t-reuse-stale";
const tick   = () => new Promise((r) => setTimeout(r, 5));

const request = () =>
  new Request("http://tenant.example/kennisbank", {
    headers: new Headers({ "user-agent": "test", "x-forwarded-for": IP, "x-vercel-ip-city": "Nijmegen" }),
  });

describe("buildDecisionContext — reuse of a stale session entry without a chain", () => {
  before(async () => {
    globalThis.fetch = async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    ({ buildDecisionContext: build } = await import("../../decision/context/build-decision-context.ts"));
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  after(() => { globalThis.fetch = origFetch; });

  it("serves the stale entry and schedules nothing", async () => {
    const sessionId = "sess-reuse-stale-1";
    cache.setSessionEnrichment(sessionId, { city: "Veenendaal", companyName: "Voorbeeld B.V." }, IP, TENANT);
    await tick();

    const stale = await cache.getSessionEnrichment(sessionId, IP, TENANT);
    assert.equal(stale.hit && stale.stale, true, "the entry under test is a stale one");

    const jobs: (() => void | Promise<void>)[] = [];
    const infos: { enrichmentSource: string }[] = [];
    const ctx = await build({
      request: request(),
      tenantId: TENANT,
      sessionId,
      reuseSessionEnrichment: true,
      scheduleBackgroundWork: (fn) => { jobs.push(fn); },
      onDebugInfo: (i) => { infos.push(i); },
    });

    assert.equal(ctx.enrichment?.city, "Veenendaal", "the stale entry is served, not the header geo");
    assert.equal(ctx.enrichment?.companyName, "Voorbeeld B.V.");
    assert.equal(infos[0]?.enrichmentSource, "session-cache");
    assert.equal(jobs.length, 0, "no chain to refresh with, so no background work");

    const still = await cache.getSessionEnrichment(sessionId, IP, TENANT);
    assert.equal(still.hit, true, "the entry is left for a page that can refresh it");
    if (still.hit) assert.equal(still.enrichment.city, "Veenendaal");
  });
});
