/**
 * Billing Module — Public API
 *
 * Import from this barrel rather than individual files.
 *
 * ─── Quick start ──────────────────────────────────────────────────────────────
 *
 *   // Create a subscription checkout session
 *   import { getSubscriptionCheckoutUrl } from "@/lib/billing";
 *
 *   // Check a tenant's current plan
 *   import { getSubscription } from "@/lib/billing";
 *   const sub = await getSubscription(tenantId);
 *   if (sub?.plan === "pro") { ... }
 *
 *   // Check credit balance
 *   import { getCreditBalance } from "@/lib/billing";
 *   const balance = await getCreditBalance(tenantId);
 *
 * ─── Environment variables needed ─────────────────────────────────────────────
 *
 *   STRIPE_SECRET_KEY              sk_live_… or sk_test_…
 *   STRIPE_WEBHOOK_SECRET          whsec_…
 *   STRIPE_PRICE_STARTER_MONTHLY   price_…
 *   STRIPE_PRICE_STARTER_ANNUAL    price_…
 *   STRIPE_PRICE_GROWTH_MONTHLY    price_…
 *   STRIPE_PRICE_GROWTH_ANNUAL     price_…
 *   STRIPE_PRICE_PRO_MONTHLY       price_…
 *   STRIPE_PRICE_PRO_ANNUAL        price_…
 *   STRIPE_PRICE_CREDITS_100       price_…
 *   STRIPE_PRICE_CREDITS_500       price_…
 *   STRIPE_PRICE_CREDITS_1000      price_…
 */

// ── Stripe client ─────────────────────────────────────────────────────────────
//
// Removed. This barrel used to re-export getStripe/getWebhookSecret from a
// ./stripe-client that pinned Stripe API version 2024-06-20, while the canonical
// client (billing/stripe-config.ts → getStripeClient) pins 2025-08-27.basil.
// Nothing outside lib/billing/ ever imported either of them, so the split never
// bit — but it is why app/api/billing/cancel-subscription/route.ts once imported
// a `getStripe` that does not exist in the module it was importing from.
//
// Use: import { getStripeClient } from "@/billing/stripe-config";

// ── Plan map ──────────────────────────────────────────────────────────────────
export type { BillingCycle, PriceEntry, CreditBundle } from "./plan-map";
export {
  getSubscriptionPriceId,
  getCreditBundles,
  findCreditBundle,
  resolvePlanFromPriceId,
}                                                from "./plan-map";

// ── Billing store ─────────────────────────────────────────────────────────────
export type { SubscriptionRow, CreditTxType }    from "./billing-store";
export {
  getSubscription,
  getSubscriptionByCustomerId,
  upsertSubscription,
  updateSubscriptionByCustomerId,
  getCreditBalance,
  isEventAlreadyProcessed,
  addCredits,
  deductCredits,
}                                                from "./billing-store";
