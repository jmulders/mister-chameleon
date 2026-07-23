/**
 * Ad selection — pure eligibility filter + weighted pick.
 *
 * No I/O: the caller injects the targeting match, the frequency check and the
 * RNG, so this is fully unit-testable and deterministic in tests. The decide
 * hook wires `matchTargeting` to evaluateCondition() against the visitor's
 * decision context, and `isFrequencyOk` to a recent-impression count.
 */

import type { Ad } from "./types";

export interface SelectAdOptions {
  /** "Now" for flight-window checks. */
  now: Date;
  /** True when the ad's targeting matches the current visitor. Default: match all. */
  matchTargeting?: (ad: Ad) => boolean;
  /** True when the visitor is still under this ad's frequency cap. Default: always ok. */
  isFrequencyOk?: (ad: Ad) => boolean;
  /** RNG in [0,1) for the weighted pick. Default: Math.random. */
  random?: () => number;
}

/** Flight window: started (or no start) and not ended (or no end). */
function inFlight(ad: Ad, now: Date): boolean {
  const t = now.getTime();
  if (ad.start_at && new Date(ad.start_at).getTime() > t) return false;
  if (ad.end_at   && new Date(ad.end_at).getTime()   <= t) return false;
  return true;
}

/** Budget left: unlimited (0) or spent strictly below budget. */
function hasBudget(ad: Ad): boolean {
  return ad.budget_cents <= 0 || ad.spent_cents < ad.budget_cents;
}

/** The eligible ads for a slot: active, in-flight, within budget, targeted, capped. */
export function eligibleAds(ads: readonly Ad[], opts: SelectAdOptions): Ad[] {
  const matchTargeting = opts.matchTargeting ?? (() => true);
  const isFrequencyOk  = opts.isFrequencyOk  ?? (() => true);
  return ads.filter(
    (ad) =>
      ad.status === "active" &&
      ad.weight > 0 &&
      inFlight(ad, opts.now) &&
      hasBudget(ad) &&
      matchTargeting(ad) &&
      isFrequencyOk(ad),
  );
}

/**
 * Pick one ad from a list, weighted by `weight`. Returns null for an empty list.
 * Non-positive weights are treated as 0 (never chosen unless all are 0, in which
 * case the first is returned as a safe fallback).
 */
export function weightedPick(ads: readonly Ad[], random: () => number = Math.random): Ad | null {
  if (ads.length === 0) return null;
  const total = ads.reduce((sum, a) => sum + Math.max(0, a.weight), 0);
  if (total <= 0) return ads[0];
  let r = random() * total;
  for (const ad of ads) {
    r -= Math.max(0, ad.weight);
    if (r < 0) return ad;
  }
  return ads[ads.length - 1]; // float rounding safety
}

/** Select one eligible ad for a slot, or null when none qualify. */
export function selectAd(ads: readonly Ad[], opts: SelectAdOptions): Ad | null {
  return weightedPick(eligibleAds(ads, opts), opts.random ?? Math.random);
}
