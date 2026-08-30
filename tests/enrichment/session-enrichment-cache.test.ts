/**
 * Session enrichment cache — retry-entry semantics.
 *
 * A pipeline run that came back INCOMPLETE (a transient upstream failure, e.g. a
 * PDOK geocode timeout that left the CBS location empty) must NOT pin that empty
 * result for the full 4h session TTL. It is stored with `{ retry: true }` and a
 * short retry TTL, then treated as a hard miss so the pipeline re-runs soon,
 * while a NORMAL entry keeps its long TTL.
 *
 * TTLs are read from env at module load, so we set them BEFORE a dynamic import.
 * Retry TTL = 0s (a retry entry is stale the moment real time advances); the
 * normal TTL stays at an hour so we can prove the two paths diverge.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_CACHE_RETRY_TTL_SECONDS   = "0";
process.env.SESSION_CACHE_TTL_SECONDS         = "3600";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type Mod = typeof import("../../enrichment/session-enrichment-cache.ts");
let cache: Mod;

const tick = () => new Promise((r) => setTimeout(r, 5)); // let real time advance a few ms

describe("session enrichment cache — retry entries", () => {
  before(async () => {
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  it("a normal entry stays fresh; a retry entry is evicted after its short TTL", async () => {
    cache.setSessionEnrichment("normal-1", { countryCode: "NL" }, "1.2.3.4", "t1");
    cache.setSessionEnrichment("retry-1", {}, "1.2.3.4", "t1", { retry: true });

    await tick(); // real time advances past the 0s retry TTL (but well under 3600s)

    const normal = await cache.getSessionEnrichment("normal-1", "1.2.3.4", "t1");
    assert.equal(normal.hit, true, "the normal entry is still a fresh hit");

    const retry = await cache.getSessionEnrichment("retry-1", "1.2.3.4", "t1");
    assert.equal(retry.hit, false, "the transient retry entry is a miss → pipeline re-runs");
    if (!retry.hit) assert.equal(retry.reason, "ttl-expired");

    // Sanity: the normal entry, stored the same instant, is NOT evicted — proving
    // the divergence is due to the retry flag's short TTL, not elapsed time.
    assert.equal((await cache.getSessionEnrichment("normal-1", "1.2.3.4", "t1")).hit, true);
  });
});
