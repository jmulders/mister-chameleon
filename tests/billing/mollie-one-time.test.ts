/**
 * Mollie for the one-time purchases (step 1 of Mollie next to Stripe).
 *
 * No network and no database: the Mollie client takes its fetch as an
 * argument and the delivery takes its credit functions as arguments.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import { bundlePurchasable, paymentProviderFrom } from "../../billing/payment-provider.ts";
import {
  centsFromMollieAmount,
  createMolliePayment,
  getMolliePayment,
  isMolliePaymentId,
  mollieAmountValue,
  mollieModeFromKey,
  mollieWebhookUrl,
  MollieError,
  type MolliePayment,
} from "../../billing/mollie.ts";
import { fulfilMolliePayment, planMolliePayment, type MollieFulfilDeps } from "../../billing/mollie-fulfil.ts";
import { isMollieRef, mollieResultQuery, mollieReturnUrl } from "../../billing/mollie-checkout.ts";

const KEY = "test_" + "x".repeat(30);

function paid(over: Partial<MolliePayment> = {}, meta: Record<string, string> = {}): MolliePayment {
  return {
    id:     "tr_abc12345",
    status: "paid",
    mode:   "test",
    amount: { currency: "EUR", value: "29.00" },
    metadata: { type: "session_bundle", tenant_id: "statamic", bundle_id: "sessions_1k", amount_cents: "2900", ...meta },
    ...over,
  };
}

describe("payment provider setting", () => {
  it("is Stripe unless it says mollie", () => {
    assert.equal(paymentProviderFrom(undefined), "stripe");
    assert.equal(paymentProviderFrom(""), "stripe");
    assert.equal(paymentProviderFrom("stripe"), "stripe");
    assert.equal(paymentProviderFrom("paypal"), "stripe");
    assert.equal(paymentProviderFrom("mollie"), "mollie");
    assert.equal(paymentProviderFrom(" Mollie "), "mollie");
  });

  it("a bundle needs a Stripe price with Stripe and only a key with Mollie", () => {
    assert.equal(bundlePurchasable({ stripePrice: "price_1" }, "stripe", false), true);
    assert.equal(bundlePurchasable({}, "stripe", true), false);
    assert.equal(bundlePurchasable({ stripePrice: " " }, "stripe", true), false);
    assert.equal(bundlePurchasable({}, "mollie", true), true);
    assert.equal(bundlePurchasable({ stripePrice: "price_1" }, "mollie", false), false);
  });
});

describe("Mollie amounts and ids", () => {
  it("writes cents with exactly two decimals", () => {
    assert.equal(mollieAmountValue(2900), "29.00");
    assert.equal(mollieAmountValue(650), "6.50");
    assert.equal(mollieAmountValue(5), "0.05");
    assert.equal(mollieAmountValue(39900), "399.00");
  });

  it("refuses an amount that is not a positive whole number of cents", () => {
    for (const bad of [0, -1, 29.5, Number.NaN]) assert.throws(() => mollieAmountValue(bad));
  });

  it("reads an amount back, and only a clean EUR one", () => {
    assert.equal(centsFromMollieAmount({ currency: "EUR", value: "29.00" }), 2900);
    assert.equal(centsFromMollieAmount({ currency: "EUR", value: "0.05" }), 5);
    assert.equal(centsFromMollieAmount({ currency: "USD", value: "29.00" }), null);
    assert.equal(centsFromMollieAmount({ currency: "EUR", value: "29" }), null);
    assert.equal(centsFromMollieAmount({ currency: "EUR", value: "29.000" }), null);
    assert.equal(centsFromMollieAmount(undefined), null);
  });

  it("knows a key's mode from its prefix", () => {
    assert.equal(mollieModeFromKey(KEY), "test");
    assert.equal(mollieModeFromKey("live_" + "x".repeat(30)), "live");
    assert.equal(mollieModeFromKey("sk_test_123456789"), null);
    assert.equal(mollieModeFromKey(""), null);
    assert.equal(mollieModeFromKey(undefined), null);
  });

  it("accepts a payment id and nothing that could bend a URL", () => {
    assert.equal(isMolliePaymentId("tr_d0b0E3EA3v"), true);
    assert.equal(isMolliePaymentId("tr_"), false);
    assert.equal(isMolliePaymentId("tr_abc/../../customers"), false);
    assert.equal(isMolliePaymentId("cs_test_123"), false);
    assert.equal(isMolliePaymentId(null), false);
  });

  it("gives a webhook address only where Mollie can reach it", () => {
    assert.equal(mollieWebhookUrl("https://www.misterchameleon.nl"), "https://www.misterchameleon.nl/api/webhooks/mollie");
    assert.equal(mollieWebhookUrl("https://www.misterchameleon.nl/some/path"), "https://www.misterchameleon.nl/api/webhooks/mollie");
    assert.equal(mollieWebhookUrl("http://localhost:3108"), undefined);
    assert.equal(mollieWebhookUrl("https://localhost:3108"), undefined);
    assert.equal(mollieWebhookUrl("https://app.localhost"), undefined);
    assert.equal(mollieWebhookUrl("https://127.0.0.1"), undefined);
    assert.equal(mollieWebhookUrl("http://www.misterchameleon.nl"), undefined);
    assert.equal(mollieWebhookUrl(""), undefined);
    assert.equal(mollieWebhookUrl("not a url"), undefined);
  });
});

describe("Mollie client", () => {
  function fakeFetch(status: number, body: unknown) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch;
    return { fn, calls };
  }

  it("creates a payment with the amount, the addresses and the metadata", async () => {
    const f = fakeFetch(201, { id: "tr_abc12345", status: "open", amount: { currency: "EUR", value: "29.00" }, _links: { checkout: { href: "https://www.mollie.com/checkout/x" } } });
    const payment = await createMolliePayment(
      {
        amountCents: 2900, description: "Mister Chameleon: 1,000 Sessions",
        redirectUrl: "https://site.example/back", webhookUrl: "https://site.example/api/webhooks/mollie",
        metadata: { type: "session_bundle", tenant_id: "statamic" }, idempotencyKey: "ref-1",
      },
      { fetch: f.fn, apiKey: KEY },
    );
    assert.equal(payment.id, "tr_abc12345");
    assert.equal(f.calls[0]!.url, "https://api.mollie.com/v2/payments");
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    assert.equal(headers["Authorization"], `Bearer ${KEY}`);
    assert.equal(headers["Idempotency-Key"], "ref-1");
    assert.deepEqual(JSON.parse(String(f.calls[0]!.init.body)), {
      amount:      { currency: "EUR", value: "29.00" },
      description: "Mister Chameleon: 1,000 Sessions",
      redirectUrl: "https://site.example/back",
      webhookUrl:  "https://site.example/api/webhooks/mollie",
      metadata:    { type: "session_bundle", tenant_id: "statamic" },
    });
  });

  it("leaves the webhook out when there is none (localhost)", async () => {
    const f = fakeFetch(201, { id: "tr_abc12345", status: "open", amount: { currency: "EUR", value: "29.00" } });
    await createMolliePayment(
      { amountCents: 2900, description: "x", redirectUrl: "http://localhost:3108/back", metadata: {} },
      { fetch: f.fn, apiKey: KEY },
    );
    assert.equal("webhookUrl" in JSON.parse(String(f.calls[0]!.init.body)), false);
  });

  it("reports Mollie's own explanation, and never the key", async () => {
    const f = fakeFetch(422, { status: 422, title: "Unprocessable Entity", detail: "The amount is lower than the minimum" });
    await assert.rejects(
      createMolliePayment({ amountCents: 1, description: "x", redirectUrl: "https://a.example", metadata: {} }, { fetch: f.fn, apiKey: KEY }),
      (err: unknown) => {
        assert.ok(err instanceof MollieError);
        assert.equal(err.status, 422);
        assert.match(err.message, /lower than the minimum/);
        assert.equal(err.message.includes(KEY), false);
        return true;
      },
    );
  });

  it("refuses to work without a key", async () => {
    const before = process.env["MOLLIE_API_KEY"];
    delete process.env["MOLLIE_API_KEY"];
    try {
      await assert.rejects(getMolliePayment("tr_abc12345", { fetch: fakeFetch(200, {}).fn }), /not configured/);
    } finally {
      if (before !== undefined) process.env["MOLLIE_API_KEY"] = before;
    }
  });

  it("does not put a bent id into a URL", async () => {
    const f = fakeFetch(200, {});
    await assert.rejects(getMolliePayment("tr_x/../../refunds", { fetch: f.fn, apiKey: KEY }), /Not a Mollie payment id/);
    assert.equal(f.calls.length, 0);
  });
});

describe("planMolliePayment", () => {
  it("a paid session bundle delivers the bundle's sessions", () => {
    assert.deepEqual(planMolliePayment(paid()), {
      action: "credit", kind: "session_bundle", tenantId: "statamic", bundleId: "sessions_1k",
      sessions: 1_000, label: "1,000 Sessions", amountCents: 2900,
    });
  });

  it("a paid AI credit bundle delivers the bundle's credits", () => {
    const plan = planMolliePayment(paid(
      { amount: { currency: "EUR", value: "22.00" } },
      { type: "credit_bundle", bundle_id: "credits_1000", amount_cents: "2200" },
    ));
    assert.deepEqual(plan, {
      action: "credit", kind: "credit_bundle", tenantId: "statamic", bundleId: "credits_1000",
      credits: 1000, label: "1,000 Credits", amountCents: 2200,
    });
  });

  it("a paid top-up delivers what was paid", () => {
    const plan = planMolliePayment(paid(
      { amount: { currency: "EUR", value: "50.00" } },
      { type: "wallet_top_up", bundle_id: "", amount_cents: "5000" },
    ));
    assert.deepEqual(plan, { action: "credit", kind: "wallet_top_up", tenantId: "statamic", amountCents: 5000 });
  });

  it("waits for a payment that can still be paid", () => {
    for (const status of ["open", "pending", "authorized"]) {
      assert.deepEqual(planMolliePayment(paid({ status })), { action: "wait", status });
    }
  });

  it("delivers nothing for a payment that ended without money", () => {
    for (const status of ["canceled", "expired", "failed"]) {
      assert.deepEqual(planMolliePayment(paid({ status })), { action: "none", status });
    }
  });

  it("refuses a paid payment it may not deliver", () => {
    const refuse = (p: MolliePayment) => {
      const plan = planMolliePayment(p);
      assert.equal(plan.action, "refuse");
      return plan.action === "refuse" ? plan.reason : "";
    };
    assert.equal(refuse(paid({}, { tenant_id: "" })), "no_tenant");
    assert.equal(refuse(paid({}, { type: "subscription" })), "unknown_kind");
    assert.equal(refuse(paid({}, { bundle_id: "sessions_10k" })), "unknown_bundle");
    assert.equal(refuse(paid({ amount: { currency: "EUR", value: "1.00" } })), "amount_mismatch");
    assert.equal(refuse(paid({ amount: { currency: "USD", value: "29.00" } })), "amount_unreadable");
    assert.equal(refuse(paid({ amountRefunded: { currency: "EUR", value: "29.00" } })), "refunded_or_charged_back");
    assert.equal(refuse(paid({ amountChargedBack: { currency: "EUR", value: "29.00" } })), "refunded_or_charged_back");
    assert.equal(refuse(paid({ metadata: null })), "no_tenant");
  });
});

describe("fulfilMolliePayment", () => {
  function deps() {
    const log: string[] = [];
    const claimed = new Set<string>();
    const d: MollieFulfilDeps = {
      creditOnce: async (_c, paymentId, _t, _live, _kind, credit) => {
        if (claimed.has(paymentId)) return "already-credited";
        claimed.add(paymentId);
        try { await credit(); } catch (err) { claimed.delete(paymentId); throw err; }
        return "credited";
      },
      addSessionCredits: async (_c, tenantId, sessions, bundleId, paymentId) => { log.push(`sessions ${tenantId} ${sessions} ${bundleId} ${paymentId}`); },
      addCredits:        async (_c, tenantId, credits, bundleId, paymentId)  => { log.push(`credits ${tenantId} ${credits} ${bundleId} ${paymentId}`); },
      creditWallet:      async (_c, tenantId, cents, paymentId)              => { log.push(`wallet ${tenantId} ${cents} ${paymentId}`); },
    };
    return { d, log };
  }
  const client = {} as never;

  it("delivers a paid session bundle once, however often it is asked", async () => {
    const { d, log } = deps();
    const first  = await fulfilMolliePayment(client, paid(), d);
    const second = await fulfilMolliePayment(client, paid(), d);
    assert.deepEqual(first,  { outcome: "credited",         kind: "session_bundle", tenantId: "statamic", bundleId: "sessions_1k" });
    assert.deepEqual(second, { outcome: "already-credited", kind: "session_bundle", tenantId: "statamic", bundleId: "sessions_1k" });
    assert.deepEqual(log, ["sessions statamic 1000 sessions_1k tr_abc12345"]);
  });

  it("sends each kind to its own balance", async () => {
    const { d, log } = deps();
    await fulfilMolliePayment(client, paid({ id: "tr_credits1", amount: { currency: "EUR", value: "6.50" } }, { type: "credit_bundle", bundle_id: "credits_250", amount_cents: "650" }), d);
    await fulfilMolliePayment(client, paid({ id: "tr_wallet01", amount: { currency: "EUR", value: "50.00" } }, { type: "wallet_top_up", bundle_id: "", amount_cents: "5000" }), d);
    assert.deepEqual(log, ["credits statamic 250 credits_250 tr_credits1", "wallet statamic 5000 tr_wallet01"]);
  });

  it("touches nothing for a payment that is open, cancelled or refused", async () => {
    const { d, log } = deps();
    assert.deepEqual(await fulfilMolliePayment(client, paid({ status: "open" }), d),     { outcome: "waiting",  status: "open" });
    assert.deepEqual(await fulfilMolliePayment(client, paid({ status: "canceled" }), d), { outcome: "not-paid", status: "canceled" });
    assert.deepEqual(await fulfilMolliePayment(client, paid({}, { type: "nope" }), d),   { outcome: "refused",  reason: "unknown_kind" });
    assert.deepEqual(log, []);
  });

  it("lets a failed delivery be tried again", async () => {
    const { d, log } = deps();
    let fail = true;
    const flaky: MollieFulfilDeps = {
      ...d,
      addSessionCredits: async (...args) => { if (fail) throw new Error("database away"); await d.addSessionCredits(...args); },
    };
    await assert.rejects(fulfilMolliePayment(client, paid(), flaky), /database away/);
    fail = false;
    assert.equal((await fulfilMolliePayment(client, paid(), flaky)).outcome, "credited");
    assert.equal(log.length, 1);
  });
});

describe("the return from Mollie", () => {
  const REF = "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b";

  it("the return address carries the platform's reference", () => {
    assert.equal(
      mollieReturnUrl("https://www.misterchameleon.nl", "statamic", REF),
      `https://www.misterchameleon.nl/admin/tenants/statamic/billing?mollie=return&ref=${REF}`,
    );
    assert.equal(isMollieRef(REF), true);
    assert.equal(isMollieRef("tr_abc12345"), false);
    assert.equal(isMollieRef(`${REF}' or 1=1`), false);
  });

  it("maps the outcome to the address the billing page already understands", () => {
    const credited = (kind: "session_bundle" | "credit_bundle" | "wallet_top_up", bundleId: string | null) =>
      ({ outcome: "credited" as const, kind, tenantId: "statamic", bundleId });
    assert.equal(mollieResultQuery(credited("session_bundle", "sessions_1k"), "session_bundle", "sessions_1k"), "session_bundle=success&bundle_id=sessions_1k");
    assert.equal(mollieResultQuery(credited("credit_bundle", "credits_250"), "credit_bundle", "credits_250"), "bundle=success&bundle_id=credits_250");
    assert.equal(mollieResultQuery(credited("wallet_top_up", null), "wallet_top_up", null), "bundle=success");
    assert.equal(mollieResultQuery({ outcome: "already-credited", kind: "session_bundle", tenantId: "statamic", bundleId: "sessions_5k" }, "session_bundle", "sessions_5k"), "session_bundle=success&bundle_id=sessions_5k");
    assert.equal(mollieResultQuery({ outcome: "not-paid", status: "canceled" }, "session_bundle", "sessions_1k"), "session_bundle=cancelled");
    assert.equal(mollieResultQuery({ outcome: "not-paid", status: "expired" }, "credit_bundle", "credits_250"), "bundle=cancelled");
    assert.equal(mollieResultQuery({ outcome: "waiting", status: "pending" }, "session_bundle", "sessions_1k"), "mollie=pending");
    assert.equal(mollieResultQuery({ outcome: "refused", reason: "amount_mismatch" }, "session_bundle", "sessions_1k"), "mollie=problem");
  });
});

describe("the routes hand over to Mollie", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("each one-time checkout route has a Mollie branch after its own checks", () => {
    for (const [file, kind] of [
      ["app/api/billing/create-session-bundle-checkout/route.ts", "session_bundle"],
      ["app/api/billing/create-bundle-checkout/route.ts", "credit_bundle"],
      ["app/api/billing/wallet/top-up/route.ts", "wallet_top_up"],
    ] as const) {
      const src = read(file);
      assert.match(src, /mollieCheckoutResponse\(client, request, \{/, file);
      assert.match(src, new RegExp(`kind:\\s+"${kind}"`), file);
      assert.ok(src.indexOf("guardTenantRoute(tenantId)") < src.indexOf("mollieCheckoutResponse(client"), `${file}: the session check comes first`);
    }
  });

  it("a bundle needs no Stripe price when Mollie takes the money", () => {
    for (const file of ["app/api/billing/create-session-bundle-checkout/route.ts", "app/api/billing/create-bundle-checkout/route.ts"]) {
      assert.match(read(file), /if \(provider !== "mollie" && !bundle\.stripePrice\) \{/, file);
    }
  });

  it("the webhook trusts nothing but the payment it reads back", () => {
    const src = read("app/api/webhooks/mollie/route.ts");
    assert.match(src, /if \(!isMolliePaymentId\(id\)\) return DONE\(\);/);
    assert.match(src, /settleMolliePayment\(getDb\(\), id\)/);
    assert.match(src, /err\.status === 404 \|\| err\.status === 410/);
    assert.match(src, /new NextResponse\(null, \{ status: 500 \}\)/);
  });

  it("the stand-in API address is never honoured in production", () => {
    assert.match(read("billing/mollie.ts"), /if \(override && process\.env\.NODE_ENV !== "production"\) return/);
  });
});
