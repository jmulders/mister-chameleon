/**
 * Mollie step 4: changing the plan, and the payment method.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import { remainingFraction, upgradeProrationCents } from "../../billing/plan-change-proration.ts";
import {
  PAYMENT_METHOD_PAYMENT_TYPE,
  PAYMENT_METHOD_VERIFICATION_CENTS,
  paymentMethodOutcome,
} from "../../billing/mollie-payment-method.ts";
import { mollieResultQuery } from "../../billing/mollie-checkout.ts";
import { planChangeKind } from "../../billing/mollie-plan-change.ts";
import type { MolliePayment } from "../../billing/mollie.ts";

const START = "2026-12-01T00:00:00.000Z";
const END   = "2027-01-01T00:00:00.000Z";

describe("the rest of the period", () => {
  it("is the share of the period still to come", () => {
    assert.equal(remainingFraction(START, END, new Date(START)), 1);
    assert.equal(remainingFraction(START, END, new Date(END)), 0);
    assert.equal(remainingFraction(START, END, new Date("2026-12-16T12:00:00.000Z")), 0.5);
  });

  it("stays between nothing and everything", () => {
    assert.equal(remainingFraction(START, END, new Date("2026-11-20T00:00:00Z")), 1);
    assert.equal(remainingFraction(START, END, new Date("2027-02-01T00:00:00Z")), 0);
  });

  it("is everything when there is no usable period: an upgrade is never given away", () => {
    assert.equal(remainingFraction(null, END), 1);
    assert.equal(remainingFraction(START, null), 1);
    assert.equal(remainingFraction(END, START), 1);
    assert.equal(remainingFraction("nope", END), 1);
  });
});

describe("what an upgrade costs now", () => {
  const base = { periodStart: START, periodEnd: END };

  it("is the price difference for the rest of the period, in whole cents", () => {
    // Starter 149 to Growth 349, halfway: half of 200.
    assert.equal(upgradeProrationCents({ ...base, oldCents: 14900, newCents: 34900, now: new Date("2026-12-16T12:00:00.000Z") }), 10000);
    // On the first day: the whole difference.
    assert.equal(upgradeProrationCents({ ...base, oldCents: 14900, newCents: 34900, now: new Date(START) }), 20000);
    // Growth to Pro with ten of 31 days left.
    assert.equal(upgradeProrationCents({ ...base, oldCents: 34900, newCents: 74900, now: new Date("2026-12-22T00:00:00.000Z") }), Math.round(40000 * 10 / 31));
  });

  it("is nothing for a plan that is not dearer, and nothing once the period has run out", () => {
    assert.equal(upgradeProrationCents({ ...base, oldCents: 34900, newCents: 14900, now: new Date(START) }), 0);
    assert.equal(upgradeProrationCents({ ...base, oldCents: 34900, newCents: 34900, now: new Date(START) }), 0);
    assert.equal(upgradeProrationCents({ ...base, oldCents: 14900, newCents: 34900, now: new Date(END) }), 0);
  });
});

describe("what kind of change it is", () => {
  it("knows the same plan, a trial, an upgrade and a downgrade", () => {
    assert.equal(planChangeKind({ status: "active", plan: "growth" }, "growth"), "same");
    assert.equal(planChangeKind({ status: "trialing", plan: "growth" }, "pro"), "trial");
    assert.equal(planChangeKind({ status: "trialing", plan: "growth" }, "starter"), "trial");
    assert.equal(planChangeKind({ status: "active", plan: "starter" }, "growth"), "upgrade");
    assert.equal(planChangeKind({ status: "active", plan: "growth" }, "pro"), "upgrade");
    assert.equal(planChangeKind({ status: "active", plan: "pro" }, "growth"), "downgrade");
    assert.equal(planChangeKind({ status: "active", plan: null }, "growth"), "upgrade");
  });
});

describe("a new payment method", () => {
  const pay = (status: string): MolliePayment => ({ id: "tr_method0001", status, amount: { currency: "EUR", value: "0.01" }, metadata: { type: PAYMENT_METHOD_PAYMENT_TYPE, tenant_id: "voorbeeld" } });

  it("costs one cent", () => {
    assert.equal(PAYMENT_METHOD_VERIFICATION_CENTS, 1);
  });

  it("is updated only when the mandate was really stored", () => {
    assert.deepEqual(paymentMethodOutcome(pay("paid"), true),  { outcome: "payment-method", state: "updated", status: "paid" });
    assert.deepEqual(paymentMethodOutcome(pay("paid"), false), { outcome: "payment-method", state: "no-mandate", status: "paid" });
  });

  it("waits, or was not paid", () => {
    for (const s of ["open", "pending", "authorized"]) assert.equal((paymentMethodOutcome(pay(s), false) as { state: string }).state, "waiting");
    for (const s of ["canceled", "expired", "failed"]) assert.equal((paymentMethodOutcome(pay(s), false) as { state: string }).state, "not-paid");
  });

  it("returns to the billing page with the right notice", () => {
    assert.equal(mollieResultQuery({ outcome: "payment-method", state: "updated", status: "paid" }, null, null), "mollie=method");
    assert.equal(mollieResultQuery({ outcome: "payment-method", state: "waiting", status: "open" }, null, null), "mollie=pending");
    assert.equal(mollieResultQuery({ outcome: "payment-method", state: "no-mandate", status: "paid" }, null, null), "mollie=problem");
    assert.equal(mollieResultQuery({ outcome: "payment-method", state: "not-paid", status: "canceled" }, null, null), "bundle=cancelled");
  });
});

describe("the wiring", () => {
  const read   = (p: string) => fs.readFileSync(p, "utf8");
  const route  = read("app/api/billing/change-plan/route.ts");
  const branch = read("billing/mollie-plan-change.ts");

  it("the route hands over to Mollie before anything about Stripe prices, and after the access check", () => {
    const start = route.indexOf('if (getPaymentProvider() === "mollie" && mollieConfigured()');
    assert.ok(start > 0 && start < route.indexOf("// ── 4. Resolve new price ID"));
    assert.ok(route.indexOf("canAccessTenant(session, tenantId)") < start);
    assert.match(route, /sub && !sub\.stripe_subscription_id && \["active", "trialing"\]\.includes\(sub\.status\)/);
    assert.match(route, /const change = await changePlanViaMollie\(client, \{ tenantId, newPlanId, billingCycle, sub \}\);/);
  });

  it("on trial the plan changes at once and nothing is charged", () => {
    const trial = branch.slice(branch.indexOf('if (kind === "trial") {'), branch.indexOf("// Downgrade: at the next period."));
    assert.match(trial, /await switchNow\(\);\s+return \{ ok: true, effectiveNextPeriod: false \};/);
    assert.doesNotMatch(trial, /chargeMollieRenewal/);
  });

  it("a downgrade waits for the next period and charges nothing now", () => {
    const down = branch.slice(branch.indexOf('if (kind === "downgrade") {'), branch.indexOf("// Upgrade: collect the difference"));
    assert.match(down, /pending_plan:\s+newPlanId,/);
    assert.match(down, /pending_plan_effective_date: sub\.current_period_end,/);
    assert.match(down, /effectiveNextPeriod: true/);
    assert.doesNotMatch(down, /chargeMollieRenewal|switchNow\(\)/);
  });

  it("an upgrade is collected before the plan changes", () => {
    const up = branch.slice(branch.indexOf("// Upgrade: collect the difference"));
    const charge = up.indexOf("await chargeMollieRenewal(client, {");
    const refuse = up.indexOf("if (!charge.ok) {");
    const change = up.lastIndexOf("await switchNow();");
    assert.ok(charge > 0 && refuse > charge && change > refuse);
  });

  it("a failed upgrade leaves no debt behind", () => {
    assert.match(branch, /await client\.from\("mollie_renewals"\)\.delete\(\)\.match\(\{ tenant_id: tenantId, period_end: nowIso \}\)\.eq\("status", "failed"\);/);
    assert.match(branch, /status: 402/);
  });

  it("an upgrade without a payment method on file is refused before any charge", () => {
    const up = branch.slice(branch.indexOf("// Upgrade: collect the difference"));
    assert.ok(up.indexOf("if (!(await mollieReloadSource(client, tenantId, deps?.mollie))) {") < up.indexOf("await chargeMollieRenewal(client, {"));
  });

  it("the payment method route checks the session first and makes a first payment of one cent", () => {
    const src = read("app/api/billing/mollie/payment-method/route.ts");
    assert.ok(src.indexOf("guardTenantRoute(tenantId)") < src.indexOf("ensureMollieCustomer("));
    assert.match(src, /kind:\s+PAYMENT_METHOD_PAYMENT_TYPE,/);
    assert.match(src, /amountCents:\s+PAYMENT_METHOD_VERIFICATION_CENTS,/);
    assert.match(src, /firstForCustomerId: customerId,/);
  });

  it("the settle path stores the mandate of a verification payment and delivers nothing", () => {
    const src = read("billing/mollie-checkout.ts");
    const at  = src.indexOf("if (type === PAYMENT_METHOD_PAYMENT_TYPE) {");
    assert.ok(at > 0 && at < src.indexOf("const result = await fulfilMolliePayment(client, payment, deps?.fulfil);"));
    assert.match(src.slice(at, at + 300), /const stored = await rememberMollieMandate\(client, payment\);\s+const result = paymentMethodOutcome\(payment, stored\);/);
  });

  it("the dashboard shows Mollie's own card instead of the Stripe portal", () => {
    const src = read("app/admin/tenants/[tenantId]/billing/_components/BillingDashboard.tsx");
    assert.match(src, /\{mollieMandate \? \(\s+<MolliePaymentCard tenantId=\{tenantId\} subscription=\{subscription\} mollieMandate=\{mollieMandate\} \/>/);
    assert.match(src, /It replaces the payment method on file\./);
  });
});

describe("the tenant's package follows the plan", () => {
  it("an unknown or empty plan is Starter", async () => {
    const { packageKeyForPlan } = await import("../../billing/subscriptions.ts");
    assert.equal(packageKeyForPlan("growth"), "growth");
    assert.equal(packageKeyForPlan("pro"), "pro");
    assert.equal(packageKeyForPlan("starter"), "starter");
    assert.equal(packageKeyForPlan(null), "starter");
    assert.equal(packageKeyForPlan("enterprise"), "starter");
  });

  /** One tenant_settings row in memory: select().eq().maybeSingle() and update().eq(). */
  function settingsTable(settings: Record<string, unknown> | null) {
    const writes: Array<Record<string, unknown>> = [];
    const client = {
      from: (table: string) => {
        assert.equal(table, "tenant_settings");
        return {
          select: (cols: string) => { assert.equal(cols, "settings"); return { eq: () => ({ maybeSingle: async () => ({ data: settings === null ? null : { settings }, error: null }) }) }; },
          update: (patch: Record<string, unknown>) => { writes.push(patch); return { eq: async () => ({ error: null }) }; },
        };
      },
    };
    return { client: client as never, writes };
  }

  it("writes packageKey into the settings, and keeps every other setting", async () => {
    const { syncPackageKeyFromPlan } = await import("../../billing/subscriptions.ts");
    const { client, writes } = settingsTable({ packageKey: "growth", name: "Voorbeeld BV", snippet: { enabled: true } });
    await syncPackageKeyFromPlan(client, "voorbeeld", "pro");
    assert.equal(writes.length, 1);
    assert.deepEqual(writes[0]!["settings"], { packageKey: "pro", name: "Voorbeeld BV", snippet: { enabled: true } });
    assert.equal("package_key" in writes[0]!, false, "there is no package_key column");
  });

  it("a cancelled subscription goes back to Starter", async () => {
    const { syncPackageKeyFromPlan } = await import("../../billing/subscriptions.ts");
    const { client, writes } = settingsTable({ packageKey: "pro" });
    await syncPackageKeyFromPlan(client, "voorbeeld", null);
    assert.deepEqual(writes[0]!["settings"], { packageKey: "starter" });
  });

  it("writes nothing when the package is already right, or the tenant is not there", async () => {
    const { syncPackageKeyFromPlan } = await import("../../billing/subscriptions.ts");
    const same = settingsTable({ packageKey: "growth" });
    await syncPackageKeyFromPlan(same.client, "voorbeeld", "growth");
    assert.equal(same.writes.length, 0);
    const none = settingsTable(null);
    await syncPackageKeyFromPlan(none.client, "weg", "growth");
    assert.equal(none.writes.length, 0);
  });
});
