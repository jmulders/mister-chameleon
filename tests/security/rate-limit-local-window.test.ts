/**
 * The in-memory allowance in front of the database rate-limit counter, and the
 * cutoff the cleanup cron uses.
 */

import { describe, it, beforeEach } from "node:test";
import assert                       from "node:assert/strict";
import {
  bumpLocal,
  decideLocally,
  effectiveCount,
  localAllowance,
  localSize,
  resetLocal,
  LOCAL_MAX_KEYS,
} from "@/lib/rate-limiting/local-window";
import { rateLimitCutoff, RATE_LIMIT_RETENTION_MS } from "@/lib/rate-limiting/cleanup";
import { checkRateLimit, RATE_LIMIT_TIMEOUT_MS }    from "@/lib/rate-limiting";

const W1 = "2026-11-13T14:37";
const W2 = "2026-11-13T14:38";

describe("local allowance", () => {
  beforeEach(() => resetLocal());

  it("is a quarter of the limit", () => {
    assert.equal(localAllowance("api", 120), 30);
    assert.equal(localAllowance("track", 60), 15);
    assert.equal(localAllowance("slot", 6000), 1500);
  });

  it("is nothing for auth, so every auth call is counted in the database", () => {
    assert.equal(localAllowance("auth", 20), 0);
    const first = decideLocally("auth", "auth:1.2.3.4", W1, 20);
    assert.equal(first.askDatabase, true);
    assert.equal(localSize(), 0);
  });

  it("keeps the first calls of a caller away from the database", () => {
    for (let i = 1; i <= 30; i++) {
      const d = decideLocally("api", "api:1.2.3.4", W1, 120);
      assert.equal(d.askDatabase, false, `call ${i}`);
      assert.equal(d.localCount, i);
    }
  });

  it("asks the database from the first call past the allowance", () => {
    for (let i = 1; i <= 30; i++) decideLocally("api", "api:1.2.3.4", W1, 120);
    assert.equal(decideLocally("api", "api:1.2.3.4", W1, 120).askDatabase, true);
    assert.equal(decideLocally("api", "api:1.2.3.4", W1, 120).askDatabase, true);
  });

  it("counts each caller on its own", () => {
    for (let i = 1; i <= 31; i++) decideLocally("api", "api:1.2.3.4", W1, 120);
    assert.equal(decideLocally("api", "api:5.6.7.8", W1, 120).askDatabase, false);
  });

  it("starts again in a new minute", () => {
    for (let i = 1; i <= 31; i++) decideLocally("api", "api:1.2.3.4", W1, 120);
    const d = decideLocally("api", "api:1.2.3.4", W2, 120);
    assert.equal(d.askDatabase, false);
    assert.equal(d.localCount, 1);
  });
});

describe("limit with the allowance included", () => {
  it("holds the calls that skipped the database against the limit", () => {
    // 30 calls passed locally, so the 90th database count is call 120: the last one allowed.
    assert.equal(effectiveCount("api", 120, 90), 120);
    assert.ok(effectiveCount("api", 120, 90) <= 120);
    assert.ok(effectiveCount("api", 120, 91) > 120);
  });

  it("leaves the auth count as the database gives it", () => {
    assert.equal(effectiveCount("auth", 20, 20), 20);
    assert.equal(effectiveCount("auth", 20, 21), 21);
  });
});

describe("local map size", () => {
  beforeEach(() => resetLocal());

  it("drops callers from older minutes when it is full", () => {
    for (let i = 0; i < LOCAL_MAX_KEYS; i++) bumpLocal(`api:old-${i}`, W1);
    assert.equal(localSize(), LOCAL_MAX_KEYS);
    bumpLocal("api:new", W2);
    assert.equal(localSize(), 1);
  });

  it("never grows past its ceiling within one minute", () => {
    for (let i = 0; i < LOCAL_MAX_KEYS + 10; i++) bumpLocal(`api:flood-${i}`, W1);
    assert.ok(localSize() <= LOCAL_MAX_KEYS);
  });

  it("does not empty the map for a caller it already knows", () => {
    for (let i = 0; i < LOCAL_MAX_KEYS; i++) bumpLocal(`api:k-${i}`, W1);
    assert.equal(bumpLocal("api:k-0", W1), 2);
    assert.equal(localSize(), LOCAL_MAX_KEYS);
  });
});

describe("cleanup cutoff", () => {
  it("keeps counters for fifteen minutes, longer than the ten-minute attempt window", () => {
    assert.ok(RATE_LIMIT_RETENTION_MS > 10 * 60 * 1000);
    const now = Date.parse("2026-11-13T15:00:00.000Z");
    assert.equal(rateLimitCutoff(now), "2026-11-13T14:45:00.000Z");
  });
});

describe("counter timeout", () => {
  it("gives up within a few seconds", () => {
    assert.ok(RATE_LIMIT_TIMEOUT_MS > 0 && RATE_LIMIT_TIMEOUT_MS <= 3000);
  });
});

// ── Wiring: checkRateLimit itself, outside the test bypass ────────────────────


/**
 * Run `body` as if in production with a stubbed fetch, then put everything back.
 * checkRateLimit returns early under NODE_ENV=test, so the wiring is only
 * reachable this way.
 */
async function asProduction(
  fetchStub: (url: string, init: RequestInit) => Promise<Response>,
  body:      (calls: Array<{ url: string; init: RequestInit }>) => Promise<void>,
): Promise<void> {
  const env       = process.env as Record<string, string | undefined>;
  const saved     = {
    node: env["NODE_ENV"],
    url:  env["NEXT_PUBLIC_SUPABASE_URL"],
    key:  env["SUPABASE_SERVICE_ROLE_KEY"],
  };
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const calls: Array<{ url: string; init: RequestInit }> = [];

  env["NODE_ENV"]                  = "production";
  env["NEXT_PUBLIC_SUPABASE_URL"]  = "https://db.invalid";
  env["SUPABASE_SERVICE_ROLE_KEY"] = "test-key";
  console.error = () => {};
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return fetchStub(url, init);
  }) as typeof fetch;

  try {
    resetLocal();
    await body(calls);
  } finally {
    globalThis.fetch = realFetch;
    console.error    = realError;
    env["NODE_ENV"]                  = saved.node;
    env["NEXT_PUBLIC_SUPABASE_URL"]  = saved.url;
    env["SUPABASE_SERVICE_ROLE_KEY"] = saved.key;
    resetLocal();
  }
}

describe("checkRateLimit wiring", () => {
  it("does not call the database for the first thirty api calls of a caller", async () => {
    await asProduction(
      async () => new Response("1", { status: 200 }),
      async (calls) => {
        for (let i = 1; i <= 30; i++) {
          const rl = await checkRateLimit("api", "203.0.113.9");
          assert.equal(rl.allowed, true);
          assert.equal(rl.count, i);
        }
        assert.equal(calls.length, 0);
      },
    );
  });

  it("calls the database from call 31 and adds the thirty that skipped it", async () => {
    let dbCount = 0;
    await asProduction(
      async () => new Response(String(++dbCount), { status: 200 }),
      async (calls) => {
        for (let i = 1; i <= 30; i++) await checkRateLimit("api", "203.0.113.9");
        const rl = await checkRateLimit("api", "203.0.113.9");
        assert.equal(calls.length, 1);
        assert.ok(calls[0]!.url.endsWith("/rest/v1/rpc/increment_rate_limit"));
        assert.equal(rl.count, 31);
        assert.equal(rl.allowed, true);
      },
    );
  });

  it("refuses once the database count plus the allowance passes the limit", async () => {
    await asProduction(
      async () => new Response("91", { status: 200 }),
      async () => {
        for (let i = 1; i <= 30; i++) await checkRateLimit("api", "203.0.113.9");
        const rl = await checkRateLimit("api", "203.0.113.9");
        assert.equal(rl.count, 121);
        assert.equal(rl.allowed, false);
      },
    );
  });

  it("counts every auth call in the database", async () => {
    await asProduction(
      async () => new Response("1", { status: 200 }),
      async (calls) => {
        await checkRateLimit("auth", "203.0.113.9");
        await checkRateLimit("auth", "203.0.113.9");
        assert.equal(calls.length, 2);
      },
    );
  });

  it("lets the request through when the database does not answer in time", async () => {
    await asProduction(
      // Never answers; only the abort signal ends it. A real fetch holds a
      // socket and so keeps the process running while it waits. This stub holds
      // nothing, and the timer behind AbortSignal.timeout does not keep Node
      // alive, so the stub holds a timer of its own until the signal fires.
      (_url, init) => new Promise<Response>((_resolve, reject) => {
        const keepAlive = setTimeout(() => reject(new Error("no abort signal fired")), RATE_LIMIT_TIMEOUT_MS + 3000);
        init.signal?.addEventListener("abort", () => {
          clearTimeout(keepAlive);
          reject(new Error("aborted"));
        });
      }),
      async (calls) => {
        const started = Date.now();
        const rl      = await checkRateLimit("auth", "203.0.113.9");
        const took    = Date.now() - started;
        assert.equal(calls.length, 1);
        assert.ok(calls[0]!.init.signal, "the counter call carries a timeout signal");
        assert.equal(rl.allowed, true);
        assert.ok(took >= RATE_LIMIT_TIMEOUT_MS - 100 && took < RATE_LIMIT_TIMEOUT_MS + 1500, `took ${took} ms`);
      },
    );
  });
});
