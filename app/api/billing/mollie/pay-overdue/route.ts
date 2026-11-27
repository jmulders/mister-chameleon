/**
 * POST /api/billing/mollie/pay-overdue
 *
 * A subscription charge on the tenant's mandate failed, or was reversed. There
 * is no automatic retry: the tenant pays the open amount here. It is a "first"
 * payment, so it also gives a fresh mandate for the months that follow. When
 * it is paid the subscription is active again (billing/mollie-renewal.ts).
 *
 * The amount is not in the request. It is what the failed renewal was for.
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
import { overdueAmount, OVERDUE_PAYMENT_TYPE } from "@/billing/mollie-renewal";
import { BILLING_PLANS }             from "@/billing/plans";

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
  const owed   = await overdueAmount(client, tenantId);
  if (!owed) {
    return NextResponse.json({ error: "There is no open subscription payment for this tenant." }, { status: 400 });
  }

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

  const planLabel = BILLING_PLANS[owed.plan as keyof typeof BILLING_PLANS]?.name ?? owed.plan;

  try {
    const customerId = await ensureMollieCustomer(client, tenantId, {
      name:  (tenant.settings as { name?: string } | null)?.name ?? tenantId,
      email: (wallet as { notification_email?: string | null } | null)?.notification_email ?? null,
    });

    const { url, paymentId } = await startMollieCheckout(client, {
      tenantId,
      kind:               OVERDUE_PAYMENT_TYPE,
      bundleId:           null,
      amountCents:        owed.amountCents,
      description:        `Mister Chameleon: ${planLabel} subscription, open payment`,
      origin,
      publicBaseUrl,
      firstForCustomerId: customerId,
      extraMetadata:      { period_end: owed.periodEnd },
    });

    console.info("[billing/mollie] overdue payment created", { tenantId, paymentId, amountCents: owed.amountCents });
    return NextResponse.json({ url, provider: "mollie" });
  } catch (err) {
    const msg = err instanceof MollieError || err instanceof Error ? err.message : String(err);
    console.error("[billing/mollie] could not create the overdue payment:", msg);
    return NextResponse.json({ error: `Mollie error: ${msg}` }, { status: 500 });
  }
}
