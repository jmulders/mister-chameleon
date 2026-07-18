/**
 * Cart store — the checkout maths, finally under test.
 *
 * ─── Wat dit bewaakt ─────────────────────────────────────────────────────────
 *
 *   De cart-logica zat opgesloten in een React-provider zonder één test, terwijl
 *   het een betaalpad is: één fout in een totaal of een merge en een klant betaalt
 *   het verkeerde bedrag. Bij het omzetten naar een externe store (om de
 *   set-state-in-effect eruit te halen) is de logica pure functies geworden — en
 *   dus toetsbaar. Dit pint het gedrag dat de kassa correct houdt:
 *
 *     • één plan tegelijk (een plan vervangt het vorige)
 *     • dezelfde credit-bundel nogmaals toevoegen telt de aantallen op
 *     • aantal 0 (of minder) verwijdert de bundel
 *     • totalen: plan-prijs + som van (prijs-per-stuk × aantal)
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  EMPTY_CART,
  withPlan,
  withoutPlan,
  withCreditBundle,
  withCreditBundleQty,
  withoutCreditBundle,
  computeTotals,
  type CartPlan,
  type CartCreditBundle,
} from "@/lib/cart/cart-store";

const proPlan: CartPlan = {
  planId: "pro", name: "Pro plan", priceCents: 74900, period: "month",
};
const growthPlan: CartPlan = {
  planId: "growth", name: "Growth plan", priceCents: 34900, period: "month",
};
const hatchling: CartCreditBundle = {
  bundleId: "credits_5000", label: "Hatchling", quantity: 1,
  priceCentsEach: 9900, creditsEach: 5000,
};

describe("cart-store — plan", () => {
  it("adds a plan to an empty cart", () => {
    const cart = withPlan(EMPTY_CART, proPlan);
    assert.equal(cart.plan?.planId, "pro");
  });

  it("replaces the plan rather than keeping two", () => {
    const cart = withPlan(withPlan(EMPTY_CART, growthPlan), proPlan);
    assert.equal(cart.plan?.planId, "pro");
  });

  it("removes the plan but keeps credit bundles", () => {
    const withBoth = withCreditBundle(withPlan(EMPTY_CART, proPlan), hatchling);
    const cart     = withoutPlan(withBoth);
    assert.equal(cart.plan, null);
    assert.equal(cart.creditBundles.length, 1);
  });

  it("does not mutate its input", () => {
    const before = withPlan(EMPTY_CART, growthPlan);
    withPlan(before, proPlan);
    assert.equal(before.plan?.planId, "growth", "original cart unchanged");
  });
});

describe("cart-store — credit bundles", () => {
  it("adds a new bundle", () => {
    const cart = withCreditBundle(EMPTY_CART, hatchling);
    assert.equal(cart.creditBundles.length, 1);
    assert.equal(cart.creditBundles[0]?.quantity, 1);
  });

  it("sums quantities when the same bundle is added again", () => {
    const once  = withCreditBundle(EMPTY_CART, hatchling);
    const twice = withCreditBundle(once, { ...hatchling, quantity: 2 });
    assert.equal(twice.creditBundles.length, 1, "still one line");
    assert.equal(twice.creditBundles[0]?.quantity, 3, "1 + 2");
  });

  it("sets an explicit quantity", () => {
    const cart = withCreditBundleQty(withCreditBundle(EMPTY_CART, hatchling), "credits_5000", 4);
    assert.equal(cart.creditBundles[0]?.quantity, 4);
  });

  it("removes the bundle when quantity drops to 0", () => {
    const cart = withCreditBundleQty(withCreditBundle(EMPTY_CART, hatchling), "credits_5000", 0);
    assert.equal(cart.creditBundles.length, 0);
  });

  it("removes the bundle when quantity goes negative", () => {
    const cart = withCreditBundleQty(withCreditBundle(EMPTY_CART, hatchling), "credits_5000", -1);
    assert.equal(cart.creditBundles.length, 0);
  });

  it("removes a bundle by id", () => {
    const cart = withoutCreditBundle(withCreditBundle(EMPTY_CART, hatchling), "credits_5000");
    assert.equal(cart.creditBundles.length, 0);
  });
});

describe("cart-store — totals", () => {
  it("empty cart is 0 items, 0 cents", () => {
    const { itemCount, totalCents } = computeTotals(EMPTY_CART);
    assert.equal(itemCount, 0);
    assert.equal(totalCents, 0);
  });

  it("counts the plan as one item and adds its price", () => {
    const { itemCount, totalCents } = computeTotals(withPlan(EMPTY_CART, proPlan));
    assert.equal(itemCount, 1);
    assert.equal(totalCents, 74900);
  });

  it("sums plan + bundle price × quantity", () => {
    // Pro (749,00) + 3 × Hatchling (99,00) = 749,00 + 297,00 = 1046,00
    const cart = withCreditBundle(withPlan(EMPTY_CART, proPlan), { ...hatchling, quantity: 3 });
    const { itemCount, totalCents } = computeTotals(cart);
    assert.equal(itemCount, 2, "1 plan + 1 bundle line");
    assert.equal(totalCents, 74900 + 3 * 9900);
  });
});
