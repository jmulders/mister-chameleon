/**
 * Client-Leadinfo → ip_company_cache output mapping.
 *
 * Warming the server-side cache from a client identify must map LeadinfoData onto
 * the same Partial<EnrichmentOutput> shape the cache row stores, so a later
 * server-side decision from the same IP reads it back as a normal Leadinfo hit.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { leadinfoDataToCacheOutput } from "../../enrichment/leadinfo-cache-map.ts";
import { buildIpCompanyRow, rowToOutput, type IpCompanyRow } from "../../enrichment/ip-company-cache-ttl.ts";
import type { LeadinfoData } from "../../context/leadinfo-context.ts";

const DATA: LeadinfoData = {
  matched:         true,
  companyId:       "li_1",
  companyName:     "Nakatomi BV",
  companyCity:     "Amsterdam",
  companyDomain:   "nakatomi.example",
  companyCountry:  "NL",
  employees:       "51-200",
  employeesTotal:  120,
  salesVolume:     "1M-10M",
  cocNumber:       "12345678",
  branchCode:      "73110",
  branchCodeSic87: "7311",
};

describe("leadinfoDataToCacheOutput", () => {
  it("maps company fields + derives industry from the SBI code", () => {
    const out = leadinfoDataToCacheOutput(DATA);
    assert.equal(out.companyName, "Nakatomi BV");
    assert.equal(out.companyDomain, "nakatomi.example");
    assert.equal(out.countryCode, "NL");
    assert.equal(out.city, "Amsterdam");
    assert.equal(out.companySize, "51-200");
    assert.equal(out.companyIndustry, "Activities of advertising agencies"); // SBI 73110 (#297)
  });

  it("unknown SBI code → no industry (no crash)", () => {
    const out = leadinfoDataToCacheOutput({ ...DATA, branchCode: "00000" });
    assert.equal(out.companyIndustry, undefined);
    assert.equal(out.companyName, "Nakatomi BV");
  });

  it("round-trips through the cache row: build → read back a leadinfo match", () => {
    // Prove the warmed row reads back as a normal matched Leadinfo hit.
    const row = buildIpCompanyRow("hash123", true, leadinfoDataToCacheOutput(DATA), DATA);
    const back = rowToOutput({
      matched:          row.matched,
      company_name:     row.company_name,
      company_domain:   row.company_domain,
      company_industry: row.company_industry,
      company_size:     row.company_size,
      country_code:     row.country_code,
      region:           row.region,
      city:             row.city,
      refreshed_at:     row.refreshed_at,
    } as IpCompanyRow);
    assert.equal(back.companyName, "Nakatomi BV");
    assert.equal(back.companyDomain, "nakatomi.example");
    assert.equal(back.companyIndustry, "Activities of advertising agencies");
    assert.equal(back.companySize, "51-200");
    assert.equal(back.countryCode, "NL");
    assert.equal(back.city, "Amsterdam");
    // rowToOutput stamps the source on read (not stored by the mapper).
    assert.equal(back.companyMatchSource, "leadinfo");
  });
});
