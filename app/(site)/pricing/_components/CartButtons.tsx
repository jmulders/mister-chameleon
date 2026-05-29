"use client";

/**
 * app/(site)/pricing/_components/CartButtons.tsx
 *
 * Client-side "Add to cart" buttons used by the pricing page.
 *
 * Separated from the server-rendered pricing page so that the page itself
 * remains a Server Component (metadata, static data).  Only the interactive
 * add-to-cart actions live here.
 *
 * ─── PlanCartButton ───────────────────────────────────────────────────────────
 *
 *   Sets the cart plan (replacing any previous selection) and navigates to
 *   /cart so the user can review their order and optionally add credits.
 *
 * ─── CreditCartButton ─────────────────────────────────────────────────────────
 *
 *   Adds one credit bundle to the cart (or increments the quantity if the
 *   same bundle is already in the cart) and navigates to /cart.
 */

import { useRouter }            from "next/navigation";
import { useCart, type PlanId } from "@/lib/cart/cart-context";

// ── Shared colours ────────────────────────────────────────────────────────────

const BTN_PRIMARY =
  "block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-colors bg-white text-neutral-900 hover:bg-neutral-100";
const BTN_SECONDARY =
  "block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-colors bg-neutral-900 text-white hover:bg-neutral-700";

// ── Plan price catalogue (mirrors CartSummaryBlock + billing/plans.ts) ─────────

const PLAN_PRICES: Record<PlanId, { name: string; priceCents: number; period: string }> = {
  starter: { name: "Starter",      priceCents: 14900, period: "/month" },
  growth:  { name: "Growth",       priceCents: 34900, period: "/month" },
  pro:     { name: "Pro / Agency", priceCents: 74900, period: "/month" },
};

// ── PlanCartButton ─────────────────────────────────────────────────────────────

interface PlanCartButtonProps {
  planId:    PlanId;
  isPopular?: boolean;
  label?:    string;
}

export function PlanCartButton({
  planId,
  isPopular = false,
  label     = "Start free trial",
}: PlanCartButtonProps) {
  const { setPlan } = useCart();
  const router      = useRouter();

  function handleClick() {
    setPlan({ planId, ...PLAN_PRICES[planId] });
    router.push("/cart");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={isPopular ? BTN_PRIMARY : BTN_SECONDARY}
    >
      {label}
    </button>
  );
}

// ── CreditCartButton ───────────────────────────────────────────────────────────

interface CreditCartButtonProps {
  bundleId:       string;
  label:          string;
  priceCentsEach: number;
  creditsEach:    number;
  /** Visual style. Defaults to "secondary" (dark button on white). */
  style?:         "primary" | "secondary" | "outline";
  buttonLabel?:   string;
}

export function CreditCartButton({
  bundleId,
  label,
  priceCentsEach,
  creditsEach,
  style       = "outline",
  buttonLabel = "Add to cart",
}: CreditCartButtonProps) {
  const { addCreditBundle } = useCart();
  const router              = useRouter();

  const OUTLINE =
    "block w-full rounded-xl border border-neutral-900 py-2.5 text-center text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white";

  const className =
    style === "primary"   ? BTN_PRIMARY   :
    style === "secondary" ? BTN_SECONDARY :
    OUTLINE;

  function handleClick() {
    addCreditBundle({
      bundleId,
      label,
      quantity:       1,
      priceCentsEach,
      creditsEach,
    });
    router.push("/cart");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
    >
      {buttonLabel}
    </button>
  );
}
