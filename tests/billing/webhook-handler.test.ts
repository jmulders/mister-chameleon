/**
 * Stripe webhook handler — integration over the dispatch + DB write.
 *
 * ─── Wat dit bewaakt ─────────────────────────────────────────────────────────
 *
 *   subscription-period.test.ts pint de pure periode-lezer. Dit gaat een laag
 *   hoger: het voert een heel Stripe-event door handleStripeWebhook() met een
 *   opnemende mock-client, en controleert welke rij er in `subscriptions` belandt.
 *   Dat is precies de plek waar de bug van 18 juli 2026 leefde — de handler las de
 *   periode van de verkeerde plek, crashte, en de route slikte het. Geen enkele
 *   test raakte de handler, dus niets ving het.
 *
 *   Geen database: de mock-client neemt de upsert/update-calls op. Dat toetst de
 *   handler-logica (welke velden, uit welke bron), niet Postgres zelf — dat laatste
 *   hoort bij de DB-integratietests (tests/integration/, draaien met een echte DB).
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { handleStripeWebhook } from "@/billing/stripe";

// ── Opnemende mock van de Supabase-client ────────────────────────────────────
//
// Elke builder-methode is zowel chainable (retourneert zichzelf) als awaitable
// (thenable → { data, error }), zodat `await client.from(t).update(r).eq(a,b)` en
// `await client.from(t).upsert(r, opts)` allebei werken zoals in supabase-js.

interface Upsert { table: string; row: Record<string, unknown> }

function mockClient() {
  const upserts: Upsert[] = [];
  const updates: Upsert[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain = (method: string) => (...args: unknown[]) => {
      if (method === "upsert") upserts.push({ table, row: args[0] as Record<string, unknown> });
      if (method === "update") updates.push({ table, row: args[0] as Record<string, unknown> });
      return b;
    };
    for (const m of [
      "upsert", "update", "insert", "delete", "select",
      "eq", "neq", "in", "is", "order", "limit", "maybeSingle", "single",
    ]) {
      b[m] = chain(m);
    }
    // thenable: awaiting any chain resolves to a clean result.
    b["then"] = (resolve: (v: { data: null; error: null }) => unknown) =>
      resolve({ data: null, error: null });
    return b;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = { from: (table: string) => builder(table) };
  return { client, upserts, updates };
}

// ── Event-fabriek: het huidige Stripe-formaat (periode op het ITEM) ──────────

function subscriptionUpdatedEvent(over: Record<string, unknown> = {}) {
  return {
    id:       "evt_test_1",
    type:     "customer.subscription.updated",
    livemode: false,
    data: {
      object: {
        id:       "sub_test_1",
        status:   "active",
        customer: "cus_test_1",
        metadata: { tenant_id: "acme", plan_id: "pro" },
        cancel_at_period_end: false,
        canceled_at: null,
        // Periode op het item — zoals Stripe API >= 2024-09-30 het levert.
        items: { data: [{
          plan: { interval: "month" },
          current_period_start: 1784229438, // 2026-07-16
          current_period_end:   1786907838, // 2026-08-16
        }] },
        ...over,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("handleStripeWebhook — customer.subscription.updated", () => {

  it("schrijft de subscription-rij met de periode van het ITEM (de regressie)", async () => {
    const { client, upserts } = mockClient();

    const result = await handleStripeWebhook(client, subscriptionUpdatedEvent(), "test");

    assert.deepEqual(result, { handled: true, action: "subscription_updated", tenantId: "acme" });

    const sub = upserts.find((u) => u.table === "subscriptions");
    assert.ok(sub, "er moet een upsert op subscriptions zijn");
    assert.equal(sub!.row["tenant_id"], "acme");
    assert.equal(sub!.row["plan"], "pro");
    assert.equal(sub!.row["status"], "active");
    assert.equal(sub!.row["billing_cycle"], "monthly");
    // De kern: de einddatum komt van het item (16 aug), niet undefined/crash.
    assert.equal(sub!.row["current_period_end"], new Date(1786907838 * 1000).toISOString());
    assert.equal(sub!.row["current_period_start"], new Date(1784229438 * 1000).toISOString());
  });

  it("valt niet om als de periode ontbreekt — schrijft null, geen NaN", async () => {
    const { client, upserts } = mockClient();
    const ev = subscriptionUpdatedEvent({
      items: { data: [{ plan: { interval: "month" } }] },
      billing_cycle_anchor: 1785542400,
    });

    const result = await handleStripeWebhook(client, ev, "test");

    assert.equal(result.handled, true);
    const sub = upserts.find((u) => u.table === "subscriptions")!;
    assert.equal(sub.row["current_period_end"], null, "geen einddatum → null, geen Invalid Date");
    assert.ok(typeof sub.row["current_period_start"] === "string", "start valt terug op de anchor");
  });

  it("negeert een event zonder tenant_id in de metadata", async () => {
    const { client, upserts } = mockClient();
    const ev = subscriptionUpdatedEvent({ metadata: {} });

    const result = await handleStripeWebhook(client, ev, "test");

    assert.deepEqual(result, { handled: false, action: "no_tenant_id", tenantId: null });
    assert.equal(upserts.length, 0, "niets weggeschreven zonder tenant");
  });

  it("weigert een live-event terwijl de modus test is (livemode mismatch)", async () => {
    const { client, upserts } = mockClient();
    const ev = subscriptionUpdatedEvent();
    ev.livemode = true;

    const result = await handleStripeWebhook(client, ev, "test");

    assert.equal(result.handled, false);
    assert.equal(result.action, "livemode_mismatch");
    assert.equal(upserts.length, 0, "een mismatchend event raakt de database niet");
  });
});

describe("handleStripeWebhook — customer.subscription.deleted", () => {

  it("markeert de rij als canceled", async () => {
    const { client, updates } = mockClient();
    const ev = subscriptionUpdatedEvent();
    ev.type = "customer.subscription.deleted";

    const result = await handleStripeWebhook(client, ev, "test");

    assert.deepEqual(result, { handled: true, action: "subscription_canceled", tenantId: "acme" });
    const sub = updates.find((u) => u.table === "subscriptions");
    assert.ok(sub, "subscriptions moet ge-update zijn");
    assert.equal(sub!.row["status"], "canceled");
  });
});
