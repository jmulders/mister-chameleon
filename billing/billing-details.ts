/**
 * What the platform knows about a tenant for billing: who to invoice, where
 * they are, and their VAT number.
 *
 * The country and the VAT number decide the VAT of every charge (vat.ts). The
 * name and the address go on the invoice. A tenant that has filled in nothing
 * is treated as a Dutch customer: 21% is charged, which is right for nearly
 * everyone and never too little.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { addVat, normaliseCountry, normaliseVatNumber, vatDecision, vatNumberOfCountry, type VatAmounts } from "./vat";

export interface BillingDetails {
  tenant_id:     string;
  company_name:  string | null;
  address_line:  string | null;
  postal_code:   string | null;
  city:          string | null;
  /** ISO 3166-1 alpha-2. */
  country:       string;
  /** Normalised: capitals, no spaces. */
  vat_number:    string | null;
  invoice_email: string | null;
}

export function defaultBillingDetails(tenantId: string): BillingDetails {
  return { tenant_id: tenantId, company_name: null, address_line: null, postal_code: null, city: null, country: "NL", vat_number: null, invoice_email: null };
}

export type BillingDetailsInput = Partial<Record<"company_name" | "address_line" | "postal_code" | "city" | "country" | "vat_number" | "invoice_email", unknown>>;

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/\s+/g, " ");
  return t === "" ? null : t.slice(0, max);
};

/**
 * Check and tidy what someone typed. Pure.
 *
 * A VAT number that is filled in must be one, and must belong to the country
 * that is filled in. Otherwise a typing error would quietly turn a customer
 * abroad into one who is charged 21%, or the other way round.
 */
export function cleanBillingDetails(
  tenantId: string,
  input:    BillingDetailsInput,
): { ok: true; details: BillingDetails } | { ok: false; error: string } {
  const country = normaliseCountry(input.country);
  if (typeof input.country === "string" && input.country.trim() !== "" && !/^[A-Za-z]{2}$/.test(input.country.trim())) {
    return { ok: false, error: "Choose a country." };
  }

  let vatNumber: string | null = null;
  if (typeof input.vat_number === "string" && input.vat_number.trim() !== "") {
    vatNumber = normaliseVatNumber(input.vat_number);
    if (!vatNumber) return { ok: false, error: "This is not a VAT number. It starts with two letters, for example NL123456789B01." };
    if (!vatNumberOfCountry(vatNumber, country)) {
      return { ok: false, error: "The VAT number does not belong to the country you chose." };
    }
  }

  const email = text(input.invoice_email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "This is not an email address." };

  return {
    ok: true,
    details: {
      tenant_id:     tenantId,
      company_name:  text(input.company_name, 200),
      address_line:  text(input.address_line, 200),
      postal_code:   text(input.postal_code, 20),
      city:          text(input.city, 100),
      country,
      vat_number:    vatNumber,
      invoice_email: email ? email.toLowerCase() : null,
    },
  };
}

/** The tenant's billing details, or the defaults. Never throws. */
export async function getBillingDetails(client: SupabaseClient, tenantId: string): Promise<BillingDetails> {
  try {
    const { data, error } = await client
      .from("billing_details")
      .select("tenant_id, company_name, address_line, postal_code, city, country, vat_number, invoice_email")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error || !data) return defaultBillingDetails(tenantId);
    const row = data as BillingDetails;
    return { ...row, country: normaliseCountry(row.country), vat_number: normaliseVatNumber(row.vat_number) };
  } catch {
    return defaultBillingDetails(tenantId);
  }
}

export async function saveBillingDetails(client: SupabaseClient, details: BillingDetails): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from("billing_details")
    .upsert({ ...details, updated_at: new Date().toISOString() }, { onConflict: "tenant_id" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * What a charge of `netCents` comes to for this tenant, VAT included.
 *
 * The one place a charge gets its VAT. A failed read charges the Dutch rate
 * (getBillingDetails falls back to the defaults): too much VAT can be put
 * right on an invoice, a charge without it cannot be collected afterwards.
 */
export async function chargeAmounts(client: SupabaseClient, tenantId: string, netCents: number): Promise<VatAmounts> {
  const details = await getBillingDetails(client, tenantId);
  return addVat(netCents, vatDecision({ country: details.country, vatNumber: details.vat_number }));
}

/** The VAT fields a Mollie payment carries in its metadata. */
export function vatMetadata(amounts: VatAmounts): Record<string, string> {
  return {
    net_cents:     String(amounts.netCents),
    vat_cents:     String(amounts.vatCents),
    vat_rate_bp:   String(amounts.rateBp),
    vat_treatment: amounts.treatment,
  };
}
