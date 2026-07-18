/**
 * lib/cart/cart-store.ts
 *
 * Framework-agnostic shopping-cart store, backed by localStorage and exposed as
 * an external store (subscribe + snapshot) so React reads it with
 * useSyncExternalStore.
 *
 * ─── Why the cart moved out of the provider ───────────────────────────────────
 *
 *   The old CartProvider held the cart in useState and loaded localStorage in a
 *   useEffect that called setCartState() — the set-state-in-effect pattern the
 *   linter flags, and a hydration-fragile way to restore client-only state.
 *
 *   As an external store the load becomes a getServerSnapshot concern: the server
 *   (and the first hydration render) see EMPTY_CART, matching the SSR HTML, and
 *   the persisted cart is read straight after subscribe — no effect, no mismatch.
 *
 *   The bonus is that the mutation and totals logic is now pure and unit-testable
 *   without rendering a component. The checkout path had no tests; now its maths
 *   can have them. Every reducer below is exported for exactly that reason.
 */

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

export const EMPTY_CART: Cart = { plan: null, creditBundles: [] };
const STORAGE_KEY = "mc_cart_v1";

// ── Pure reducers (exported for tests) ────────────────────────────────────────
//
// Each returns a NEW Cart; none mutate their input. This is the entire cart
// business logic, isolated from React and from localStorage.

export function withPlan(cart: Cart, plan: CartPlan): Cart {
  return { ...cart, plan };
}

export function withoutPlan(cart: Cart): Cart {
  return { ...cart, plan: null };
}

/** Add a bundle. If the same bundleId is already present, sum the quantities. */
export function withCreditBundle(cart: Cart, bundle: CartCreditBundle): Cart {
  const existing = cart.creditBundles.find((b) => b.bundleId === bundle.bundleId);
  if (existing) {
    return {
      ...cart,
      creditBundles: cart.creditBundles.map((b) =>
        b.bundleId === bundle.bundleId
          ? { ...b, quantity: b.quantity + bundle.quantity }
          : b,
      ),
    };
  }
  return { ...cart, creditBundles: [...cart.creditBundles, bundle] };
}

/** Set a bundle's quantity. A quantity of 0 or less removes it entirely. */
export function withCreditBundleQty(cart: Cart, bundleId: string, qty: number): Cart {
  return {
    ...cart,
    creditBundles:
      qty <= 0
        ? cart.creditBundles.filter((b) => b.bundleId !== bundleId)
        : cart.creditBundles.map((b) =>
            b.bundleId === bundleId ? { ...b, quantity: qty } : b,
          ),
  };
}

export function withoutCreditBundle(cart: Cart, bundleId: string): Cart {
  return {
    ...cart,
    creditBundles: cart.creditBundles.filter((b) => b.bundleId !== bundleId),
  };
}

export function computeTotals(cart: Cart): { itemCount: number; totalCents: number } {
  const itemCount = (cart.plan ? 1 : 0) + cart.creditBundles.length;
  const totalCents =
    (cart.plan?.priceCents ?? 0) +
    cart.creditBundles.reduce((sum, b) => sum + b.priceCentsEach * b.quantity, 0);
  return { itemCount, totalCents };
}

// ── localStorage adapters ─────────────────────────────────────────────────────
//
// Both guard `typeof window` so the module is import-safe on the server and in
// tests (where they are simply no-ops / return EMPTY_CART).

function readStorage(): Cart {
  if (typeof window === "undefined") return EMPTY_CART;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Cart) : EMPTY_CART;
  } catch {
    return EMPTY_CART; // parse error / disabled storage → empty
  }
}

function persist(cart: Cart): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* quota / private mode — ignore */
  }
}

// ── External store ────────────────────────────────────────────────────────────

let state: Cart = EMPTY_CART;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function commit(next: Cart): void {
  state = next;
  persist(next);
  emit();
}

/**
 * useSyncExternalStore subscribe. On the first client subscription it hydrates
 * `state` from localStorage — this is what replaces the load-on-mount effect.
 * React re-reads the snapshot right after subscribing, so the restored cart
 * shows up immediately without a manual setState.
 */
export function subscribeCart(listener: () => void): () => void {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    state = readStorage();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Client snapshot — stable reference between mutations. */
export function getCartSnapshot(): Cart {
  return state;
}

/** Server + first-hydration snapshot — always empty, matches the SSR HTML. */
export function getServerCartSnapshot(): Cart {
  return EMPTY_CART;
}

// ── Mutations (stable identities; safe to pass straight into context) ─────────

export const cartActions = {
  setPlan:               (plan: CartPlan)                    => commit(withPlan(state, plan)),
  removePlan:            ()                                  => commit(withoutPlan(state)),
  addCreditBundle:       (bundle: CartCreditBundle)          => commit(withCreditBundle(state, bundle)),
  updateCreditBundleQty: (bundleId: string, qty: number)     => commit(withCreditBundleQty(state, bundleId, qty)),
  removeCreditBundle:    (bundleId: string)                  => commit(withoutCreditBundle(state, bundleId)),
  clearCart:             ()                                  => commit(EMPTY_CART),
};
