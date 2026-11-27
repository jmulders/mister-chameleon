/**
 * Start a one-time purchase at Mollie, and settle it when the customer returns.
 *
 * Mollie's return address cannot carry the payment id: the id exists only
 * after the payment is created, and the address is part of creating it. So
 * the platform makes its own reference first, puts that in the address, and
 * keeps the pair (reference, payment id) in `mollie_payments`. On return the
 * reference finds the payment, and the payment is read back from Mollie.
 *
 * The row is also the record of what was started: a payment the customer
 * abandoned stays visible as "open" or "expired" instead of vanishing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMolliePayment,
  getMolliePayment,
  mollieWebhookUrl,
  type MollieDeps,
  type MolliePayment,
} from "./mollie";
import {
  fulfilMolliePayment,
  type MollieFulfilDeps,
  type MollieFulfilment,
  type MolliePurchaseKind,
} from "./mollie-fulfil";
import { rememberMollieMandate } from "./mollie-customer";
import { AUTO_RELOAD_PAYMENT_TYPE, settleMollieAutoReload, type AutoReloadSettleDeps } from "./mollie-auto-reload";
import { TRIAL_SIGNUP_PAYMENT_TYPE, settleMollieTrialSignup, type TrialSettleDeps } from "./mollie-trial";
import {
  OVERDUE_PAYMENT_TYPE,
  RENEWAL_PAYMENT_TYPE,
  settleMollieOverduePayment,
  settleMollieRenewal,
  type OverdueSettleDeps,
  type RenewalSettleDeps,
} from "./mollie-renewal";
import { PAYMENT_METHOD_PAYMENT_TYPE, paymentMethodOutcome } from "./mollie-payment-method";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMollieRef(ref: unknown): ref is string {
  return typeof ref === "string" && UUID.test(ref);
}

/** The billing page of a tenant, with the reference the return needs. */
export function mollieReturnUrl(origin: string, tenantId: string, ref: string): string {
  return `${origin}/admin/tenants/${encodeURIComponent(tenantId)}/billing?mollie=return&ref=${ref}`;
}

/**
 * Where the customer ends up after the return was settled: the address the
 * billing page already understands, so the existing banners show. Pure.
 */
export function mollieResultQuery(result: MollieFulfilment, kind: MolliePurchaseKind | null, bundleId: string | null): string {
  if (result.outcome === "waiting") return "mollie=pending";
  if (result.outcome === "refused") return "mollie=problem";
  // A charge on a mandate has no return: the tenant was never at a checkout.
  if (result.outcome === "auto-reload") return "mollie=pending";
  // A trial signup returns to /checkout/success, not to the billing page.
  if (result.outcome === "trial-signup") return "mollie=pending";
  // The tenant verified a new payment method.
  if (result.outcome === "payment-method") {
    if (result.state === "updated")    return "mollie=method";
    if (result.state === "waiting")    return "mollie=pending";
    if (result.state === "no-mandate") return "mollie=problem";
    return "bundle=cancelled";
  }
  // The tenant paid an open subscription amount and came back to the billing page.
  if (result.outcome === "renewal") {
    if (result.state === "paid")    return "mollie=restored";
    if (result.state === "waiting") return "mollie=pending";
    // "unknown" is the other road having settled it already: also restored.
    return result.state === "unknown" ? "mollie=restored" : "bundle=cancelled";
  }
  const done  = result.outcome === "credited" || result.outcome === "already-credited";
  const k     = done ? result.kind : kind;
  const id    = done ? result.bundleId : bundleId;
  const state = done ? "success" : "cancelled";
  if (k === "session_bundle") {
    return `session_bundle=${state}${done && id ? `&bundle_id=${encodeURIComponent(id)}` : ""}`;
  }
  // AI credit bundles and the wallet top-up share the wallet banner.
  return `bundle=${state}${done && id ? `&bundle_id=${encodeURIComponent(id)}` : ""}`;
}

export interface StartMollieCheckoutInput {
  tenantId:    string;
  /** A purchase kind, the payment of an open subscription amount, or the verification of a payment method. */
  kind:        MolliePurchaseKind | typeof OVERDUE_PAYMENT_TYPE | typeof PAYMENT_METHOD_PAYMENT_TYPE;
  /** Bundle id for the two bundle kinds, null for a wallet top-up. */
  bundleId:    string | null;
  amountCents: number;
  description: string;
  /** Where the browser is: the return address is built on it. */
  origin:      string;
  /**
   * The public address of the site for the webhook. The request's own origin
   * is used when this is not set.
   */
  publicBaseUrl?: string | null;
  /**
   * Makes this a "first" payment for the given Mollie customer: the tenant
   * pays now and thereby authorises later charges (the automatic top-up).
   * The checkout must have told the tenant so before it gets here.
   */
  firstForCustomerId?: string;
  /** More for the payment's metadata, for the kind that needs it. */
  extraMetadata?: Record<string, string>;
}

export interface StartMollieCheckoutDeps {
  mollie?: MollieDeps;
  newRef?: () => string;
}

export async function startMollieCheckout(
  client: SupabaseClient,
  input:  StartMollieCheckoutInput,
  deps?:  StartMollieCheckoutDeps,
): Promise<{ url: string; paymentId: string; ref: string }> {
  const ref = (deps?.newRef ?? (() => crypto.randomUUID()))();

  const payment = await createMolliePayment(
    {
      amountCents:    input.amountCents,
      description:    input.description,
      redirectUrl:    mollieReturnUrl(input.origin, input.tenantId, ref),
      webhookUrl:     mollieWebhookUrl(input.publicBaseUrl || input.origin),
      idempotencyKey: ref,
      ...(input.firstForCustomerId
        ? { sequenceType: "first" as const, customerId: input.firstForCustomerId }
        : {}),
      metadata: {
        type:         input.kind,
        tenant_id:    input.tenantId,
        amount_cents: String(input.amountCents),
        ref,
        ...(input.bundleId ? { bundle_id: input.bundleId } : {}),
        ...(input.extraMetadata ?? {}),
      },
    },
    deps?.mollie,
  );

  const url = payment._links?.checkout?.href;
  if (!url) throw new Error("Mollie returned no checkout address");

  // Without this row the return page cannot find the payment. The webhook
  // still delivers it, so a failed insert is logged and the customer goes on.
  const { error } = await client.from("mollie_payments").insert({
    id:           payment.id,
    ref,
    tenant_id:    input.tenantId,
    kind:         input.kind,
    bundle_id:    input.bundleId,
    amount_cents: input.amountCents,
    mode:         payment.mode === "live" ? "live" : "test",
    status:       String(payment.status),
  });
  if (error) {
    console.error("[billing/mollie] could not record the payment", { paymentId: payment.id, error: error.message });
  }

  return { url, paymentId: payment.id, ref };
}

/** Keep the row in step with what Mollie says. Never throws. */
export async function noteMolliePayment(
  client:  SupabaseClient,
  payment: MolliePayment,
  result:  MollieFulfilment,
): Promise<void> {
  try {
    const credited = result.outcome === "credited" || result.outcome === "already-credited";
    await client
      .from("mollie_payments")
      .update({
        status:     String(payment.status),
        updated_at: new Date().toISOString(),
        ...(result.outcome === "credited" ? { credited_at: new Date().toISOString() } : {}),
        ...(result.outcome === "refused"  ? { problem: result.reason } : credited ? { problem: null } : {}),
      })
      .eq("id", payment.id);
  } catch (err) {
    console.error("[billing/mollie] could not update the payment row", { paymentId: payment.id, err });
  }
}

export interface SettleDeps {
  mollie?:     MollieDeps;
  fulfil?:     MollieFulfilDeps;
  autoReload?: AutoReloadSettleDeps;
  trial?:      TrialSettleDeps;
  renewal?:    RenewalSettleDeps;
  overdue?:    OverdueSettleDeps;
}

/**
 * Read a payment back from Mollie and deliver it when it is paid. Shared by
 * the webhook and the return page.
 */
export async function settleMolliePayment(
  client:    SupabaseClient,
  paymentId: string,
  deps?:     SettleDeps,
): Promise<{ payment: MolliePayment; result: MollieFulfilment }> {
  const payment = await getMolliePayment(paymentId, deps?.mollie);
  const type    = payment.metadata?.["type"];

  // The subscription: a period the renewal job charged on the mandate, or an
  // open amount the tenant paid themselves. Neither credits anything, both
  // move the subscription (mollie-renewal.ts).
  if (type === RENEWAL_PAYMENT_TYPE) {
    const result = await settleMollieRenewal(client, payment, deps?.renewal);
    await noteMolliePayment(client, payment, result);
    return { payment, result };
  }
  if (type === OVERDUE_PAYMENT_TYPE) {
    const result = await settleMollieOverduePayment(client, payment, deps?.overdue);
    // Paying it was a first payment: it also gave a fresh mandate.
    await rememberMollieMandate(client, payment);
    await noteMolliePayment(client, payment, result);
    return { payment, result };
  }

  // A new payment method: nothing is delivered, the mandate is the point.
  if (type === PAYMENT_METHOD_PAYMENT_TYPE) {
    const stored = await rememberMollieMandate(client, payment);
    const result = paymentMethodOutcome(payment, stored);
    await noteMolliePayment(client, payment, result);
    return { payment, result };
  }

  // A charge on a mandate (the automatic top-up) has its own bookkeeping: the
  // reload attempt, credited in one transaction with its status.
  if (payment.metadata?.["type"] === AUTO_RELOAD_PAYMENT_TYPE) {
    const result = await settleMollieAutoReload(client, payment, deps?.autoReload);
    await noteMolliePayment(client, payment, result);
    return { payment, result };
  }

  // The verification payment of a trial signup makes a tenant, not a credit.
  // It stores its own mandate, under the tenant it has just created.
  if (payment.metadata?.["type"] === TRIAL_SIGNUP_PAYMENT_TYPE) {
    const result = await settleMollieTrialSignup(client, payment, deps?.trial);
    await noteMolliePayment(client, payment, result);
    return { payment, result };
  }

  const result = await fulfilMolliePayment(client, payment, deps?.fulfil);
  // A paid first payment also gave a mandate. Kept after the delivery, and
  // on every road here: the webhook and the return both may be the first.
  await rememberMollieMandate(client, payment);
  await noteMolliePayment(client, payment, result);
  return { payment, result };
}

/**
 * The customer is back from Mollie. Returns the query string to continue
 * with, or null when the reference is not one of this tenant's payments.
 */
export async function settleMollieReturn(
  client:   SupabaseClient,
  tenantId: string,
  ref:      string,
  deps?:    SettleDeps,
): Promise<string | null> {
  if (!isMollieRef(ref)) return null;

  const { data: row } = await client
    .from("mollie_payments")
    .select("id, kind, bundle_id")
    .eq("ref", ref)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!row) return null;

  const kind     = row.kind as MolliePurchaseKind;
  const bundleId = (row.bundle_id as string | null) ?? null;
  const { result } = await settleMolliePayment(client, row.id as string, deps);

  // The payment must be this tenant's own: the row says so, and the payment's
  // metadata has to agree before anything is shown as delivered.
  if ((result.outcome === "credited" || result.outcome === "already-credited") && result.tenantId !== tenantId) {
    return "mollie=problem";
  }
  return mollieResultQuery(result, kind, bundleId);
}
