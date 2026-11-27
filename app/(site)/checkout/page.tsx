/**
 * app/(site)/checkout/page.tsx
 *
 * Checkout page — account creation form + order summary.
 *
 * Server component shell that delegates rendering to CheckoutPageClient,
 * which reads cart contents from CartContext (localStorage) and handles
 * form submission to /api/trial/start.
 */

import type { Metadata }          from "next";
import { CheckoutPageClient }     from "./_components/CheckoutPageClient";
import { getSiteLocale }          from "@/lib/site-texts/server";
import { SHOP_TEXTS }             from "@/lib/site-texts/shop";
import { mollieTrialSignupEnabled, TRIAL_VERIFICATION_CENTS } from "@/billing/mollie-trial";

// The note above the form depends on a setting, so it is read per request.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = SHOP_TEXTS[await getSiteLocale()];
  return {
    title:  t.metaCheckoutTitle,
    robots: { index: false },
  };
}

export default function CheckoutPage() {
  // With Mollie the visitor pays a small amount now to verify the payment
  // method. The form says so before they start.
  const verificationCents = mollieTrialSignupEnabled() ? TRIAL_VERIFICATION_CENTS : null;
  return <CheckoutPageClient verificationCents={verificationCents} />;
}
