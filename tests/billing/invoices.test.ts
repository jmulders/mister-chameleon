/**
 * The invoices the platform issues itself: what they say, what they add up
 * to, and the PDF they are printed as.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import { amountWidth, countryName, cp1252, dutchDate, euro, invoicePdf, wrap, type InvoiceForPdf } from "../../billing/invoice-pdf.ts";
import {
  amountsFromPayment,
  dutchVatNote,
  invoiceForPdf,
  invoiceMailText,
  paymentReference,
  renewalReference,
  type InvoiceRow,
} from "../../billing/invoices.ts";
import { purchaseDescription, renewalDescription, upgradeDescription } from "../../billing/mollie-invoicing.ts";
import { SELLER } from "../../billing/seller.ts";
import type { MolliePayment } from "../../billing/mollie.ts";

const seller = { name: SELLER.name, addressLine: SELLER.addressLine, postalCode: SELLER.postalCode, city: SELLER.city, country: SELLER.country, vatNumber: SELLER.vatNumber, kvk: SELLER.kvk, email: SELLER.email, website: SELLER.website };

const row: InvoiceRow = {
  number: "20261127-0001", tenant_id: "voorbeeld", reference: "renewal:voorbeeld:2026-12-01T00:00:00.000Z", kind: "subscription",
  description: "Abonnement Growth, periode 01-12-2026 tot en met 31-12-2026",
  net_cents: 34900, vat_cents: 7329, gross_cents: 42229, vat_rate_bp: 2100, vat_treatment: "nl",
  issued_at: "2026-11-27T16:00:00.000Z", paid_at: null,
  customer: { name: "Voorbeeld Café B.V.", addressLine: "Voorbeeldstraat 12", postalCode: "1234 AB", city: "Utrecht", country: "NL", vatNumber: "NL123456789B01" },
  seller,
};

describe("the seller on every invoice", () => {
  it("is Mister Chameleon B.V. with its VAT number in full", () => {
    assert.equal(SELLER.name, "Mister Chameleon B.V.");
    assert.equal(SELLER.vatNumber, "NL851242893B02");
    assert.equal(SELLER.kvk, "54286093");
    assert.match(SELLER.vatNumber, /^NL\d{9}B\d{2}$/);
  });
});

describe("which invoice a charge gets", () => {
  it("one per payment, one per subscription period", () => {
    assert.equal(paymentReference("tr_abc12345"), "payment:tr_abc12345");
    assert.equal(renewalReference("voorbeeld", "2026-12-01T00:00:00.000Z"), "renewal:voorbeeld:2026-12-01T00:00:00.000Z");
  });

  it("finds the invoice of a period again, however the instant is written", () => {
    // The database writes "+00:00", JavaScript writes ".000Z".
    assert.equal(renewalReference("voorbeeld", "2026-12-01T00:00:00+00:00"), renewalReference("voorbeeld", "2026-12-01T00:00:00.000Z"));
    assert.equal(renewalReference("voorbeeld", "2026-12-01 00:00:00+00"), renewalReference("voorbeeld", "2026-12-01T00:00:00.000Z"));
  });

  it("names each purchase in Dutch", () => {
    assert.equal(purchaseDescription("session_bundle", "sessions_1k"), "Bundel 1.000 extra gepersonaliseerde bezoeken");
    assert.equal(purchaseDescription("session_bundle", "sessions_20k"), "Bundel 20.000 extra gepersonaliseerde bezoeken");
    assert.equal(purchaseDescription("credit_bundle", "credits_250"), "Bundel 250 credits");
    assert.equal(purchaseDescription("wallet_top_up", null), "Opwaardering tegoed");
    assert.equal(upgradeDescription("pro"), "Upgrade naar Pro, rest van de lopende periode");
  });

  it("names a subscription period by its first and its last day", () => {
    assert.equal(renewalDescription("growth", "2026-12-01T00:00:00.000Z", "monthly"), "Abonnement Growth, periode 01-12-2026 tot en met 31-12-2026");
    assert.equal(renewalDescription("starter", "2027-02-01T00:00:00.000Z", "monthly"), "Abonnement Starter, periode 01-02-2027 tot en met 28-02-2027");
    assert.equal(renewalDescription("pro", "2026-12-01T00:00:00.000Z", "annual"), "Abonnement Pro, periode 01-12-2026 tot en met 30-11-2027");
  });
});

describe("the amounts of an invoice come from the payment itself", () => {
  const pay = (value: string, meta: Record<string, string>): MolliePayment => ({ id: "tr_abc12345", status: "paid", amount: { currency: "EUR", value }, metadata: meta });
  const vat = { net_cents: "2900", vat_cents: "609", vat_rate_bp: "2100", vat_treatment: "nl" };

  it("reads net, VAT and total", () => {
    assert.deepEqual(amountsFromPayment(pay("35.09", vat)), { netCents: 2900, vatCents: 609, grossCents: 3509, rateBp: 2100, treatment: "nl" });
  });

  it("does not guess: no invoice from amounts that are missing or do not add up", () => {
    assert.equal(amountsFromPayment(pay("35.09", {})), null);
    assert.equal(amountsFromPayment(pay("35.10", vat)), null, "net plus VAT is not what was paid");
    assert.equal(amountsFromPayment(pay("35.09", { ...vat, vat_treatment: "made_up" })), null);
    assert.equal(amountsFromPayment(pay("35.09", { ...vat, net_cents: "-1" })), null);
  });
});

describe("what an invoice says", () => {
  it("carries the sentence a rate of nothing needs, in Dutch", () => {
    assert.match(dutchVatNote("eu_reverse_charge")!, /Btw verlegd/);
    assert.match(dutchVatNote("outside_eu")!, /buiten de EU/);
    assert.equal(dutchVatNote("nl"), null);
    assert.equal(dutchVatNote("eu_no_vat_number"), null);
  });

  it("the mail names the number, the sum and that nothing has to be transferred", () => {
    const mail = invoiceMailText(row);
    assert.equal(mail.subject, "Factuur 20261127-0001 van Mister Chameleon");
    assert.match(mail.text, /Subtotaal: € 349,00/);
    assert.match(mail.text, /Btw 21%: € 73,29/);
    assert.match(mail.text, /Totaal: € 422,29/);
    assert.match(mail.text, /Je hoeft niets over te maken\./);
    assert.match(invoiceMailText({ ...row, paid_at: "2026-11-28T10:00:00Z" }).text, /Deze factuur is voldaan\./);
  });
});

describe("the PDF", () => {
  it("writes amounts and dates the Dutch way", () => {
    assert.equal(euro(42229), "€ 422,29");
    assert.equal(euro(123456789), "€ 1.234.567,89");
    assert.equal(euro(5), "€ 0,05");
    assert.equal(dutchDate("2026-11-27T16:00:00Z"), "27-11-2026");
    // Just before midnight UTC it is already the next day in the Netherlands.
    assert.equal(dutchDate("2026-11-27T23:30:00Z"), "28-11-2026");
    assert.equal(countryName("NL"), "Nederland");
    assert.equal(countryName("BE"), "België");
    assert.equal(countryName(null), null);
  });

  it("writes text in Windows-1252, so the euro sign and accents come out", () => {
    assert.deepEqual(cp1252("€"), [0x80]);
    assert.deepEqual(cp1252("é"), [0xe9]);
    assert.deepEqual(cp1252("A b"), [0x41, 0x20, 0x62]);
    assert.deepEqual(cp1252("猫"), [0x3f], "what the encoding cannot write becomes a question mark");
  });

  it("measures an amount with Helvetica's own widths", () => {
    assert.equal(amountWidth("0", 10), 5.56);
    assert.equal(amountWidth("1,0", 10), ((556 + 278 + 556) * 10) / 1000);
    assert.equal(amountWidth("€ 422,29", 10), ((556 + 278 + 556 * 3 + 278 + 556 * 2) * 10) / 1000);
    // A comma is narrower than a digit: that is why the amounts line up.
    assert.ok(amountWidth(",", 10) < amountWidth("0", 10));
  });

  it("breaks a long line on spaces", () => {
    assert.deepEqual(wrap("een twee drie vier", 8), ["een twee", "drie", "vier"]);
    assert.deepEqual(wrap("", 8), [""]);
  });

  const pdf = Buffer.from(invoicePdf(invoiceForPdf(row))).toString("latin1");

  it("is one A4 page with the two built-in fonts", () => {
    assert.ok(pdf.startsWith("%PDF-1.4\n"));
    assert.ok(pdf.endsWith("%%EOF\n"));
    assert.match(pdf, /\/MediaBox \[0 0 595 842\]/);
    assert.match(pdf, /\/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding/);
    assert.match(pdf, /\/BaseFont \/Helvetica-Bold \/Encoding \/WinAnsiEncoding/);
    assert.match(pdf, /\/Count 1/);
  });

  it("has a table of offsets that points at every object", () => {
    const xrefAt = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)![1]);
    assert.ok(pdf.slice(xrefAt).startsWith("xref\n0 7\n"));
    const offsets = [...pdf.slice(xrefAt).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    assert.equal(offsets.length, 6);
    offsets.forEach((offset, i) => assert.ok(pdf.slice(offset).startsWith(`${i + 1} 0 obj\n`), `object ${i + 1}`));
  });

  it("declares the length of its content exactly", () => {
    const m = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(pdf)!;
    assert.equal(m[2]!.length, Number(m[1]));
  });

  const has = (text: string) => pdf.includes(`<${cp1252(text).map((b) => b.toString(16).padStart(2, "0")).join("")}>`);

  it("prints what an invoice must carry", () => {
    for (const text of [
      "Mister Chameleon B.V.", "Gildetrom 35", "3905 TB Veenendaal", "KvK 54286093", "Btw-nummer NL851242893B02",
      "Factuur", "20261127-0001", "27-11-2026",
      "Voorbeeld Café B.V.", "Voorbeeldstraat 12", "1234 AB Utrecht, Nederland", "Btw-nummer NL123456789B01",
      "Abonnement Growth, periode 01-12-2026 tot en met 31-12-2026",
      "Subtotaal", "Btw 21%", "Totaal", "€ 349,00", "€ 73,29", "€ 422,29",
    ]) assert.ok(has(text), `the PDF prints "${text}"`);
  });

  it("says it is paid, or that it is collected by direct debit", () => {
    assert.ok(has("Het bedrag wordt met je machtiging van je rekening afgeschreven. Je hoeft niets over te maken."));
    const paid = Buffer.from(invoicePdf(invoiceForPdf({ ...row, paid_at: "2026-11-28T10:00:00Z" }))).toString("latin1");
    assert.ok(paid.includes(`<${cp1252("Voldaan op 28-11-2026.").map((b) => b.toString(16).padStart(2, "0")).join("")}>`));
  });

  it("prints the reverse charge sentence for a customer abroad", () => {
    const abroad: InvoiceForPdf = invoiceForPdf({ ...row, vat_cents: 0, gross_cents: 34900, vat_rate_bp: 0, vat_treatment: "eu_reverse_charge" });
    const text = Buffer.from(invoicePdf(abroad)).toString("latin1");
    assert.ok(text.includes(`<${cp1252("Btw verlegd naar de afnemer (artikel 196 van de btw-richtlijn).").map((b) => b.toString(16).padStart(2, "0")).join("")}>`));
    assert.ok(text.includes(`<${cp1252("Btw 0%").map((b) => b.toString(16).padStart(2, "0")).join("")}>`));
  });

  it("is the same bytes for the same invoice", () => {
    assert.deepEqual(invoicePdf(invoiceForPdf(row)), invoicePdf(invoiceForPdf(row)));
  });
});

describe("when an invoice is issued", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("a purchase when it is delivered, on both roads, once per payment", () => {
    const src = read("billing/mollie-checkout.ts");
    assert.match(src, /if \(result\.outcome === "credited" \|\| result\.outcome === "already-credited"\) \{\s+await invoicePurchase\(client, payment, \{ kind: result\.kind, tenantId: result\.tenantId, bundleId: result\.bundleId \}\);/);
    assert.match(read("billing/mollie-invoicing.ts"), /reference:\s+paymentReference\(payment\.id\),/);
  });

  it("the subscription when Mollie accepts the charge, not before", () => {
    const src = read("billing/mollie-renewal.ts");
    const charge  = src.indexOf("payment = await createMolliePayment(");
    const failed  = src.indexOf('if (status === "failed" || status === "canceled" || status === "expired") {', charge);
    const invoice = src.indexOf("await issueInvoice(client, {", charge);
    assert.ok(charge > 0 && failed > charge && invoice > failed, "the invoice comes after the refusal check");
  });

  it("the invoice follows the money: paid, open again, paid by the tenant", () => {
    const src = read("billing/mollie-renewal.ts");
    assert.match(src, /await setInvoicePaid\(client, renewalReference\(settledRow\.tenant_id, new Date\(settledRow\.period_end\)\.toISOString\(\)\), true\);/);
    assert.match(src, /await setInvoicePaid\(client, renewalReference\(row\.tenant_id, new Date\(row\.period_end\)\.toISOString\(\)\), false\);/);
    assert.match(src, /await setInvoicePaid\(client, reference, true\);/);
  });

  it("the verification payments get none", () => {
    assert.doesNotMatch(read("billing/mollie-trial.ts"), /issueInvoice|invoicePurchase/);
    assert.doesNotMatch(read("billing/mollie-payment-method.ts"), /issueInvoice|invoicePurchase/);
  });

  it("a number is taken inside the transaction that writes the invoice", () => {
    const sql = read("supabase/migrations/20240101000197_invoices.sql");
    const lock   = sql.indexOf("update public.invoice_counter set last_seq = last_seq + 1 where id returning last_seq into v_seq;");
    const insert = sql.indexOf("insert into public.invoices");
    assert.ok(lock > 0 && insert > lock);
    assert.match(sql, /reference\s+text\s+not null unique/);
    assert.match(sql, /check \(gross_cents = net_cents \+ vat_cents\)/);
    assert.match(sql, /revoke all on function public\.issue_invoice\([^)]*\) from public, anon, authenticated;/);
  });

  it("the PDF route checks the session and reads only this tenant's invoice", () => {
    const src = read("app/api/billing/invoices/[number]/pdf/route.ts");
    assert.ok(src.indexOf("guardTenantRoute(tenantId)") < src.indexOf("getInvoice(getDb(), tenantId, number)"));
    assert.match(read("billing/invoices.ts"), /\.eq\("tenant_id", tenantId\)\.eq\("number", number\)/);
  });
});
