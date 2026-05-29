/**
 * Plan + Credit Bundle Price Map
 *
 * Maps application plan keys and credit bundle IDs to Stripe Price IDs.
 * This is the single source of truth for price resolution.
 *
 * ─── How to configure ────────────────────────────────────────────────────────
 *
 *   1. Create products + prices in the Stripe Dashboard (or via the Stripe CLI).
 *   2. Copy the price IDs (format: price_xxx) into the corresponding
 *      environment variables below.
 *   3. Add the env vars to .env.local (dev) and your deployment environment.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   Subscriptions (recurring):
 *     STRIPE_PRICE_STARTER_MONTHLY   e.g. price_1Abc…
 *     STRIPE_PRICE_STARTER_ANNUAL
 *     STRIPE_PRICE_GROWTH_MONTHLY
 *     STRIPE_PRICE_GROWTH_ANNUAL
 *     STRIPE_PRICE_PRO_MONTHLY
 *     STRIPE_PRICE_PRO_ANNUAL
 *
 *   Credit bundles (one-time):
 *     STRIPE_PRICE_CREDITS_100       100 credits
 *     STRIPE_PRICE_CREDITS_500       500 credits (best value)
 *     STRIPE_PRICE_CREDITS_1000      1000 credits (bulk)
 *
 * ─── Credit bundles ───────────────────────────────────────────────────────────
 *
 *   Credits are consumed by enrichment lookups and certain platform features.
 *   One credit = one enrichment call.  Bundles are one-time purchases.
 *
 *   bundle_id     credits   notes
 *   credits_100   100       Entry / top-up
 *   credits_500   500       Most popular
 *   credits_1000  1000      Bulk / agencies
 */

import type { PackageKey } from "@/tenant/types";

// ── Subscription price map ─────────────────────────────────────────────────────

export type BillingCycle = "monthly" | "annual";

export interface PriceEntry {
  priceId:  string;
  plan:     PackageKey;
  cycle:    BillingCycle;
}

function env(name: string): string {
  return process.env[name] ?? "";
}

/**
 * Returns the Stripe Price ID for a plan + billing cycle combination.
 * Throws if no price ID is configured.
 */
export function getSubscriptionPriceId(
  plan:  PackageKey,
  cycle: BillingCycle,
): string {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
  const priceId = env(key);
  if (!priceId) {
    throw new Error(
      `[plan-map] Missing Stripe price ID for plan="${plan}" cycle="${cycle}". ` +
      `Set the environment variable: ${key}`,
    );
  }
  return priceId;
}

// ── Credit bundle map ─────────────────────────────────────────────────────────

export interface CreditBundle {
  /** Stable machine-readable ID used in checkout metadata. */
  bundleId:    string;
  /** Display label in the UI. */
  label:       string;
  /** Number of credits the buyer receives. */
  credits:     number;
  /** Stripe Price ID (one-time payment). */
  priceId:     string;
}

/**
 * All available credit bundles, in ascending order by credits.
 * The `priceId` fields are resolved from environment variables at call time.
 */
export function getCreditBundles(): CreditBundle[] {
  return [
    {
      bundleId: "credits_100",
      label:    "100 Credits",
      credits:  100,
      priceId:  env("STRIPE_PRICE_CREDITS_100"),
    },
    {
      bundleId: "credits_500",
      label:    "500 Credits",
      credits:  500,
      priceId:  env("STRIPE_PRICE_CREDITS_500"),
    },
    {
      bundleId: "credits_1000",
      label:    "1,000 Credits",
      credits:  1000,
      priceId:  env("STRIPE_PRICE_CREDITS_1000"),
    },
  ];
}

/**
 * Find a credit bundle by its bundle ID.
 * Returns undefined if the bundle doesn't exist.
 */
export function findCreditBundle(bundleId: string): CreditBundle | undefined {
  return getCreditBundles().find((b) => b.bundleId === bundleId);
}

// ── Reverse lookup — Stripe → plan ────────────────────────────────────────────

/**
 * Given a Stripe Price ID, resolve the plan key and billing cycle.
 * Used in webhook handlers to determine which plan was purchased.
 * Returns null if the price ID doesn't match any configured plan.
 */
export function resolvePlanFromPriceId(
  priceId: string,
): { plan: PackageKey; cycle: BillingCycle } | null {
  const plans: PackageKey[]     = ["starter", "growth", "pro"];
  const cycles: BillingCycle[]  = ["monthly", "annual"];

  for (const plan of plans) {
    for (const cycle of cycles) {
      const key = `STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`;
      if (env(key) === priceId) {
        return { plan, cycle };
      }
    }
  }
  return null;
}
