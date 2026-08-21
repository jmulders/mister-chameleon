/**
 * Unit tests for ProviderCache.getOrLoad — in-flight request coalescing.
 *
 * Covers: concurrent coalescing, error-not-cached retry, per-key isolation,
 * post-success TTL-store reuse, and the shouldCache:false coalesce-without-store
 * case.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { ProviderCache } from "../../enrichment/provider-cache.ts";

/** A deferred promise plus a call counter, to control loader timing. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("ProviderCache.getOrLoad", () => {
  it("(a) two parallel calls on the same key run the loader once and share the value", async () => {
    const cache = new ProviderCache<string>(60_000);
    let calls = 0;
    const d = deferred<string>();
    const loader = () => { calls++; return d.promise; };

    const p1 = cache.getOrLoad("k", loader);
    const p2 = cache.getOrLoad("k", loader);
    d.resolve("value");
    const [v1, v2] = await Promise.all([p1, p2]);

    assert.equal(calls, 1);
    assert.equal(v1, "value");
    assert.equal(v2, "value");
  });

  it("(b) after a reject the next call re-runs the loader (no cached error)", async () => {
    const cache = new ProviderCache<string>(60_000);
    let calls = 0;
    const loader = () => {
      calls++;
      return calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve("ok");
    };

    await assert.rejects(cache.getOrLoad("k", loader), /boom/);
    // The failed load left nothing cached and cleared the in-flight slot.
    assert.equal(cache.get("k").hit, false);

    const v = await cache.getOrLoad("k", loader);
    assert.equal(v, "ok");
    assert.equal(calls, 2);
  });

  it("(c) different keys do not coalesce", async () => {
    const cache = new ProviderCache<string>(60_000);
    let calls = 0;
    const loader = (v: string) => () => { calls++; return Promise.resolve(v); };

    const [a, b] = await Promise.all([
      cache.getOrLoad("a", loader("A")),
      cache.getOrLoad("b", loader("B")),
    ]);

    assert.equal(calls, 2);
    assert.equal(a, "A");
    assert.equal(b, "B");
  });

  it("(d) after success the value is in the TTL store and a third call uses the cache", async () => {
    const cache = new ProviderCache<string>(60_000);
    let calls = 0;
    const loader = () => { calls++; return Promise.resolve("cached"); };

    await cache.getOrLoad("k", loader);
    assert.equal(cache.get("k").hit, true);

    const third = await cache.getOrLoad("k", loader);
    assert.equal(third, "cached");
    assert.equal(calls, 1); // loader not called again
  });

  it("(e) shouldCache:false coalesces the load but does not store the result", async () => {
    const cache = new ProviderCache<Record<string, unknown>>(60_000);
    let calls = 0;
    const d = deferred<Record<string, unknown>>();
    const loader = () => { calls++; return d.promise; };
    const shouldCache = (v: Record<string, unknown>) => Object.keys(v).length > 0;

    // Two concurrent callers coalesce onto one empty-result load.
    const p1 = cache.getOrLoad("k", loader, { shouldCache });
    const p2 = cache.getOrLoad("k", loader, { shouldCache });
    d.resolve({});
    const [v1, v2] = await Promise.all([p1, p2]);

    assert.equal(calls, 1);          // coalesced
    assert.deepEqual(v1, {});
    assert.deepEqual(v2, {});
    assert.equal(cache.get("k").hit, false); // empty result not stored

    // A later call runs the loader again (nothing was cached).
    const d2 = deferred<Record<string, unknown>>();
    const loader2 = () => { calls++; return d2.promise; };
    const p3 = cache.getOrLoad("k", loader2, { shouldCache });
    d2.resolve({ hit: 1 });
    const v3 = await p3;
    assert.equal(calls, 2);
    assert.deepEqual(v3, { hit: 1 });
    assert.equal(cache.get("k").hit, true); // non-empty result IS stored
  });

  it("existing get/set/has behavior is unchanged after adding getOrLoad", async () => {
    const cache = new ProviderCache<number>(60_000);
    assert.equal(cache.has("x"), false);
    cache.set("x", 42);
    assert.equal(cache.has("x"), true);
    assert.equal(cache.get("x").hit, true);
    // A fresh hit short-circuits getOrLoad without touching the loader.
    let called = false;
    const v = await cache.getOrLoad("x", () => { called = true; return Promise.resolve(0); });
    assert.equal(v, 42);
    assert.equal(called, false);
  });
});
