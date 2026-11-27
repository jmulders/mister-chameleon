/**
 * A session bundle bought through Stripe Checkout is credited once, by
 * whichever road reports the payment.
 *
 * Only the browser returning to the billing page credited. A buyer who paid
 * and closed the tab, or whose delayed payment arrived later, never got the
 * sessions: the webhook had no branch for metadata.type = "session_bundle".
 * See billing/session-bundle-fulfil.ts.
 *
 * No database: the fake below keeps the claim rows, the ledger and the RPC in
 * memory. The webhook is driven through handleStripeWebhook() itself.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";

import { handleStripeWebhook } from "@/billing/stripe";
import { checkoutCreditClaimKey } from "../../billing/checkout-credit-claim.ts";
import {
  fulfilSessionBundleCheckout,
  planSessionBundleCheckout,
  type SessionBundleCheckout,
} from "../../billing/session-bundle-fulfil.ts";

interface LedgerRow {
  tenant_id:                string;
  entry_type:               string;
  amount:                   number;
  bundle_id:                string | null;
  stripe_payment_intent_id: string | null;
  note:                     string | null;
}

function fakeDb(opts: { rpcFailures?: number; claimTableMissing?: boolean; ledger?: LedgerRow[] } = {}) {
  const claims = new Set<string>();
  const ledger: LedgerRow[] = [...(opts.ledger ?? [])];
  let rpcFailures = opts.rpcFailures ?? 0;

  const client = {
    from(table: string) {
      if (table === "wallet_webhook_events") {
        return {
          upsert(row: { stripe_event_id: string }) {
            return {
              async select() {
                if (opts.claimTableMissing) return { data: null, error: { message: "relation does not exist" } };
                if (claims.has(row.stripe_event_id)) return { data: [], error: null };
                claims.add(row.stripe_event_id);
                return { data: [{ stripe_event_id: row.stripe_event_id }], error: null };
              },
            };
          },
          delete() {
            return { async eq(_col: string, value: string) { claims.delete(value); return { error: null }; } };
          },
        };
      }
      if (table === "session_credit_ledger") {
        const filters: Record<string, unknown> = {};
        const query = {
          select() { return query; },
          eq(column: string, value: unknown) { filters[column] = value; return query; },
          async limit(n: number) {
            const rows = ledger.filter((row) =>
              Object.entries(filters).every(([column, value]) => (row as unknown as Record<string, unknown>)[column] === value));
            return { data: rows.slice(0, n).map((_, i) => ({ id: `row-${i}` })), error: null };
          },
        };
        return query;
      }
      throw new Error(`unexpected table: ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "add_session_credits");
      if (rpcFailures > 0) { rpcFailures--; return { data: null, error: { message: "database is down" } }; }
      ledger.push({
        tenant_id:                String(args["p_tenant_id"]),
        entry_type:               "purchase",
        amount:                   Number(args["p_amount"]),
        bundle_id:                String(args["p_bundle_id"]),
        stripe_payment_intent_id: String(args["p_stripe_id"]),
        note:                     String(args["p_note"]),
      });
      return { data: 0, error: null };
    },
  };

  const credited = () => ledger.reduce((sum, row) => sum + row.amount, 0);
  return { client: client as unknown as SupabaseClient, claims, ledger, credited };
}

function checkout(over: Partial<SessionBundleCheckout> = {}, meta: Record<string, string | undefined> = {}): SessionBundleCheckout {
  return {
    id:             "cs_test_1",
    payment_status: "paid",
    metadata:       { type: "session_bundle", tenant_id: "statamic", bundle_id: "sessions_1k", ...meta },
    ...over,
  };
}

function checkoutEvent(type: string, session: SessionBundleCheckout, eventId = "evt_test_1") {
  return {
    id:       eventId,
    type,
    livemode: false,
    data:     { object: { mode: "payment", url: null, customer: "cus_1", subscription: null, ...session } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("planSessionBundleCheckout", () => {
  it("delivers the sessions of the bundle in the metadata when the session is paid", () => {
    assert.deepEqual(planSessionBundleCheckout(checkout()), {
      action: "credit", tenantId: "statamic", bundleId: "sessions_1k", sessions: 1_000, label: "1,000 Sessions",
    });
    const large = planSessionBundleCheckout(checkout({}, { bundle_id: "sessions_20k" }));
    assert.equal(large.action === "credit" && large.sessions, 20_000);
  });

  it("waits for anything that is not paid, a missing status included", () => {
    for (const status of ["unpaid", "no_payment_required", null, undefined]) {
      const plan = planSessionBundleCheckout(checkout({ payment_status: status }));
      assert.equal(plan.action, "wait", String(status));
    }
  });

  it("refuses what it may not deliver", () => {
    assert.deepEqual(planSessionBundleCheckout(checkout({}, { type: "credit_bundle" })), { action: "refuse", reason: "not_session_bundle" });
    assert.deepEqual(planSessionBundleCheckout(checkout({ metadata: null })),            { action: "refuse", reason: "not_session_bundle" });
    assert.deepEqual(planSessionBundleCheckout(checkout({}, { tenant_id: undefined })),  { action: "refuse", reason: "no_tenant" });
    assert.deepEqual(planSessionBundleCheckout(checkout({}, { bundle_id: "sessions_10k" })), { action: "refuse", reason: "unknown_bundle" });
  });
});

describe("Stripe webhook: session bundle", () => {
  it("credits when the buyer never comes back to the billing page", async () => {
    const db = fakeDb();

    const result = await handleStripeWebhook(db.client, checkoutEvent("checkout.session.completed", checkout()), "test");

    assert.deepEqual(result, { handled: true, action: "session_bundle_processed", tenantId: "statamic" });
    assert.deepEqual(db.ledger, [{
      tenant_id:                "statamic",
      entry_type:               "purchase",
      amount:                   1_000,
      bundle_id:                "sessions_1k",
      stripe_payment_intent_id: "cs_test_1",
      note:                     "1,000 Sessions, Stripe checkout cs_test_1",
    }]);
    assert.ok(db.claims.has(checkoutCreditClaimKey("cs_test_1")));
  });

  it("credits a delayed payment when the money arrives, not when the checkout completes", async () => {
    const db = fakeDb();

    const completed = await handleStripeWebhook(
      db.client, checkoutEvent("checkout.session.completed", checkout({ payment_status: "unpaid" }), "evt_1"), "test");
    assert.deepEqual(completed, { handled: true, action: "session_bundle_awaiting_payment", tenantId: "statamic" });
    assert.equal(db.credited(), 0);
    assert.equal(db.claims.size, 0, "an unpaid session holds no claim");

    const paid = await handleStripeWebhook(
      db.client, checkoutEvent("checkout.session.async_payment_succeeded", checkout(), "evt_2"), "test");
    assert.equal(paid.action, "session_bundle_processed");
    assert.equal(db.credited(), 1_000);
  });

  it("does not credit again when Stripe delivers the event a second time", async () => {
    const db = fakeDb();
    const event = checkoutEvent("checkout.session.completed", checkout());

    await handleStripeWebhook(db.client, event, "test");
    const again = await handleStripeWebhook(db.client, event, "test");

    assert.deepEqual(again, { handled: true, action: "session_bundle_already_processed", tenantId: "statamic" });
    assert.equal(db.credited(), 1_000);
  });

  it("does not credit a bundle it does not know, and says so", async () => {
    const db = fakeDb();

    const result = await handleStripeWebhook(
      db.client, checkoutEvent("checkout.session.completed", checkout({}, { bundle_id: "sessions_10k" })), "test");

    assert.deepEqual(result, { handled: false, action: "session_bundle_unknown_bundle", tenantId: "statamic" });
    assert.equal(db.credited(), 0);
    assert.equal(db.claims.size, 0);
  });

  it("throws when the credit fails, and leaves the session free for the next attempt", async () => {
    const db = fakeDb({ rpcFailures: 1 });
    const event = checkoutEvent("checkout.session.completed", checkout());

    await assert.rejects(handleStripeWebhook(db.client, event, "test"), /add_session_credits failed: database is down/);
    assert.equal(db.claims.size, 0, "the claim is released");

    const retry = await handleStripeWebhook(db.client, event, "test");
    assert.equal(retry.action, "session_bundle_processed");
    assert.equal(db.credited(), 1_000);
  });
});

describe("webhook and returning browser together", () => {
  // The billing page calls fulfilSessionBundleCheckout() with the session it
  // retrieved from Stripe: the same function, the same claim.
  const browser = (db: ReturnType<typeof fakeDb>) => fulfilSessionBundleCheckout(db.client, checkout(), false);
  const webhook = (db: ReturnType<typeof fakeDb>) =>
    handleStripeWebhook(db.client, checkoutEvent("checkout.session.completed", checkout()), "test");

  it("credit once when the webhook is first", async () => {
    const db = fakeDb();
    assert.equal((await webhook(db)).action, "session_bundle_processed");
    const page = await browser(db);
    assert.equal(page.outcome, "already-credited");
    assert.equal(page.outcome === "already-credited" && page.sessions, 1_000);
    assert.equal(db.credited(), 1_000);
  });

  it("credit once when the browser is first, and on every reload after", async () => {
    const db = fakeDb();
    assert.equal((await browser(db)).outcome, "credited");
    assert.equal((await webhook(db)).action, "session_bundle_already_processed");
    assert.equal((await browser(db)).outcome, "already-credited");
    assert.equal(db.credited(), 1_000);
  });

  it("credit once when both arrive at the same moment", async () => {
    const db = fakeDb();
    const [hook, page] = await Promise.all([webhook(db), browser(db)]);
    const winners = [hook.action === "session_bundle_processed", page.outcome === "credited"].filter(Boolean);
    assert.equal(winners.length, 1, `${hook.action} / ${page.outcome}`);
    assert.equal(db.credited(), 1_000);
  });

  it("let the browser credit after a webhook whose credit failed", async () => {
    const db = fakeDb({ rpcFailures: 1 });
    await assert.rejects(webhook(db));
    assert.equal((await browser(db)).outcome, "credited");
    assert.equal(db.credited(), 1_000);
  });
});

describe("purchases from before the claim", () => {
  const before: LedgerRow = {
    tenant_id: "statamic", entry_type: "purchase", amount: 1_000, bundle_id: "sessions_1k",
    stripe_payment_intent_id: "cs_test_1", note: "1,000 Sessions, Stripe checkout cs_test_1",
  };

  it("are not credited again by a reload of the success page or a resent webhook", async () => {
    const db = fakeDb({ ledger: [before] });

    const page = await fulfilSessionBundleCheckout(db.client, checkout(), false);
    assert.equal(page.outcome, "already-credited");
    assert.ok(db.claims.has(checkoutCreditClaimKey("cs_test_1")), "the claim is kept, so the next call stops there");

    const hook = await handleStripeWebhook(db.client, checkoutEvent("checkout.session.completed", checkout()), "test");
    assert.equal(hook.action, "session_bundle_already_processed");
    assert.equal(db.credited(), 1_000);
  });

  it("do not stand in the way of another session of the same tenant", async () => {
    const db = fakeDb({ ledger: [before] });
    const other = await fulfilSessionBundleCheckout(db.client, checkout({ id: "cs_test_2" }), false);
    assert.equal(other.outcome, "credited");
    assert.equal(db.credited(), 2_000);
  });

  it("the ledger is the check to fall back on when the claim table cannot be written", async () => {
    const db = fakeDb({ claimTableMissing: true });
    assert.equal((await fulfilSessionBundleCheckout(db.client, checkout(), false)).outcome, "credited");
    assert.equal((await fulfilSessionBundleCheckout(db.client, checkout(), false)).outcome, "already-credited");
    assert.equal(db.credited(), 1_000);
  });
});

describe("the billing page's confirmation", () => {
  const source = fs.readFileSync("app/admin/tenants/[tenantId]/billing/actions.ts", "utf8");
  const action = source.slice(
    source.indexOf("export async function confirmSessionBundlePurchaseAction"),
    source.indexOf("// ── Subscription management actions"),
  );

  it("delivers through the same function as the webhook, with the session Stripe returned", () => {
    assert.ok(action.includes("session = await stripe.checkout.sessions.retrieve(checkoutSessionId);"));
    assert.ok(action.includes("await fulfilSessionBundleCheckout(client, session, session.livemode)"));
  });

  it("has no credit and no check of its own left", () => {
    assert.equal(action.includes("add_session_credits"), false, "the RPC is called in one place only");
    assert.equal(action.includes(".ilike("), false, "the note in the ledger is not the guard any more");
  });

  it("still refuses a session of another tenant before anything is delivered", () => {
    const tenantCheck = action.indexOf("session.metadata.tenant_id !== tenantId");
    assert.ok(tenantCheck > 0);
    assert.ok(tenantCheck < action.indexOf("fulfilSessionBundleCheckout("));
  });
});
