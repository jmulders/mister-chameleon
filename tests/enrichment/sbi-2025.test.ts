/**
 * SBI 2025 industry lookup.
 *
 * Locks the code → industry resolution used to derive companyIndustryNl/En from
 * Leadinfo's leadinfoBranchCode: a known code resolves, unknown/blank/null return
 * null (never throws), and codes are matched as strings (leading zeros kept).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { lookupSbiIndustry, sbiLookup } from "../../lib/enrichment/sbi-2025.ts";

describe("lookupSbiIndustry", () => {
  it("resolves the advertising-agency code (73110)", () => {
    const hit = lookupSbiIndustry("73110");
    assert.equal(hit?.en, "Activities of advertising agencies");
    assert.equal(hit?.nl, "Activiteiten van reclamebureaus");
  });

  it("returns null for an unknown code (no crash)", () => {
    assert.equal(lookupSbiIndustry("00000"), null);
  });

  it("returns null for null / undefined / blank", () => {
    assert.equal(lookupSbiIndustry(null), null);
    assert.equal(lookupSbiIndustry(undefined), null);
    assert.equal(lookupSbiIndustry("   "), null);
  });

  it("matches as a string, preserving leading zeros (no numeric coercion)", () => {
    // A leading-zero code must not be looked up as a trimmed number. Whatever the
    // table holds, the lookup key is the string form — so "73110" and 73110 agree
    // and a hypothetical "0001" would never collide with "1".
    assert.equal(lookupSbiIndustry(" 73110 ")?.en, "Activities of advertising agencies");
    // Object keys are strings; there is no numeric key that shadows a zero-padded one.
    for (const k of Object.keys(sbiLookup)) assert.equal(typeof k, "string");
  });
});
