/**
 * Stripe Client
 *
 * Server-side singleton Stripe instance.  Import `stripe` from this module
 * wherever you need to call the Stripe API.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   STRIPE_SECRET_KEY          Required.  Secret key from Stripe dashboard.
 *                              Format: sk_live_… or sk_test_…
 *
 *   STRIPE_WEBHOOK_SECRET      Required for webhook signature verification.
 *                              Format: whsec_…
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { stripe } from "@/lib/billing/stripe-client";
 *   const session = await stripe.checkout.sessions.create({ ... });
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   This module is safe to import in any Server Component, API route, or
 *   Server Action.  It MUST NOT be imported client-side.
 *   Guard with `"use server"` or keep in server-only module boundaries.
 */

import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[stripe-client] Missing required environment variable: ${name}. ` +
      `Add it to .env.local (dev) or your deployment environment (prod).`,
    );
  }
  return value;
}

/**
 * Server-side Stripe SDK instance.
 * Lazily evaluated so the environment variable is only required at call time,
 * not at module import time (which would break builds without the variable).
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2024-06-20",
      typescript:  true,
    });
  }
  return _stripe;
}

/** Convenience export — the Stripe instance, same as `getStripe()`. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop: string | symbol) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * The Stripe webhook secret.  Used in webhook route to verify signature.
 * Throws if not set — better to fail loudly than silently accept unsigned events.
 */
export function getWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}
