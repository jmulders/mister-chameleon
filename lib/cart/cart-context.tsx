"use client";

/**
 * lib/cart/cart-context.tsx
 *
 * Client-side shopping cart state for the Mister Chameleon order flow.
 *
 * ─── What lives in the cart ───────────────────────────────────────────────────
 *
 *   plan          — the selected subscription plan (at most one; replacing
 *                   a plan replaces the previous selection)
 *   creditBundles — zero or more Chameleon Credit packages (Hatchling /
 *                   Climber / Dragon), each with a quantity
 *
 * ─── Persistence ─────────────────────────────────────────────────────────────
 *
 *   Cart state is persisted to localStorage under the key "mc_cart_v1".
 *   It is loaded on first render and written on every update.
 *   The cart is cleared after a successful checkout.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   Wrap the site layout with <CartProvider>.
 *   Read and mutate with the useCart() hook inside client components.
 *   Use useCartSafe() in components that may render outside the provider
 *   (returns null when not inside CartProvider — safe for SSR contexts).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanId = "starter" | "growth" | "pro";

export interface CartPlan {
  planId:     PlanId;
  name:       string;
  /** Monthly price in euro-cents (e.g. 14900 = €149). */
  priceCents: number;
  period:     string;
}

export interface CartCreditBundle {
  bundleId:       string;
  label:          string;
  /** Number of units in the cart (1 = buy once, 2 = buy twice, etc.). */
  quantity:       number;
  /** Price per unit in euro-cents. */
  priceCentsEach: number;
  /** Number of credits per unit (e.g. 5000 = "Hatchling"). */
  creditsEach:    number;
}

export interface Cart {
  plan:          CartPlan | null;
  creditBundles: CartCreditBundle[];
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY_CART: Cart = { plan: null, creditBundles: [] };
const STORAGE_KEY = "mc_cart_v1";

function computeTotals(cart: Cart) {
  const itemCount =
    (cart.plan ? 1 : 0) + cart.creditBundles.length;
  const totalCents =
    (cart.plan?.priceCents ?? 0) +
    cart.creditBundles.reduce(
      (sum, b) => sum + b.priceCentsEach * b.quantity,
      0,
    );
  return { itemCount, totalCents };
}

// ── Context ───────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<Cart>(EMPTY_CART);

  // Load persisted cart from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCartState(JSON.parse(raw) as Cart);
    } catch {
      // Ignore parse/storage errors — start with empty cart.
    }
  }, []);

  // Persist cart to localStorage on every state change.
  const setCart = useCallback((updater: (prev: Cart) => Cart) => {
    setCartState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* quota / private mode — ignore */ }
      return next;
    });
  }, []);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const setPlan = useCallback(
    (plan: CartPlan) => setCart((prev) => ({ ...prev, plan })),
    [setCart],
  );

  const removePlan = useCallback(
    () => setCart((prev) => ({ ...prev, plan: null })),
    [setCart],
  );

  const addCreditBundle = useCallback(
    (bundle: CartCreditBundle) =>
      setCart((prev) => {
        const existing = prev.creditBundles.find(
          (b) => b.bundleId === bundle.bundleId,
        );
        if (existing) {
          return {
            ...prev,
            creditBundles: prev.creditBundles.map((b) =>
              b.bundleId === bundle.bundleId
                ? { ...b, quantity: b.quantity + bundle.quantity }
                : b,
            ),
          };
        }
        return {
          ...prev,
          creditBundles: [...prev.creditBundles, bundle],
        };
      }),
    [setCart],
  );

  const updateCreditBundleQty = useCallback(
    (bundleId: string, qty: number) =>
      setCart((prev) => ({
        ...prev,
        creditBundles:
          qty <= 0
            ? prev.creditBundles.filter((b) => b.bundleId !== bundleId)
            : prev.creditBundles.map((b) =>
                b.bundleId === bundleId ? { ...b, quantity: qty } : b,
              ),
      })),
    [setCart],
  );

  const removeCreditBundle = useCallback(
    (bundleId: string) =>
      setCart((prev) => ({
        ...prev,
        creditBundles: prev.creditBundles.filter(
          (b) => b.bundleId !== bundleId,
        ),
      })),
    [setCart],
  );

  const clearCart = useCallback(
    () => setCart(() => EMPTY_CART),
    [setCart],
  );

  const { itemCount, totalCents } = computeTotals(cart);

  return (
    <CartContext.Provider
      value={{
        cart,
        setPlan,
        removePlan,
        addCreditBundle,
        updateCreditBundleQty,
        removeCreditBundle,
        clearCart,
        itemCount,
        totalCents,
      }}
    >
      {children}
    </CartContext.Provider>
  );
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
