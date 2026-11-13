/**
 * Database calls give up after a fixed time instead of hanging with a database
 * that does not answer.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert                                      from "node:assert/strict";

const env = process.env as Record<string, string | undefined>;

// lib/env reads these when it is first imported, so they are set before the
// dynamic imports below. The host does not exist; fetch is stubbed throughout.
env["NEXT_PUBLIC_SUPABASE_URL"]       = "https://db.invalid";
env["SUPABASE_SERVICE_ROLE_KEY"]      = "test-service-key";
env["SUPABASE_REST_READ_TIMEOUT_MS"]  = "200";
env["SUPABASE_REST_WRITE_TIMEOUT_MS"] = "400";
env["SUPABASE_REST_BREAKER_OPEN_MS"]  = "300";

const db = await import("@/data/db");
const { readPersistedSiteSettings } = await import("@/cms/providers/site-settings-cache-store");

const REST    = "https://db.invalid/rest/v1/tenant_settings?select=*";
const STORAGE = "https://db.invalid/storage/v1/object/assets/logo.png";

type Call = { url: string; init: RequestInit };

const realFetch = globalThis.fetch;
const realError = console.error;
let calls: Call[] = [];

/**
 * A database that never answers. A real fetch holds a socket and so keeps the
 * process running; this stub holds a timer of its own until the signal fires,
 * because the timer behind AbortSignal.timeout does not keep Node alive.
 */
function hang(): void {
  globalThis.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return new Promise<Response>((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error("no abort signal fired")), 5000);
      init.signal?.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        reject(init.signal!.reason);
      });
    });
  }) as typeof fetch;
}

function answer(body: string, status = 200): void {
  globalThis.fetch = ((input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return Promise.resolve(new Response(body, { status, headers: { "Content-Type": "application/json" } }));
  }) as typeof fetch;
}

before(() => { console.error = () => {}; });
// Every test starts with a closed breaker, so one test's timeouts do not
// reject the next test's calls.
beforeEach(() => db.resetRestBreaker());
after(() => { globalThis.fetch = realFetch; console.error = realError; });

describe("which requests get a time limit", () => {
  it("limits a PostgREST read to the read limit", () => {
    assert.equal(db.restTimeoutMs(REST, "GET", {}), db.DEFAULT_REST_READ_TIMEOUT_MS);
    assert.equal(db.restTimeoutMs(REST, undefined, {}), db.DEFAULT_REST_READ_TIMEOUT_MS);
    assert.equal(db.restTimeoutMs(REST, "head", {}), db.DEFAULT_REST_READ_TIMEOUT_MS);
  });

  it("gives writes and RPC calls the longer write limit", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      assert.equal(db.restTimeoutMs(REST, method, {}), db.DEFAULT_REST_WRITE_TIMEOUT_MS, method);
    }
    assert.equal(db.restTimeoutMs("https://db.invalid/rest/v1/rpc/credit_wallet", "POST", {}), db.DEFAULT_REST_WRITE_TIMEOUT_MS);
    assert.ok(db.DEFAULT_REST_WRITE_TIMEOUT_MS > db.DEFAULT_REST_READ_TIMEOUT_MS);
  });

  it("leaves storage, auth and anything that is not PostgREST alone", () => {
    assert.equal(db.restTimeoutMs(STORAGE, "POST", {}), null);
    assert.equal(db.restTimeoutMs("https://db.invalid/auth/v1/token", "POST", {}), null);
    assert.equal(db.restTimeoutMs("not a url", "GET", {}), null);
  });

  it("takes the limits from the environment, and 0 switches one off", () => {
    assert.equal(db.restTimeoutMs(REST, "GET",  { SUPABASE_REST_READ_TIMEOUT_MS: "1500" }), 1500);
    assert.equal(db.restTimeoutMs(REST, "POST", { SUPABASE_REST_WRITE_TIMEOUT_MS: "30000" }), 30000);
    assert.equal(db.restTimeoutMs(REST, "GET",  { SUPABASE_REST_READ_TIMEOUT_MS: "0" }), null);
    assert.equal(db.restTimeoutMs(REST, "GET",  { SUPABASE_REST_READ_TIMEOUT_MS: "nonsense" }), db.DEFAULT_REST_READ_TIMEOUT_MS);
    assert.equal(db.restTimeoutMs(REST, "GET",  { SUPABASE_REST_READ_TIMEOUT_MS: "-5" }), db.DEFAULT_REST_READ_TIMEOUT_MS);
  });
});

describe("a database that never answers", () => {
  it("ends a read after the read limit with a TimeoutError", async () => {
    calls = []; hang();
    const started = Date.now();
    await assert.rejects(db.supabaseFetch(REST), (err: Error) => err.name === "TimeoutError");
    const took = Date.now() - started;
    assert.ok(took >= 150 && took < 1500, `took ${took} ms`);
  });

  it("gives a write the longer limit", async () => {
    calls = []; hang();
    const started = Date.now();
    await assert.rejects(db.supabaseFetch(REST, { method: "POST", body: "{}" }), (err: Error) => err.name === "TimeoutError");
    const took = Date.now() - started;
    assert.ok(took >= 350 && took < 2000, `took ${took} ms`);
  });

  it("lets a real data function fall back instead of hanging", async () => {
    calls = []; hang();
    const started = Date.now();
    const settings = await readPersistedSiteSettings("statamic", "nl");
    const took = Date.now() - started;
    assert.equal(settings, null);
    assert.equal(calls.length, 1);
    assert.ok(calls[0]!.url.includes("/rest/v1/tenant_site_settings_cache"));
    assert.ok(took >= 150 && took < 1500, `took ${took} ms`);
  });

  it("is recognised as a transport failure, a cancelled statement is not", () => {
    assert.equal(db.isNetworkError("DatabaseUnavailableError: The database did not answer recently."), true);
    assert.equal(db.isNetworkError("TimeoutError: The operation was aborted due to timeout"), true);
    assert.equal(db.isNetworkError("AbortError: This operation was aborted"), true);
    assert.equal(db.isNetworkError("canceling statement due to statement timeout"), false);
    assert.equal(db.isNetworkError("relation \"nope\" does not exist"), false);
  });
});

describe("requests the limit must not disturb", () => {
  it("passes a quick answer through unchanged, with the cache switched off", async () => {
    calls = []; answer('[{"id":1}]');
    const res = await db.supabaseFetch(REST);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ id: 1 }]);
    assert.equal(calls[0]!.init.cache, "no-store");
    assert.ok(calls[0]!.init.signal, "a PostgREST call carries a signal");
  });

  it("gives a storage call no signal of its own", async () => {
    calls = []; answer("{}");
    await db.supabaseFetch(STORAGE, { method: "POST", body: "x" });
    assert.equal(calls[0]!.init.signal, undefined);
  });

  it("still honours a signal the caller passed", async () => {
    calls = []; hang();
    const controller = new AbortController();
    const pending = db.supabaseFetch(REST, { signal: controller.signal });
    setTimeout(() => controller.abort(), 30);
    const started = Date.now();
    await assert.rejects(pending, (err: Error) => err.name === "AbortError");
    assert.ok(Date.now() - started < 150, "ended by the caller, before the limit");
  });
});

describe("after two timeouts in a row", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function twoTimeouts(): Promise<void> {
    hang();
    await Promise.all([
      assert.rejects(db.supabaseFetch(REST)),
      assert.rejects(db.supabaseFetch(REST)),
    ]);
  }

  it("rejects the next call at once, without sending it", async () => {
    await twoTimeouts();
    calls = [];
    const started = Date.now();
    await assert.rejects(db.supabaseFetch(REST), (err: Error) => err.name === "DatabaseUnavailableError");
    assert.ok(Date.now() - started < 50, "no waiting");
    assert.equal(calls.length, 0, "nothing was sent");
  });

  it("rejects a write at once too, so it is certainly not applied", async () => {
    await twoTimeouts();
    calls = [];
    await assert.rejects(
      db.supabaseFetch(REST, { method: "POST", body: "{}" }),
      (err: Error) => err.name === "DatabaseUnavailableError",
    );
    assert.equal(calls.length, 0);
  });

  it("lets a real data function fall back at once", async () => {
    await twoTimeouts();
    calls = [];
    const started = Date.now();
    assert.equal(await readPersistedSiteSettings("statamic", "nl"), null);
    assert.ok(Date.now() - started < 100);
    assert.equal(calls.length, 0);
  });

  it("keeps storage calls going", async () => {
    await twoTimeouts();
    calls = []; answer("{}");
    const res = await db.supabaseFetch(STORAGE, { method: "POST", body: "x" });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
  });

  it("sends one probe after the open time, and an answer brings every call back", async () => {
    await twoTimeouts();
    await sleep(350);
    calls = []; answer("[]");
    assert.equal((await db.supabaseFetch(REST)).status, 200);
    assert.equal((await db.supabaseFetch(REST)).status, 200);
    assert.equal((await db.supabaseFetch(REST, { method: "POST", body: "{}" })).status, 200);
    assert.equal(calls.length, 3);
  });

  it("stays shut when the probe gets no answer either", async () => {
    await twoTimeouts();
    await sleep(350);
    calls = []; hang();
    await assert.rejects(db.supabaseFetch(REST), (err: Error) => err.name === "TimeoutError");
    assert.equal(calls.length, 1, "the probe went out");
    calls = [];
    await assert.rejects(db.supabaseFetch(REST), (err: Error) => err.name === "DatabaseUnavailableError");
    assert.equal(calls.length, 0);
  });

  it("does not count a call the caller aborted", async () => {
    hang();
    for (let i = 0; i < 3; i++) {
      const controller = new AbortController();
      const pending = db.supabaseFetch(REST, { signal: controller.signal });
      controller.abort();
      await assert.rejects(pending, (err: Error) => err.name === "AbortError");
    }
    calls = []; answer("[]");
    assert.equal((await db.supabaseFetch(REST)).status, 200);
    assert.equal(calls.length, 1);
  });
});
