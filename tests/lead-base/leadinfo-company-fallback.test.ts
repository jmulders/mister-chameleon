/**
 * Lead-base firmographic resolution with a client-side Leadinfo fallback.
 *
 * Regression: recordVisitorProfile read only the generic firmographic fields, so a
 * client-Leadinfo-identified visitor (mc_li → leadinfo* fields) was recorded as
 * anonymous. resolveCompanyFirmographics must fall back to the leadinfo* fields
 * (and derive the industry from the SBI code) so the company — and thus the
 * "recognised" identity level — comes through.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveCompanyFirmographics } from "../../lib/lead-base/leadinfo-company-fallback.ts";
import type { EnrichmentOutput } from "../../enrichment/types.ts";

const enr = (o: Partial<EnrichmentOutput>): Partial<EnrichmentOutput> => o;

describe("resolveCompanyFirmographics", () => {
  it("prefers the generic server-side firmographic fields", () => {
    const r = resolveCompanyFirmographics(enr({
      companyName: "Acme BV", companyDomain: "acme.example",
      companySize: "51-200", companyIndustry: "SaaS",
      // leadinfo fields present but should NOT win
      leadinfoCompanyName: "Nakatomi BV", leadinfoBranchCode: "73110",
    }));
    assert.deepEqual(r, {
      companyName: "Acme BV", companyDomain: "acme.example",
      companySize: "51-200", companyIndustry: "SaaS",
    });
  });

  it("falls back to the client Leadinfo fields when the generic ones are empty", () => {
    const r = resolveCompanyFirmographics(enr({
      leadinfoCompanyName:   "Nakatomi BV",
      leadinfoCompanyDomain: "nakatomi.example",
      leadinfoEmployees:     "201-500",
      leadinfoBranchCode:    "73110",
    }));
    assert.equal(r.companyName, "Nakatomi BV");
    assert.equal(r.companyDomain, "nakatomi.example");
    assert.equal(r.companySize, "201-500");
    // industry derived from the SBI code via the #297 lookup
    assert.equal(r.companyIndustry, "Activities of advertising agencies");
  });

  it("industry stays null for an unknown SBI code (no crash)", () => {
    const r = resolveCompanyFirmographics(enr({ leadinfoCompanyName: "X BV", leadinfoBranchCode: "00000" }));
    assert.equal(r.companyName, "X BV");
    assert.equal(r.companyIndustry, null);
  });

  it("all-null when neither generic nor Leadinfo company is present", () => {
    assert.deepEqual(resolveCompanyFirmographics(enr({})), {
      companyName: null, companyDomain: null, companySize: null, companyIndustry: null,
    });
    assert.deepEqual(resolveCompanyFirmographics(null), {
      companyName: null, companyDomain: null, companySize: null, companyIndustry: null,
    });
  });
});
