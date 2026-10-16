/**
 * Session enrichment cache — the in-process L1 Map is bounded.
 *
 * Without a cap or sweep, a long-lived instance grew without bound (worse
 * because anonymous session ids are new per request). The L1 now holds at most
 * SESSION_CACHE_MAX_ENTRIES entries (oldest write evicted first) and drops
 * expired entries as new ones are written.
 *
 * Assertions use getSessionEnrichmentMeta, which reads only the L1, so the
 * shared L2 can never mask an eviction. The Supabase client is pointed at a stub
 * host with a stubbed fetch, so no L2 write leaves the process. Env is set
 * BEFORE the dynamic import because the module reads it at load.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL          = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY         = "stub-service-role";
process.env.SESSION_CACHE_MAX_ENTRIES         = "3";
process.env.SESSION_CACHE_RETRY_TTL_SECONDS   = "0";
process.env.SESSION_CACHE_TTL_SECONDS         = "3600";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type Mod = typeof import("../../enrichment/session-enrichment-cache.ts");
let cache: Mod;
const origFetch = globalThis.fetch;
const tick = () => new Promise((r) => setTimeout(r, 5));

const has = (id: string) => cache.getSessionEnrichmentMeta(id).exists;

describe("session enrichment cache — bounded L1", () => {
  before(async () => {
    globalThis.fetch = async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  after(() => {
    cache.flushAllSessionEnrichment();
    globalThis.fetch = origFetch;
  });

  it("never holds more than the cap; the oldest write is evicted first", () => {
    cache.flushAllSessionEnrichment();
    for (const id of ["a", "b", "c", "d"]) cache.setSessionEnrichment(id, { countryCode: "NL" }, null, "t");
    assert.equal(cache.getSessionEnrichmentStats().size, 3);
    assert.equal(has("a"), false, "the oldest entry was evicted");
    assert.ok(has("b") && has("c") && has("d"));
  });

  it("re-writing a session makes it the newest", () => {
    cache.flushAllSessionEnrichment();
    for (const id of ["a", "b", "c"]) cache.setSessionEnrichment(id, {}, null, "t");
    cache.setSessionEnrichment("a", { city: "x" }, null, "t"); // a is now newest
    cache.setSessionEnrichment("d", {}, null, "t");
    assert.equal(has("b"), false, "b is now the oldest and was evicted");
    assert.ok(has("a") && has("c") && has("d"));
  });

  it("expired entries are dropped when new entries are written", async () => {
    cache.flushAllSessionEnrichment();
    cache.setSessionEnrichment("r1", {}, null, "t", { retry: true }); // 0s retry TTL
    await tick();
    cache.setSessionEnrichment("n1", {}, null, "t");
    assert.equal(has("r1"), false, "the expired retry entry was swept");
    assert.equal(cache.getSessionEnrichmentStats().size, 1);
  });

  it("hits still work under the cap", async () => {
    cache.flushAllSessionEnrichment();
    cache.setSessionEnrichment("h1", { countryCode: "BE" }, "1.1.1.1", "t");
    const r = await cache.getSessionEnrichment("h1", "1.1.1.1", "t");
    assert.equal(r.hit, true);
    if (r.hit) assert.equal(r.enrichment.countryCode, "BE");
  });
});
