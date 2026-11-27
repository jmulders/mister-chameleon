/**
 * Which invoice a Mollie payment gets, and what it says.
 *
 * invoices.ts knows how to issue an invoice. This file knows what each kind
 * of charge is called on one, in Dutch because it is printed, and where the
 * amounts come from: the VAT metadata the platform wrote on the payment when
 * it created it. A payment without usable VAT metadata gets no invoice here,
 * and says so in the log: an invoice is not guessed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MolliePayment } from "./mollie";
import type { MolliePurchaseKind } from "./mollie-fulfil";
import { CREDIT_BUNDLES, SESSION_CREDIT_BUNDLES, BILLING_PLANS } from "./plans";
import { amountsFromPayment, issueInvoice, paymentReference } from "./invoices";
import { dutchDate } from "./invoice-pdf";

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** What a purchase at the checkout is called on its invoice. Pure. */
export function purchaseDescription(kind: MolliePurchaseKind, bundleId: string | null): string {
  if (kind === "session_bundle") {
    const bundle = SESSION_CREDIT_BUNDLES.find((b) => b.id === bundleId);
    return bundle ? `Bundel ${thousands(bundle.sessions)} extra gepersonaliseerde bezoeken` : "Bundel extra gepersonaliseerde bezoeken";
  }
  if (kind === "credit_bundle") {
    const bundle = CREDIT_BUNDLES.find((b) => b.id === bundleId);
    return bundle ? `Bundel ${thousands(bundle.credits)} credits` : "Bundel credits";
  }
  return "Opwaardering tegoed";
}

/** The name of a plan as it is sold. */
export function planName(planId: string): string {
  return BILLING_PLANS[planId as keyof typeof BILLING_PLANS]?.name ?? planId;
}

/**
 * What a subscription period is called on its invoice. Pure.
 *
 * `periodStart` is where the new period begins, which is where the old one
 * ended. The last day named is the day before the next period starts.
 */
export function renewalDescription(planId: string, periodStart: string, cycle: "monthly" | "annual"): string {
  const start = new Date(periodStart);
  const end   = new Date(start);
  if (cycle === "annual") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else                    end.setUTCMonth(end.getUTCMonth() + 1);
  const last = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `Abonnement ${planName(planId)}, periode ${dutchDate(start.toISOString())} tot en met ${dutchDate(last.toISOString())}`;
}

export function upgradeDescription(planId: string): string {
  return `Upgrade naar ${planName(planId)}, rest van de lopende periode`;
}

/** The invoice of a purchase that was paid at the checkout. Never throws. */
export async function invoicePurchase(
  client:  SupabaseClient,
  payment: MolliePayment,
  what:    { kind: MolliePurchaseKind; tenantId: string; bundleId: string | null },
): Promise<void> {
  const amounts = amountsFromPayment(payment);
  if (!amounts) {
    console.error("[billing/invoices] payment without usable VAT amounts, no invoice issued", { paymentId: payment.id, tenantId: what.tenantId });
    return;
  }
  await issueInvoice(client, {
    tenantId:    what.tenantId,
    reference:   paymentReference(payment.id),
    kind:        what.kind,
    description: purchaseDescription(what.kind, what.bundleId),
    amounts,
    paymentId:   payment.id,
    paid:        true,
  });
}

/** The invoice of an automatic top-up that was paid. Never throws. */
export async function invoiceAutoReload(client: SupabaseClient, payment: MolliePayment): Promise<void> {
  const tenantId = payment.metadata?.["tenant_id"];
  const amounts  = amountsFromPayment(payment);
  if (typeof tenantId !== "string" || !tenantId || !amounts) {
    console.error("[billing/invoices] automatic top-up without usable VAT amounts, no invoice issued", { paymentId: payment.id });
    return;
  }
  await issueInvoice(client, {
    tenantId,
    reference:   paymentReference(payment.id),
    kind:        "auto_reload",
    description: "Automatische opwaardering tegoed",
    amounts,
    paymentId:   payment.id,
    paid:        true,
  });
}
