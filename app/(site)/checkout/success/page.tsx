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
import { getSiteLocale }     from "@/lib/site-texts/server";
import { SHOP_TEXTS }        from "@/lib/site-texts/shop";

export async function generateMetadata(): Promise<Metadata> {
  const t = SHOP_TEXTS[await getSiteLocale()];
  return {
    title:  t.metaSuccessTitle,
    robots: { index: false },
  };
}

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessClient />;
}
