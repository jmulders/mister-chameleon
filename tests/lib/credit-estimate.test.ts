/**
 * The estimate behind the calculator on the price list (25 Nov 2026), and the
 * rule that the page shows no price it did not read from the pricing table.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estimateMonthlyCredits } from "@/lib/credit-estimate";

describe("credits per month", () => {
  it("charges a per-visit source once for every visit with consent", () => {
    // 25,000 visits, half with consent, one source of 0.03 credit.
    assert.equal(estimateMonthlyCredits({ visits: 25_000, consentShare: 0.5, recognisedShare: 0, creditsPerVisit: 0.03, creditsPerCompany: 0 }).credits, 375);
  });

  it("adds the lookup and the recognition for every recognised company", () => {
    // 12,500 with consent. Network 0.03 each = 375. A tenth recognised: 1,250 x 1.03 = 1,287.5.
    const out = estimateMonthlyCredits({ visits: 25_000, consentShare: 0.5, recognisedShare: 0.1, creditsPerVisit: 0.03, creditsPerCompany: 1.03 });
    assert.equal(out.credits, 1663, "rounded up, because it is an upper bound");
    assert.equal(out.cents, 1663, "one credit is one cent");
  });

  it("is nothing without consent or without visits", () => {
    assert.equal(estimateMonthlyCredits({ visits: 25_000, consentShare: 0, recognisedShare: 1, creditsPerVisit: 1, creditsPerCompany: 1 }).credits, 0);
    assert.equal(estimateMonthlyCredits({ visits: 0, consentShare: 1, recognisedShare: 1, creditsPerVisit: 1, creditsPerCompany: 1 }).credits, 0);
  });

  it("keeps a share between nothing and everything, and ignores nonsense", () => {
    const base = { visits: 1000, recognisedShare: 0, creditsPerVisit: 1, creditsPerCompany: 0 };
    assert.equal(estimateMonthlyCredits({ ...base, consentShare: 3 }).credits, 1000);
    assert.equal(estimateMonthlyCredits({ ...base, consentShare: -1 }).credits, 0);
    assert.equal(estimateMonthlyCredits({ ...base, consentShare: Number.NaN }).credits, 0);
    assert.equal(estimateMonthlyCredits({ ...base, visits: -5, consentShare: 1 }).credits, 0);
  });

  it("does not turn a rounding error into an extra credit", () => {
    // 100 x 0.03 is 3.0000000000000004 in floating point.
    assert.equal(estimateMonthlyCredits({ visits: 100, consentShare: 1, recognisedShare: 0, creditsPerVisit: 0.03, creditsPerCompany: 0 }).credits, 3);
  });
});

describe("the prices on the price list", () => {
  const reader = readFileSync("lib/billing/public-lookup-prices.ts", "utf8");
  const page   = readFileSync("app/(site)/prijzen/page.tsx", "utf8");
  const calc   = readFileSync("app/(site)/prijzen/_components/CreditCalculator.tsx", "utf8");

  it("come from the table the platform charges from", () => {
    assert.match(reader, /\.from\("enrichment_pricing"\)/);
    assert.match(reader, /credit_cost/);
    // The same column the tracker debits with.
    assert.match(readFileSync("billing/enrichment-tracker.ts", "utf8"), /Number\(r\.credit_cost\)/);
    // The recognition is the constant the lead base charges.
    assert.match(reader, /recognition: RECOGNITION_CREDIT_COST/);
  });

  it("are not shown when a price is missing or the table cannot be read", () => {
    assert.match(reader, /if \(value === undefined\) return null;/);
    assert.match(reader, /catch \{\s*return null;/);
    assert.match(page, /\{lookupPrices && \(/);
  });

  it("are not written into the page or the calculator", () => {
    // No literal price of a lookup anywhere but the pricing table.
    assert.doesNotMatch(page, /0[.,]0[36]/);
    assert.doesNotMatch(calc, /0[.,]0[36]/);
    assert.match(calc, /prices\[s\.key\]/);
    assert.match(calc, /prices\.company \+ prices\.recognition/);
  });
});
