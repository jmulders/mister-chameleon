/**
 * POST /api/billing/mollie/authorise
 *
 * Starts the payment that gives the platform a mandate: the tenant pays one
 * wallet top-up now, and thereby allows the automatic top-ups that follow.
 * The button that leads here says so in as many words; this route is not
 * reached from a plain "top up".
 *
 * The amount is the tenant's own automatic top-up amount unless the request
 * names another, so the first payment and the later ones are the same size.
 *
 * Body:     { tenantId: string; amountCents?: number }
 * Response: { url: string }   the Mollie checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb }                     from "@/data/db";
import { guardTenantRoute }          from "@/lib/admin-auth/route-guard";
import { getPaymentProvider }        from "@/billing/payment-provider";
import { mollieConfigured, MollieError } from "@/billing/mollie";
import { ensureMollieCustomer }      from "@/billing/mollie-customer";
import { startMollieCheckout }       from "@/billing/mollie-checkout";
import { firstPaymentAmount }        from "@/billing/mollie-authorise";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { tenantId?: unknown; amountCents?: unknown };
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
    client.from("tenant_wallets").select("auto_reload_amount_cents, notification_email, currency").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const amount = firstPaymentAmount(body.amountCents, (wallet as { auto_reload_amount_cents?: number } | null)?.auto_reload_amount_cents);
  if (!amount.ok) return NextResponse.json({ error: amount.error }, { status: 400 });

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
      kind:               "wallet_top_up",
      bundleId:           null,
      amountCents:        amount.cents,
      description:        `Mister Chameleon: wallet top-up €${(amount.cents / 100).toFixed(2)} and authorisation for automatic top-ups`,
      origin,
      publicBaseUrl,
      firstForCustomerId: customerId,
    });

    console.info("[billing/mollie] first payment created", { tenantId, paymentId, amountCents: amount.cents });
    return NextResponse.json({ url, provider: "mollie" });
  } catch (err) {
    const msg = err instanceof MollieError || err instanceof Error ? err.message : String(err);
    console.error("[billing/mollie] could not create the first payment:", msg);
    return NextResponse.json({ error: `Mollie error: ${msg}` }, { status: 500 });
  }
}
