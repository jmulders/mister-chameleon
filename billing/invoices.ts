/**
 * The invoices the platform issues itself.
 *
 * Stripe wrote the invoices for what it charged. For what the platform
 * charges through Mollie it writes them here: one invoice per charge, with a
 * number that never skips (the database function issue_invoice, migration
 * 197), the VAT that was charged, and a copy of who sold and who bought as
 * they were on that day.
 *
 * When an invoice is issued
 *
 *   a purchase at the checkout     when it is paid. An abandoned checkout
 *   (bundle, top-up)               never gets a number.
 *   the automatic top-up           when it is paid.
 *   the subscription, an upgrade   when Mollie accepts the charge. The service
 *                                  runs from that moment, so the invoice is
 *                                  due from that moment. It is marked paid
 *                                  when the debit comes in, and open again
 *                                  when it is refused or reversed.
 *
 * The two one-cent verification payments get no invoice.
 *
 * Issuing never throws: a charge that was delivered is not undone because its
 * invoice could not be written. A failure is logged as an error, because an
 * invoice that is missing has to be made by hand.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBillingDetails } from "./billing-details";
import { SELLER } from "./seller";
import { vatNote, type VatAmounts, type VatTreatment } from "./vat";
import { dutchDate, euro, invoicePdf, type InvoiceForPdf, type InvoiceParty } from "./invoice-pdf";
import type { MolliePayment } from "./mollie";
import { centsFromMollieAmount } from "./mollie";

export type InvoiceKind = "subscription" | "session_bundle" | "credit_bundle" | "wallet_top_up" | "auto_reload";

export interface InvoiceRow {
  number:        string;
  tenant_id:     string;
  reference:     string;
  kind:          string;
  description:   string;
  net_cents:     number;
  vat_cents:     number;
  gross_cents:   number;
  vat_rate_bp:   number;
  vat_treatment: string;
  issued_at:     string;
  paid_at:       string | null;
  customer:      InvoiceParty;
  seller:        InvoiceParty & { kvk: string; email: string; website: string };
}

const COLUMNS = "number, tenant_id, reference, kind, description, net_cents, vat_cents, gross_cents, vat_rate_bp, vat_treatment, issued_at, paid_at, customer, seller";

/** The reference of the invoice for a payment at the checkout or an automatic top-up. */
export const paymentReference = (paymentId: string) => `payment:${paymentId}`;
/** The reference of the invoice for a subscription period, or an upgrade inside one. */
export function renewalReference(tenantId: string, periodEnd: string): string {
  // The same instant is written in more than one way ("…+00:00" from the
  // database, "….000Z" from JavaScript). One spelling, or the invoice of a
  // period is not found again when its payment comes in.
  const at = new Date(periodEnd);
  return `renewal:${tenantId}:${Number.isNaN(at.getTime()) ? periodEnd : at.toISOString()}`;
}

/**
 * The VAT amounts a payment was made with, from the metadata the platform
 * wrote when it created the payment. Null when they are not there or do not
 * add up to what was paid: an invoice is not guessed. Pure.
 */
export function amountsFromPayment(payment: MolliePayment): VatAmounts | null {
  const meta  = payment.metadata ?? {};
  const int   = (key: string) => { const v = meta[key]; return typeof v === "string" && /^\d+$/.test(v) ? Number.parseInt(v, 10) : Number.NaN; };
  const net   = int("net_cents");
  const vat   = int("vat_cents");
  const rate  = int("vat_rate_bp");
  const paid  = centsFromMollieAmount(payment.amount);
  const treatment = meta["vat_treatment"];
  if (![net, vat, rate].every(Number.isInteger) || paid === null || net + vat !== paid) return null;
  if (treatment !== "nl" && treatment !== "eu_reverse_charge" && treatment !== "eu_no_vat_number" && treatment !== "outside_eu") return null;
  return { netCents: net, vatCents: vat, grossCents: paid, rateBp: rate, treatment };
}

function sellerSnapshot(): InvoiceRow["seller"] {
  return {
    name: SELLER.name, addressLine: SELLER.addressLine, postalCode: SELLER.postalCode, city: SELLER.city,
    country: SELLER.country, vatNumber: SELLER.vatNumber, kvk: SELLER.kvk, email: SELLER.email, website: SELLER.website,
  };
}

export interface IssueInvoiceInput {
  tenantId:    string;
  reference:   string;
  kind:        InvoiceKind;
  /** In Dutch: it is printed on the invoice. */
  description: string;
  amounts:     VatAmounts;
  paymentId:   string | null;
  paid:        boolean;
}

/**
 * Issue an invoice, once per reference, and mail it when this call made it.
 * Returns the number, or null when it could not be written. Never throws.
 */
export async function issueInvoice(client: SupabaseClient, input: IssueInvoiceInput): Promise<string | null> {
  try {
    const details  = await getBillingDetails(client, input.tenantId);
    const customer: InvoiceParty = {
      name:        details.company_name ?? input.tenantId,
      addressLine: details.address_line,
      postalCode:  details.postal_code,
      city:        details.city,
      country:     details.country,
      vatNumber:   details.vat_number,
    };

    const { data, error } = await client.rpc("issue_invoice", {
      p_tenant_id:     input.tenantId,
      p_reference:     input.reference,
      p_kind:          input.kind,
      p_description:   input.description,
      p_net_cents:     input.amounts.netCents,
      p_vat_cents:     input.amounts.vatCents,
      p_vat_rate_bp:   input.amounts.rateBp,
      p_vat_treatment: input.amounts.treatment,
      p_payment_id:    input.paymentId,
      p_paid:          input.paid,
      p_customer:      customer,
      p_seller:        sellerSnapshot(),
    });
    if (error) throw new Error(error.message);

    const row = (Array.isArray(data) ? data[0] : data) as { invoice_number?: string; created?: boolean } | null;
    if (!row?.invoice_number) throw new Error("issue_invoice returned no number");

    if (row.created) {
      console.info("[billing/invoices] issued", { number: row.invoice_number, tenantId: input.tenantId, kind: input.kind, grossCents: input.amounts.grossCents });
      await mailInvoice(client, row.invoice_number, details.invoice_email);
    }
    return row.invoice_number;
  } catch (err) {
    console.error("[billing/invoices] INVOICE NOT ISSUED, make it by hand", {
      tenantId: input.tenantId, reference: input.reference, kind: input.kind,
      grossCents: input.amounts.grossCents, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Mark the invoice of a reference paid, or open again. Never throws. */
export async function setInvoicePaid(client: SupabaseClient, reference: string, paid: boolean): Promise<void> {
  try {
    await client.from("invoices").update({ paid_at: paid ? new Date().toISOString() : null }).eq("reference", reference);
  } catch (err) {
    console.error("[billing/invoices] could not update the paid state", { reference, err });
  }
}

export async function getInvoice(client: SupabaseClient, tenantId: string, number: string): Promise<InvoiceRow | null> {
  const { data } = await client.from("invoices").select(COLUMNS).eq("tenant_id", tenantId).eq("number", number).maybeSingle();
  return (data as InvoiceRow | null) ?? null;
}

export async function listInvoices(client: SupabaseClient, tenantId: string, limit = 50): Promise<InvoiceRow[]> {
  const { data } = await client.from("invoices").select(COLUMNS).eq("tenant_id", tenantId).order("seq", { ascending: false }).limit(limit);
  return (data as InvoiceRow[] | null) ?? [];
}

/** An invoice row as what the PDF writer wants. Pure. */
export function invoiceForPdf(row: InvoiceRow): InvoiceForPdf {
  return {
    number:      row.number,
    issuedAt:    row.issued_at,
    paidAt:      row.paid_at,
    description: row.description,
    netCents:    row.net_cents,
    vatCents:    row.vat_cents,
    grossCents:  row.gross_cents,
    vatRateBp:   row.vat_rate_bp,
    vatNote:     dutchVatNote(row.vat_treatment),
    customer:    row.customer,
    seller:      row.seller,
  };
}

/** The sentence an invoice at 0% must carry, in Dutch. */
export function dutchVatNote(treatment: string): string | null {
  if (vatNote(treatment as VatTreatment) === null) return null;
  return treatment === "eu_reverse_charge"
    ? "Btw verlegd naar de afnemer (artikel 196 van de btw-richtlijn)."
    : "Buiten het bereik van de Nederlandse btw: de dienst wordt geleverd aan een afnemer buiten de EU.";
}

/** The text of the mail an invoice goes out with. Pure. */
export function invoiceMailText(row: InvoiceRow): { subject: string; text: string } {
  const pct  = row.vat_rate_bp / 100;
  const note = dutchVatNote(row.vat_treatment);
  return {
    subject: `Factuur ${row.number} van Mister Chameleon`,
    text:
      `Hallo,\n\n` +
      `In de bijlage vind je factuur ${row.number} van ${dutchDate(row.issued_at)}.\n\n` +
      `${row.description}\n` +
      `Subtotaal: ${euro(row.net_cents)}\n` +
      `Btw ${pct}%: ${euro(row.vat_cents)}\n` +
      `Totaal: ${euro(row.gross_cents)}\n` +
      (note ? `${note}\n` : "") +
      `\n` +
      (row.paid_at
        ? `Deze factuur is voldaan. Je hoeft niets te doen.\n`
        : `Het bedrag wordt met je machtiging van je rekening afgeschreven. Je hoeft niets over te maken.\n`) +
      `\nAl je facturen staan ook in je dashboard, onder Billing.\n\n` +
      `Mister Chameleon`,
  };
}

/**
 * Mail an invoice with its PDF. Best effort: the invoice exists and is in the
 * dashboard whether the mail goes out or not.
 */
async function mailInvoice(client: SupabaseClient, number: string, to: string | null): Promise<void> {
  if (!to) {
    console.warn("[billing/invoices] no address to mail the invoice to", { number });
    return;
  }
  try {
    const { data } = await client.from("invoices").select(COLUMNS).eq("number", number).maybeSingle();
    const row = data as InvoiceRow | null;
    if (!row) return;

    const { sendMail, resolveTransportConfig } = await import("@/forms/mail-transport");
    const { serverEnv }                        = await import("@/lib/env");
    const { getPlatformEmailSettings }         = await import("@/platform/platform-store");
    const { PLATFORM_FROM }                    = await import("@/lib/platform-contact");
    const platform  = await getPlatformEmailSettings();
    const transport = resolveTransportConfig(null, platform.ok ? platform.data : null);
    const mail      = invoiceMailText(row);

    const result = await sendMail({
      from:    serverEnv.email.fromAddress ?? PLATFORM_FROM,
      to:      [to],
      subject: mail.subject,
      text:    mail.text,
      attachments: [{ filename: `factuur-${row.number}.pdf`, content: invoicePdf(invoiceForPdf(row)), contentType: "application/pdf" }],
    }, transport);
    if (!result.ok) console.warn("[billing/invoices] invoice mail failed", { number, error: result.error });
  } catch (err) {
    console.warn("[billing/invoices] invoice mail threw", { number, err });
  }
}
