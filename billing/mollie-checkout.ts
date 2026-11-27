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
  kind:        MolliePurchaseKind;
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
      metadata: {
        type:         input.kind,
        tenant_id:    input.tenantId,
        amount_cents: String(input.amountCents),
        ref,
        ...(input.bundleId ? { bundle_id: input.bundleId } : {}),
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
  mollie?: MollieDeps;
  fulfil?: MollieFulfilDeps;
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
  const result  = await fulfilMolliePayment(client, payment, deps?.fulfil);
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
