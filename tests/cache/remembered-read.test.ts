/**
 * A remembered read: the answer is kept across requests, a failed read never.
 *
 * Found on 21 Nov 2026: on a quiet site the first database reads took up to a
 * second each, and the homepage waited for six steps of them. The
 * configuration reads now go through rememberedRead(). These tests hold what
 * makes that safe: a database error that a store answers with an empty value
 * must not be kept as if it were the configuration.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { foregroundRead, noteFailedRead, READS_AT_ONCE, rememberedRead, REMEMBERED_READ_TAG, WAIT_FOR_A_TURN_MS, type CacheLayer } from "@/lib/cache/remembered-read";

/**
 * A small stand-in for Next's data cache with the behaviour this code leans
 * on: answers pass through JSON, a stale answer is served while the read runs
 * again, and a read that throws stores nothing.
 */
function fakeCache() {
  const entries = new Map<string, { body: string; at: number }>();
  const background: Promise<unknown>[] = [];
  const seen: { key: string; revalidate: number; tags: string[] }[] = [];
  let now = 0;
  const layer: CacheLayer = (load, keyParts, options) => async () => {
    const key = keyParts.join("|");
    seen.push({ key, revalidate: options.revalidate, tags: options.tags });
    const hit = entries.get(key);
    const store = async () => {
      const value = await load();
      entries.set(key, { body: JSON.stringify(value), at: now });
      return value;
    };
    if (hit) {
      if (now - hit.at >= options.revalidate) background.push(store().catch(() => undefined));
      return JSON.parse(hit.body);
    }
    return store();
  };
  return {
    layer, entries, seen,
    pass: (seconds: number) => { now += seconds; },
    settle: async () => { await Promise.all(background.splice(0)); },
  };
}

describe("rememberedRead", () => {
  it("asks the source once and answers the next requests from memory", async () => {
    const cache = fakeCache();
    let asked = 0;
    const read = rememberedRead("t", async (tenant: string) => { asked++; return [{ tenant }]; }, { seconds: 60 }, cache.layer);
    assert.deepEqual(await read("a"), [{ tenant: "a" }]);
    assert.deepEqual(await read("a"), [{ tenant: "a" }]);
    assert.deepEqual(await read("a"), [{ tenant: "a" }]);
    assert.equal(asked, 1);
  });

  it("keeps the answers of two tenants apart", async () => {
    const cache = fakeCache();
    const read = rememberedRead("t", async (tenant: string) => `van ${tenant}`, { seconds: 60 }, cache.layer);
    assert.equal(await read("a"), "van a");
    assert.equal(await read("b"), "van b");
    assert.equal(await read("a"), "van a");
    assert.equal(cache.entries.size, 2);
  });

  it("keeps two reads with the same arguments apart by their name", async () => {
    const cache = fakeCache();
    const one = rememberedRead("one", async (t: string) => `1 ${t}`, { seconds: 60 }, cache.layer);
    const two = rememberedRead("two", async (t: string) => `2 ${t}`, { seconds: 60 }, cache.layer);
    assert.equal(await one("a"), "1 a");
    assert.equal(await two("a"), "2 a");
  });

  it("serves a stale answer at once and refreshes it behind the response", async () => {
    const cache = fakeCache();
    let version = 1;
    const read = rememberedRead("t", async () => version, { seconds: 60 }, cache.layer);
    assert.equal(await read(), 1);
    version = 2;
    cache.pass(61);
    assert.equal(await read(), 1, "the visitor does not wait for the new read");
    await cache.settle();
    assert.equal(await read(), 2, "the visit after that has the new answer");
  });

  it("does not keep the answer of a read that noted a failure", async () => {
    const cache = fakeCache();
    let down = true;
    let asked = 0;
    // A store as this codebase writes them: a database error becomes an empty list.
    const store = async (): Promise<string[]> => {
      asked++;
      if (down) { noteFailedRead(); return []; }
      return ["segment"];
    };
    const read = rememberedRead("t", store, { seconds: 60 }, cache.layer);
    assert.deepEqual(await read(), [], "the caller gets what the store answered");
    assert.equal(cache.entries.size, 0, "but nothing is kept");
    down = false;
    assert.deepEqual(await read(), ["segment"], "so the next request reads again");
    assert.equal(asked, 2);
  });

  it("keeps the last good answer when the refresh fails", async () => {
    const cache = fakeCache();
    let down = false;
    const store = async (): Promise<string[]> => {
      if (down) { noteFailedRead(); return []; }
      return ["segment"];
    };
    const read = rememberedRead("t", store, { seconds: 60 }, cache.layer);
    assert.deepEqual(await read(), ["segment"]);
    down = true;
    cache.pass(61);
    assert.deepEqual(await read(), ["segment"]);
    await cache.settle();
    assert.deepEqual(await read(), ["segment"], "an empty list from a failed read must not replace it");
  });

  it("does not keep a result that says it failed", async () => {
    const cache = fakeCache();
    type Result = { ok: true; data: number[] } | { ok: false; error: string };
    let down = true;
    const read = rememberedRead<[], Result>(
      "t",
      async () => (down ? { ok: false, error: "timeout" } : { ok: true, data: [1] }),
      { seconds: 60, keep: (r) => r.ok },
      cache.layer,
    );
    assert.deepEqual(await read(), { ok: false, error: "timeout" });
    assert.equal(cache.entries.size, 0);
    down = false;
    assert.deepEqual(await read(), { ok: true, data: [1] });
    assert.equal(cache.entries.size, 1);
  });

  it("remembers that something does not exist: null is an answer", async () => {
    const cache = fakeCache();
    let asked = 0;
    const read = rememberedRead("t", async (_key: string): Promise<{ title: string } | null> => { asked++; return null; }, { seconds: 60 }, cache.layer);
    assert.equal(await read("hero_weg"), null);
    assert.equal(await read("hero_weg"), null);
    assert.equal(asked, 1);
  });

  it("passes on an error the read throws, and keeps nothing", async () => {
    const cache = fakeCache();
    const read = rememberedRead("t", async (): Promise<number> => { throw new Error("stuk"); }, { seconds: 60 }, cache.layer);
    await assert.rejects(read(), /stuk/);
    assert.equal(cache.entries.size, 0);
  });

  it("reads directly when the cache itself fails", async () => {
    const broken: CacheLayer = () => async () => { throw new Error("incrementalCache missing"); };
    let asked = 0;
    const read = rememberedRead("t", async () => { asked++; return "antwoord"; }, { seconds: 60 }, broken);
    assert.equal(await read(), "antwoord");
    assert.equal(asked, 1);
  });

  it("a failure noted outside a remembered read does nothing", () => {
    assert.doesNotThrow(() => noteFailedRead());
  });

  it("a failure in one read does not mark another that runs at the same time", async () => {
    const cache = fakeCache();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const slowGood = rememberedRead("good", async () => { await gate; return "goed"; }, { seconds: 60 }, cache.layer);
    const bad = rememberedRead("bad", async () => { noteFailedRead(); return "leeg"; }, { seconds: 60 }, cache.layer);
    const pending = slowGood();
    assert.equal(await bad(), "leeg");
    release();
    assert.equal(await pending, "goed");
    assert.deepEqual([...cache.entries.keys()], ["remembered-read|good|[]"]);
  });

  it("gives every answer its lifetime and the tag a save drops it by", async () => {
    const cache = fakeCache();
    const read = rememberedRead("t", async (a: string, b: boolean) => `${a}${b}`, { seconds: 45 }, cache.layer);
    await read("x", true);
    assert.deepEqual(cache.seen[0], { key: 'remembered-read|t|["x",true]', revalidate: 45, tags: [REMEMBERED_READ_TAG] });
  });

  it("never lets two sets of arguments share a key", async () => {
    const cache = fakeCache();
    const read = rememberedRead("t", async (key: string, tenant: string) => `${key} van ${tenant}`, { seconds: 60 }, cache.layer);
    assert.equal(await read("a,b", "c"), "a,b van c");
    assert.equal(await read("a", "b,c"), "a van b,c");
    assert.equal(await read("hero", null as unknown as string), "hero van null");
    assert.equal(await read("hero", "null"), "hero van null");
    assert.equal(cache.entries.size, 4);
  });
});

describe("a few reads at a time", () => {
  /** Reads that stay open until released, and count how many are open at once. */
  function gatedReads() {
    let open = 0;
    let most = 0;
    const release: Array<() => void> = [];
    const read = async (name: string) => {
      open++;
      most = Math.max(most, open);
      await new Promise<void>((r) => release.push(r));
      open--;
      return name;
    };
    return { read, release, most: () => most, open: () => open };
  }
  const tick = () => new Promise<void>((r) => setImmediate(r));

  it("opens no more than three reads at once, and the rest follow as they finish", async () => {
    const cache = fakeCache();
    const gate = gatedReads();
    const read = rememberedRead("turns", gate.read, { seconds: 60 }, cache.layer);
    const all = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((n) => read(n));
    await tick();
    assert.equal(gate.open(), READS_AT_ONCE);
    while (gate.release.length > 0) { gate.release.shift()!(); await tick(); }
    assert.deepEqual(await Promise.all(all), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);
    assert.equal(gate.most(), READS_AT_ONCE);
  });

  it("gives the slot back when a read fails, so the next ones are not held up", async () => {
    const cache = fakeCache();
    const broken = rememberedRead("turns-broken", async (_n: number): Promise<number> => { throw new Error("stuk"); }, { seconds: 60 }, cache.layer);
    for (let i = 0; i < 8; i++) await assert.rejects(broken(i), /stuk/);
    const gate = gatedReads();
    const read = rememberedRead("turns-after", gate.read, { seconds: 60 }, cache.layer);
    const pending = [read("a"), read("b"), read("c")];
    await tick();
    assert.equal(gate.open(), 3, "all three slots are free again");
    gate.release.splice(0).forEach((r) => r());
    await Promise.all(pending);
  });

  it("lets a read go after two seconds of waiting, whatever holds the slots", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cache = fakeCache();
    const gate = gatedReads();
    const read = rememberedRead("turns-hang", gate.read, { seconds: 60 }, cache.layer);
    const hanging = [read("a"), read("b"), read("c")];
    const late = read("d");
    await tick();
    assert.equal(gate.open(), 3);
    t.mock.timers.tick(WAIT_FOR_A_TURN_MS);
    await tick();
    assert.equal(gate.open(), 4, "the fourth read no longer waits for a slot");
    gate.release.splice(0).forEach((r) => r());
    assert.deepEqual(await Promise.all([...hanging, late]), ["a", "b", "c", "d"]);
    // The read that went without a slot must not give one back it never had.
    const gate2 = gatedReads();
    const read2 = rememberedRead("turns-hang-2", gate2.read, { seconds: 60 }, cache.layer);
    const more = ["e", "f", "g", "h"].map((n) => read2(n));
    await tick();
    assert.equal(gate2.open(), READS_AT_ONCE);
    while (gate2.release.length > 0) { gate2.release.shift()!(); await tick(); }
    await Promise.all(more);
  });
});

describe("a read the visitor waits for goes first", () => {
  const tick = () => new Promise<void>((r) => setImmediate(r));

  it("holds the refresh until the visitor's read has answered", async () => {
    const cache = fakeCache();
    const order: string[] = [];
    let answer!: (v: string) => void;
    const visitor = foregroundRead(new Promise<string>((r) => { answer = r; }));
    const read = rememberedRead("first", async (n: string) => { order.push(`config ${n}`); return n; }, { seconds: 60 }, cache.layer);
    const pending = [read("a"), read("b")];
    await tick();
    assert.equal(order.length, 0, "no configuration read starts while the visitor's read is under way");
    order.push("visitor answered");
    answer("klaar");
    assert.equal(await visitor, "klaar");
    await Promise.all(pending);
    assert.deepEqual(order, ["visitor answered", "config a", "config b"]);
  });

  it("does not wait when nothing is under way, and not after a failed visitor read", async () => {
    const cache = fakeCache();
    const failing = foregroundRead(Promise.reject(new Error("stuk")));
    await assert.rejects(failing, /stuk/);
    await tick();
    const read = rememberedRead("first-free", async () => "antwoord", { seconds: 60 }, cache.layer);
    assert.equal(await read(), "antwoord");
  });

  it("waits no longer than two seconds for a visitor read that hangs", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const cache = fakeCache();
    let asked = 0;
    void foregroundRead(new Promise<void>(() => {}));
    const read = rememberedRead("first-hang", async () => { asked++; return "antwoord"; }, { seconds: 60 }, cache.layer);
    const pending = read();
    await tick();
    assert.equal(asked, 0);
    t.mock.timers.tick(WAIT_FOR_A_TURN_MS);
    assert.equal(await pending, "antwoord");
  });
});

describe("the stores say when a read failed", () => {
  // Each of these answers a database error with an empty value. Without the
  // note, that empty value would be remembered as the configuration.
  const cases: [string, string, number][] = [
    ["tenant/tenant-store.ts", "pipeline stages", 2],
    ["platform/platform-store.ts", "platform settings", 2],
    ["lib/design-effect-sets/effect-sets-store.ts", "effect sets", 2],
    ["lib/adaptive-blocks/adaptive-blocks-store.ts", "block by key and block list", 4],
    ["billing/plan-enforcement.ts", "plan, session count and credits", 6],
    ["interest-profiles/repository.ts", "the tenant's interest profile overrides", 2],
  ];
  for (const [file, what, expected] of cases) {
    it(`${what} (${file})`, async () => {
      const { readFileSync } = await import("node:fs");
      const notes = (readFileSync(file, "utf8").match(/noteFailedRead\(\)/g) ?? []).length;
      assert.equal(notes, expected);
    });
  }
});
