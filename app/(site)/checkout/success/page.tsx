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
import { getDb }             from "@/data/db";
import { settleMolliePayment } from "@/billing/mollie-checkout";
import { settleMollieTrialReturn } from "@/billing/mollie-trial";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const t = SHOP_TEXTS[await getSiteLocale()];
  // With ?ref= the visitor is back from Mollie and may not have paid: the tab
  // must not say "payment confirmed" before the page knows.
  const fromMollie = typeof (await searchParams)["ref"] === "string";
  return {
    title:  fromMollie ? t.metaCheckoutTitle : t.metaSuccessTitle,
    robots: { index: false },
  };
}

/**
 * Mollie sends the visitor back with ?ref=<uuid>, whether they paid or not.
 * The payment is read back from Mollie here and, when it is paid, the account
 * is created at once (the webhook does the same, whichever is first). The
 * page then shows what really happened instead of always "payment confirmed".
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ref = (await searchParams)["ref"];
  let outcome: "ok" | "pending" | "not-completed" = "ok";

  if (typeof ref === "string" && ref !== "") {
    try {
      const state = await settleMollieTrialReturn(getDb(), ref, settleMolliePayment);
      if (state === "not-paid" || state === "refused" || state === null) outcome = "not-completed";
      else if (state === "waiting") outcome = "pending";
    } catch (err) {
      // The payment may well be fine: the webhook completes the signup.
      console.error("[checkout/success] could not settle the Mollie return", err);
      outcome = "pending";
    }
  }

  return <CheckoutSuccessClient outcome={outcome} />;
}
