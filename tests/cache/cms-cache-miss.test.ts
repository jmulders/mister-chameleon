/**
 * The CMS cache remembers that a key has no content.
 *
 * Found on 16 Nov 2026 while tracing why the homepage was slow: a variant key
 * that does not exist was asked from the database again on every pageview. The
 * cache stored the miss but the cached provider read "null" as "not cached".
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import {
  CMS_CACHE_ENABLED, CMS_CACHE_TTL_MS, CMS_CACHE_MISS_TTL_MS,
  flushAllCmsCache, getCmsVariant, lookupCmsVariant, setCmsVariant,
} from "@/cache/cms-cache";
import { CachedCMSProvider } from "@/cms/providers/cached-cms-provider";
import type { CMSProvider } from "@/cms/providers/cms-provider";

/** A provider that only knows the keys it is given, and counts what it is asked. */
function countingProvider(known: Record<string, unknown>) {
  const asked: string[] = [];
  const answer = (slot: string) => async (key: string) => {
    asked.push(`${slot}:${key}`);
    return (known[`${slot}:${key}`] ?? null) as never;
  };
  const inner = {
    getHeroVariant:         answer("hero"),
    getProofVariant:        answer("proof"),
    getCTAVariant:          answer("cta"),
    getFeatureVariant:      answer("feature"),
    getConversionVariant:   answer("conversion"),
    getNotificationVariant: answer("notification"),
    getAdaptiveBlock:       answer("adaptive"),
  } as unknown as CMSProvider;
  return { inner, asked };
}

describe("CMS cache: a miss is an answer", () => {
  beforeEach(() => {
    mock.timers.reset();
    flushAllCmsCache();
  });

  it("runs with the cache on, as production does", () => {
    assert.equal(CMS_CACHE_ENABLED, true);
  });

  it("tells a remembered miss apart from a key it has never seen", () => {
    assert.deepEqual(lookupCmsVariant("t1", "hero", "nooit-gezien"), { found: false });
    setCmsVariant("t1", "hero", "bestaat-niet", null);
    assert.deepEqual(lookupCmsVariant("t1", "hero", "bestaat-niet"), { found: true, value: null });
    // The old reader cannot tell them apart; that is why the provider needs the new one.
    assert.equal(getCmsVariant("t1", "hero", "bestaat-niet"), null);
    assert.equal(getCmsVariant("t1", "hero", "nooit-gezien"), null);
  });

  it("asks the source once for a key that does not exist, not on every request", async () => {
    const { inner, asked } = countingProvider({});
    const provider = new CachedCMSProvider(inner, "t1", "nl");
    for (let i = 0; i < 5; i++) assert.equal(await provider.getHeroVariant("hero_weg"), null);
    assert.deepEqual(asked, ["hero:hero_weg"]);
  });

  it("does so for every kind of variant", async () => {
    const { inner, asked } = countingProvider({});
    const provider = new CachedCMSProvider(inner, "t1", "nl");
    const calls: Array<() => Promise<unknown>> = [
      () => provider.getHeroVariant("k"), () => provider.getProofVariant("k"), () => provider.getCTAVariant("k"),
      () => provider.getFeatureVariant("k"), () => provider.getConversionVariant("k"),
      () => provider.getNotificationVariant("k"), () => provider.getAdaptiveBlock("k"),
    ];
    for (const call of calls) { await call(); await call(); await call(); }
    assert.deepEqual(asked, ["hero:k", "proof:k", "cta:k", "feature:k", "conversion:k", "notification:k", "adaptive:k"]);
  });

  it("still serves a key that exists from the cache", async () => {
    const hero = { title: "Kop" };
    const { inner, asked } = countingProvider({ "hero:hero_default": hero });
    const provider = new CachedCMSProvider(inner, "t1", "nl");
    assert.equal(await provider.getHeroVariant("hero_default"), hero);
    assert.equal(await provider.getHeroVariant("hero_default"), hero);
    assert.deepEqual(asked, ["hero:hero_default"]);
  });

  it("forgets a miss after half a minute, long before it forgets a hit", async () => {
    // The providers answer null both for a missing key and for a failed read, so
    // a remembered miss may be a hiccup. It must not stick for the full five
    // minutes, and a block an editor has just created must show up soon.
    assert.equal(CMS_CACHE_MISS_TTL_MS, 30_000);
    assert.ok(CMS_CACHE_MISS_TTL_MS < CMS_CACHE_TTL_MS);

    mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    const known: Record<string, unknown> = { "proof:blijft": { title: "Bewijs" } };
    const { inner, asked } = countingProvider(known);
    const provider = new CachedCMSProvider(inner, "t1", "nl");

    assert.equal(await provider.getHeroVariant("hero_nieuw"), null);
    await provider.getProofVariant("blijft");
    mock.timers.tick(CMS_CACHE_MISS_TTL_MS - 1);
    assert.equal(await provider.getHeroVariant("hero_nieuw"), null);
    assert.equal(asked.filter((a) => a === "hero:hero_nieuw").length, 1, "still remembered just before the half minute");

    // The editor creates the block; half a minute after the first miss it is found.
    known["hero:hero_nieuw"] = { title: "Nieuwe kop" };
    mock.timers.tick(2);
    assert.deepEqual(await provider.getHeroVariant("hero_nieuw"), { title: "Nieuwe kop" });
    assert.equal(asked.filter((a) => a === "hero:hero_nieuw").length, 2);

    // The hit from the start is still served from the cache.
    await provider.getProofVariant("blijft");
    assert.equal(asked.filter((a) => a === "proof:blijft").length, 1);
    mock.timers.reset();
  });

  it("keeps the caches of two tenants and two languages apart", async () => {
    const { inner, asked } = countingProvider({});
    await new CachedCMSProvider(inner, "t1", "nl").getHeroVariant("k");
    await new CachedCMSProvider(inner, "t2", "nl").getHeroVariant("k");
    await new CachedCMSProvider(inner, "t1", "en").getHeroVariant("k");
    assert.equal(asked.length, 3, "a miss for one tenant or language says nothing about another");
  });
});
