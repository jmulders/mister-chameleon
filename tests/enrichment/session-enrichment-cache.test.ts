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

describe("session enrichment cache — form-location (mc_loc) invalidation", () => {
  before(async () => {
    cache = await import("../../enrichment/session-enrichment-cache.ts");
  });

  const IP = "1.2.3.4";
  const T  = "statamic";
  // Fingerprints as produced by formLocationFingerprint (postcode|huisnummer|place).
  const NONE = null;
  const ADDR = "3904bt|3|";
  const ADDR2 = "3904bt|5|";

  it("null→value: browsed on IP-geo (no form loc), then a form submit sets a postcode+huisnummer → MISS → re-enrich", async () => {
    // Cached during browsing: no form location.
    cache.setSessionEnrichment("s-nullval", { countryCode: "NL" }, IP, T, { formLocationHash: NONE });
    // Next request AFTER the submit carries the new mc_loc fingerprint.
    const r = await cache.getSessionEnrichment("s-nullval", IP, T, ADDR);
    assert.equal(r.hit, false, "the stale IP-geo entry must not shadow the just-submitted address");
    if (!r.hit) assert.equal(r.reason, "formloc-changed");
  });

  it("value→different value: a second submit with a different house number → MISS", async () => {
    cache.setSessionEnrichment("s-diff", { countryCode: "NL" }, IP, T, { formLocationHash: ADDR });
    const r = await cache.getSessionEnrichment("s-diff", IP, T, ADDR2);
    assert.equal(r.hit, false);
    if (!r.hit) assert.equal(r.reason, "formloc-changed");
  });

  it("equal form location → HIT (no needless re-enrich)", async () => {
    cache.setSessionEnrichment("s-same", { countryCode: "NL" }, IP, T, { formLocationHash: ADDR });
    const r = await cache.getSessionEnrichment("s-same", IP, T, ADDR);
    assert.equal(r.hit, true, "same mc_loc keeps serving the cached enrichment");
  });

  it("no current form location → behaves as before (HIT), even when the entry was cached with one", async () => {
    // value stored, current request has no mc_loc → must NOT drop back to IP-geo.
    cache.setSessionEnrichment("s-valnull", { countryCode: "NL" }, IP, T, { formLocationHash: ADDR });
    assert.equal((await cache.getSessionEnrichment("s-valnull", IP, T, NONE)).hit, true);
    // null stored, current null → plain hit (unchanged legacy behaviour).
    cache.setSessionEnrichment("s-nullnull", { countryCode: "NL" }, IP, T);
    assert.equal((await cache.getSessionEnrichment("s-nullnull", IP, T, NONE)).hit, true);
    // 3-arg legacy call (no formloc arg at all) still works → hit.
    assert.equal((await cache.getSessionEnrichment("s-nullnull", IP, T)).hit, true);
  });

  it("IP/tenant checks still take precedence over an equal form location", async () => {
    cache.setSessionEnrichment("s-ip", { countryCode: "NL" }, IP, T, { formLocationHash: ADDR });
    const changedIp = await cache.getSessionEnrichment("s-ip", "9.9.9.9", T, ADDR);
    assert.equal(changedIp.hit, false);
    if (!changedIp.hit) assert.equal(changedIp.reason, "ip-changed");

    cache.setSessionEnrichment("s-tenant", { countryCode: "NL" }, IP, T, { formLocationHash: ADDR });
    const changedTenant = await cache.getSessionEnrichment("s-tenant", IP, "other", ADDR);
    assert.equal(changedTenant.hit, false);
    if (!changedTenant.hit) assert.equal(changedTenant.reason, "tenant-changed");
  });
});
