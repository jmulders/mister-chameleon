"use client";

/**
 * lib/cart/cart-context.tsx
 *
 * React binding for the cart. All cart state and logic live in cart-store.ts (a
 * framework-agnostic external store); this file only exposes it to components as
 * a context, so the public API — <CartProvider>, useCart(), useCartSafe() — is
 * unchanged for every consumer.
 *
 * ─── Why the state is not here anymore ────────────────────────────────────────
 *
 *   The provider used to hold the cart in useState and load localStorage in a
 *   useEffect that called setCartState() — the set-state-in-effect the linter
 *   flags. It now reads the store via useSyncExternalStore, which handles the
 *   client-only restore (getServerSnapshot = empty, matching SSR; the persisted
 *   cart is read right after subscribe). See cart-store.ts for the details.
 */

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  type Cart,
  type CartPlan,
  type CartCreditBundle,
  type PlanId,
  subscribeCart,
  getCartSnapshot,
  getServerCartSnapshot,
  computeTotals,
  cartActions,
} from "./cart-store";

// Re-export the types so existing `import { ..., type PlanId } from
// "@/lib/cart/cart-context"` sites keep working.
export type { Cart, CartPlan, CartCreditBundle, PlanId };

// ── Context value ─────────────────────────────────────────────────────────────

export interface CartContextValue {
  cart:                  Cart;
  setPlan:               (plan: CartPlan) => void;
  removePlan:            () => void;
  addCreditBundle:       (bundle: CartCreditBundle) => void;
  updateCreditBundleQty: (bundleId: string, qty: number) => void;
  removeCreditBundle:    (bundleId: string) => void;
  clearCart:             () => void;
  /** Total number of line items (1 plan + N credit bundles). */
  itemCount:             number;
  /** Combined order total in euro-cents. */
  totalCents:            number;
}

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const cart = useSyncExternalStore(
    subscribeCart,
    getCartSnapshot,
    getServerCartSnapshot,
  );

  const { itemCount, totalCents } = computeTotals(cart);

  // cartActions are module-level and stable; only cart/totals change.
  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      setPlan:               cartActions.setPlan,
      removePlan:            cartActions.removePlan,
      addCreditBundle:       cartActions.addCreditBundle,
      updateCreditBundleQty: cartActions.updateCreditBundleQty,
      removeCreditBundle:    cartActions.removeCreditBundle,
      clearCart:             cartActions.clearCart,
      itemCount,
      totalCents,
    }),
    [cart, itemCount, totalCents],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Returns the cart context value.
 * Throws if called outside a <CartProvider>.
 */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

/**
 * Like useCart() but returns null when used outside a <CartProvider>.
 * Safe to call from components that may be rendered server-side or outside
 * the site layout (e.g. block showcase, admin routes).
 */
export function useCartSafe(): CartContextValue | null {
  return useContext(CartContext);
}
