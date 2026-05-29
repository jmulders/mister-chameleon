"use client";

/**
 * CartIconButton
 *
 * Sticky header cart icon — shows a badge with the number of items in the cart.
 * Reads from CartContext (localStorage-backed) and navigates to /cart on click.
 *
 * Hidden when the cart is empty (badge not shown, icon still visible).
 * Renders null when CartProvider is not in the tree (e.g. admin layout).
 */

import Link           from "next/link";
import { useCartSafe } from "@/lib/cart/cart-context";

export function CartIconButton() {
  const cart = useCartSafe();

  // Don't render if CartProvider is missing (admin / server-only pages)
  if (!cart) return null;

  const count = cart.itemCount;

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `View cart — ${count} item${count !== 1 ? "s" : ""}` : "View cart"}
      style={{
        position:        "relative",
        display:         "inline-flex",
        alignItems:      "center",
        justifyContent:  "center",
        width:           "2.25rem",
        height:          "2.25rem",
        borderRadius:    "0.5rem",
        color:           "var(--header-fg, currentColor)",
        textDecoration:  "none",
        flexShrink:      0,
        transition:      "background 0.15s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-subtle, rgba(0,0,0,0.06))")}
      onMouseOut={(e)  => (e.currentTarget.style.background = "transparent")}
    >
      {/* Cart icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <path
          d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="3"
          y1="6"
          x2="21"
          y2="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M16 10a4 4 0 01-8 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Item count badge */}
      {count > 0 && (
        <span
          aria-hidden="true"
          style={{
            position:        "absolute",
            top:             "-4px",
            right:           "-4px",
            minWidth:        "1.1rem",
            height:          "1.1rem",
            padding:         "0 0.25rem",
            borderRadius:    "9999px",
            background:      "var(--primary, #4f46e5)",
            color:           "white",
            fontSize:        "0.65rem",
            fontWeight:      700,
            lineHeight:      "1.1rem",
            textAlign:       "center",
            pointerEvents:   "none",
          }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
