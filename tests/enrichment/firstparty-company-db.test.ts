/**
 * Unit tests for the first-party company-DB enricher stage.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { createFirstPartyCompanyDbEnricher } from "../../enrichment/providers/firstparty-company-db.ts";
import type { LeadinfoPersistentCache } from "../../enrichment/ip-company-cache-ttl.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";

const input = (ip: string | null) => ({ ip } as EnricherInput);
const acc = (over: Partial<EnrichmentOutput> = {}): Partial<EnrichmentOutput> => over;

function cacheReturning(output: Partial<EnrichmentOutput> | null): LeadinfoPersistentCache {
  return {
    get: async () => (output === null ? null : { output }),
    set: async () => {},
  };
}

describe("createFirstPartyCompanyDbEnricher — shouldRun", () => {
  const stage = createFirstPartyCompanyDbEnricher({ cache: cacheReturning(null) });

  it("runs with an IP, off cloud, no prior company", () => {
    assert.equal(stage.shouldRun!(input("1.2.3.4"), acc()), true);
  });
  it("skips without an IP", () => {
    assert.equal(stage.shouldRun!(input(null), acc()), false);
  });
  it("skips on cloud IPs", () => {
    assert.equal(stage.shouldRun!(input("1.2.3.4"), acc({ isCloudProvider: true })), false);
  });
  it("skips when a company is already resolved", () => {
    assert.equal(stage.shouldRun!(input("1.2.3.4"), acc({ companyName: "Acme" })), false);
  });
});

describe("createFirstPartyCompanyDbEnricher — enricher", () => {
  it("confident matched hit → returns company + firstparty source", async () => {
    const stage = createFirstPartyCompanyDbEnricher({
      cache: cacheReturning({ companyName: "Acme", companyDomain: "acme.com", companyMatchConfidence: 0.9, companyMatchSource: "leadinfo" }),
      confidenceThreshold: 0.6,
    });
    const out = await stage.enricher(input("1.2.3.4"), acc());
    assert.equal(out.companyName, "Acme");
    assert.equal(out.companyDomain, "acme.com");
    assert.equal(out.companyMatchSource, "firstparty"); // re-stamped
  });

  it("below-threshold hit → defers to paid providers ({})", async () => {
    const stage = createFirstPartyCompanyDbEnricher({
      cache: cacheReturning({ companyName: "Acme", companyMatchConfidence: 0.4 }),
      confidenceThreshold: 0.6,
    });
    assert.deepEqual(await stage.enricher(input("1.2.3.4"), acc()), {});
  });

  it("no-match / empty output → {}", async () => {
    const stage = createFirstPartyCompanyDbEnricher({ cache: cacheReturning({}) });
    assert.deepEqual(await stage.enricher(input("1.2.3.4"), acc()), {});
  });

  it("miss (null) → {}", async () => {
    const stage = createFirstPartyCompanyDbEnricher({ cache: cacheReturning(null) });
    assert.deepEqual(await stage.enricher(input("1.2.3.4"), acc()), {});
  });

  it("missing confidence defaults to 0 → below default threshold → {}", async () => {
    const stage = createFirstPartyCompanyDbEnricher({
      cache: cacheReturning({ companyName: "Acme" }), // no confidence
    });
    assert.deepEqual(await stage.enricher(input("1.2.3.4"), acc()), {});
  });

  it("no IP → {} (defensive)", async () => {
    const stage = createFirstPartyCompanyDbEnricher({
      cache: cacheReturning({ companyName: "Acme", companyMatchConfidence: 0.9 }),
    });
    assert.deepEqual(await stage.enricher(input(null), acc()), {});
  });
});
