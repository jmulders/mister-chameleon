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

export const metadata: Metadata = {
  title:  "Checkout — Mister Chameleon",
  robots: { index: false },
};

export default function CheckoutPage() {
  return <CheckoutPageClient />;
}
