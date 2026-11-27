/**
 * The automatic wallet top-up, charged on a Mollie mandate.
 *
 * The rules of the top-up are not here. When it fires, the monthly cap, the
 * one-attempt-at-a-time guarantee and the credit in one transaction with the
 * attempt's status all stay in auto-reload.ts and wallet-reload-attempts.ts,
 * as they are for Stripe. This file is only the two places where the provider
 * shows: making the charge, and reading its outcome.
 *
 * How it differs from a card charge at Stripe
 *
 *   A mandate given through iDEAL is a SEPA direct debit. Such a charge is
 *   not paid at once: it stays "pending" for some working days before the
 *   bank confirms it. The wallet is credited when Mollie reports "paid", never
 *   earlier, so the top-up lands days after it was triggered. Until then the
 *   attempt stays open and no second one starts. A mandate given by card is
 *   charged at once.
 *
 *   A direct debit can also be reversed by the payer for weeks afterwards.
 *   That reversal is not processed here yet.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createMolliePayment, mollieWebhookUrl, type MollieDeps, type MolliePayment } from "./mollie";
import { currentMollieMode, getMollieCustomerRow, usableMandate } from "./mollie-customer";
import type { MollieFulfilment } from "./mollie-fulfil";
import { chargeAmounts, vatMetadata } from "./billing-details";
import { vatRateLabel } from "./vat";

/** `metadata.type` of a charge made for the automatic top-up. */
export const AUTO_RELOAD_PAYMENT_TYPE = "wallet_auto_reload";

/** What auto-reload.ts needs from a provider to make the charge. */
export interface ReloadCharge {
  /** The provider's payment id, stored on the attempt so the webhook finds it. */
  id:        string;
  status:    string;
  /** True when the money is already in: the wallet can be credited at once. */
  succeeded: boolean;
}

export interface MollieReloadSource {
  customerId: string;
  mandateId:  string;
}

/**
 * The mandate the tenant gave, or null when there is none for the mode of
 * the configured key. Never throws: no mandate and a failed read both mean
 * "do not charge".
 */
export async function mollieReloadSource(
  client:   SupabaseClient,
  tenantId: string,
  deps?:    MollieDeps,
): Promise<MollieReloadSource | null> {
  try {
    const mode = currentMollieMode(deps);
    if (!mode) return null;
    return usableMandate(await getMollieCustomerRow(client, tenantId, mode));
  } catch (err) {
    console.error("[billing/mollie-auto-reload] could not read the mandate", { tenantId, err });
    return null;
  }
}

/**
 * Charge the mandate for one top-up.
 *
 * The idempotency key is the attempt's own: a retried request returns the
 * first payment instead of charging twice.
 */
export async function chargeMollieReload(
  client: SupabaseClient,
  input: {
    tenantId:       string;
    attemptId:      string;
    /** The top-up itself, exclusive of VAT: what the wallet will get. */
    amountCents:    number;
    idempotencyKey: string;
    source:         MollieReloadSource;
  },
  deps?: MollieDeps,
): Promise<ReloadCharge> {
  const publicBaseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? null;
  // The mandate is charged the top-up plus VAT. The wallet is credited the
  // top-up itself: that amount is on the reload attempt, not on the payment.
  const amounts = await chargeAmounts(client, input.tenantId, input.amountCents);
  const payment = await createMolliePayment(
    {
      amountCents:    amounts.grossCents,
      description:    `Mister Chameleon: automatic wallet top-up €${(input.amountCents / 100).toFixed(2)}` +
                      (amounts.vatCents > 0 ? ` plus ${vatRateLabel(amounts.rateBp)} VAT` : ""),
      sequenceType:   "recurring",
      customerId:     input.source.customerId,
      mandateId:      input.source.mandateId,
      webhookUrl:     mollieWebhookUrl(publicBaseUrl),
      idempotencyKey: input.idempotencyKey,
      metadata: {
        type:              AUTO_RELOAD_PAYMENT_TYPE,
        tenant_id:         input.tenantId,
        reload_attempt_id: input.attemptId,
        amount_cents:      String(amounts.grossCents),
        ...vatMetadata(amounts),
      },
    },
    deps,
  );

  // The record of what was started, next to the one-time payments. A failed
  // insert does not undo the charge: the attempt row is what the webhook uses.
  const { error } = await client.from("mollie_payments").insert({
    id:           payment.id,
    ref:          crypto.randomUUID(),
    tenant_id:    input.tenantId,
    kind:         AUTO_RELOAD_PAYMENT_TYPE,
    bundle_id:    null,
    amount_cents: amounts.grossCents,
    mode:         payment.mode === "live" ? "live" : "test",
    status:       String(payment.status),
  });
  if (error) {
    console.error("[billing/mollie-auto-reload] could not record the payment", { paymentId: payment.id, error: error.message });
  }

  return { id: payment.id, status: String(payment.status), succeeded: payment.status === "paid" };
}

export interface AutoReloadSettleDeps {
  onSuccess: (client: SupabaseClient, paymentId: string) => Promise<void>;
  onFailure: (client: SupabaseClient, paymentId: string, reason: string) => Promise<void>;
}

/** What a payment's status means for its reload attempt. Pure. */
export function autoReloadState(status: string): "succeeded" | "failed" | "waiting" {
  if (status === "paid") return "succeeded";
  if (status === "failed" || status === "canceled" || status === "expired") return "failed";
  return "waiting";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Make sure the attempt knows its payment. Normally it does: the id is
 * written right after the charge. If that write failed, the payment's own
 * metadata still names the attempt, and this puts the id on it. Only an
 * attempt that is still pending and has no payment yet is touched.
 */
async function adoptReloadAttempt(client: SupabaseClient, payment: MolliePayment): Promise<void> {
  const attemptId = payment.metadata?.["reload_attempt_id"];
  if (typeof attemptId !== "string" || !UUID.test(attemptId)) return;
  try {
    await client
      .from("wallet_reload_attempts")
      .update({ status: "processing", stripe_payment_intent_id: payment.id })
      .eq("id", attemptId)
      .eq("status", "pending")
      .is("stripe_payment_intent_id", null);
  } catch (err) {
    console.error("[billing/mollie-auto-reload] could not adopt the attempt", { paymentId: payment.id, err });
  }
}

/**
 * Bring the reload attempt in step with the payment Mollie reports. Both
 * handlers are idempotent on the attempt's status, so a repeated webhook
 * credits once.
 */
export async function settleMollieAutoReload(
  client:  SupabaseClient,
  payment: MolliePayment,
  deps?:   AutoReloadSettleDeps,
): Promise<MollieFulfilment> {
  const status = String(payment.status);
  const state  = autoReloadState(status);

  if (state !== "waiting") {
    let handlers = deps;
    if (!handlers) {
      const { handleAutoReloadSuccess, handleAutoReloadFailure } = await import("./auto-reload");
      handlers = {
        onSuccess: handleAutoReloadSuccess,
        onFailure: (c, id, reason) => handleAutoReloadFailure(c, id, reason),
      };
    }
    if (!deps) await adoptReloadAttempt(client, payment);
    if (state === "succeeded") await handlers.onSuccess(client, payment.id);
    else                       await handlers.onFailure(client, payment.id, `Mollie payment ${status}`);
  }
  return { outcome: "auto-reload", state, status };
}
