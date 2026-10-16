/**
 * fetchVisitorHistory and updateBehaviorState must run their independent reads
 * CONCURRENTLY. Both used `Promise.all([asRows(await q1), asRows(await q2), …])`:
 * the `await` inside each array element runs while the array literal is being
 * built, so the queries ran one after another and Promise.all only ever saw
 * already-settled values. Latency was the SUM of the queries, not the max.
 *
 * The Supabase client is pointed at a stub host and `fetch` is stubbed with a
 * small delay that records how many REST requests are in flight at once. Env is
 * set BEFORE the dynamic import because lib/env reads it at module load.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL  = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";

const origFetch = globalThis.fetch;

let inFlight = 0;
let maxInFlight = 0;
const tables: string[] = [];

function tableOf(u: unknown): string {
  const m = /\/rest\/v1\/([^?]+)/.exec(String(u));
  return m?.[1] ?? "?";
}

type HistoryMod = typeof import("../../context/fetch-visitor-history.ts");
type BehaviorMod = typeof import("../../lib/journey/update-behavior-state.ts");
let fetchVisitorHistory: HistoryMod["fetchVisitorHistory"];
let updateBehaviorState: BehaviorMod["updateBehaviorState"];

describe("history / behavior-state reads run in parallel", () => {
  before(async () => {
    globalThis.fetch = async (u: unknown, init?: RequestInit) => {
      tables.push(`${init?.method ?? "GET"} ${tableOf(u)}`);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 25));
      inFlight--;
      const table = tableOf(u);
      const body =
        table === "events" ? [{ created_at: "2026-10-01T00:00:00Z", payload: {} }] :
        table === "served_variants" ? [{ hero_key: "h1", cta_key: "c1" }] :
        [];
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
    ({ fetchVisitorHistory } = await import("../../context/fetch-visitor-history.ts"));
    ({ updateBehaviorState } = await import("../../lib/journey/update-behavior-state.ts"));
  });

  after(() => { globalThis.fetch = origFetch; });

  beforeEach(() => { inFlight = 0; maxInFlight = 0; tables.length = 0; });

  it("fetchVisitorHistory issues all four reads concurrently and keeps its results", async () => {
    const h = await fetchVisitorHistory("sess-par-1", "t-par");
    assert.equal(maxInFlight, 4, `expected the 4 reads in flight together, got ${maxInFlight} (${tables.join(", ")})`);
    assert.equal(h.fromDatabase, true);
    assert.equal(h.pageViewCount, 1);
    assert.equal(h.ctaClickCount, 1);
    assert.equal(h.lastHeroKey, "h1");
    assert.equal(h.lastCtaKey, "c1");
  });

  it("updateBehaviorState issues its four reads concurrently, then upserts", async () => {
    await updateBehaviorState("sess-par-2", "t-par");
    const reads = tables.filter((t) => t.startsWith("GET "));
    assert.equal(reads.length, 4);
    assert.equal(maxInFlight, 4, `expected the 4 reads in flight together, got ${maxInFlight} (${tables.join(", ")})`);
  });
});
