/**
 * What a paid Mollie payment delivers.
 *
 * Two roads lead here for the same payment: Mollie's webhook and the browser
 * coming back from the checkout. Either can be first, either can be missing
 * (a closed tab, a webhook that cannot reach localhost) and both can come
 * twice. So the delivery is claimed once per payment id, with the same claim
 * the Stripe checkout uses (checkout-credit-claim.ts): the first road credits,
 * every later one is told it was done.
 *
 * The payment that is passed in must have been read from Mollie with the
 * platform's own key. Its status, amount and metadata are then facts: the
 * metadata was written by the platform when it created the payment and the
 * customer cannot change it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { centsFromMollieAmount, type MolliePayment } from "./mollie";
import { CREDIT_BUNDLES, SESSION_CREDIT_BUNDLES } from "./plans";

export type MolliePurchaseKind = "session_bundle" | "credit_bundle" | "wallet_top_up";

export const MOLLIE_PURCHASE_KINDS: readonly MolliePurchaseKind[] =
  ["session_bundle", "credit_bundle", "wallet_top_up"];

export type MolliePlan =
  /** Paid, and this is what to deliver. */
  | { action: "credit"; kind: "session_bundle"; tenantId: string; bundleId: string; sessions: number; label: string; amountCents: number }
  | { action: "credit"; kind: "credit_bundle";  tenantId: string; bundleId: string; credits:  number; label: string; amountCents: number }
  | { action: "credit"; kind: "wallet_top_up";  tenantId: string; amountCents: number }
  /** Not paid yet, but it still can be (open, pending, authorized). */
  | { action: "wait";   status: string }
  /** Ended without money: cancelled, expired or failed. */
  | { action: "none";   status: string }
  /** Paid, but not something this code may deliver. Logged, never credited. */
  | { action: "refuse"; reason: string };

function metaString(payment: MolliePayment, key: string): string {
  const value = payment.metadata?.[key];
  return typeof value === "string" ? value : "";
}

/**
 * Decide what a payment delivers. Pure, so every refusal is testable.
 */
export function planMolliePayment(payment: MolliePayment): MolliePlan {
  const status = String(payment.status);
  if (status === "open" || status === "pending" || status === "authorized") {
    return { action: "wait", status };
  }
  if (status !== "paid") return { action: "none", status };

  const paidCents = centsFromMollieAmount(payment.amount);
  if (paidCents === null || paidCents <= 0) return { action: "refuse", reason: "amount_unreadable" };

  // Money that has already gone back is not delivered on a late webhook.
  const refunded    = centsFromMollieAmount(payment.amountRefunded)    ?? 0;
  const chargedBack = centsFromMollieAmount(payment.amountChargedBack) ?? 0;
  if (refunded > 0 || chargedBack > 0) return { action: "refuse", reason: "refunded_or_charged_back" };

  const kind     = metaString(payment, "type");
  const tenantId = metaString(payment, "tenant_id");
  if (!tenantId) return { action: "refuse", reason: "no_tenant" };

  // The amount the platform asked for travels in the metadata. A payment for
  // any other amount is not the one that was created here.
  const askedCents = Number.parseInt(metaString(payment, "amount_cents"), 10);
  if (!Number.isInteger(askedCents) || askedCents !== paidCents) {
    return { action: "refuse", reason: "amount_mismatch" };
  }

  if (kind === "session_bundle") {
    const bundleId = metaString(payment, "bundle_id");
    const bundle   = SESSION_CREDIT_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return { action: "refuse", reason: "unknown_bundle" };
    return { action: "credit", kind, tenantId, bundleId, sessions: bundle.sessions, label: bundle.label, amountCents: paidCents };
  }
  if (kind === "credit_bundle") {
    const bundleId = metaString(payment, "bundle_id");
    const bundle   = CREDIT_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) return { action: "refuse", reason: "unknown_bundle" };
    return { action: "credit", kind, tenantId, bundleId, credits: bundle.credits, label: bundle.label, amountCents: paidCents };
  }
  if (kind === "wallet_top_up") {
    return { action: "credit", kind, tenantId, amountCents: paidCents };
  }
  return { action: "refuse", reason: "unknown_kind" };
}

export type MollieFulfilment =
  | { outcome: "credited" | "already-credited"; kind: MolliePurchaseKind; tenantId: string; bundleId: string | null }
  | { outcome: "waiting";  status: string }
  | { outcome: "not-paid"; status: string }
  | { outcome: "refused";  reason: string }
  /** A charge on a mandate for the automatic top-up (mollie-auto-reload.ts). */
  | { outcome: "auto-reload"; state: "succeeded" | "failed" | "waiting"; status: string };

export interface MollieFulfilDeps {
  /** checkout-credit-claim.ts: runs `credit` once per payment id. */
  creditOnce: (
    client: SupabaseClient, paymentId: string, tenantId: string, livemode: boolean, kind: string,
    credit: () => Promise<unknown>,
  ) => Promise<"credited" | "already-credited">;
  addSessionCredits: (client: SupabaseClient, tenantId: string, sessions: number, bundleId: string, paymentId: string, note: string) => Promise<void>;
  addCredits:        (client: SupabaseClient, tenantId: string, credits: number, bundleId: string, paymentId: string, description: string) => Promise<void>;
  creditWallet:      (client: SupabaseClient, tenantId: string, amountCents: number, paymentId: string, note: string) => Promise<void>;
}

async function defaultDeps(): Promise<MollieFulfilDeps> {
  const [{ creditCheckoutSessionOnce }, { addCredits }, { creditWallet }] = await Promise.all([
    import("./checkout-credit-claim"),
    import("./usage"),
    import("./wallet"),
  ]);
  return {
    creditOnce: creditCheckoutSessionOnce,
    addSessionCredits: async (client, tenantId, sessions, bundleId, paymentId, note) => {
      // The RPC reports a failure in its answer instead of throwing. It must
      // throw here, or the claim would stand on a delivery that did not happen.
      const { error } = await client.rpc("add_session_credits", {
        p_tenant_id: tenantId,
        p_amount:    sessions,
        p_bundle_id: bundleId,
        p_stripe_id: paymentId,   // the column predates Mollie: it holds the payment reference
        p_note:      note,
      });
      if (error) throw new Error(`add_session_credits failed: ${error.message}`);
    },
    addCredits: async (client, tenantId, credits, bundleId, paymentId, description) => {
      await addCredits(client, tenantId, credits, "purchase", { stripeEventId: paymentId, bundleId, description });
    },
    creditWallet: async (client, tenantId, amountCents, paymentId, note) => {
      await creditWallet(client, tenantId, amountCents, "top_up_manual", "mollie_payment", paymentId, note);
    },
  };
}

/**
 * Deliver a payment, once. Throws when the delivery itself fails, so the
 * webhook answers with an error and Mollie tries again later.
 */
export async function fulfilMolliePayment(
  client:  SupabaseClient,
  payment: MolliePayment,
  deps?:   MollieFulfilDeps,
): Promise<MollieFulfilment> {
  const plan = planMolliePayment(payment);
  if (plan.action === "wait")   return { outcome: "waiting",  status: plan.status };
  if (plan.action === "none")   return { outcome: "not-paid", status: plan.status };
  if (plan.action === "refuse") return { outcome: "refused",  reason: plan.reason };

  const d        = deps ?? await defaultDeps();
  const livemode = payment.mode === "live";
  const mode     = livemode ? "live" : "test";

  const outcome = await d.creditOnce(client, payment.id, plan.tenantId, livemode, plan.kind, async () => {
    if (plan.kind === "session_bundle") {
      await d.addSessionCredits(client, plan.tenantId, plan.sessions, plan.bundleId, payment.id,
        `${plan.label}, Mollie payment ${payment.id}`);
    } else if (plan.kind === "credit_bundle") {
      await d.addCredits(client, plan.tenantId, plan.credits, plan.bundleId, payment.id,
        `Purchased ${plan.label}`);
    } else {
      await d.creditWallet(client, plan.tenantId, plan.amountCents, payment.id,
        `Manual top-up via Mollie (${mode})`);
    }
  });

  return {
    outcome,
    kind:     plan.kind,
    tenantId: plan.tenantId,
    bundleId: plan.kind === "wallet_top_up" ? null : plan.bundleId,
  };
}
