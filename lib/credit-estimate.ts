/**
 * The estimate behind the calculator on the price list: how many credits a
 * site uses in a month.
 *
 * It mirrors how the platform charges, as an upper bound:
 *
 *   - Lookups run only for a visit with consent.
 *   - A source that runs for every such visit is charged once per visit.
 *   - Looking up a company is charged when a company is found. A visitor the
 *     site recognises for the first time costs a fixed number of credits on
 *     top (lib/lead-base/bill-lead-credit.ts).
 *
 * Caches only make the real number lower: what the site already knows it does
 * not look up again. So the outcome is "at most", never "at least".
 *
 * The shares (consent, recognised) are the buyer's own guesses. No rate comes
 * from the platform, because the platform has no such figure.
 *
 * Pure and client-safe.
 */

export interface CreditEstimateInput {
  /** Visits per month. */
  visits:          number;
  /** Share of visits with consent for lookups, 0 to 1. */
  consentShare:    number;
  /** Share of those visits where the company is recognised, 0 to 1. */
  recognisedShare: number;
  /** Credits per visit with consent: the sum of every switched-on source that runs for each visit. */
  creditsPerVisit: number;
  /** Credits per recognised company: the lookup plus the recognition. 0 when recognising is off. */
  creditsPerCompany: number;
}

export interface CreditEstimate {
  /** Credits per month, rounded up to a whole credit. */
  credits: number;
  /** The same in euro cents: one credit is one cent. */
  cents:   number;
}

const share  = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const amount = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

export function estimateMonthlyCredits(input: CreditEstimateInput): CreditEstimate {
  const withConsent = amount(input.visits) * share(input.consentShare);
  const raw =
    withConsent * amount(input.creditsPerVisit) +
    withConsent * share(input.recognisedShare) * amount(input.creditsPerCompany);
  // Rounded up: an estimate that is an upper bound must not round down.
  const credits = Math.ceil(Math.round(raw * 1000) / 1000);
  return { credits, cents: credits };
}
