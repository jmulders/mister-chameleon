/**
 * The subscription, charged on a Mollie mandate (step 3).
 *
 * The platform already renews the subscriptions Stripe does not manage: a
 * daily job (app/api/cron/billing-renewal) finds the ones whose period has
 * ended, charges, moves the period on, and starts the reminders when the
 * charge fails. That job keeps all of that. This file is the charge, and what
 * a charge at Mollie adds to the story.
 *
 * What Mollie adds
 *
 *   1. A direct debit is not paid at once. It is "pending" for some working
 *      days. The job cannot wait for that, so a charge that Mollie accepted
 *      counts as collected: the period moves on and the tenant stays active.
 *      This is how a direct debit subscription works everywhere. If the bank
 *      later refuses it, or the payer reverses it, Mollie's webhook says so
 *      and the tenant goes past due then, with the same reminder mail.
 *
 *   2. One charge per period, whatever happens. Before anything is sent to
 *      Mollie a row is claimed in `mollie_renewals`, keyed on tenant and the
 *      period that ended. A second run of the job, or one that is retried
 *      after a timeout, finds the row and does not charge again.
 *
 *   3. A way back. When a charge fails there is no automatic retry. The
 *      tenant pays the open amount themselves (payOverdue), which also gives a
 *      fresh mandate, and that payment restores the subscription.
 *
 * A trial that ends is moved to the 1st of the next month before it is
 * charged, as the Stripe path does (trialConversionRealign in stripe.ts): a
 * few free days, then a period that runs with the calendar month, like the
 * session limit does.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  centsFromMollieAmount,
  createMolliePayment,
  mollieWebhookUrl,
  type MollieDeps,
  type MolliePayment,
} from "./mollie";
import { mollieReloadSource } from "./mollie-auto-reload";
import type { MollieFulfilment } from "./mollie-fulfil";
import { chargeAmounts, vatMetadata } from "./billing-details";
import { vatRateLabel } from "./vat";

/** `metadata.type` of a charge the renewal job made on a mandate. */
export const RENEWAL_PAYMENT_TYPE = "subscription_renewal";
/** `metadata.type` of the payment a tenant makes themselves for an open amount. */
export const OVERDUE_PAYMENT_TYPE = "subscription_payment";

// ── The calendar month ────────────────────────────────────────────────────────

/** True for an instant that is exactly midnight UTC on the 1st. Pure. */
export function alignedToMonthStart(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCDate() === 1 && d.getUTCHours() === 0 && d.getUTCMinutes() === 0
    && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

/** Midnight UTC on the 1st of the month after `now`. Pure. */
export function nextMonthStartIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
}

/**
 * Whether an ended trial must first be moved to the 1st. Pure.
 *
 * Only a trial, and only one whose period does not already end on a 1st:
 * once it does, the next run charges it. That second condition is the loop
 * guard, a trial is moved once.
 */
export function trialRealign(
  sub: { status: string; current_period_end: string | null },
  now: Date = new Date(),
): { realign: boolean; periodEnd: string } {
  const realign = sub.status === "trialing" && !alignedToMonthStart(sub.current_period_end);
  return { realign, periodEnd: realign ? nextMonthStartIso(now) : (sub.current_period_end ?? "") };
}

// ── The charge ────────────────────────────────────────────────────────────────

/** The same shape as attemptSubscriptionCharge(), so the job treats both alike. */
export type MollieRenewalResult =
  | { ok: true;  paymentIntentId: string; settled: boolean; chargedCents?: number }
  | { ok: false; error: string; noPaymentMethod: boolean; chargedCents?: number };

export interface MollieRenewalInput {
  tenantId:    string;
  /** The end of the period being renewed. With the tenant it names the charge. */
  periodEnd:   string;
  /** The price exclusive of VAT. The VAT for this tenant is added to it. */
  amountCents: number;
  plan:        string;
  cycle:       "monthly" | "annual";
  description: string;
  /** renewalIdempotencyKey(): a retried request returns the first payment. */
  idempotencyKey: string;
}

type RenewalRow = { status: string; payment_id: string | null };

/** What a row that already exists means for a run that finds it. Pure. */
export function existingRenewal(row: RenewalRow): MollieRenewalResult | "create" {
  if (row.status === "paid")    return { ok: true, paymentIntentId: row.payment_id ?? "", settled: true };
  if (row.status === "pending") return { ok: true, paymentIntentId: row.payment_id ?? "", settled: false };
  if (row.status === "failed")  return { ok: false, error: "The charge for this period failed earlier.", noPaymentMethod: false };
  // "creating": claimed, but the run stopped before Mollie answered. Create it
  // again with the same idempotency key, Mollie returns the first payment.
  return "create";
}

export async function chargeMollieRenewal(
  client: SupabaseClient,
  input:  MollieRenewalInput,
  deps?:  MollieDeps,
): Promise<MollieRenewalResult> {
  const { tenantId, periodEnd } = input;
  const key = { tenant_id: tenantId, period_end: periodEnd };

  // What is owed is the price plus VAT. That total is what the row holds, what
  // Mollie is asked for and what the tenant pays later if this charge fails.
  const amounts     = await chargeAmounts(client, tenantId, input.amountCents);
  const amountCents = amounts.grossCents;

  // ── Claim the period ────────────────────────────────────────────────────────
  const { data: claimed, error: claimErr } = await client
    .from("mollie_renewals")
    .upsert(
      { ...key, amount_cents: amountCents, plan: input.plan, cycle: input.cycle, status: "creating" },
      { onConflict: "tenant_id,period_end", ignoreDuplicates: true },
    )
    .select("status");

  if (claimErr) {
    // Without the claim a second run could charge again. Do not charge.
    return { ok: false, error: `Could not claim the renewal: ${claimErr.message}`, noPaymentMethod: false };
  }
  if (!Array.isArray(claimed) || claimed.length === 0) {
    const { data: row } = await client.from("mollie_renewals").select("status, payment_id").match(key).maybeSingle();
    const known = row ? existingRenewal(row as RenewalRow) : "create";
    if (known !== "create") return known;
  }

  const fail = async (error: string, noPaymentMethod: boolean): Promise<MollieRenewalResult> => {
    await client.from("mollie_renewals").update({ status: "failed", problem: error.slice(0, 300), updated_at: new Date().toISOString() }).match(key);
    return { ok: false, error, noPaymentMethod, chargedCents: amountCents };
  };

  // ── The mandate ─────────────────────────────────────────────────────────────
  const source = await mollieReloadSource(client, tenantId, deps);
  if (!source) return fail("No Mollie mandate on file for this tenant.", true);

  // ── The charge ──────────────────────────────────────────────────────────────
  let payment: MolliePayment;
  try {
    payment = await createMolliePayment(
      {
        amountCents,
        description:    amounts.vatCents > 0 ? `${input.description}, incl. ${vatRateLabel(amounts.rateBp)} VAT` : input.description,
        sequenceType:   "recurring",
        customerId:     source.customerId,
        mandateId:      source.mandateId,
        webhookUrl:     mollieWebhookUrl(process.env["NEXT_PUBLIC_APP_URL"] ?? null),
        idempotencyKey: input.idempotencyKey,
        metadata: {
          type:         RENEWAL_PAYMENT_TYPE,
          tenant_id:    tenantId,
          period_end:   periodEnd,
          plan:         input.plan,
          amount_cents: String(amountCents),
          ...vatMetadata(amounts),
        },
      },
      deps,
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), false);
  }

  const status = String(payment.status);
  const mode   = payment.mode === "live" ? "live" : "test";

  // The record next to the other Mollie payments. Not what the webhook uses.
  await client.from("mollie_payments").insert({
    id: payment.id, ref: crypto.randomUUID(), tenant_id: tenantId, kind: RENEWAL_PAYMENT_TYPE,
    bundle_id: input.plan, amount_cents: amountCents, mode, status,
  });

  if (status === "failed" || status === "canceled" || status === "expired") {
    await client.from("mollie_renewals").update({ payment_id: payment.id }).match(key);
    return fail(`Payment status: ${status}`, false);
  }

  const settled = status === "paid";
  await client
    .from("mollie_renewals")
    .update({ payment_id: payment.id, status: settled ? "paid" : "pending", updated_at: new Date().toISOString(), ...(settled ? { settled_at: new Date().toISOString() } : {}) })
    .match(key);

  return { ok: true, paymentIntentId: payment.id, settled, chargedCents: amountCents };
}

/** The job moved the period on for this charge. Kept for the way back. */
export async function noteRenewalAdvanced(client: SupabaseClient, tenantId: string, periodEnd: string): Promise<void> {
  try {
    await client.from("mollie_renewals").update({ period_advanced: true }).match({ tenant_id: tenantId, period_end: periodEnd });
  } catch { /* the charge stands without the note */ }
}

// ── What Mollie reports later ─────────────────────────────────────────────────

/**
 * What a renewal payment's state means. Pure.
 *
 * "reversed" is a payment that was paid and then taken back by the payer's
 * bank: a direct debit can be reversed for weeks.
 */
export function renewalPaymentState(payment: MolliePayment): "paid" | "failed" | "reversed" | "waiting" {
  const status = String(payment.status);
  if ((centsFromMollieAmount(payment.amountChargedBack) ?? 0) > 0) return "reversed";
  if (status === "paid") return "paid";
  if (status === "failed" || status === "canceled" || status === "expired") return "failed";
  return "waiting";
}

export interface RenewalSettleDeps {
  /** Mark the tenant past due and send the reminder, as the job does on a failed charge. */
  startDunning: (client: SupabaseClient, tenantId: string, info: { plan: string; amountCents: number }) => Promise<void>;
}

async function defaultStartDunning(
  client: SupabaseClient, tenantId: string, info: { plan: string; amountCents: number },
): Promise<void> {
  const { markTenantPastDue, getTenantDunningSettings, sendDunningEmail } = await import("./dunning");
  const { BILLING_PLANS } = await import("./plans");
  await markTenantPastDue(client, tenantId);
  const settings = await getTenantDunningSettings(client, tenantId);
  const due      = new Date();
  await sendDunningEmail(client, tenantId, {
    planName:      BILLING_PLANS[info.plan as keyof typeof BILLING_PLANS]?.name ?? info.plan,
    amountCents:   info.amountCents,
    dueDate:       due.toISOString(),
    quarantineEnd: new Date(due.getTime() + settings.quarantine_days * 24 * 60 * 60 * 1000).toISOString(),
  });
}

/**
 * Bring a renewal in step with what Mollie reports.
 *
 * Paid: nothing more to do, the period moved on when the charge was accepted.
 * Failed or reversed: the tenant goes past due and gets the reminder, once.
 * The row's own status is the guard: only a row that was pending or paid can
 * turn into failed, so a repeated webhook starts the reminders once.
 */
export async function settleMollieRenewal(
  client:  SupabaseClient,
  payment: MolliePayment,
  deps?:   RenewalSettleDeps,
): Promise<MollieFulfilment> {
  const state = renewalPaymentState(payment);
  const done  = (s: "paid" | "failed" | "waiting" | "unknown"): MollieFulfilment =>
    ({ outcome: "renewal", state: s, status: String(payment.status) });
  if (state === "waiting") return done("waiting");

  const now = new Date().toISOString();

  if (state === "paid") {
    await client
      .from("mollie_renewals")
      .update({ status: "paid", settled_at: now, updated_at: now })
      .eq("payment_id", payment.id)
      .eq("status", "pending");
    return done("paid");
  }

  // Failed or reversed. Only the first report changes the row and comes back.
  const { data: turned, error } = await client
    .from("mollie_renewals")
    .update({ status: "failed", problem: state === "reversed" ? "reversed by the payer" : `payment ${payment.status}`, updated_at: now })
    .eq("payment_id", payment.id)
    .in("status", ["pending", "paid"])
    .select("tenant_id, plan, amount_cents");
  if (error) throw new Error(`mollie_renewals update failed: ${error.message}`);

  const row = Array.isArray(turned) ? turned[0] as { tenant_id: string; plan: string; amount_cents: number } | undefined : undefined;
  if (!row) return done("unknown");

  await (deps?.startDunning ?? defaultStartDunning)(client, row.tenant_id, { plan: row.plan, amountCents: row.amount_cents });
  return done("failed");
}

// ── The way back ──────────────────────────────────────────────────────────────

export interface OverdueAmount {
  amountCents: number;
  plan:        string;
  periodEnd:   string;
  /** False when the charge failed before the period moved on: paying must do that too. */
  periodAdvanced: boolean;
}

/**
 * What a past-due tenant owes: the newest renewal that failed. Null when
 * there is none, and then there is nothing this path can collect.
 */
export async function overdueAmount(client: SupabaseClient, tenantId: string): Promise<OverdueAmount | null> {
  const { data } = await client
    .from("mollie_renewals")
    .select("amount_cents, plan, period_end, period_advanced")
    .eq("tenant_id", tenantId)
    .eq("status", "failed")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as { amount_cents: number; plan: string; period_end: string; period_advanced: boolean | null };
  return { amountCents: row.amount_cents, plan: row.plan, periodEnd: row.period_end, periodAdvanced: row.period_advanced === true };
}

export interface OverdueSettleDeps {
  renewPeriod:  (client: SupabaseClient, tenantId: string) => Promise<{ ok: boolean }>;
  clearDunning: (client: SupabaseClient, tenantId: string) => Promise<void>;
}

/**
 * The tenant paid the open amount themselves.
 *
 * The failed renewal becomes paid, the period moves on if it had not yet, and
 * the reminders stop: the subscription is active again. Claimed on the row's
 * status, so the webhook and the return together do this once.
 */
export async function settleMollieOverduePayment(
  client:  SupabaseClient,
  payment: MolliePayment,
  deps?:   OverdueSettleDeps,
): Promise<MollieFulfilment> {
  const status = String(payment.status);
  const done   = (s: "paid" | "failed" | "waiting" | "unknown"): MollieFulfilment => ({ outcome: "renewal", state: s, status });
  if (status === "open" || status === "pending" || status === "authorized") return done("waiting");
  if (status !== "paid") return done("failed");

  const meta      = payment.metadata ?? {};
  const tenantId  = typeof meta["tenant_id"]  === "string" ? meta["tenant_id"]  : "";
  const periodEnd = typeof meta["period_end"] === "string" ? meta["period_end"] : "";
  const asked     = Number.parseInt(typeof meta["amount_cents"] === "string" ? meta["amount_cents"] : "", 10);
  if (!tenantId || !periodEnd || centsFromMollieAmount(payment.amount) !== asked) return done("unknown");

  const now = new Date().toISOString();
  const { data: turned, error } = await client
    .from("mollie_renewals")
    .update({ status: "paid", payment_id: payment.id, problem: null, settled_at: now, updated_at: now })
    .match({ tenant_id: tenantId, period_end: periodEnd })
    .eq("status", "failed")
    .select("period_advanced");
  if (error) throw new Error(`mollie_renewals update failed: ${error.message}`);

  const row = Array.isArray(turned) ? turned[0] as { period_advanced: boolean | null } | undefined : undefined;
  if (!row) return done("unknown");   // already settled by the other road

  let d = deps;
  if (!d) {
    const { renewSubscriptionPeriod } = await import("./subscriptions");
    const { clearTenantDunning }      = await import("./dunning");
    d = { renewPeriod: (c, t) => renewSubscriptionPeriod(c, t, { force: true }), clearDunning: clearTenantDunning };
  }
  if (row.period_advanced !== true) {
    await d.renewPeriod(client, tenantId);
    await client.from("mollie_renewals").update({ period_advanced: true }).match({ tenant_id: tenantId, period_end: periodEnd });
  }
  await d.clearDunning(client, tenantId);
  return done("paid");
}
