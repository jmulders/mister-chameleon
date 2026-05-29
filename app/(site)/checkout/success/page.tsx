/**
 * app/(site)/checkout/success/page.tsx
 *
 * Stripe redirects here after a successful Checkout session:
 *   /checkout/success?session_id=cs_...
 *
 * The actual account creation happens asynchronously via the
 * checkout.session.completed webhook → /api/webhooks/stripe.
 * This page simply reassures the user that their payment went through
 * and their account is being set up.
 */

import type { Metadata } from "next";
import CheckoutSuccessClient from "./_components/CheckoutSuccessClient";

export const metadata: Metadata = {
  title:  "Payment confirmed — Mister Chameleon",
  robots: { index: false },
};

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessClient />;
}
