/**
 * POST /api/billing/mollie/payment-method
 *
 * Set up or replace the payment method a subscription is charged on. With
 * Stripe that is the customer portal. Mollie has no portal: a payment method
 * is a mandate, and a mandate comes from a payment that is really paid. So
 * the tenant pays a verification amount of one cent with the account or card
 * they want to use from now on. The mandate of that payment replaces the old
 * one in the platform's record (billing/mollie-customer.ts).
 *
 * Body:     { tenantId: string }
 * Response: { url: string }   the Mollie checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb }                     from "@/data/db";
import { guardTenantRoute }          from "@/lib/admin-auth/route-guard";
import { getPaymentProvider }        from "@/billing/payment-provider";
import { mollieConfigured, MollieError } from "@/billing/mollie";
import { ensureMollieCustomer }      from "@/billing/mollie-customer";
import { startMollieCheckout }       from "@/billing/mollie-checkout";
import { PAYMENT_METHOD_PAYMENT_TYPE, PAYMENT_METHOD_VERIFICATION_CENTS } from "@/billing/mollie-payment-method";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantId = body.tenantId;
  const guard = await guardTenantRoute(tenantId);
  if (!guard.ok) return guard.response;
  if (typeof tenantId !== "string" || tenantId === "") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  if (getPaymentProvider() !== "mollie" || !mollieConfigured()) {
    return NextResponse.json({ error: "Mollie is not the payment provider of this site." }, { status: 400 });
  }

  const client = getDb();
  const [{ data: tenant }, { data: wallet }] = await Promise.all([
    client.from("tenant_settings").select("tenant_id, settings").eq("tenant_id", tenantId).maybeSingle(),
    client.from("tenant_wallets").select("notification_email").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const publicBaseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? null;
  const origin        = request.headers.get("origin") ?? publicBaseUrl ?? "";
  if (!origin) {
    return NextResponse.json({ error: "Could not determine the site address for the return." }, { status: 500 });
  }

  try {
    const customerId = await ensureMollieCustomer(client, tenantId, {
      name:  (tenant.settings as { name?: string } | null)?.name ?? tenantId,
      email: (wallet as { notification_email?: string | null } | null)?.notification_email ?? null,
    });

    const { url, paymentId } = await startMollieCheckout(client, {
      tenantId,
      kind:               PAYMENT_METHOD_PAYMENT_TYPE,
      bundleId:           null,
      amountCents:        PAYMENT_METHOD_VERIFICATION_CENTS,
      description:        "Mister Chameleon: verification of your payment method",
      origin,
      publicBaseUrl,
      firstForCustomerId: customerId,
    });

    console.info("[billing/mollie] payment method verification created", { tenantId, paymentId });
    return NextResponse.json({ url, provider: "mollie" });
  } catch (err) {
    const msg = err instanceof MollieError || err instanceof Error ? err.message : String(err);
    console.error("[billing/mollie] could not create the verification payment:", msg);
    return NextResponse.json({ error: `Mollie error: ${msg}` }, { status: 500 });
  }
}
