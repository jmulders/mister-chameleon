/**
 * VAT on what the platform charges.
 *
 * The prices on the site and in the code are exclusive of VAT, as the terms
 * say. Nothing added the VAT: a Dutch customer on Growth paid €349 where
 * €349 plus 21% was due. This file decides the VAT of a charge. Every charge
 * the platform makes through Mollie asks it.
 *
 * The seller is a Dutch company selling a digital service to businesses. The
 * rules applied, in that light:
 *
 *   customer in the Netherlands            21% Dutch VAT
 *   customer in another EU country,
 *     with a VAT number of that country    0%, VAT reverse-charged to them
 *   customer in another EU country,
 *     without a VAT number                 21% Dutch VAT
 *   customer outside the EU                0%, outside the scope of Dutch VAT
 *
 * The third line is a choice, not a law of nature: a sale to an EU customer
 * who is not a business is taxed in the customer's country once the seller's
 * cross-border sales pass a yearly threshold. Below it the seller's own rate
 * applies, which is what is done here. A VAT number is checked for its form
 * and its country, not against the EU's register.
 *
 * Pure: no I/O. Rates are whole basis points so the sums stay whole cents.
 */

/** 21%, in basis points. */
export const NL_VAT_RATE_BP = 2100;

export const SELLER_COUNTRY = "NL";

/** The 27 member states, by ISO 3166-1 alpha-2 code. */
export const EU_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

export type VatTreatment = "nl" | "eu_reverse_charge" | "eu_no_vat_number" | "outside_eu";

export interface VatDecision {
  treatment: VatTreatment;
  /** The rate in basis points: 2100 or 0. */
  rateBp:    number;
}

/** A country code as the platform stores it: two capitals, or the seller's own. */
export function normaliseCountry(raw: unknown): string {
  if (typeof raw !== "string") return SELLER_COUNTRY;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : SELLER_COUNTRY;
}

/**
 * A VAT number without spaces, dots or dashes, in capitals. Null when it
 * cannot be one: two letters and then two to twelve letters or digits.
 */
export function normaliseVatNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const vat = raw.toUpperCase().replace(/[\s.\-]/g, "");
  return /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(vat) ? vat : null;
}

/** The prefix a country's VAT numbers carry. Greece writes EL. */
export function vatPrefixFor(country: string): string {
  return country === "GR" ? "EL" : country;
}

/** Whether a (normalised) VAT number belongs to the country. */
export function vatNumberOfCountry(vatNumber: string | null, country: string): boolean {
  return vatNumber !== null && vatNumber.startsWith(vatPrefixFor(country));
}

/** The VAT of a charge to this customer. */
export function vatDecision(customer: { country?: unknown; vatNumber?: unknown }): VatDecision {
  const country = normaliseCountry(customer.country);
  if (country === SELLER_COUNTRY) return { treatment: "nl", rateBp: NL_VAT_RATE_BP };
  if (!EU_COUNTRIES.includes(country)) return { treatment: "outside_eu", rateBp: 0 };
  return vatNumberOfCountry(normaliseVatNumber(customer.vatNumber), country)
    ? { treatment: "eu_reverse_charge", rateBp: 0 }
    : { treatment: "eu_no_vat_number", rateBp: NL_VAT_RATE_BP };
}

export interface VatAmounts {
  netCents:   number;
  vatCents:   number;
  grossCents: number;
  rateBp:     number;
  treatment:  VatTreatment;
}

/** Net to gross, in whole cents. The VAT is rounded half up, once, on the total. */
export function addVat(netCents: number, decision: VatDecision): VatAmounts {
  if (!Number.isInteger(netCents) || netCents < 0) {
    throw new Error(`A net amount must be a whole number of cents, not negative (got ${netCents})`);
  }
  const vatCents = Math.round((netCents * decision.rateBp) / 10_000);
  return { netCents, vatCents, grossCents: netCents + vatCents, rateBp: decision.rateBp, treatment: decision.treatment };
}

/** "21%" or "0%". For a description on a bank statement or an invoice line. */
export function vatRateLabel(rateBp: number): string {
  const pct = rateBp / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** The sentence an invoice must carry for a rate of nothing, or null. */
export function vatNote(treatment: VatTreatment): string | null {
  if (treatment === "eu_reverse_charge") return "VAT reverse-charged to the customer (article 196 of the EU VAT Directive).";
  if (treatment === "outside_eu")        return "Outside the scope of Dutch VAT: the service is supplied to a customer outside the EU.";
  return null;
}
