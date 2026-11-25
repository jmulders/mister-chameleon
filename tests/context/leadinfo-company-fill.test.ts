/**
 * fillCompanyFromLeadinfo — the condition under which a client-side Leadinfo
 * match fills the generic company fields.
 *
 * Found on 25 Nov 2026: a tenant that recognises companies through the mc_li
 * cookie alone had no companyName / companyIndustry / companySize in the
 * decision context for a company Leadinfo did recognise, so no rule on those
 * fields (or on the derived companyType / industryGroup) could match.
 *
 * The condition: Leadinfo matched AND the generic field is empty. A value another
 * provider set is never overwritten.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { fillCompanyFromLeadinfo } from "../../context/leadinfo-company-fill.ts";
import { resolveCompanyFirmographics } from "../../lib/lead-base/leadinfo-company-fallback.ts";
import type { EnrichmentOutput } from "../../enrichment/types.ts";

const LEADINFO: Partial<EnrichmentOutput> = {
  leadinfoMatched:        true,
  leadinfoCompanyName:    "Steets B.V.",
  leadinfoCompanyDomain:  "steets.nl",
  leadinfoEmployees:      "52",
  leadinfoEmployeesTotal: 21,
  leadinfoBranchCode:     "73110",
};

describe("fillCompanyFromLeadinfo", () => {
  it("fills all four generic fields when Leadinfo is the only source", () => {
    const { enrichment, filled } = fillCompanyFromLeadinfo({ countryCode: "NL", ...LEADINFO });
    assert.equal(enrichment.companyName, "Steets B.V.");
    assert.equal(enrichment.companyDomain, "steets.nl");
    assert.equal(enrichment.companySize, "52");
    assert.equal(enrichment.companyIndustry, "Activities of advertising agencies");
    assert.deepEqual([...filled].sort(), ["companyDomain", "companyIndustry", "companyName", "companySize"]);
    // everything else survives, the leadinfo* fields included
    assert.equal(enrichment.countryCode, "NL");
    assert.equal(enrichment.leadinfoCompanyName, "Steets B.V.");
    assert.equal(enrichment.leadinfoEmployeesTotal, 21);
  });

  it("stamps the match source and confidence like the server-side Leadinfo stage", () => {
    const { enrichment } = fillCompanyFromLeadinfo({ ...LEADINFO });
    assert.equal(enrichment.companyMatchSource, "leadinfo");
    assert.equal(enrichment.companyMatchConfidence, 0.75);
  });

  it("never overwrites a value another provider set", () => {
    const input: Partial<EnrichmentOutput> = {
      ...LEADINFO,
      companyName:            "Acme BV",
      companyDomain:          "acme.example",
      companySize:            "201-500",
      companyIndustry:        "Software",
      companyMatchSource:     "openkvk",
      companyMatchConfidence: 0.9,
    };
    const { enrichment, filled } = fillCompanyFromLeadinfo(input);
    assert.deepEqual(filled, []);
    assert.equal(enrichment, input, "nothing to fill returns the same object");
  });

  it("fills only the fields that are empty, and leaves another provider's match source alone", () => {
    const { enrichment, filled } = fillCompanyFromLeadinfo({
      ...LEADINFO,
      companyName:            "Acme BV",
      companyMatchSource:     "openkvk",
      companyMatchConfidence: 0.9,
    });
    assert.equal(enrichment.companyName, "Acme BV");
    assert.equal(enrichment.companyDomain, "steets.nl");
    assert.equal(enrichment.companySize, "52");
    assert.equal(enrichment.companyIndustry, "Activities of advertising agencies");
    assert.equal(enrichment.companyMatchSource, "openkvk");
    assert.equal(enrichment.companyMatchConfidence, 0.9);
    assert.ok(!filled.includes("companyName"));
  });

  it("does not claim the match when it only added size or industry", () => {
    const { enrichment } = fillCompanyFromLeadinfo({
      ...LEADINFO, companyName: "Acme BV", companyDomain: "acme.example",
    });
    assert.equal(enrichment.companySize, "52");
    assert.equal(enrichment.companyMatchSource ?? null, null);
    assert.equal(enrichment.companyMatchConfidence ?? null, null);
  });

  it("treats null and a blank string as empty", () => {
    const { enrichment } = fillCompanyFromLeadinfo({
      ...LEADINFO, companyName: null, companyDomain: "  ", companySize: "", companyIndustry: null,
    });
    assert.equal(enrichment.companyName, "Steets B.V.");
    assert.equal(enrichment.companyDomain, "steets.nl");
    assert.equal(enrichment.companySize, "52");
    assert.equal(enrichment.companyIndustry, "Activities of advertising agencies");
  });

  it("does nothing unless Leadinfo matched", () => {
    for (const matched of [false, null, undefined]) {
      const input: Partial<EnrichmentOutput> = { ...LEADINFO, leadinfoMatched: matched as boolean | null };
      const { enrichment, filled } = fillCompanyFromLeadinfo(input);
      assert.deepEqual(filled, []);
      assert.equal(enrichment, input);
      assert.equal(enrichment.companyName ?? null, null);
    }
  });

  it("does nothing for a match without company data", () => {
    const input: Partial<EnrichmentOutput> = { leadinfoMatched: true };
    const { enrichment, filled } = fillCompanyFromLeadinfo(input);
    assert.deepEqual(filled, []);
    assert.equal(enrichment, input);
  });

  it("leaves the industry empty for an SBI code the table does not know", () => {
    const { enrichment, filled } = fillCompanyFromLeadinfo({ ...LEADINFO, leadinfoBranchCode: "00000" });
    assert.equal(enrichment.companyIndustry ?? null, null);
    assert.ok(!filled.includes("companyIndustry"));
    assert.equal(enrichment.companyName, "Steets B.V.");
  });

  it("does not mutate its input", () => {
    const input: Partial<EnrichmentOutput> = { ...LEADINFO };
    const before = JSON.stringify(input);
    fillCompanyFromLeadinfo(input);
    assert.equal(JSON.stringify(input), before);
  });

  it("is idempotent", () => {
    const once  = fillCompanyFromLeadinfo({ ...LEADINFO }).enrichment;
    const twice = fillCompanyFromLeadinfo(once);
    assert.deepEqual(twice.filled, []);
    assert.equal(twice.enrichment, once);
  });

  it("agrees with the lead base and the rule webhook on what the company is", () => {
    // Both read resolveCompanyFirmographics. After the fill, the generic fields
    // are what that function answers, so a profile, a webhook and a rule see
    // the same company.
    const cases: Partial<EnrichmentOutput>[] = [
      { ...LEADINFO },
      { ...LEADINFO, companyName: "Acme BV" },
      { ...LEADINFO, companySize: "201-500", companyIndustry: "Software" },
    ];
    for (const input of cases) {
      const { enrichment } = fillCompanyFromLeadinfo(input);
      assert.deepEqual(
        {
          companyName:     enrichment.companyName     ?? null,
          companyDomain:   enrichment.companyDomain   ?? null,
          companySize:     enrichment.companySize     ?? null,
          companyIndustry: enrichment.companyIndustry ?? null,
        },
        resolveCompanyFirmographics(input),
      );
    }
  });
});
