/**
 * Ad pricing — pure cost helpers.
 *
 * Units: the wallet's canonical unit is a "credit" where 1 credit = EUR 0.01
 * (= 1 cent). So a cost expressed in cents maps 1:1 to credits for
 * billing/wallet.ts#debitWallet.
 *
 *   CPM ad → billed per impression: rate_cents (per 1000) / 1000 per impression.
 *   CPC ad → billed per click:      rate_cents per click.
 *
 * An ad is billed on exactly one event type (impressions for CPM, clicks for
 * CPC), so the "other" event costs nothing.
 */

import type { Ad } from "./types";

/**
 * Behavioural-targeting profiling fee, in cents (= wallet credits), charged once
 * per unique visitor per calendar day when a targeted ad is evaluated against a
 * real audience profile. Separate from CPM/CPC — see ad_profiling_charges.
 */
export const PROFILING_FEE_CENTS = 2; // €0.02 per unique targeted visitor/day

/** Cost of one impression, in cents (= wallet credits). 0 for CPC ads. */
export function impressionCostCents(ad: Pick<Ad, "pricing_model" | "rate_cents">): number {
  return ad.pricing_model === "cpm" ? Math.max(0, ad.rate_cents) / 1000 : 0;
}

/** Cost of one click, in cents (= wallet credits). 0 for CPM ads. */
export function clickCostCents(ad: Pick<Ad, "pricing_model" | "rate_cents">): number {
  return ad.pricing_model === "cpc" ? Math.max(0, ad.rate_cents) : 0;
}

/** The billable cost in cents for a given event type on this ad. */
export function eventCostCents(
  ad: Pick<Ad, "pricing_model" | "rate_cents">,
  eventType: "impression" | "click",
): number {
  return eventType === "impression" ? impressionCostCents(ad) : clickCostCents(ad);
}
