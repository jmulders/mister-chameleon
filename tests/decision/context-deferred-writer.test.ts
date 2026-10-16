/**
 * buildDecisionContext — the deferred (background) cache warm on a cache MISS
 * must write the same entry shape as the blocking path:
 *   - normalised current* location fields (currentCity / currentRegion /
 *     currentCountry / currentLocationSource), and
 *   - the retry flag for an INCOMPLETE run, so a timed-out pipeline is cached for
 *     the short retry TTL instead of the full session TTL.
 *
 * Retry TTL = 0s (a retry entry is a miss as soon as real time advances); the
 * normal TTL stays at an hour so the two diverge.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL          = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY         = "stub-service-role";
process.env.SESSION_CACHE_RETRY_TTL_SECONDS   = "0";
process.env.SESSION_CACHE_TTL_SECONDS         = "3600";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type BuildMod = typeof import("../../decision/context/build-decision-context.ts");
type CacheMod = typeof import("../../enrichment/session-enrichment-cache.ts");
type StagedEnricher = import("../../enrichment/types.ts").StagedEnricher;

let build: BuildMod["buildDecisionContext"];
let cache: CacheMod;
const origFetch = globalThis.fetch;

const IP = "203.0.113.8";
const TENANT = "t-deferred";
const tick = () => new Promise((r) => setTimeout(r, 5));

function stage(output: Record<string, unknown>, retry = false): StagedEnricher {
  return {
    label: "Spy Stage",
    enricher: async (_i: unknown, _a: unknown, ctx?: { markRetry(r: string): void }) => {
      if (retry) ctx?.markRetry("stub transient failure");
      return output;
    },
  } as unknown as StagedEnricher;
}

async function runDeferred(sessionId: string, stages: StagedEnricher[]): Promise<void> {
  const jobs: (() => void | Promise<void>)[] = [];
  await build({
    request: new Request("http://tenant.example/", { headers: new Headers({ "user-agent": "test", "x-forwarded-for": IP }) }),
    tenantId: TENANT,
    sessionId,
    stagedEnrichers: stages,
    deferSlowEnrichmentOnMiss: true,
    scheduleBackgroundWork: (fn) => { jobs.push(fn); },
  });
  assert.equal(jobs.length, 1, "the full pipeline was deferred to background work");
  await jobs[0]!();
}

describe("buildDecisionContext — deferred background cache writer", () => {
  before(async () => {
    // @ts-expect-error minimal fetch stub for the Supabase REST client
    globalThis.fetch = async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    ({ buildDecisionContext: build } = await import("../../decision/context/build-decision-context.ts"));
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  after(() => { globalThis.fetch = origFetch; });

  it("stores normalised current* location fields", async () => {
    const sessionId = "sess-deferred-1";
    await runDeferred(sessionId, [stage({ city: "Utrecht", region: "UT", countryCode: "NL" })]);

    const r = await cache.getSessionEnrichment(sessionId, IP, TENANT);
    assert.equal(r.hit, true);
    if (r.hit) {
      assert.equal(r.enrichment.currentCity, "Utrecht");
      assert.equal(r.enrichment.currentRegion, "UT");
      assert.equal(r.enrichment.currentCountry, "NL");
      assert.equal(r.enrichment.currentLocationSource, "ip_geo");
    }
  });

  it("a complete background run is cached for the normal TTL", async () => {
    const sessionId = "sess-deferred-2";
    await runDeferred(sessionId, [stage({ city: "Utrecht" })]);
    await tick();
    assert.equal((await cache.getSessionEnrichment(sessionId, IP, TENANT)).hit, true);
  });

  it("an incomplete background run is cached as a short-lived retry entry", async () => {
    const sessionId = "sess-deferred-3";
    await runDeferred(sessionId, [stage({ city: "Utrecht" }, true)]);
    await tick(); // past the 0s retry TTL, far under the 3600s normal TTL

    const r = await cache.getSessionEnrichment(sessionId, IP, TENANT);
    assert.equal(r.hit, false, "a timed-out / incomplete run must not be pinned for the full TTL");
  });
});
