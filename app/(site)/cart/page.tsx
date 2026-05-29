/**
 * app/(site)/cart/page.tsx
 *
 * Shopping cart review page.
 *
 * Server component shell — delegates all rendering to CartPageClient which
 * reads from the CartContext (localStorage-backed) and renders the cart
 * contents, credit-bundle controls, order summary, and "Proceed to checkout"
 * CTA.
 */

import type { Metadata }     from "next";
import { CartPageClient }    from "./_components/CartPageClient";

export const metadata: Metadata = {
  title:  "Your cart — Mister Chameleon",
  robots: { index: false },
};

export default function CartPage() {
  return <CartPageClient />;
}
