/**
 * Mollie step 3: the subscription charged on a mandate.
 *
 * No network and no database. The Mollie client takes its fetch, the settle
 * steps take their handlers, and the database is a small stand-in that keeps
 * the rows of `mollie_renewals` in memory and answers the few calls made.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import type { MolliePayment } from "../../billing/mollie.ts";
import {
  alignedToMonthStart,
  existingRenewal,
  nextMonthStartIso,
  OVERDUE_PAYMENT_TYPE,
  RENEWAL_PAYMENT_TYPE,
  renewalPaymentState,
  settleMollieOverduePayment,
  settleMollieRenewal,
  trialRealign,
} from "../../billing/mollie-renewal.ts";

describe("the calendar month", () => {
  it("knows midnight UTC on the 1st, and nothing else", () => {
    assert.equal(alignedToMonthStart("2026-12-01T00:00:00.000Z"), true);
    assert.equal(alignedToMonthStart("2026-12-01T00:00:00+00:00"), true);
    assert.equal(alignedToMonthStart("2026-12-01T00:00:01.000Z"), false);
    assert.equal(alignedToMonthStart("2026-12-11T10:00:00.000Z"), false);
    assert.equal(alignedToMonthStart("2026-12-01T01:00:00+01:00"), true, "the same instant in another zone");
    assert.equal(alignedToMonthStart(null), false);
    assert.equal(alignedToMonthStart("not a date"), false);
  });

  it("finds the 1st of the next month, also over the year", () => {
    assert.equal(nextMonthStartIso(new Date("2026-11-27T15:00:00Z")), "2026-12-01T00:00:00.000Z");
    assert.equal(nextMonthStartIso(new Date("2026-12-11T10:00:00Z")), "2027-01-01T00:00:00.000Z");
    assert.equal(nextMonthStartIso(new Date("2026-12-01T00:00:00Z")), "2027-01-01T00:00:00.000Z");
  });

  it("moves an ended trial to the 1st once, and then lets it be charged", () => {
    const now = new Date("2026-12-11T03:00:00Z");
    assert.deepEqual(trialRealign({ status: "trialing", current_period_end: "2026-12-11T10:00:00.000Z" }, now), { realign: true, periodEnd: "2027-01-01T00:00:00.000Z" });
    // The loop guard: a trial that already ends on a 1st is not moved again.
    assert.deepEqual(trialRealign({ status: "trialing", current_period_end: "2027-01-01T00:00:00.000Z" }, new Date("2027-01-01T03:00:00Z")), { realign: false, periodEnd: "2027-01-01T00:00:00.000Z" });
    // A paid subscription keeps its own period.
    assert.equal(trialRealign({ status: "active", current_period_end: "2026-12-11T10:00:00.000Z" }, now).realign, false);
  });
});

describe("one charge per period", () => {
  it("a run that finds a row does not charge again", () => {
    assert.deepEqual(existingRenewal({ status: "paid", payment_id: "tr_a" }),    { ok: true, paymentIntentId: "tr_a", settled: true });
    assert.deepEqual(existingRenewal({ status: "pending", payment_id: "tr_a" }), { ok: true, paymentIntentId: "tr_a", settled: false });
    const failed = existingRenewal({ status: "failed", payment_id: "tr_a" });
    assert.equal(failed !== "create" && failed.ok, false);
  });

  it("a row that was claimed and never got a payment is created again, with the same key", () => {
    assert.equal(existingRenewal({ status: "creating", payment_id: null }), "create");
  });
});

describe("what Mollie reports later", () => {
  const pay = (over: Partial<MolliePayment>): MolliePayment => ({
    id: "tr_renew00001", status: "paid", amount: { currency: "EUR", value: "349.00" },
    metadata: { type: RENEWAL_PAYMENT_TYPE, tenant_id: "voorbeeld", period_end: "2027-01-01T00:00:00.000Z", plan: "growth", amount_cents: "34900" },
    ...over,
  });

  it("reads paid, failed, waiting, and a debit the payer reversed", () => {
    assert.equal(renewalPaymentState(pay({})), "paid");
    for (const status of ["failed", "canceled", "expired"]) assert.equal(renewalPaymentState(pay({ status })), "failed");
    for (const status of ["open", "pending"]) assert.equal(renewalPaymentState(pay({ status })), "waiting");
    assert.equal(renewalPaymentState(pay({ amountChargedBack: { currency: "EUR", value: "349.00" } })), "reversed");
    assert.equal(renewalPaymentState(pay({ amountChargedBack: { currency: "EUR", value: "0.00" } })), "paid");
  });

  /** `mollie_renewals` in memory: update().eq()/.in()/.match().select() on one row. */
  function table(row: Record<string, unknown>) {
    const rows = [row];
    const client = {
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          const filters: Array<(r: Record<string, unknown>) => boolean> = [];
          const run = () => { const hit = rows.filter((r) => filters.every((f) => f(r))); hit.forEach((r) => Object.assign(r, patch)); return hit.map((r) => ({ ...r })); };
          const q: Record<string, unknown> = {
            eq:     (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
            in:     (k: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[k])); return q; },
            match:  (m: Record<string, unknown>) => { filters.push((r) => Object.entries(m).every(([k, v]) => r[k] === v)); return q; },
            select: async () => ({ data: run(), error: null }),
            then:   (f: (v: { data: null; error: null }) => unknown) => { run(); return Promise.resolve({ data: null, error: null }).then(f); },
          };
          return q;
        },
      }),
    };
    return { client: client as never, rows };
  }
  const renewal = (status: string) => ({
    tenant_id: "voorbeeld", period_end: "2027-01-01T00:00:00.000Z", payment_id: "tr_renew00001",
    plan: "growth", amount_cents: 34900, status, period_advanced: true,
  });

  it("a pending debit that is paid needs nothing more", async () => {
    const { client, rows } = table(renewal("pending"));
    const dunned: string[] = [];
    const result = await settleMollieRenewal(client, pay({}), { startDunning: async (_c, t) => { dunned.push(t); } });
    assert.deepEqual(result, { outcome: "renewal", state: "paid", status: "paid" });
    assert.equal(rows[0]!["status"], "paid");
    assert.deepEqual(dunned, []);
  });

  it("a debit the bank refuses puts the tenant past due, once", async () => {
    const { client, rows } = table(renewal("pending"));
    const dunned: string[] = [];
    const deps = { startDunning: async (_c: unknown, t: string, info: { plan: string; amountCents: number }) => { dunned.push(`${t} ${info.plan} ${info.amountCents}`); } };
    const first  = await settleMollieRenewal(client, pay({ status: "failed" }), deps);
    const second = await settleMollieRenewal(client, pay({ status: "failed" }), deps);
    assert.equal((first as { state: string }).state, "failed");
    assert.equal((second as { state: string }).state, "unknown");
    assert.equal(rows[0]!["status"], "failed");
    assert.deepEqual(dunned, ["voorbeeld growth 34900"]);
  });

  it("a paid debit the payer reverses weeks later does the same", async () => {
    const { client, rows } = table(renewal("paid"));
    const dunned: string[] = [];
    const result = await settleMollieRenewal(client, pay({ amountChargedBack: { currency: "EUR", value: "349.00" } }), { startDunning: async (_c, t) => { dunned.push(t); } });
    assert.equal((result as { state: string }).state, "failed");
    assert.equal(rows[0]!["problem"], "reversed by the payer");
    assert.deepEqual(dunned, ["voorbeeld"]);
  });

  it("waits while the bank has not answered", async () => {
    const { client, rows } = table(renewal("pending"));
    const result = await settleMollieRenewal(client, pay({ status: "pending" }), { startDunning: async () => { throw new Error("must not run"); } });
    assert.equal((result as { state: string }).state, "waiting");
    assert.equal(rows[0]!["status"], "pending");
  });

  const overdue = (over: Partial<MolliePayment> = {}): MolliePayment => ({
    id: "tr_overdue001", status: "paid", amount: { currency: "EUR", value: "349.00" },
    metadata: { type: OVERDUE_PAYMENT_TYPE, tenant_id: "voorbeeld", period_end: "2027-01-01T00:00:00.000Z", amount_cents: "34900" },
    ...over,
  });

  it("the tenant paying the open amount restores the subscription, once", async () => {
    const { client, rows } = table(renewal("failed"));
    const log: string[] = [];
    const deps = { renewPeriod: async (_c: unknown, t: string) => { log.push(`renew ${t}`); return { ok: true }; }, clearDunning: async (_c: unknown, t: string) => { log.push(`clear ${t}`); } };
    const first  = await settleMollieOverduePayment(client, overdue(), deps);
    const second = await settleMollieOverduePayment(client, overdue(), deps);
    assert.equal((first as { state: string }).state, "paid");
    assert.equal((second as { state: string }).state, "unknown");
    assert.equal(rows[0]!["status"], "paid");
    assert.equal(rows[0]!["payment_id"], "tr_overdue001");
    // The period had moved on already when the debit was accepted: only the reminders stop.
    assert.deepEqual(log, ["clear voorbeeld"]);
  });

  it("moves the period on too when the charge had failed before it did", async () => {
    const { client } = table({ ...renewal("failed"), period_advanced: false });
    const log: string[] = [];
    await settleMollieOverduePayment(client, overdue(), {
      renewPeriod: async (_c, t) => { log.push(`renew ${t}`); return { ok: true }; },
      clearDunning: async (_c, t) => { log.push(`clear ${t}`); },
    });
    assert.deepEqual(log, ["renew voorbeeld", "clear voorbeeld"]);
  });

  it("restores nothing for a payment that is not paid or not the amount asked", async () => {
    const { client, rows } = table(renewal("failed"));
    const deps = { renewPeriod: async () => { throw new Error("must not run"); }, clearDunning: async () => { throw new Error("must not run"); } };
    assert.equal((await settleMollieOverduePayment(client, overdue({ status: "open" }), deps) as { state: string }).state, "waiting");
    assert.equal((await settleMollieOverduePayment(client, overdue({ status: "canceled" }), deps) as { state: string }).state, "failed");
    assert.equal((await settleMollieOverduePayment(client, overdue({ amount: { currency: "EUR", value: "1.00" } }), deps) as { state: string }).state, "unknown");
    assert.equal(rows[0]!["status"], "failed");
  });
});

describe("the wiring", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");

  it("the job charges the Mollie mandate when Mollie is the provider, and Stripe otherwise", () => {
    const src = read("app/api/cron/billing-renewal/route.ts");
    assert.match(src, /const viaMollie = getPaymentProvider\(\) === "mollie";/);
    assert.match(src, /\? await chargeMollieRenewal\(client, \{/);
    assert.match(src, /: await attemptSubscriptionCharge\(/);
  });

  it("an ended trial is moved to the 1st before it is charged, only with Mollie", () => {
    const src = read("app/api/cron/billing-renewal/route.ts");
    const realign = src.indexOf("const move = trialRealign(sub);");
    const charge  = src.indexOf("await chargeMollieRenewal(client, {");
    assert.ok(realign > 0 && charge > realign);
    assert.match(src, /if \(viaMollie\) \{\s+const move = trialRealign\(sub\);/);
  });

  it("the period that moved on is noted on the charge", () => {
    const src = read("app/api/cron/billing-renewal/route.ts");
    assert.equal(src.split("await noteRenewalAdvanced(client, tenant_id, renewedFrom);").length - 1, 2, "after the annual and after the monthly renewal");
  });

  it("the settle path sends both kinds of subscription payment to this module", () => {
    const src = read("billing/mollie-checkout.ts");
    assert.match(src, /if \(type === RENEWAL_PAYMENT_TYPE\) \{/);
    assert.match(src, /if \(type === OVERDUE_PAYMENT_TYPE\) \{/);
    assert.ok(src.indexOf("if (type === RENEWAL_PAYMENT_TYPE) {") < src.indexOf("const result = await fulfilMolliePayment(client, payment, deps?.fulfil);"));
  });

  it("the claim comes before the charge, and a failed claim charges nothing", () => {
    const src = read("billing/mollie-renewal.ts");
    const claim  = src.indexOf('.from("mollie_renewals")\n    .upsert(');
    const charge = src.indexOf("payment = await createMolliePayment(");
    assert.ok(claim > 0 && charge > claim);
    assert.match(src, /if \(claimErr\) \{[\s\S]*?return \{ ok: false, error: `Could not claim the renewal/);
  });

  it("the route to pay an open amount checks the session first and asks what is owed", () => {
    const src = read("app/api/billing/mollie/pay-overdue/route.ts");
    assert.ok(src.indexOf("guardTenantRoute(tenantId)") < src.indexOf("overdueAmount(client, tenantId)"));
    assert.match(src, /kind:\s+OVERDUE_PAYMENT_TYPE/);
    assert.match(src, /firstForCustomerId: customerId,/);
  });
});
