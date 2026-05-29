/**
 * Stripe SDK — lazy singleton.
 *
 * Using a lazy getter instead of a module-level throw means that:
 *   • Importing this module never crashes, even when STRIPE_SECRET_KEY is absent.
 *   • The error surfaces only when a billing API route actually calls a Stripe
 *     method, so unrelated pages (homepage, admin, etc.) are never affected.
 *   • Tree-shaking works as expected: the Stripe constructor runs only once.
 */

import Stripe from "stripe";

let _stripe: Stripe | undefined;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY — add it to .env.local before using Stripe.",
    );
  }
  _stripe = new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
  return _stripe;
}

/**
 * Drop-in replacement for the previous `stripe` named export.
 *
 * All property accesses are forwarded to the lazy singleton via a Proxy, so
 * existing callers (`stripe.checkout.sessions.create(…)`) continue to work
 * unchanged.  The first property access triggers initialisation (and throws
 * if STRIPE_SECRET_KEY is not set) rather than the module import.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return Reflect.get(getStripe(), prop) as unknown;
  },
  // Stripe SDK methods are called with the correct `this` context via Reflect.get.
  // If a method needs explicit binding, callers can do: const s = stripe; s.method(…)
});
