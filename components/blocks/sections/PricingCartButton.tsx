"use client";

/**
 * PricingCartButton
 *
 * Client-side CTA button for pricing tier cards.
 *
 * When the ctaHref follows the `/order/{planId}` pattern, clicking the button
 * adds the plan to the cart (via useCart().setPlan) and navigates to /cart so
 * the user can review their order.  For any other href the button falls back
 * to a plain anchor link, preserving backward-compatibility.
 *
 * This component is intentionally tiny so that PricingSectionBlock can remain
 * a server component — only the interactive CTA needs to be a client island.
 */

import { useRouter }            from "next/navigation";
import { useCartSafe, type PlanId } from "@/lib/cart/cart-context";

// ── Plan price catalogue — mirrors CartButtons.tsx + billing/plans.ts ─────────

const PLAN_PRICES: Record<PlanId, { name: string; priceCents: number; period: string }> = {
  starter: { name: "Starter",      priceCents: 14900, period: "/month" },
  growth:  { name: "Growth",       priceCents: 34900, period: "/month" },
  pro:     { name: "Pro / Agency", priceCents: 74900, period: "/month" },
};

const KNOWN_PLAN_IDS = new Set<string>(["starter", "growth", "pro"]);

function extractPlanId(ctaHref: string): PlanId | null {
  const match = ctaHref.match(/^\/order\/(\w+)$/);
  if (!match) return null;
  const id = match[1];
  return KNOWN_PLAN_IDS.has(id) ? (id as PlanId) : null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PricingCartButtonProps {
  ctaHref:     string;
  ctaLabel:    string;
  highlighted: boolean;
  /** Additional className to apply to the element */
  className?:  string;
  style?:      React.CSSProperties;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PricingCartButton({
  ctaHref,
  ctaLabel,
  highlighted,
  className,
  style,
}: PricingCartButtonProps) {
  const cart   = useCartSafe();
  const router = useRouter();

  const planId = extractPlanId(ctaHref);

  // If cart is available and this is a known plan href, use cart flow.
  if (cart && planId) {
    function handleClick() {
      cart!.setPlan({ planId: planId!, ...PLAN_PRICES[planId!] });
      router.push("/cart");
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className={className}
        style={style}
      >
        {ctaLabel}
      </button>
    );
  }

  // Fallback: plain anchor for non-order hrefs or when CartProvider is absent.
  return (
    <a href={ctaHref} className={className} style={style}>
      {ctaLabel}
    </a>
  );
}
