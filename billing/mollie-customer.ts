/**
 * The Mollie customer of a tenant, and its mandate.
 *
 * A mandate is the tenant's standing permission to be charged while they are
 * not there. It exists for one reason at this step: the automatic wallet
 * top-up. It comes into being when the tenant pays a "first" payment, which
 * the checkout presents as exactly that: pay now, and allow later top-ups.
 *
 * The platform stores the two ids and nothing else. Whether a mandate is still
 * good is Mollie's to say: a charge on a revoked or expired mandate fails
 * there, and the reload attempt is then marked failed and the tenant told.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createMollieCustomer,
  getMollieApiKey,
  isMollieCustomerId,
  isMollieMandateId,
  mollieModeFromKey,
  type MollieDeps,
  type MollieMode,
  type MolliePayment,
} from "./mollie";

export interface MollieCustomerRow {
  tenant_id:      string;
  mode:           MollieMode;
  customer_id:    string;
  mandate_id:     string | null;
  mandate_method: string | null;
  mandate_since:  string | null;
}

/** The mode of the configured key, or of the key the caller injects. */
export function currentMollieMode(deps?: MollieDeps): MollieMode | null {
  return mollieModeFromKey(deps?.apiKey ?? getMollieApiKey());
}

export async function getMollieCustomerRow(
  client:   SupabaseClient,
  tenantId: string,
  mode:     MollieMode,
): Promise<MollieCustomerRow | null> {
  const { data, error } = await client
    .from("mollie_customers")
    .select("tenant_id, mode, customer_id, mandate_id, mandate_method, mandate_since")
    .eq("tenant_id", tenantId)
    .eq("mode", mode)
    .maybeSingle();
  if (error) throw new Error(`mollie_customers read failed: ${error.message}`);
  return (data as MollieCustomerRow | null) ?? null;
}

/**
 * What the platform may charge without the tenant present, or null. Pure.
 */
export function usableMandate(
  row: Pick<MollieCustomerRow, "customer_id" | "mandate_id"> | null | undefined,
): { customerId: string; mandateId: string } | null {
  if (!row || !isMollieCustomerId(row.customer_id) || !isMollieMandateId(row.mandate_id)) return null;
  return { customerId: row.customer_id, mandateId: row.mandate_id };
}

/**
 * The tenant's Mollie customer, created the first time it is needed.
 *
 * Two requests at once can both find no row and both create a customer. The
 * insert of the second one is refused by the primary key; it then reads the
 * row that won. The spare customer at Mollie holds nothing and charges nothing.
 */
export async function ensureMollieCustomer(
  client:   SupabaseClient,
  tenantId: string,
  contact:  { name?: string | null; email?: string | null },
  deps?:    MollieDeps,
): Promise<string> {
  const mode = currentMollieMode(deps);
  if (!mode) throw new Error("Mollie is not configured. Set MOLLIE_API_KEY.");

  const existing = await getMollieCustomerRow(client, tenantId, mode);
  if (existing && isMollieCustomerId(existing.customer_id)) return existing.customer_id;

  const customer = await createMollieCustomer(
    { name: contact.name ?? tenantId, email: contact.email ?? null, metadata: { tenant_id: tenantId } },
    deps,
  );

  const { error } = await client
    .from("mollie_customers")
    .insert({ tenant_id: tenantId, mode, customer_id: customer.id });
  if (error) {
    const winner = await getMollieCustomerRow(client, tenantId, mode);
    if (winner && isMollieCustomerId(winner.customer_id)) return winner.customer_id;
    throw new Error(`mollie_customers insert failed: ${error.message}`);
  }
  return customer.id;
}

/**
 * Whether a payment gave a mandate, and to whom. Pure.
 *
 * Only a PAID FIRST payment does, and only one that names its tenant in the
 * metadata the platform wrote when it created the payment.
 */
export function mandateFromPayment(
  payment: MolliePayment,
): { tenantId: string; customerId: string; mandateId: string; method: string | null; mode: MollieMode } | null {
  if (payment.status !== "paid" || payment.sequenceType !== "first") return null;
  if (!isMollieCustomerId(payment.customerId) || !isMollieMandateId(payment.mandateId)) return null;
  const tenantId = payment.metadata?.["tenant_id"];
  if (typeof tenantId !== "string" || tenantId === "") return null;
  return {
    tenantId,
    customerId: payment.customerId,
    mandateId:  payment.mandateId,
    method:     typeof payment.method === "string" ? payment.method : null,
    mode:       payment.mode === "live" ? "live" : "test",
  };
}

/**
 * Keep the mandate a paid first payment gave. Never throws: the payment
 * itself has been delivered, and a later first payment can give a mandate
 * again.
 *
 * The row is matched on tenant AND customer: a payment only ever sets the
 * mandate of the customer it was made for.
 */
export async function rememberMollieMandate(
  client:  SupabaseClient,
  payment: MolliePayment,
): Promise<boolean> {
  const mandate = mandateFromPayment(payment);
  if (!mandate) return false;
  try {
    const { data, error } = await client
      .from("mollie_customers")
      .update({
        mandate_id:     mandate.mandateId,
        mandate_method: mandate.method,
        mandate_since:  new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      })
      .eq("tenant_id", mandate.tenantId)
      .eq("mode", mandate.mode)
      .eq("customer_id", mandate.customerId)
      .select("tenant_id");
    if (error) {
      console.error("[billing/mollie] could not store the mandate", { paymentId: payment.id, error: error.message });
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error("[billing/mollie] could not store the mandate", { paymentId: payment.id, err });
    return false;
  }
}
