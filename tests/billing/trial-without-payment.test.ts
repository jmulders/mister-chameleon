/**
 * A trial that asks for no payment details.
 *
 * The owner asked for it on 28 Nov 2026: a card or a payment up front makes a
 * trial feel like a commitment. The visitor's e-mail address stands in for the
 * payment, and a trial that ends with nothing to charge is paused, not chased.
 *
 * No network and no database: the token functions are pure, and the steps
 * that touch the database take a stand-in that records what it was asked.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import { SignJWT }      from "jose";

import {
  CONFIRM_TTL_HOURS,
  confirmationMail,
  confirmationUrl,
  confirmTrialSignup,
  readTrialConfirmation,
  signTrialConfirmation,
  trialNeedsPayment,
  type ConfirmDeps,
} from "../../billing/trial-signup.ts";
import { endTrialWithoutPayment, isTrialEndWithoutPayment, trialEndedMail, type TrialEndDeps } from "../../billing/trial-end.ts";
import { getDunningState } from "../../billing/dunning.ts";
import { TRIAL_SESSION_LIMIT } from "../../billing/trial-session-cap.ts";
import type { ProvisionedTrial } from "../../billing/trial-provisioning.ts";
import { SHOP_TEXTS } from "../../lib/site-texts/shop.ts";

const SECRET  = "s".repeat(40);
const PENDING = "0a1b2c3d-0000-4000-8000-000000000001";
const NOW     = new Date("2026-11-28T10:00:00Z");
const read    = (path: string) => fs.readFileSync(path, "utf8");

describe("the switch", () => {
  it("asks for no payment unless it is told to", () => {
    assert.equal(trialNeedsPayment({}), false);
    assert.equal(trialNeedsPayment({ TRIAL_REQUIRES_PAYMENT: "on" }), true);
    // Only the exact word: a typo must not quietly bring the card back.
    assert.equal(trialNeedsPayment({ TRIAL_REQUIRES_PAYMENT: "true" }), false);
    assert.equal(trialNeedsPayment({ TRIAL_REQUIRES_PAYMENT: "" }), false);
  });
});

describe("the link in the confirmation mail", () => {
  it("names the signup and is read back", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    assert.deepEqual(await readTrialConfirmation(token, SECRET, NOW), { ok: true, pendingId: PENDING });
  });

  it("works for 48 hours and not longer", async () => {
    assert.equal(CONFIRM_TTL_HOURS, 48);
    const token  = await signTrialConfirmation(PENDING, SECRET, NOW);
    const before = new Date(NOW.getTime() + 47 * 60 * 60 * 1000);
    const after  = new Date(NOW.getTime() + 49 * 60 * 60 * 1000);
    assert.equal((await readTrialConfirmation(token, SECRET, before)).ok, true);
    assert.deepEqual(await readTrialConfirmation(token, SECRET, after), { ok: false, reason: "expired" });
  });

  it("refuses a token that was changed, or signed with another secret", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    const [head, body, sig] = token.split(".");
    const forged = `${head}.${Buffer.from(JSON.stringify({ sub: "someone-else", aud: "trial-confirm", exp: 9999999999 })).toString("base64url")}.${sig}`;
    assert.deepEqual(await readTrialConfirmation(forged, SECRET, NOW), { ok: false, reason: "invalid" });
    assert.deepEqual(await readTrialConfirmation(token, "t".repeat(40), NOW), { ok: false, reason: "invalid" });
    assert.deepEqual(await readTrialConfirmation("not-a-token", SECRET, NOW), { ok: false, reason: "invalid" });
    assert.ok(body);
  });

  it("is not signed with the admin secret itself", async () => {
    // An admin session is signed with the raw secret. A token made that way,
    // even with the right audience, is not a confirmation: the two kinds can
    // never be passed off as each other.
    const withRawSecret = await new SignJWT({ sub: PENDING, aud: "trial-confirm" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(NOW.getTime() / 1000))
      .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));
    assert.deepEqual(await readTrialConfirmation(withRawSecret, SECRET, NOW), { ok: false, reason: "invalid" });
  });

  it("is not made without a real secret", async () => {
    await assert.rejects(() => signTrialConfirmation(PENDING, "", NOW), /secret/);
    await assert.rejects(() => signTrialConfirmation(PENDING, "short", NOW), /secret/);
  });

  it("leads to the confirmation page on the site the visitor signed up on", () => {
    assert.equal(confirmationUrl("https://www.example.nl/", "a.b.c"), "https://www.example.nl/checkout/confirm?token=a.b.c");
  });
});

describe("the confirmation mail", () => {
  it("carries the link and says what the trial is, in Dutch and in English", () => {
    for (const locale of ["nl", "en"] as const) {
      const mail = confirmationMail(locale, { name: "Sanne", url: "https://www.example.nl/checkout/confirm?token=x" });
      assert.ok(mail.text.includes("https://www.example.nl/checkout/confirm?token=x"));
      assert.ok(mail.html.includes('href="https://www.example.nl/checkout/confirm?token=x"'));
      assert.ok(mail.text.includes(String(TRIAL_SESSION_LIMIT)), "names the session limit");
      assert.ok(mail.text.includes("48"), "says how long the link works");
    }
    assert.match(confirmationMail("nl", { name: "Sanne", url: "u" }).text, /geen betaalgegevens/);
    assert.match(confirmationMail("en", { name: "Sanne", url: "u" }).text, /do not enter payment details/);
  });

  it("does not let a name break out of the mail", () => {
    const mail = confirmationMail("nl", { name: "<script>x</script>", url: "u" });
    assert.equal(mail.html.includes("<script>"), false);
  });
});

// ── Opening the link ───────────────────────────────────────────────────────────

const TRIAL: ProvisionedTrial = {
  tenantId: "voorbeeld", userId: "u1", name: "Sanne", email: "sanne@example.test", company: "Voorbeeld",
  planId: "growth", planLabel: "Growth", now: NOW.toISOString(), trialEndsAt: new Date(NOW.getTime() + 14 * 86400000).toISOString(),
};

function pendingClient(status: string | null) {
  const writes: Array<{ table: string; op: string; row: Record<string, unknown> }> = [];
  const client = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: status ? { status } : null, error: null }) }) }),
      upsert: (row: Record<string, unknown>) => { writes.push({ table, op: "upsert", row }); return Promise.resolve({ error: null }); },
    }),
  };
  return { client: client as never, writes };
}

function deps(over: Partial<ConfirmDeps> = {}): { d: ConfirmDeps; calls: string[] } {
  const calls: string[] = [];
  const claimed = new Set<string>();
  const d: ConfirmDeps = {
    once: async (_c, key, _t, run) => { if (claimed.has(key)) return "already"; claimed.add(key); await run(); return "ran"; },
    provision: async () => { calls.push("provision"); return { ok: true, trial: TRIAL }; },
    complete:  async () => { calls.push("complete"); },
    ...over,
  };
  return { d, calls };
}

describe("opening the link", () => {
  it("makes the account and its trial, with no payment method anywhere", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    const { client, writes } = pendingClient("pending");
    const { d, calls } = deps();
    assert.deepEqual(await confirmTrialSignup(client, token, SECRET, d, NOW), { state: "created", tenantId: "voorbeeld" });
    assert.deepEqual(calls, ["provision", "complete"]);
    const sub = writes.find((w) => w.table === "subscriptions")!.row;
    assert.equal(sub["status"], "trialing");
    assert.equal(sub["plan"], "growth");
    assert.equal(sub["trial_end"], TRIAL.trialEndsAt);
    // The platform's own subscription: no provider ids.
    assert.equal("stripe_subscription_id" in sub, false);
    assert.equal(writes.some((w) => w.table === "mollie_customers"), false);
  });

  it("makes one account when the link is opened twice", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    const { client } = pendingClient("pending");
    const { d, calls } = deps();
    assert.equal((await confirmTrialSignup(client, token, SECRET, d, NOW)).state, "created");
    assert.equal((await confirmTrialSignup(client, token, SECRET, d, NOW)).state, "already");
    assert.deepEqual(calls, ["provision", "complete"]);
  });

  it("says the account exists when the signup was completed before", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    const { d, calls } = deps();
    assert.deepEqual(await confirmTrialSignup(pendingClient("completed").client, token, SECRET, d, NOW), { state: "already" });
    assert.deepEqual(calls, []);
  });

  it("makes nothing for an expired or a made-up link", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    const late  = new Date(NOW.getTime() + 3 * 86400000);
    const { d, calls } = deps();
    assert.deepEqual(await confirmTrialSignup(pendingClient("pending").client, token, SECRET, d, late), { state: "expired" });
    assert.deepEqual(await confirmTrialSignup(pendingClient("pending").client, "x.y.z", SECRET, d, NOW), { state: "invalid" });
    // A good token for a signup that is not there (removed, or never stored).
    assert.deepEqual(await confirmTrialSignup(pendingClient(null).client, token, SECRET, d, NOW), { state: "invalid" });
    assert.deepEqual(calls, []);
  });

  it("reports a signup that could not be turned into an account", async () => {
    const token = await signTrialConfirmation(PENDING, SECRET, NOW);
    const { d } = deps({ provision: async () => ({ ok: false, action: "trial_signup_user_create_failed" }) });
    assert.deepEqual(await confirmTrialSignup(pendingClient("pending").client, token, SECRET, d, NOW), { state: "failed", reason: "trial_signup_user_create_failed" });
  });
});

// ── The end of the trial ───────────────────────────────────────────────────────

describe("a trial that ends with nothing to charge", () => {
  it("is told apart from a payment that failed", () => {
    assert.equal(isTrialEndWithoutPayment({ status: "trialing" }, { ok: false, noPaymentMethod: true }), true);
    // A card that was refused, or a mandate that bounced: that is a missed payment.
    assert.equal(isTrialEndWithoutPayment({ status: "trialing" }, { ok: false, noPaymentMethod: false }), false);
    // A paying customer whose card disappeared is not a trial that ended.
    assert.equal(isTrialEndWithoutPayment({ status: "active" }, { ok: false, noPaymentMethod: true }), false);
    assert.equal(isTrialEndWithoutPayment({ status: "trialing" }, { ok: true }), false);
  });

  it("stops the service like an unpaid subscription does, without a debt", () => {
    assert.equal(getDunningState("paused", null).isBlocked, true);
    assert.equal(getDunningState("paused", null).isQuarantined, false);
    // What was true before still is.
    assert.equal(getDunningState("unpaid", null).isBlocked, true);
    assert.equal(getDunningState("trialing", null).isBlocked, false);
    assert.equal(getDunningState("active", null).isBlocked, false);
  });

  function subscriptionClient(rowsTurned: number) {
    const updates: Array<Record<string, unknown>> = [];
    const filters: Array<[string, unknown]> = [];
    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => { filters.push([col, val]); return chain; },
      select: async () => ({ data: Array.from({ length: rowsTurned }, () => ({ tenant_id: "voorbeeld" })), error: null }),
    };
    const client = { from: () => ({ update: (row: Record<string, unknown>) => { updates.push(row); return chain; } }) };
    return { client: client as never, updates, filters };
  }

  function endDeps(sent: Array<{ to: string[]; subject: string }>, to: string[] = ["sanne@example.test"]): TrialEndDeps {
    return {
      recipients: async () => to,
      send:       async (addresses, mail) => { sent.push({ to: addresses, subject: mail.subject }); return true; },
      billingUrl: async (tenantId) => `https://www.example.nl/admin/tenants/${tenantId}/billing`,
    };
  }

  it("pauses the subscription and tells the tenant", async () => {
    const sent: Array<{ to: string[]; subject: string }> = [];
    const { client, updates, filters } = subscriptionClient(1);
    const result = await endTrialWithoutPayment(client, "voorbeeld", { planName: "Growth", priceCents: 34900 }, endDeps(sent));
    assert.deepEqual(result, { paused: true, mailed: true });
    assert.equal(updates[0]!["status"], "paused");
    // Nothing is owed: no due date and no reminder state is set.
    assert.equal("payment_due_since" in updates[0]!, false);
    // Claimed on the status, so only a trial is paused.
    assert.deepEqual(filters, [["tenant_id", "voorbeeld"], ["status", "trialing"]]);
    assert.deepEqual(sent.map((s) => s.to), [["sanne@example.test"]]);
  });

  it("does nothing the second time", async () => {
    const sent: Array<{ to: string[]; subject: string }> = [];
    const result = await endTrialWithoutPayment(subscriptionClient(0).client, "voorbeeld", { planName: "Growth", priceCents: 34900 }, endDeps(sent));
    assert.deepEqual(result, { paused: false, mailed: false });
    assert.equal(sent.length, 0);
  });

  it("still pauses when there is nobody to mail", async () => {
    const sent: Array<{ to: string[]; subject: string }> = [];
    const result = await endTrialWithoutPayment(subscriptionClient(1).client, "voorbeeld", { planName: "Growth", priceCents: 34900 }, endDeps(sent, []));
    assert.deepEqual(result, { paused: true, mailed: false });
  });

  it("writes a mail that asks for nothing and says how to go on", () => {
    const mail = trialEndedMail({ planName: "Growth", priceCents: 34900, billingUrl: "https://www.example.nl/admin/tenants/voorbeeld/billing" });
    assert.match(mail.text, /Er is niets afgeschreven/);
    assert.match(mail.text, /Nothing was charged/);
    assert.match(mail.text, /€\s?349,00 per maand, excl\. btw/);
    assert.ok(mail.text.includes("https://www.example.nl/admin/tenants/voorbeeld/billing"));
    // It is not a reminder: no word of a failed or overdue payment.
    assert.doesNotMatch(mail.text, /mislukt|achterstand|overdue|failed|past due/i);
  });
});

// ── How it is wired ────────────────────────────────────────────────────────────

describe("the wiring", () => {
  const route  = read("app/api/trial/checkout-session/route.ts");
  const cron   = read("app/api/cron/billing-renewal/route.ts");
  const form   = read("app/(site)/checkout/_components/CheckoutPageClient.tsx");
  const page   = read("app/(site)/checkout/page.tsx");
  const board  = read("app/admin/tenants/[tenantId]/billing/_components/BillingDashboard.tsx");
  const admin  = read("app/admin/tenants/[tenantId]/billing/page.tsx");

  it("the signup takes the road without payment before either provider", () => {
    const noPayment = route.indexOf("if (!trialNeedsPayment()) {");
    assert.ok(noPayment > 0);
    assert.ok(noPayment < route.indexOf("if (mollieTrialSignupEnabled()) {"), "before the Mollie verification payment");
    assert.ok(noPayment < route.indexOf("stripe.checkout.sessions.create"), "before the Stripe Checkout");
    // The link is only handed back outside production.
    assert.match(route, /sent \|\| process\.env\["NODE_ENV"\] === "production" \? \{\} : \{ devConfirmUrl: url \}/);
    // Without a mail the signup cannot be finished, so production says so.
    assert.match(route, /if \(!sent && process\.env\["NODE_ENV"\] === "production"\)/);
  });

  it("the form says no payment details are needed and ends in check-your-mail", () => {
    assert.match(page, /const needsPayment\s+= trialNeedsPayment\(\);/);
    assert.match(page, /needsPayment && mollieTrialSignupEnabled\(\)/);
    assert.match(form, /!needsPayment \? t\.trialNoPaymentNote/);
    assert.match(form, /if \(res\.ok && data\.confirm\) \{/);
    assert.match(form, /data-part="checkout-confirm-sent"/);
    for (const locale of ["nl", "en"] as const) {
      const t = SHOP_TEXTS[locale];
      assert.ok(t.trialNoPaymentNote.includes(String(TRIAL_SESSION_LIMIT)));
      assert.ok(t.confirmBody("sanne@example.test").includes("sanne@example.test"));
    }
    assert.match(SHOP_TEXTS.nl.trialNoPaymentNote, /geen betaalgegevens/);
  });

  it("nothing around the signup says a payment follows by itself", () => {
    // "Je betaalt pas na 14 dagen" stood in the cart, on the form and on the
    // price page. With no payment method on file nothing is paid after 14
    // days unless the tenant chooses to go on.
    const shop = read("lib/site-texts/shop.ts");
    assert.doesNotMatch(shop, /Je betaalt pas na 14 dagen"/);
    assert.doesNotMatch(shop, /zodra je proefperiode van 14 dagen voorbij is/);
    assert.match(SHOP_TEXTS.nl.planChargesNote("€ 349"), /Na je proefperiode van 14 dagen kost dit pakket € 349 per maand\./);
    // The form does not promise a secure payment where there is none.
    assert.match(form, /\(needsPayment \? t\.checkoutTrust : t\.checkoutTrustNoPayment\)\.map/);
    assert.equal(SHOP_TEXTS.nl.checkoutTrustNoPayment.some((l) => /Stripe|betalen/i.test(l)), false);
    // The price page follows the switch.
    const prices = read("app/(site)/prijzen/page.tsx");
    assert.match(prices, /\{trialNeedsPayment\(\)\s+\? "Je kunt elk pakket 14 dagen gratis proberen\. Je betaalt pas na 14 dagen\."\s+: "Je kunt elk pakket 14 dagen gratis proberen, zonder betaalgegevens\. Daarna kies je zelf of je doorgaat\."\}/);
  });

  it("the daily job pauses such a trial instead of sending a reminder", () => {
    const ended   = cron.indexOf("if (!chargeResult.ok && isTrialEndWithoutPayment(sub, chargeResult)) {");
    const pastDue = cron.indexOf("await markTenantPastDue(client, tenant_id);");
    assert.ok(ended > 0 && ended < pastDue, "the trial's end is handled before the missed payment");
    // And it does not get the free days to the 1st: there is nothing to charge then.
    assert.match(cron, /if \(viaMollie && \(sub\.status !== "trialing" \|\| await mollieReloadSource\(client, tenant_id\)\)\) \{/);
  });

  it("a tenant admin sees only their own tenants in the overview", () => {
    // Anyone can make an account now, so the overview must not list the
    // names of every customer to each of them, as it did until this change.
    const overview = read("app/admin/tenants/page.tsx");
    assert.match(overview, /const superAdmin = isSuperAdmin\(session\);/);
    assert.match(overview, /const own\s+= superAdmin \? null : new Set\(await getTenantIdsForUser\(session\.sub\)\.catch\(\(\) => \[\] as string\[\]\)\);/);
    assert.match(overview, /const tenants\s+= own \? everyone\.filter\(\(t\) => own\.has\(t\.tenantId\)\) : everyone;/);
    // The totals of the platform and the ways to make a tenant are a super admin's.
    assert.match(overview, /\{superAdmin && <StatamicRolloutCard \/>\}/);
    assert.match(overview, /\{superAdmin && <div className="mt-5 grid/);
    // Nothing after the filter reads the whole list again.
    assert.equal((overview.match(/everyone\b/g) ?? []).length, 3);
  });

  it("the dashboard says the trial ended, calmly, and offers the way on", () => {
    assert.match(admin, /const trialEnded = subscription\?\.status === "paused";/);
    assert.match(admin, /subscription\?\.status === "unpaid" \|\| trialEnded\)/);
    assert.match(board, /Your trial has ended/);
    assert.match(board, /Nothing was charged\./);
    assert.match(board, /\{trialEnded && !mollieOverdue && paymentNotice !== "restored" && \(/);
  });
});
