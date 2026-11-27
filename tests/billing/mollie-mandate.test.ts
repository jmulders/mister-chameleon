/**
 * Mollie step 2a: the mandate, and the automatic wallet top-up charged on it.
 *
 * No network and no database: the client takes its fetch as an argument, the
 * settle step takes its handlers, and the few database calls go to a small
 * stand-in that records them.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import {
  createMollieCustomer,
  createMolliePayment,
  isMollieCustomerId,
  isMollieMandateId,
  MollieError,
  type MolliePayment,
} from "../../billing/mollie.ts";
import { mandateFromPayment, usableMandate } from "../../billing/mollie-customer.ts";
import { firstPaymentAmount } from "../../billing/mollie-authorise.ts";
import {
  AUTO_RELOAD_PAYMENT_TYPE,
  autoReloadState,
  chargeMollieReload,
  settleMollieAutoReload,
} from "../../billing/mollie-auto-reload.ts";
import { mollieResultQuery, startMollieCheckout } from "../../billing/mollie-checkout.ts";

const KEY  = "test_" + "x".repeat(30);
const CUST = "cst_abc12345";
const MDT  = "mdt_abc12345";

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit; json: Record<string, unknown> }> = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, json: init.body ? JSON.parse(String(init.body)) : {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

/** A stand-in for the few Supabase calls these paths make. Records inserts. */
function fakeClient() {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      return {
        insert: async (row: Record<string, unknown>) => { inserts.push({ table, row }); return { error: null }; },
      };
    },
  };
  return { client: client as never, inserts };
}

describe("ids", () => {
  it("knows a customer and a mandate id, and nothing that could bend a URL", () => {
    assert.equal(isMollieCustomerId(CUST), true);
    assert.equal(isMollieCustomerId("cst_"), false);
    assert.equal(isMollieCustomerId("cst_a/../payments"), false);
    assert.equal(isMollieCustomerId(MDT), false);
    assert.equal(isMollieMandateId(MDT), true);
    assert.equal(isMollieMandateId(null), false);
  });
});

describe("first and recurring payments", () => {
  const open = { id: "tr_abc12345", status: "open", amount: { currency: "EUR", value: "50.00" } };

  it("a first payment names the customer and still has a checkout to return from", async () => {
    const f = fakeFetch(201, open);
    await createMolliePayment(
      { amountCents: 5000, description: "x", redirectUrl: "https://a.example/back", metadata: {}, sequenceType: "first", customerId: CUST },
      { fetch: f.fn, apiKey: KEY },
    );
    assert.equal(f.calls[0]!.json["sequenceType"], "first");
    assert.equal(f.calls[0]!.json["customerId"], CUST);
    assert.equal(f.calls[0]!.json["redirectUrl"], "https://a.example/back");
    assert.equal("mandateId" in f.calls[0]!.json, false);
  });

  it("a recurring payment charges the mandate and has no return address", async () => {
    const f = fakeFetch(201, { ...open, status: "pending" });
    await createMolliePayment(
      { amountCents: 5000, description: "x", metadata: {}, sequenceType: "recurring", customerId: CUST, mandateId: MDT },
      { fetch: f.fn, apiKey: KEY },
    );
    assert.equal(f.calls[0]!.json["sequenceType"], "recurring");
    assert.equal(f.calls[0]!.json["customerId"], CUST);
    assert.equal(f.calls[0]!.json["mandateId"], MDT);
    assert.equal("redirectUrl" in f.calls[0]!.json, false);
  });

  it("refuses a first or recurring payment without a customer, before any request", async () => {
    const f = fakeFetch(201, open);
    for (const sequenceType of ["first", "recurring"] as const) {
      await assert.rejects(
        createMolliePayment({ amountCents: 5000, description: "x", redirectUrl: "https://a.example", metadata: {}, sequenceType }, { fetch: f.fn, apiKey: KEY }),
        (err: unknown) => err instanceof MollieError && /needs a Mollie customer/.test(err.message),
      );
    }
    assert.equal(f.calls.length, 0);
  });

  it("refuses a payment the customer makes without a return address", async () => {
    const f = fakeFetch(201, open);
    await assert.rejects(
      createMolliePayment({ amountCents: 5000, description: "x", metadata: {} }, { fetch: f.fn, apiKey: KEY }),
      /needs a return address/,
    );
    assert.equal(f.calls.length, 0);
  });

  it("refuses a mandate id that is not one", async () => {
    const f = fakeFetch(201, open);
    await assert.rejects(
      createMolliePayment(
        { amountCents: 5000, description: "x", metadata: {}, sequenceType: "recurring", customerId: CUST, mandateId: "tr_abc12345" },
        { fetch: f.fn, apiKey: KEY },
      ),
      /Not a Mollie mandate id/,
    );
    assert.equal(f.calls.length, 0);
  });

  it("creates a customer with name, email and the tenant in the metadata", async () => {
    const f = fakeFetch(201, { id: CUST, mode: "test" });
    const customer = await createMollieCustomer({ name: "Voorbeeld BV", email: "a@b.example", metadata: { tenant_id: "voorbeeld" } }, { fetch: f.fn, apiKey: KEY });
    assert.equal(customer.id, CUST);
    assert.equal(f.calls[0]!.url, "https://api.mollie.com/v2/customers");
    assert.deepEqual(f.calls[0]!.json, { name: "Voorbeeld BV", email: "a@b.example", metadata: { tenant_id: "voorbeeld" } });
  });

  it("does not accept an answer that is not a customer", async () => {
    const f = fakeFetch(201, { id: "tr_abc12345" });
    await assert.rejects(createMollieCustomer({ name: "x" }, { fetch: f.fn, apiKey: KEY }), /without a customer/);
  });
});

describe("the mandate a payment gives", () => {
  const first: MolliePayment = {
    id: "tr_abc12345", status: "paid", mode: "live", amount: { currency: "EUR", value: "50.00" },
    sequenceType: "first", customerId: CUST, mandateId: MDT, method: "ideal",
    metadata: { type: "wallet_top_up", tenant_id: "statamic", amount_cents: "5000" },
  };

  it("a paid first payment gives one, to the tenant in its metadata", () => {
    assert.deepEqual(mandateFromPayment(first), { tenantId: "statamic", customerId: CUST, mandateId: MDT, method: "ideal", mode: "live" });
  });

  it("nothing else does", () => {
    assert.equal(mandateFromPayment({ ...first, status: "open" }), null);
    assert.equal(mandateFromPayment({ ...first, status: "failed" }), null);
    assert.equal(mandateFromPayment({ ...first, sequenceType: "oneoff" }), null);
    assert.equal(mandateFromPayment({ ...first, sequenceType: "recurring" }), null);
    assert.equal(mandateFromPayment({ ...first, mandateId: null }), null);
    assert.equal(mandateFromPayment({ ...first, customerId: "nope" }), null);
    assert.equal(mandateFromPayment({ ...first, metadata: {} }), null);
  });

  it("is usable only when both ids are there", () => {
    assert.deepEqual(usableMandate({ customer_id: CUST, mandate_id: MDT }), { customerId: CUST, mandateId: MDT });
    assert.equal(usableMandate({ customer_id: CUST, mandate_id: null }), null);
    assert.equal(usableMandate({ customer_id: "x", mandate_id: MDT }), null);
    assert.equal(usableMandate(null), null);
  });
});

describe("the amount of the first payment", () => {
  it("is the tenant's own top-up amount unless the request names one", () => {
    assert.deepEqual(firstPaymentAmount(undefined, 5000), { ok: true, cents: 5000 });
    assert.deepEqual(firstPaymentAmount(2500, 5000), { ok: true, cents: 2500 });
  });

  it("is refused outside one to a thousand euros, never clamped", () => {
    assert.equal(firstPaymentAmount(99, 5000).ok, false);
    assert.equal(firstPaymentAmount(100_001, 5000).ok, false);
    assert.equal(firstPaymentAmount(0, 5000).ok, false);
    assert.equal(firstPaymentAmount(12.5, 5000).ok, false);
    assert.equal(firstPaymentAmount("5000", 5000).ok, false);
    assert.equal(firstPaymentAmount(undefined, undefined).ok, false);
    assert.deepEqual(firstPaymentAmount(100, null), { ok: true, cents: 100 });
    assert.deepEqual(firstPaymentAmount(100_000, null), { ok: true, cents: 100_000 });
  });
});

describe("starting the first payment", () => {
  it("makes the checkout payment a first payment for the customer", async () => {
    const f = fakeFetch(201, { id: "tr_abc12345", status: "open", mode: "test", amount: { currency: "EUR", value: "50.00" }, _links: { checkout: { href: "https://www.mollie.com/checkout/x" } } });
    const { client, inserts } = fakeClient();
    const started = await startMollieCheckout(
      client,
      { tenantId: "statamic", kind: "wallet_top_up", bundleId: null, amountCents: 5000, description: "x", origin: "https://www.misterchameleon.nl", firstForCustomerId: CUST },
      { mollie: { fetch: f.fn, apiKey: KEY }, newRef: () => "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b" },
    );
    assert.equal(started.url, "https://www.mollie.com/checkout/x");
    assert.equal(f.calls[0]!.json["sequenceType"], "first");
    assert.equal(f.calls[0]!.json["customerId"], CUST);
    assert.equal((f.calls[0]!.json["metadata"] as Record<string, string>)["type"], "wallet_top_up");
    assert.equal(inserts[0]!.table, "mollie_payments");
    assert.equal(inserts[0]!.row["kind"], "wallet_top_up");
  });

  it("a plain purchase stays a plain payment", async () => {
    const f = fakeFetch(201, { id: "tr_abc12345", status: "open", mode: "test", amount: { currency: "EUR", value: "29.00" }, _links: { checkout: { href: "https://www.mollie.com/checkout/x" } } });
    const { client } = fakeClient();
    await startMollieCheckout(
      client,
      { tenantId: "statamic", kind: "session_bundle", bundleId: "sessions_1k", amountCents: 2900, description: "x", origin: "https://www.misterchameleon.nl" },
      { mollie: { fetch: f.fn, apiKey: KEY } },
    );
    assert.equal("sequenceType" in f.calls[0]!.json, false);
    assert.equal("customerId" in f.calls[0]!.json, false);
  });
});

describe("the automatic top-up on a mandate", () => {
  it("charges the mandate with the attempt's own idempotency key", async () => {
    const f = fakeFetch(201, { id: "tr_reload0001", status: "pending", mode: "live", amount: { currency: "EUR", value: "50.00" } });
    const { client, inserts } = fakeClient();
    const charge = await chargeMollieReload(
      client,
      { tenantId: "statamic", attemptId: "0a1b2c3d-0000-4000-8000-000000000001", amountCents: 5000, idempotencyKey: "wr:abc", source: { customerId: CUST, mandateId: MDT } },
      { fetch: f.fn, apiKey: KEY },
    );
    assert.deepEqual(charge, { id: "tr_reload0001", status: "pending", succeeded: false });
    const body = f.calls[0]!.json;
    assert.equal(body["sequenceType"], "recurring");
    assert.equal(body["customerId"], CUST);
    assert.equal(body["mandateId"], MDT);
    assert.deepEqual(body["amount"], { currency: "EUR", value: "50.00" });
    assert.deepEqual(body["metadata"], {
      type: AUTO_RELOAD_PAYMENT_TYPE, tenant_id: "statamic",
      reload_attempt_id: "0a1b2c3d-0000-4000-8000-000000000001", amount_cents: "5000",
    });
    assert.equal((f.calls[0]!.init.headers as Record<string, string>)["Idempotency-Key"], "wr:abc");
    assert.equal(inserts[0]!.row["kind"], AUTO_RELOAD_PAYMENT_TYPE);
    assert.equal(inserts[0]!.row["mode"], "live");
  });

  it("a card mandate can be paid at once", async () => {
    const f = fakeFetch(201, { id: "tr_reload0002", status: "paid", amount: { currency: "EUR", value: "50.00" } });
    const { client } = fakeClient();
    const charge = await chargeMollieReload(
      client,
      { tenantId: "statamic", attemptId: "0a1b2c3d-0000-4000-8000-000000000002", amountCents: 5000, idempotencyKey: "wr:def", source: { customerId: CUST, mandateId: MDT } },
      { fetch: f.fn, apiKey: KEY },
    );
    assert.equal(charge.succeeded, true);
  });

  it("reads the payment's status as the attempt's fate", () => {
    assert.equal(autoReloadState("paid"), "succeeded");
    for (const s of ["failed", "canceled", "expired"]) assert.equal(autoReloadState(s), "failed");
    for (const s of ["open", "pending", "authorized"]) assert.equal(autoReloadState(s), "waiting");
  });

  const reload = (status: string): MolliePayment => ({
    id: "tr_reload0001", status, amount: { currency: "EUR", value: "50.00" },
    metadata: { type: AUTO_RELOAD_PAYMENT_TYPE, tenant_id: "statamic", reload_attempt_id: "0a1b2c3d-0000-4000-8000-000000000001" },
  });

  it("credits on paid, marks failed on failed, and waits while pending", async () => {
    const log: string[] = [];
    const deps = {
      onSuccess: async (_c: unknown, id: string) => { log.push(`ok ${id}`); },
      onFailure: async (_c: unknown, id: string, reason: string) => { log.push(`fail ${id} ${reason}`); },
    };
    assert.deepEqual(await settleMollieAutoReload({} as never, reload("pending"), deps), { outcome: "auto-reload", state: "waiting", status: "pending" });
    assert.deepEqual(await settleMollieAutoReload({} as never, reload("paid"), deps),    { outcome: "auto-reload", state: "succeeded", status: "paid" });
    assert.deepEqual(await settleMollieAutoReload({} as never, reload("failed"), deps),  { outcome: "auto-reload", state: "failed", status: "failed" });
    assert.deepEqual(log, ["ok tr_reload0001", "fail tr_reload0001 Mollie payment failed"]);
  });

  it("has no return page: a charge on a mandate never reads as a purchase result", () => {
    assert.equal(mollieResultQuery({ outcome: "auto-reload", state: "succeeded", status: "paid" }, null, null), "mollie=pending");
  });
});

describe("the wiring", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("the provider setting decides what the automatic top-up charges", () => {
    const src = read("billing/auto-reload.ts");
    assert.match(src, /if \(getPaymentProvider\(\) === "mollie"\) \{/);
    assert.match(src, /mollieSource = await mollieReloadSource\(client, wallet\.tenant_id\);/);
    assert.match(src, /await triggerAutoReload\(client, wallet, balanceAfterCents, mollieSource\);/);
  });

  it("an attempt is cancelled only while no Mollie payment exists", () => {
    const src    = read("billing/auto-reload.ts");
    const branch = src.slice(src.indexOf("if (mollieSource) {"), src.indexOf("// ── Create Stripe PaymentIntent"));
    const charge = branch.indexOf("charge = await chargeMollieReload(");
    const cancel = branch.indexOf("await cancelAttempt(");
    const mark   = branch.indexOf("await markAttemptProcessing(client, attempt.id, charge.id);");
    assert.ok(charge > 0 && cancel > charge && mark > cancel, "charge, then the cancel of its catch, then the mark");
    assert.equal(branch.split("await cancelAttempt(").length - 1, 1, "one cancel, in the catch of the charge");
    assert.match(branch, /if \(charge\.succeeded\) await handleAutoReloadSuccess\(client, charge\.id\);/);
  });

  it("the settle path sends a mandate charge to the attempt, and keeps a new mandate", () => {
    const src = read("billing/mollie-checkout.ts");
    const auto = src.indexOf('if (payment.metadata?.["type"] === AUTO_RELOAD_PAYMENT_TYPE) {');
    const fulfil = src.indexOf("const result = await fulfilMolliePayment(client, payment, deps?.fulfil);");
    // The last one: the payment of an open subscription amount keeps its mandate
    // too, earlier in the function (mollie-renewal.test.ts).
    const remember = src.lastIndexOf("await rememberMollieMandate(client, payment);");
    assert.ok(auto > 0 && fulfil > auto && remember > fulfil);
  });

  it("the mandate is stored for the customer the payment was made for", () => {
    const src = read("billing/mollie-customer.ts");
    assert.match(src, /\.eq\("tenant_id", mandate\.tenantId\)\s+\.eq\("mode", mandate\.mode\)\s+\.eq\("customer_id", mandate\.customerId\)/);
  });

  it("the route checks the session before anything else and only works with Mollie on", () => {
    const src = read("app/api/billing/mollie/authorise/route.ts");
    assert.ok(src.indexOf("guardTenantRoute(tenantId)") < src.indexOf("getPaymentProvider() !== \"mollie\""));
    assert.ok(src.indexOf("getPaymentProvider() !== \"mollie\"") < src.indexOf("ensureMollieCustomer("));
    assert.match(src, /firstForCustomerId: customerId,/);
  });

  it("the button says what paying authorises", () => {
    const src = read("app/admin/tenants/[tenantId]/billing/_components/BillingDashboard.tsx");
    assert.match(src, /By paying it you\s+authorise Mister Chameleon to collect later automatic top-ups/);
    assert.match(src, /You can switch auto-reload off at any time\./);
  });
});
