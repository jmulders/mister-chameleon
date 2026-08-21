/**
 * Provider-level coalescing test for Leadinfo.
 *
 * Parallel identical IP lookups must collapse to exactly ONE upstream (paid)
 * fetch, and to at most one persistent-cache write, thanks to
 * ProviderCache.getOrLoad. Also verifies that a transient error is not cached
 * (the next call retries).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { LeadinfoProvider, flushLeadinfoProviderCache } from "../../enrichment/providers/leadinfo.ts";
import type { LeadinfoPersistentCache } from "../../enrichment/ip-company-cache-ttl.ts";

const realFetch = globalThis.fetch;

/** A deferred that lets the test hold the fetch open until both callers are waiting. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

/** In-memory persistent cache double that records get/set calls. */
function makePersistentCache(): LeadinfoPersistentCache & { sets: number; gets: number } {
  const stub = {
    gets: 0,
    sets: 0,
    async get(_ip: string) { this.gets++; return null; },
    async set(_ip: string, _row: unknown) { this.sets++; },
  };
  return stub as unknown as LeadinfoPersistentCache & { sets: number; gets: number };
}

function companyJsonResponse() {
  return new Response(
    JSON.stringify({ company: { name: "Acme Corp", website: "acme.com" }, location: { country: "NL" } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("Leadinfo coalescing", () => {
  beforeEach(() => { flushLeadinfoProviderCache(); });
  afterEach(() => { globalThis.fetch = realFetch; });

  it("parallel identical IP lookups make exactly one upstream call", async () => {
    let fetchCalls = 0;
    const gate = deferred<void>();
    globalThis.fetch = (async () => {
      fetchCalls++;
      await gate.promise;               // hold open until both callers are queued
      return companyJsonResponse();
    }) as typeof fetch;

    const persistentCache = makePersistentCache();
    const provider = new LeadinfoProvider({ apiKey: "test", apiBase: "https://api.test", persistentCache });

    const p1 = provider.lookup("1.2.3.4");
    const p2 = provider.lookup("1.2.3.4");
    // Let both lookups reach the awaiting fetch before releasing it.
    await Promise.resolve();
    gate.resolve();
    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(fetchCalls, 1, "exactly one upstream fetch for two parallel identical lookups");
    assert.equal(r1.companyName, "Acme Corp");
    assert.equal(r2.companyName, "Acme Corp");
    // At most one persistent write for the shared load.
    assert.equal(persistentCache.sets, 1, "one persistent-cache write, not two");

    // A third call after resolution is served from the in-process cache (no fetch).
    const r3 = await provider.lookup("1.2.3.4");
    assert.equal(fetchCalls, 1, "third call served from cache");
    assert.equal(r3.companyName, "Acme Corp");
  });

  it("a transient API error is not cached, so the next call retries", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      return fetchCalls === 1
        ? new Response("upstream boom", { status: 500 })
        : companyJsonResponse();
    }) as typeof fetch;

    const provider = new LeadinfoProvider({ apiKey: "test", apiBase: "https://api.test" });

    const first = await provider.lookup("9.9.9.9");
    assert.deepEqual(first, {}, "error returns empty and is not cached");

    const second = await provider.lookup("9.9.9.9");
    assert.equal(fetchCalls, 2, "second call retried upstream (error was not cached)");
    assert.equal(second.companyName, "Acme Corp");
  });
});
