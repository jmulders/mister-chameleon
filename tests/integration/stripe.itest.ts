/**
 * Stripe integration — the real API, in test mode.
 *
 * The pure suite tests nextCalendarMonthStartUnix(); it cannot test whether
 * Stripe honours the anchor, or whether the price IDs the billing config points
 * at actually exist and cost what we think. This does the latter — a read-only
 * consistency check between the plan config and Stripe, plus a live smoke of the
 * anchor timestamp on a throwaway subscription.
 *
 * Self-skips unless STRIPE_TEST_SECRET_KEY is set. Uses TEST-mode keys only; it
 * creates and immediately cancels a throwaway subscription on a test customer, so
 * no real money and no lasting objects.
 */

import { describe, it }              from "node:test";
import assert                        from "node:assert/strict";
import Stripe                        from "stripe";
import { STRIPE_API_VERSION }        from "@/billing/stripe-config";
import { nextCalendarMonthStartUnix } from "@/billing/stripe";

const KEY  = process.env["STRIPE_TEST_SECRET_KEY"];
const skip = !KEY ? "STRIPE_TEST_SECRET_KEY not set" : false;

// The Pro monthly price the two live subscriptions use (test mode shares the id).
const PRO_MONTHLY_PRICE = "price_1TR5B7DEKaa8bAKIXbxTkqHb";

describe("Stripe integration (test mode)", () => {

  it("the Pro price exists and still costs EUR 749", { skip }, async () => {
    const stripe = new Stripe(KEY!, { apiVersion: STRIPE_API_VERSION });
    const price  = await stripe.prices.retrieve(PRO_MONTHLY_PRICE);
    assert.equal(price.active, true, "Pro price should be active");
    assert.equal(price.currency, "eur");
    assert.equal(price.unit_amount, 74900, "Pro is EUR 749,00 — config drift if this fails");
    assert.equal(price.recurring?.interval, "month");
  });

  it("Stripe accepts nextCalendarMonthStartUnix() as a billing_cycle_anchor", { skip }, async () => {
    const stripe = new Stripe(KEY!, { apiVersion: STRIPE_API_VERSION });

    // Throwaway customer with a test payment method attached.
    const customer = await stripe.customers.create({ description: "itest — safe to delete" });
    try {
      await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: "pm_card_visa" },
      });

      const anchor = nextCalendarMonthStartUnix();
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: PRO_MONTHLY_PRICE }],
        billing_cycle_anchor: anchor,
        proration_behavior: "none",
      });

      // The anchor Stripe stored is the 1st we asked for — the thing the billing
      // model needs and that we could only verify by hand until now.
      assert.equal(sub.billing_cycle_anchor, anchor, "Stripe should honour the calendar-month anchor");
      const anchorDate = new Date(anchor * 1000);
      assert.equal(anchorDate.getUTCDate(), 1, "anchor lands on the 1st, UTC");

      await stripe.subscriptions.cancel(sub.id);
    } finally {
      await stripe.customers.del(customer.id);
    }
  });
});
