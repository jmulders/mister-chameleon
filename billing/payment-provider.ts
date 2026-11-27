/**
 * Which payment provider takes the money.
 *
 * The platform was built on Stripe alone. Mollie is being added next to it,
 * one money flow at a time. Step 1 covers the one-time purchases: session
 * bundles, AI credit bundles and the wallet top-up. Subscriptions, the trial
 * signup, plan changes and the customer portal are still Stripe only.
 *
 * One setting decides: PAYMENT_PROVIDER=mollie. Anything else, or nothing,
 * is Stripe, so an environment that never heard of Mollie behaves as before.
 */

export type PaymentProvider = "stripe" | "mollie";

/** Pure: the provider a raw setting stands for. */
export function paymentProviderFrom(raw: string | null | undefined): PaymentProvider {
  return typeof raw === "string" && raw.trim().toLowerCase() === "mollie" ? "mollie" : "stripe";
}

export function getPaymentProvider(): PaymentProvider {
  return paymentProviderFrom(process.env["PAYMENT_PROVIDER"]);
}

/**
 * Whether a bundle can be bought right now.
 *
 * With Stripe a bundle needs a Stripe Price ID, because Stripe charges the
 * price behind that ID. With Mollie the platform names the amount itself
 * (the bundle's priceCents), so a configured Mollie key is enough.
 */
export function bundlePurchasable(
  bundle:      { stripePrice?: string | null },
  provider:    PaymentProvider,
  mollieReady: boolean,
): boolean {
  if (provider === "mollie") return mollieReady;
  return typeof bundle.stripePrice === "string" && bundle.stripePrice.trim() !== "";
}
