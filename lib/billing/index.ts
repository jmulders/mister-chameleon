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
export { getStripe, getWebhookSecret }           from "./stripe-client";

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
