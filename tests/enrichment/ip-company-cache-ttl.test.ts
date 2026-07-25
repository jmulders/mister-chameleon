/**
 * Unit tests for the pure IP→company cache logic (freshness + row mapping).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  isFresh, rowToOutput, buildIpCompanyRow,
  MATCH_TTL_MS, NO_MATCH_TTL_MS,
  type IpCompanyRow,
} from "../../enrichment/ip-company-cache-ttl.ts";

const NOW = Date.parse("2026-07-24T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function row(over: Partial<IpCompanyRow> = {}): IpCompanyRow {
  return {
    matched: true, company_name: "Acme", company_domain: "acme.com",
    company_industry: "Software", company_size: "51-200",
    country_code: "NL", region: "NH", city: "Amsterdam",
    refreshed_at: ago(0), ...over,
  };
}

describe("isFresh", () => {
  it("matched rows are fresh within 30 days, stale after", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: ago(29 * 86_400_000) }, NOW), true);
    assert.equal(isFresh({ matched: true, refreshed_at: ago(31 * 86_400_000) }, NOW), false);
  });

  it("no-match rows are fresh within 7 days, stale after", () => {
    assert.equal(isFresh({ matched: false, refreshed_at: ago(6 * 86_400_000) }, NOW), true);
    assert.equal(isFresh({ matched: false, refreshed_at: ago(8 * 86_400_000) }, NOW), false);
  });

  it("uses the right TTL per matched flag (a no-match at 10d is stale, a match is fresh)", () => {
    assert.equal(isFresh({ matched: true,  refreshed_at: ago(10 * 86_400_000) }, NOW), true);
    assert.equal(isFresh({ matched: false, refreshed_at: ago(10 * 86_400_000) }, NOW), false);
  });

  it("missing or unparseable timestamp → stale", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: null }, NOW), false);
    assert.equal(isFresh({ matched: true, refreshed_at: "not-a-date" }, NOW), false);
  });

  it("clock skew (row in the future) → treated as fresh", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: new Date(NOW + 60_000).toISOString() }, NOW), true);
  });

  it("honours custom TTL overrides", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: ago(2_000) }, NOW, { matchTtlMs: 1_000 }), false);
    assert.equal(isFresh({ matched: false, refreshed_at: ago(500) }, NOW, { noMatchTtlMs: 1_000 }), true);
  });

  it("default TTL constants are 30d / 7d", () => {
    assert.equal(MATCH_TTL_MS, 30 * 24 * 60 * 60 * 1_000);
    assert.equal(NO_MATCH_TTL_MS, 7 * 24 * 60 * 60 * 1_000);
  });
});

describe("rowToOutput", () => {
  it("maps a matched row to enrichment output", () => {
    const out = rowToOutput(row());
    assert.equal(out.companyName, "Acme");
    assert.equal(out.companyDomain, "acme.com");
    assert.equal(out.companyIndustry, "Software");
    assert.equal(out.companySize, "51-200");
    assert.equal(out.countryCode, "NL");
    assert.equal(out.region, "NH");
    assert.equal(out.city, "Amsterdam");
    assert.equal(out.companyMatchSource, "leadinfo");
    assert.equal(out.companyMatchConfidence, 0.75);
  });

  it("a no-match row maps to an empty output (no company)", () => {
    assert.deepEqual(rowToOutput(row({ matched: false })), {});
  });

  it("omits null fields", () => {
    const out = rowToOutput(row({ company_industry: null, city: null }));
    assert.equal("companyIndustry" in out, false);
    assert.equal("city" in out, false);
    assert.equal(out.companyName, "Acme");
  });
});

describe("buildIpCompanyRow", () => {
  it("maps enrichment output back to columns, keeps raw, sets refreshed_at", () => {
    const raw = { company: { name: "Acme" }, extra: "kept" };
    const built = buildIpCompanyRow(
      "1.2.3.4", true,
      { companyName: "Acme", companyDomain: "acme.com", companyIndustry: "Software", companySize: "51-200", countryCode: "NL" },
      raw, "2026-07-24T12:00:00.000Z",
    );
    assert.equal(built.ip, "1.2.3.4");
    assert.equal(built.matched, true);
    assert.equal(built.company_name, "Acme");
    assert.equal(built.company_domain, "acme.com");
    assert.equal(built.company_size, "51-200");
    assert.equal(built.region, null);   // not provided → null
    assert.deepEqual(built.raw, raw);
    assert.equal(built.refreshed_at, "2026-07-24T12:00:00.000Z");
  });

  it("no-match: matched=false, company columns null, raw defaults to null", () => {
    const built = buildIpCompanyRow("1.2.3.4", false, {}, null, "2026-07-24T12:00:00.000Z");
    assert.equal(built.matched, false);
    assert.equal(built.company_name, null);
    assert.equal(built.raw, null);
  });

  it("round-trips through rowToOutput for a matched entry", () => {
    const output = { companyName: "Acme", companyDomain: "acme.com", companyIndustry: "Software", companySize: "51-200", countryCode: "NL", region: "NH", city: "Amsterdam" };
    const built = buildIpCompanyRow("1.2.3.4", true, output, null, NOW.toString());
    const back  = rowToOutput({ ...built, refreshed_at: built.refreshed_at } as unknown as IpCompanyRow);
    for (const k of Object.keys(output) as (keyof typeof output)[]) {
      assert.equal(back[k], output[k]);
    }
  });
});
