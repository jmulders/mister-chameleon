/**
 * computeDerivedContext — companyType and industryGroup.
 *
 * Found on 25 Nov 2026: Leadinfo reports the number of employees as a plain
 * number in a string (production holds company_size = "52"). deriveCompanyType
 * knew only buckets such as "51-200", so a plain number fell through every
 * pattern and became "unknown". And the English keyword match misread SBI
 * industry names ("Wholesale of fruit and vegetables" contains "it " and read
 * as tech), so for an industry that comes from Leadinfo the SBI division decides.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { computeDerivedContext } from "../../context/derived-context.ts";
import { lookupSbiIndustry } from "../../lib/enrichment/sbi-2025.ts";
import type { RuleEvaluationContext } from "../../decision/rules/field-registry.ts";
import type { EnrichmentOutput } from "../../enrichment/types.ts";

function derive(enrichment: Partial<EnrichmentOutput>) {
  const ctx = {
    source: "direct", visitType: "new", device: "desktop",
    currentHour: 10, isWeekend: false, month: 11,
    enrichment,
  } as unknown as RuleEvaluationContext;
  return computeDerivedContext(ctx);
}

const companyType = (companySize: unknown, extra: Partial<EnrichmentOutput> = {}) =>
  derive({ companyName: "Acme BV", companySize: companySize as string | null, ...extra }).companyType;

describe("companyType — existing buckets keep their class", () => {
  const cases: [string, string][] = [
    ["1-10", "startup"], ["11-50", "startup"],
    ["51-200", "smb"],
    ["201-500", "mid-market"], ["501-1000", "mid-market"], ["201-1000", "mid-market"],
    ["1001-5000", "enterprise"], ["5001+", "enterprise"], ["10001+", "enterprise"],
    ["1000+", "enterprise"], ["5000+", "enterprise"], ["10000+", "enterprise"],
    ["Enterprise", "enterprise"], ["Large company", "enterprise"],
    ["Medium", "mid-market"], ["Small business", "smb"], ["Micro", "startup"],
    ["10-49", "unknown"], ["n/a", "unknown"],
  ];
  for (const [size, expected] of cases) {
    it(`"${size}" is ${expected}`, () => assert.equal(companyType(size), expected));
  }
});

describe("companyType — a plain head count", () => {
  const cases: [string, string][] = [
    ["1", "startup"], ["21", "startup"], ["50", "startup"],
    ["51", "smb"], ["52", "smb"], ["200", "smb"],
    ["201", "mid-market"], ["250", "mid-market"], ["1000", "mid-market"],
    ["1001", "enterprise"], ["5001", "enterprise"], ["10010", "enterprise"], ["250000", "enterprise"],
    // thousands separators: Dutch point, English comma, a space
    ["1.200", "enterprise"], ["1,200", "enterprise"], ["1 200", "enterprise"], ["12.500", "enterprise"],
    [" 52 ", "smb"],
  ];
  for (const [size, expected] of cases) {
    it(`"${size}" is ${expected}`, () => assert.equal(companyType(size), expected));
  }

  it("a number that is not a head count stays unknown", () => {
    assert.equal(companyType("0"), "unknown");
    assert.equal(companyType("1.5"), "unknown");
    assert.equal(companyType("52.0"), "unknown");
    assert.equal(companyType("-5"), "unknown");
  });

  it("accepts a number that arrives as a number", () => {
    assert.equal(companyType(52), "smb");
  });
});

describe("companyType — leadinfoEmployeesTotal as a fallback", () => {
  it("is used when companySize is empty", () => {
    assert.equal(companyType(null, { leadinfoEmployeesTotal: 21 }), "startup");
    assert.equal(companyType("", { leadinfoEmployeesTotal: 120 }), "smb");
    assert.equal(companyType(undefined, { leadinfoEmployeesTotal: 250 }), "mid-market");
    assert.equal(companyType(null, { leadinfoEmployeesTotal: 1001 }), "enterprise");
  });

  it("is used when companySize says nothing recognisable", () => {
    assert.equal(companyType("n/a", { leadinfoEmployeesTotal: 300 }), "mid-market");
    assert.equal(companyType("0", { leadinfoEmployeesTotal: 300 }), "mid-market");
  });

  it("does not override a companySize that can be read", () => {
    assert.equal(companyType("52", { leadinfoEmployeesTotal: 5000 }), "smb");
    assert.equal(companyType("51-200", { leadinfoEmployeesTotal: 5000 }), "smb");
  });

  it("ignores a total of zero or less", () => {
    assert.equal(companyType(null, { leadinfoEmployeesTotal: 0 }), null);
    assert.equal(companyType(null, { leadinfoEmployeesTotal: -3 }), null);
    assert.equal(companyType("n/a", { leadinfoEmployeesTotal: 0 }), "unknown");
  });

  it("stays null without any size, and without a company", () => {
    assert.equal(companyType(null), null);
    assert.equal(derive({ companySize: "52", leadinfoEmployeesTotal: 21 }).companyType, null);
  });
});

describe("industryGroup — SBI division of the Leadinfo branch code", () => {
  // Industry text as the generic field holds it after the Leadinfo fill.
  const fromLeadinfo = (code: string) =>
    derive({ companyIndustry: lookupSbiIndustry(code)?.en ?? null, leadinfoBranchCode: code }).industryGroup;

  const cases: [string, string][] = [
    ["62100", "tech"], ["63100", "tech"],
    ["64110", "finance"], ["65111", "finance"], ["66110", "finance"],
    ["86101", "healthcare"], ["87100", "healthcare"], ["88101", "healthcare"],
    ["69101", "professional-services"], ["70101", "professional-services"],
    ["73110", "professional-services"], ["74110", "professional-services"],
    ["78100", "professional-services"],
    ["46110", "retail"], ["47110", "retail"],
    ["10110", "manufacturing"], ["33110", "manufacturing"],
  ];
  for (const [code, expected] of cases) {
    it(`SBI ${code} is ${expected}`, () => {
      assert.ok(lookupSbiIndustry(code), `SBI ${code} must exist in the table`);
      assert.equal(fromLeadinfo(code), expected);
    });
  }

  it("fixes an SBI name the keyword match misreads", () => {
    const code = "46311"; // Wholesale of fruit and vegetables, except ware potatoes
    const name = lookupSbiIndustry(code)?.en;
    assert.ok(name, "SBI 46311 must exist in the table");
    // The words alone: "fruit and" contains "it " and reads as tech.
    assert.equal(derive({ companyIndustry: name }).industryGroup, "tech");
    // With the code the wholesale division decides.
    assert.equal(derive({ companyIndustry: name, leadinfoBranchCode: code }).industryGroup, "retail");
  });

  it("works from the code alone, without an industry text", () => {
    assert.equal(derive({ leadinfoBranchCode: "62100" }).industryGroup, "tech");
  });

  it("falls back to the keyword match for a division without a group", () => {
    // 75000 veterinary activities: no group for division 75, no keyword either.
    assert.equal(fromLeadinfo("75000"), "other");
    // 85 education is not mapped; the code alone gives nothing.
    assert.equal(derive({ leadinfoBranchCode: "85201" }).industryGroup, null);
  });

  it("reads the division only from a five-digit code", () => {
    // "6200" is 06.20 extraction of natural gas with its leading zero dropped,
    // not division 62.
    assert.equal(derive({ leadinfoBranchCode: "6200" }).industryGroup, null);
    assert.equal(derive({ leadinfoBranchCode: "62" }).industryGroup, null);
    assert.equal(derive({ leadinfoBranchCode: "abcde" }).industryGroup, null);
  });

  it("does not overrule an industry another provider set", () => {
    assert.equal(
      derive({ companyIndustry: "Hospital & Health Care", leadinfoBranchCode: "73110" }).industryGroup,
      "healthcare",
    );
  });

  it("keeps the keyword match and the CRM fallback as they were", () => {
    assert.equal(derive({ companyIndustry: "Software" }).industryGroup, "tech");
    assert.equal(derive({ crmIndustry: "Banking" }).industryGroup, "finance");
    assert.equal(derive({ companyIndustry: "Something else" }).industryGroup, "other");
    assert.equal(derive({}).industryGroup, null);
  });
});
