/**
 * Mollie step 2b: the trial signup.
 *
 * No network and no database: the Mollie client takes its fetch, the settle
 * step takes its provisioning functions, and the few database calls go to a
 * stand-in that records them.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import type { MolliePayment } from "../../billing/mollie.ts";
import {
  mollieTrialSwitchFrom,
  pendingTenantKey,
  planMollieTrialSignup,
  settleMollieTrialSignup,
  startMollieTrialSignup,
  trialReturnUrl,
  TRIAL_SIGNUP_PAYMENT_TYPE,
  TRIAL_VERIFICATION_CENTS,
  type TrialSettleDeps,
} from "../../billing/mollie-trial.ts";
import { slugifyTenant, TRIAL_DAYS, type ProvisionedTrial } from "../../billing/trial-provisioning.ts";
import { SHOP_TEXTS } from "../../lib/site-texts/shop.ts";

const KEY     = "test_" + "x".repeat(30);
const PENDING = "0a1b2c3d-0000-4000-8000-000000000001";
const REF     = "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b";

function paid(over: Partial<MolliePayment> = {}, meta: Record<string, string> = {}): MolliePayment {
  return {
    id: "tr_trial00001", status: "paid", mode: "test", amount: { currency: "EUR", value: "0.01" },
    sequenceType: "first", customerId: "cst_abc12345", mandateId: "mdt_abc12345", method: "ideal",
    metadata: { type: TRIAL_SIGNUP_PAYMENT_TYPE, pending_signup_id: PENDING, plan_id: "growth", amount_cents: "1", ...meta },
    ...over,
  };
}

/** Records every write. Enough of the Supabase client for these paths. */
function fakeClient() {
  const writes: Array<{ table: string; op: string; row: Record<string, unknown> }> = [];
  const chain = (table: string, op: string, row: Record<string, unknown>) => {
    writes.push({ table, op, row });
    const done = { error: null, data: null };
    const self: Record<string, unknown> = { eq: () => self, then: (f: (v: typeof done) => unknown) => Promise.resolve(done).then(f) };
    return self;
  };
  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => chain(table, "insert", row),
      upsert: (row: Record<string, unknown>) => chain(table, "upsert", row),
      update: (row: Record<string, unknown>) => chain(table, "update", row),
    }),
  };
  return { client: client as never, writes };
}

describe("the switch", () => {
  it("is off unless it says on", () => {
    for (const off of [undefined, null, "", "off", "false", "0", "mollie"]) assert.equal(mollieTrialSwitchFrom(off), false);
    for (const on of ["on", "ON", " true ", "1"]) assert.equal(mollieTrialSwitchFrom(on), true);
  });

  it("the verification payment is one cent and a trial is fourteen days", () => {
    assert.equal(TRIAL_VERIFICATION_CENTS, 1);
    assert.equal(TRIAL_DAYS, 14);
  });
});

describe("starting the signup", () => {
  it("creates a customer, then a first payment of one cent that returns to the success page", async () => {
    const calls: Array<{ url: string; json: Record<string, unknown> }> = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      const json = JSON.parse(String(init.body));
      calls.push({ url, json });
      const body = url.endsWith("/customers")
        ? { id: "cst_abc12345", mode: "test" }
        : { id: "tr_trial00001", status: "open", mode: "test", amount: json.amount, _links: { checkout: { href: "https://www.mollie.com/checkout/x" } } };
      return new Response(JSON.stringify(body), { status: 201 });
    }) as unknown as typeof fetch;
    const { client, writes } = fakeClient();

    const started = await startMollieTrialSignup(
      client,
      { pendingId: PENDING, company: "Voorbeeld BV", email: "a@b.example", planId: "growth", origin: "https://www.misterchameleon.nl" },
      { mollie: { fetch: fetchFn, apiKey: KEY }, newRef: () => REF },
    );

    assert.equal(started.url, "https://www.mollie.com/checkout/x");
    assert.deepEqual(calls.map((c) => c.url), ["https://api.mollie.com/v2/customers", "https://api.mollie.com/v2/payments"]);
    assert.deepEqual(calls[0]!.json, { name: "Voorbeeld BV", email: "a@b.example", metadata: { pending_signup_id: PENDING } });
    const p = calls[1]!.json;
    assert.deepEqual(p["amount"], { currency: "EUR", value: "0.01" });
    assert.equal(p["sequenceType"], "first");
    assert.equal(p["customerId"], "cst_abc12345");
    assert.equal(p["redirectUrl"], `https://www.misterchameleon.nl/checkout/success?ref=${REF}`);
    assert.equal(p["webhookUrl"], "https://www.misterchameleon.nl/api/webhooks/mollie");
    assert.deepEqual(p["metadata"], { type: "trial_signup", pending_signup_id: PENDING, plan_id: "growth", amount_cents: "1", ref: REF });
    assert.deepEqual(writes[0], {
      table: "mollie_payments", op: "insert",
      row: { id: "tr_trial00001", ref: REF, tenant_id: `pending:${PENDING}`, kind: "trial_signup", bundle_id: "growth", amount_cents: 1, mode: "test", status: "open" },
    });
  });

  it("names the stand-in tenant and the return address", () => {
    assert.equal(pendingTenantKey(PENDING), `pending:${PENDING}`);
    assert.equal(trialReturnUrl("https://a.example", REF), `https://a.example/checkout/success?ref=${REF}`);
  });
});

describe("planMollieTrialSignup", () => {
  it("a paid first payment with a mandate may become a tenant", () => {
    assert.deepEqual(planMollieTrialSignup(paid()), {
      action: "provision", pendingId: PENDING, planId: "growth",
      customerId: "cst_abc12345", mandateId: "mdt_abc12345", method: "ideal",
    });
  });

  it("waits while the payment can still be paid, and does nothing when it ended without money", () => {
    for (const status of ["open", "pending", "authorized"]) assert.deepEqual(planMollieTrialSignup(paid({ status })), { action: "wait", status });
    for (const status of ["canceled", "expired", "failed"]) assert.deepEqual(planMollieTrialSignup(paid({ status })), { action: "none", status });
  });

  it("refuses a paid payment that is not a usable signup", () => {
    const reason = (p: MolliePayment) => { const plan = planMollieTrialSignup(p); return plan.action === "refuse" ? plan.reason : plan.action; };
    assert.equal(reason(paid({}, { pending_signup_id: "nope" })), "no_pending_signup");
    assert.equal(reason(paid({ amount: { currency: "EUR", value: "0.02" } })), "amount_mismatch");
    assert.equal(reason(paid({ sequenceType: "oneoff" })), "not_a_first_payment");
    assert.equal(reason(paid({ mandateId: null })), "no_mandate");
    assert.equal(reason(paid({ customerId: "x" })), "no_mandate");
    assert.equal(reason(paid({}, { plan_id: "enterprise" })), "unknown_plan");
    assert.equal(reason(paid({ metadata: null })), "no_pending_signup");
  });
});

describe("settleMollieTrialSignup", () => {
  const trial: ProvisionedTrial = {
    tenantId: "voorbeeld-bv", userId: "user-1", name: "Anna", email: "a@b.example", company: "Voorbeeld BV",
    planId: "growth", planLabel: "Growth", now: "2026-11-27T10:00:00.000Z", trialEndsAt: "2026-12-11T10:00:00.000Z",
  };

  function deps(provisionOk = true) {
    const log: string[] = [];
    const claimed = new Set<string>();
    const d: TrialSettleDeps = {
      once: async (_c, paymentId, _t, _live, _kind, work) => {
        if (claimed.has(paymentId)) return "already-credited";
        claimed.add(paymentId);
        try { await work(); } catch (err) { claimed.delete(paymentId); throw err; }
        return "credited";
      },
      provision: async (_c, pendingId, tag) => {
        log.push(`provision ${pendingId} ${tag}`);
        return provisionOk ? { ok: true, trial } : { ok: false, action: "trial_signup_pending_not_found" };
      },
      complete: async (_c, pendingId, t, source) => { log.push(`complete ${pendingId} ${t.tenantId} ${source}`); },
    };
    return { d, log };
  }

  it("creates the tenant, its trial subscription and its mandate, once", async () => {
    const { d, log } = deps();
    const { client, writes } = fakeClient();
    const first  = await settleMollieTrialSignup(client, paid(), d);
    const second = await settleMollieTrialSignup(client, paid(), d);

    assert.deepEqual(first,  { outcome: "trial-signup", state: "created", status: "paid", tenantId: "voorbeeld-bv" });
    assert.deepEqual(second, { outcome: "trial-signup", state: "already", status: "paid", tenantId: null });
    assert.deepEqual(log, [`provision ${PENDING} [mollie]`, `complete ${PENDING} voorbeeld-bv Mollie`]);

    const sub = writes.find((w) => w.table === "subscriptions")!;
    assert.deepEqual(sub.row, {
      tenant_id: "voorbeeld-bv", plan: "growth", status: "trialing", billing_cycle: "monthly",
      current_period_start: trial.now, current_period_end: trial.trialEndsAt, trial_end: trial.trialEndsAt,
    });
    const cust = writes.find((w) => w.table === "mollie_customers")!;
    assert.deepEqual(cust.row, {
      tenant_id: "voorbeeld-bv", mode: "test", customer_id: "cst_abc12345", mandate_id: "mdt_abc12345",
      mandate_method: "ideal", mandate_since: trial.now, updated_at: trial.now,
    });
    assert.deepEqual(writes.find((w) => w.table === "mollie_payments")!.row, { tenant_id: "voorbeeld-bv" });
    assert.equal(writes.filter((w) => w.table === "subscriptions").length, 1, "the second call wrote nothing");
  });

  it("makes nothing for a payment that is open, cancelled or not a signup", async () => {
    const { d, log } = deps();
    const { client, writes } = fakeClient();
    assert.equal((await settleMollieTrialSignup(client, paid({ status: "open" }), d) as { state: string }).state, "waiting");
    assert.equal((await settleMollieTrialSignup(client, paid({ status: "canceled" }), d) as { state: string }).state, "not-paid");
    assert.equal((await settleMollieTrialSignup(client, paid({ mandateId: null }), d) as { state: string }).state, "refused");
    assert.deepEqual(log, []);
    assert.deepEqual(writes, []);
  });

  it("says refused when the pending signup is gone, and writes no subscription", async () => {
    const { d } = deps(false);
    const { client, writes } = fakeClient();
    assert.deepEqual(await settleMollieTrialSignup(client, paid(), d), {
      outcome: "trial-signup", state: "refused", status: "trial_signup_pending_not_found", tenantId: null,
    });
    assert.deepEqual(writes, []);
  });
});

describe("the shared provisioning", () => {
  it("makes a tenant id out of a company name", () => {
    assert.equal(slugifyTenant("Voorbeeld B.V."), "voorbeeld-b-v");
    assert.equal(slugifyTenant("  Café Zuid & Co  "), "caf-zuid-co");
    assert.equal(slugifyTenant("!!!"), "tenant");
    assert.equal(slugifyTenant("a".repeat(80)).length, 48);
  });

  it("the Stripe webhook uses the same steps, with its own subscription in between", () => {
    const src = fs.readFileSync("billing/stripe.ts", "utf8");
    const a = src.indexOf('await provisionTrialTenant(client, pendingId, "[stripe-webhook]")');
    const b = src.indexOf("// Store Stripe customer + subscription on the new tenant");
    const c = src.indexOf('await completeTrialSignup(client, pendingId, provisioned.trial, "Stripe", "[stripe-webhook]")');
    assert.ok(a > 0 && b > a && c > b);
    assert.match(src, /if \(!provisioned\.ok\) \{\s+return \{ handled: false, action: provisioned\.action, tenantId: null \};/);
    assert.doesNotMatch(src, /\.from\("admin_users"\)\s+\.insert\(/, "the user is no longer created inline");
  });

  it("a half-made tenant is undone and the signup marked failed", () => {
    const src = fs.readFileSync("billing/trial-provisioning.ts", "utf8");
    assert.match(src, /await client\.from\("admin_users"\)\.delete\(\)\.eq\("id", userId\);\s+await client\.from\("pending_trial_signups"\)\.update\(\{ status: "failed" \}\)/);
    assert.match(src, /\.eq\("id", pendingId\)\s+\.eq\("status", "pending"\)/);
  });
});

describe("the wiring", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("the route hands over to Mollie after the pending row and before anything Stripe", () => {
    const src = read("app/api/trial/checkout-session/route.ts");
    const pending = src.indexOf("const pendingId = pending.id as string;");
    const mollie  = src.indexOf("if (mollieTrialSignupEnabled()) {");
    const stripe  = src.indexOf("const stripeCredentials = await resolveStripeCredentials();");
    assert.ok(pending > 0 && mollie > pending && stripe > mollie);
    assert.match(src.slice(mollie, stripe), /\.from\("pending_trial_signups"\)\.delete\(\)\.eq\("id", pendingId\)/, "a failed start frees the email for a retry");
  });

  it("the trial signup needs the provider, its own switch and a key", () => {
    const src = read("billing/mollie-trial.ts");
    assert.match(src, /return getPaymentProvider\(\) === "mollie"\s+&& mollieTrialSwitchFrom\(process\.env\["MOLLIE_TRIAL_SIGNUP"\]\)\s+&& mollieConfigured\(\);/);
  });

  it("the settle path sends a signup payment to the provisioning, before the credit path", () => {
    const src = read("billing/mollie-checkout.ts");
    const trial  = src.indexOf('if (payment.metadata?.["type"] === TRIAL_SIGNUP_PAYMENT_TYPE) {');
    const fulfil = src.indexOf("const result = await fulfilMolliePayment(client, payment, deps?.fulfil);");
    assert.ok(trial > 0 && fulfil > trial);
  });

  it("the success page shows what happened, not always a confirmed payment", () => {
    const page = read("app/(site)/checkout/success/page.tsx");
    assert.match(page, /settleMollieTrialReturn\(getDb\(\), ref, settleMolliePayment\)/);
    assert.match(page, /if \(state === "not-paid" \|\| state === "refused" \|\| state === null\) outcome = "not-completed";/);
    const client = read("app/(site)/checkout/success/_components/CheckoutSuccessClient.tsx");
    assert.match(client, /if \(outcome !== "ok"\) return;/, "no redirect to the dashboard without an account");
    assert.match(client, /if \(outcome !== "not-completed"\) clearCart\(\);/);
  });

  it("the form says what the verification payment is and what it authorises", () => {
    const nl = SHOP_TEXTS.nl.trialVerificationNote(1);
    assert.match(nl, /Je betaalt nu € 0,01 om je betaalmethode te controleren\./);
    assert.match(nl, /machtiging om het pakket af te schrijven zodra de proefperiode voorbij is/);
    assert.match(nl, /tot 250 gepersonaliseerde bezoeken/);
    const en = SHOP_TEXTS.en.trialVerificationNote(1);
    assert.match(en, /You pay €0\.01 now to verify your payment method\./);
    // Shown when a trial asks for a payment method (TRIAL_REQUIRES_PAYMENT=on). Without it the form says no payment details are needed.
    assert.match(read("app/(site)/checkout/_components/CheckoutPageClient.tsx"), /!needsPayment \? t\.trialNoPaymentNote : verificationCents \? t\.trialVerificationNote\(verificationCents\) : t\.trialCardNote/);
  });
});

describe("binding the new user to the tenant", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("names no column the table does not have", () => {
    // admin_user_tenants has id, user_id, tenant_id and assigned_at (default now()).
    for (const file of ["billing/trial-provisioning.ts", "app/api/trial/start/route.ts", "app/admin/platform/signups/actions.ts"]) {
      // Comments left out: they name the old column on purpose.
      const code = read(file).split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
      const inserts = [...code.matchAll(/\.from\("admin_user_tenants"\)\s*\.insert\(\{([^}]*)\}\)/g)].map((m) => m[1]!);
      assert.equal(inserts.length, 1, `${file}: one insert`);
      const keys = [...inserts[0]!.matchAll(/([a-z_]+):/g)].map((m) => m[1]);
      assert.deepEqual(keys, ["user_id", "tenant_id"], file);
    }
  });

  it("reads the answer, and undoes a tenant its user cannot open", () => {
    const src = read("billing/trial-provisioning.ts");
    assert.match(src, /if \(bindErr\) \{[\s\S]*?\.from\("tenant_settings"\)\.delete\(\)\.eq\("tenant_id", tenantId\);[\s\S]*?\.from\("admin_users"\)\.delete\(\)\.eq\("id", userId\);[\s\S]*?return \{ ok: false, action: "trial_signup_binding_failed" \};/);
  });
});
