/**
 * Unit tests for the pure IP→company store logic (freshness + row mapping).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  isFresh, freshness, rowToOutput, buildIpCompanyRow,
  MATCH_TTL_MS, NO_MATCH_TTL_MS,
  HARD_RETENTION_MATCH_MS, HARD_RETENTION_NO_MATCH_MS,
  type IpCompanyRow,
} from "../../enrichment/ip-company-cache-ttl.ts";

const NOW = Date.parse("2026-07-24T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const DAY = 86_400_000;

function row(over: Partial<IpCompanyRow> = {}): IpCompanyRow {
  return {
    matched: true, company_name: "Acme", company_domain: "acme.com",
    company_industry: "Software", company_size: "51-200",
    country_code: "NL", region: "NH", city: "Amsterdam",
    refreshed_at: ago(0), confidence: null, last_verified_at: null,
    verify_count: 1, source: null, ...over,
  };
}

describe("isFresh", () => {
  it("matched rows are fresh within 30 days, stale after", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: ago(29 * DAY) }, NOW), true);
    assert.equal(isFresh({ matched: true, refreshed_at: ago(31 * DAY) }, NOW), false);
  });

  it("no-match rows are fresh within 7 days, stale after", () => {
    assert.equal(isFresh({ matched: false, refreshed_at: ago(6 * DAY) }, NOW), true);
    assert.equal(isFresh({ matched: false, refreshed_at: ago(8 * DAY) }, NOW), false);
  });

  it("missing or unparseable timestamp → not fresh", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: null }, NOW), false);
    assert.equal(isFresh({ matched: true, refreshed_at: "not-a-date" }, NOW), false);
  });

  it("clock skew (row in the future) → treated as fresh", () => {
    assert.equal(isFresh({ matched: true, refreshed_at: new Date(NOW + 60_000).toISOString() }, NOW), true);
  });

  it("prefers last_verified_at over refreshed_at when present", () => {
    // refreshed_at is recent, but the last paid verify was 31d ago → not fresh.
    assert.equal(
      isFresh({ matched: true, refreshed_at: ago(0), last_verified_at: ago(31 * DAY) }, NOW),
      false,
    );
  });
});

describe("freshness (serve-stale-while-revalidate)", () => {
  it("matched: fresh <30d, stale 30–180d, expired >180d", () => {
    assert.equal(freshness({ matched: true, refreshed_at: ago(10 * DAY) }, NOW), "fresh");
    assert.equal(freshness({ matched: true, refreshed_at: ago(60 * DAY) }, NOW), "stale");
    assert.equal(freshness({ matched: true, refreshed_at: ago(200 * DAY) }, NOW), "expired");
  });

  it("no-match: fresh <7d, stale 7–30d, expired >30d", () => {
    assert.equal(freshness({ matched: false, refreshed_at: ago(3 * DAY) }, NOW), "fresh");
    assert.equal(freshness({ matched: false, refreshed_at: ago(14 * DAY) }, NOW), "stale");
    assert.equal(freshness({ matched: false, refreshed_at: ago(45 * DAY) }, NOW), "expired");
  });

  it("missing/unparseable timestamp → expired", () => {
    assert.equal(freshness({ matched: true, refreshed_at: null }, NOW), "expired");
    assert.equal(freshness({ matched: true, refreshed_at: "nope" }, NOW), "expired");
  });

  it("clock skew → fresh", () => {
    assert.equal(freshness({ matched: true, refreshed_at: new Date(NOW + 60_000).toISOString() }, NOW), "fresh");
  });

  it("retention constants are 180d / 30d", () => {
    assert.equal(HARD_RETENTION_MATCH_MS, 180 * DAY);
    assert.equal(HARD_RETENTION_NO_MATCH_MS, 30 * DAY);
  });

  it("default soft-TTL constants are 30d / 7d", () => {
    assert.equal(MATCH_TTL_MS, 30 * DAY);
    assert.equal(NO_MATCH_TTL_MS, 7 * DAY);
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
    assert.equal(out.companyMatchSource, "leadinfo"); // null source → default
    assert.equal(out.companyMatchConfidence, 0.75);   // null confidence → default
  });

  it("carries stored confidence and source when present", () => {
    const out = rowToOutput(row({ confidence: 0.9, source: "openkvk" }));
    assert.equal(out.companyMatchConfidence, 0.9);
    assert.equal(out.companyMatchSource, "openkvk");
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
  it("maps enrichment output back to columns, keeps raw, sets timestamps + source", () => {
    const raw = { company: { name: "Acme" }, extra: "kept" };
    const built = buildIpCompanyRow(
      "deadbeef", true,
      { companyName: "Acme", companyDomain: "acme.com", companyIndustry: "Software", companySize: "51-200", countryCode: "NL" },
      raw, "leadinfo", 1, "2026-07-24T12:00:00.000Z",
    );
    assert.equal(built.ip_hash, "deadbeef");
    assert.equal(built.matched, true);
    assert.equal(built.company_name, "Acme");
    assert.equal(built.company_domain, "acme.com");
    assert.equal(built.company_size, "51-200");
    assert.equal(built.region, null);   // not provided → null
    assert.deepEqual(built.raw, raw);
    assert.equal(built.refreshed_at, "2026-07-24T12:00:00.000Z");
    assert.equal(built.last_verified_at, "2026-07-24T12:00:00.000Z");
    assert.equal(built.confidence, 0.75); // matched, no explicit confidence → default
    assert.equal(built.verify_count, 1);
    assert.equal(built.source, "leadinfo");
  });

  it("no-match: matched=false, company columns null, confidence null, raw defaults to null", () => {
    const built = buildIpCompanyRow("1.2.3.4", false, {}, null, "leadinfo", 1, "2026-07-24T12:00:00.000Z");
    assert.equal(built.matched, false);
    assert.equal(built.company_name, null);
    assert.equal(built.confidence, null);
    assert.equal(built.raw, null);
  });

  it("verify_count floors at 1", () => {
    const built = buildIpCompanyRow("1.2.3.4", true, { companyName: "X" }, null, "leadinfo", 0);
    assert.equal(built.verify_count, 1);
  });

  it("round-trips through rowToOutput for a matched entry", () => {
    const output = { companyName: "Acme", companyDomain: "acme.com", companyIndustry: "Software", companySize: "51-200", countryCode: "NL", region: "NH", city: "Amsterdam" };
    const built = buildIpCompanyRow("1.2.3.4", true, output, null, "leadinfo", 1, ago(0));
    const back  = rowToOutput({ ...built } as unknown as IpCompanyRow);
    for (const k of Object.keys(output) as (keyof typeof output)[]) {
      assert.equal(back[k], output[k]);
    }
  });
});
