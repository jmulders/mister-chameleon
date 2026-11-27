/**
 * VAT on what the platform charges, and the billing details that decide it.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import {
  addVat,
  EU_COUNTRIES,
  normaliseCountry,
  normaliseVatNumber,
  vatDecision,
  vatNote,
  vatNumberOfCountry,
  vatRateLabel,
} from "../../billing/vat.ts";
import { chargeAmounts, cleanBillingDetails, defaultBillingDetails, vatMetadata } from "../../billing/billing-details.ts";
import { planMolliePayment } from "../../billing/mollie-fulfil.ts";

describe("which VAT a customer is charged", () => {
  it("a Dutch customer pays 21%, with or without a VAT number", () => {
    assert.deepEqual(vatDecision({ country: "NL" }), { treatment: "nl", rateBp: 2100 });
    assert.deepEqual(vatDecision({ country: "NL", vatNumber: "NL851242893B02" }), { treatment: "nl", rateBp: 2100 });
  });

  it("nothing known is a Dutch customer: never too little VAT", () => {
    assert.deepEqual(vatDecision({}), { treatment: "nl", rateBp: 2100 });
    assert.deepEqual(vatDecision({ country: "" }), { treatment: "nl", rateBp: 2100 });
    assert.deepEqual(vatDecision({ country: "Nederland" }), { treatment: "nl", rateBp: 2100 });
  });

  it("an EU business with a VAT number of its own country has the VAT reverse-charged", () => {
    assert.deepEqual(vatDecision({ country: "BE", vatNumber: "BE0123456789" }), { treatment: "eu_reverse_charge", rateBp: 0 });
    assert.deepEqual(vatDecision({ country: "de", vatNumber: "de 123 456 789" }), { treatment: "eu_reverse_charge", rateBp: 0 });
    assert.deepEqual(vatDecision({ country: "GR", vatNumber: "EL123456789" }), { treatment: "eu_reverse_charge", rateBp: 0 });
  });

  it("an EU customer without a usable VAT number pays the Dutch rate", () => {
    assert.deepEqual(vatDecision({ country: "BE" }), { treatment: "eu_no_vat_number", rateBp: 2100 });
    assert.deepEqual(vatDecision({ country: "BE", vatNumber: "x" }), { treatment: "eu_no_vat_number", rateBp: 2100 });
    // A number of another country does not move the VAT.
    assert.deepEqual(vatDecision({ country: "BE", vatNumber: "DE123456789" }), { treatment: "eu_no_vat_number", rateBp: 2100 });
  });

  it("a customer outside the EU pays no Dutch VAT", () => {
    for (const country of ["GB", "US", "CH", "NO"]) assert.deepEqual(vatDecision({ country }), { treatment: "outside_eu", rateBp: 0 });
  });

  it("knows the 27 member states", () => {
    assert.equal(EU_COUNTRIES.length, 27);
    assert.equal(new Set(EU_COUNTRIES).size, 27);
    assert.equal(EU_COUNTRIES.includes("GB"), false);
  });
});

describe("the sum", () => {
  it("adds 21% in whole cents, rounded once on the total", () => {
    assert.deepEqual(addVat(34900, { treatment: "nl", rateBp: 2100 }), { netCents: 34900, vatCents: 7329, grossCents: 42229, rateBp: 2100, treatment: "nl" });
    assert.deepEqual(addVat(14900, { treatment: "nl", rateBp: 2100 }).grossCents, 18029);
    assert.deepEqual(addVat(74900, { treatment: "nl", rateBp: 2100 }).grossCents, 90629);
    assert.deepEqual(addVat(2900,  { treatment: "nl", rateBp: 2100 }).grossCents, 3509);
    // 21.48 times 0.21 is 4.5108: 451 cents.
    assert.deepEqual(addVat(2148, { treatment: "nl", rateBp: 2100 }).vatCents, 451);
    // Half a cent goes up.
    assert.deepEqual(addVat(50, { treatment: "nl", rateBp: 2100 }).vatCents, 11);
  });

  it("adds nothing at 0%", () => {
    assert.deepEqual(addVat(34900, { treatment: "eu_reverse_charge", rateBp: 0 }), { netCents: 34900, vatCents: 0, grossCents: 34900, rateBp: 0, treatment: "eu_reverse_charge" });
  });

  it("refuses an amount that is not a whole number of cents", () => {
    assert.throws(() => addVat(12.5, { treatment: "nl", rateBp: 2100 }));
    assert.throws(() => addVat(-1, { treatment: "nl", rateBp: 2100 }));
  });

  it("writes the rate and the sentence an invoice needs at 0%", () => {
    assert.equal(vatRateLabel(2100), "21%");
    assert.equal(vatRateLabel(0), "0%");
    assert.match(vatNote("eu_reverse_charge")!, /reverse-charged/);
    assert.match(vatNote("outside_eu")!, /outside the EU/);
    assert.equal(vatNote("nl"), null);
    assert.equal(vatNote("eu_no_vat_number"), null);
  });
});

describe("VAT numbers and countries", () => {
  it("tidies a VAT number and refuses what cannot be one", () => {
    assert.equal(normaliseVatNumber("nl 8512.42.893 b02"), "NL851242893B02");
    assert.equal(normaliseVatNumber("BE-0123.456.789"), "BE0123456789");
    assert.equal(normaliseVatNumber("851242893B02"), null, "without the country letters it is not a VAT number");
    assert.equal(normaliseVatNumber(""), null);
    assert.equal(normaliseVatNumber(null), null);
  });

  it("matches a number to its country, with Greece's own prefix", () => {
    assert.equal(vatNumberOfCountry("NL851242893B02", "NL"), true);
    assert.equal(vatNumberOfCountry("NL851242893B02", "BE"), false);
    assert.equal(vatNumberOfCountry("EL123456789", "GR"), true);
    assert.equal(vatNumberOfCountry(null, "NL"), false);
  });

  it("stores a country as two capitals, and anything else as the seller's own", () => {
    assert.equal(normaliseCountry("be"), "BE");
    assert.equal(normaliseCountry(" de "), "DE");
    assert.equal(normaliseCountry("Belgium"), "NL");
    assert.equal(normaliseCountry(undefined), "NL");
  });
});

describe("billing details", () => {
  it("accepts and tidies what a tenant types", () => {
    const r = cleanBillingDetails("voorbeeld", { company_name: "  Voorbeeld   BV ", address_line: "Straat 1", postal_code: "1234 AB", city: "Utrecht", country: "nl", vat_number: "nl 123456789 b01", invoice_email: "Factuur@Voorbeeld.nl" });
    assert.deepEqual(r, { ok: true, details: { tenant_id: "voorbeeld", company_name: "Voorbeeld BV", address_line: "Straat 1", postal_code: "1234 AB", city: "Utrecht", country: "NL", vat_number: "NL123456789B01", invoice_email: "factuur@voorbeeld.nl" } });
  });

  it("refuses a VAT number that is none, or that belongs to another country", () => {
    assert.equal(cleanBillingDetails("v", { country: "NL", vat_number: "12345" }).ok, false);
    const wrong = cleanBillingDetails("v", { country: "BE", vat_number: "NL123456789B01" });
    assert.equal(wrong.ok, false);
    assert.match(wrong.ok ? "" : wrong.error, /does not belong to the country/);
  });

  it("refuses a country that is not a code and an email address that is none", () => {
    assert.equal(cleanBillingDetails("v", { country: "Belgium" }).ok, false);
    assert.equal(cleanBillingDetails("v", { invoice_email: "geen adres" }).ok, false);
  });

  it("an empty form is a Dutch customer without a VAT number", () => {
    assert.deepEqual(cleanBillingDetails("v", {}), { ok: true, details: defaultBillingDetails("v") });
  });

  it("a charge falls back to the Dutch rate when the details cannot be read", async () => {
    const broken = { from: () => { throw new Error("database away"); } } as never;
    assert.deepEqual(await chargeAmounts(broken, "v", 10000), { netCents: 10000, vatCents: 2100, grossCents: 12100, rateBp: 2100, treatment: "nl" });
  });

  it("a charge uses the tenant's country and VAT number", async () => {
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { tenant_id: "v", country: "BE", vat_number: "BE0123456789" }, error: null }) }) }) }) } as never;
    const amounts = await chargeAmounts(client, "v", 34900);
    assert.equal(amounts.grossCents, 34900);
    assert.equal(amounts.treatment, "eu_reverse_charge");
    assert.deepEqual(vatMetadata(amounts), { net_cents: "34900", vat_cents: "0", vat_rate_bp: "0", vat_treatment: "eu_reverse_charge" });
  });
});

describe("the VAT reaches every charge through Mollie", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("the one-time purchases, the first top-up, the automatic top-up and the subscription all ask for it", () => {
    for (const file of [
      "app/api/billing/_lib/mollie-checkout.ts",
      "app/api/billing/mollie/authorise/route.ts",
      "billing/mollie-auto-reload.ts",
      "billing/mollie-renewal.ts",
    ]) {
      const src = read(file);
      assert.match(src, /const amounts\s+= await chargeAmounts\(client, (purchase\.tenantId|tenantId|input\.tenantId), /, file);
      assert.match(src, /vatMetadata\(amounts\)/, file);
    }
  });

  it("what Mollie is asked for is the gross amount", () => {
    assert.match(read("app/api/billing/_lib/mollie-checkout.ts"), /amountCents:\s+amounts\.grossCents,/);
    assert.match(read("app/api/billing/mollie/authorise/route.ts"), /amountCents:\s+amounts\.grossCents,/);
    assert.match(read("billing/mollie-auto-reload.ts"), /amountCents:\s+amounts\.grossCents,/);
    assert.match(read("billing/mollie-renewal.ts"), /const amountCents = amounts\.grossCents;/);
  });

  it("a wallet top-up credits what was bought, not the VAT on top", () => {
    const pay = (meta: Record<string, string>) => planMolliePayment({
      id: "tr_topup00001", status: "paid", amount: { currency: "EUR", value: "60.50" },
      metadata: { type: "wallet_top_up", tenant_id: "v", amount_cents: "6050", ...meta },
    });
    assert.deepEqual(pay({ net_cents: "5000" }), { action: "credit", kind: "wallet_top_up", tenantId: "v", amountCents: 5000 });
    // A payment from before VAT was charged credits what was paid, as it did.
    assert.deepEqual(pay({}), { action: "credit", kind: "wallet_top_up", tenantId: "v", amountCents: 6050 });
    // A net amount larger than what was paid is not believed.
    assert.deepEqual(pay({ net_cents: "999999" }), { action: "credit", kind: "wallet_top_up", tenantId: "v", amountCents: 6050 });
  });

  it("the verification payments stay one cent", () => {
    assert.doesNotMatch(read("billing/mollie-trial.ts"), /chargeAmounts/);
    assert.doesNotMatch(read("app/api/billing/mollie/payment-method/route.ts"), /chargeAmounts/);
  });
});
