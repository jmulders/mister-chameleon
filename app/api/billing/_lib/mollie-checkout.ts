/**
 * The Mollie branch of the one-time checkout routes.
 *
 * Each route keeps its own checks (session, tenant, bundle) and hands over
 * here once it knows what is being bought. The answer has the shape the
 * Stripe branch gives, `{ url }`, so the buy buttons need not know which
 * provider is behind them.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient }       from "@supabase/supabase-js";
import { mollieConfigured, MollieError } from "@/billing/mollie";
import { startMollieCheckout }       from "@/billing/mollie-checkout";
import type { MolliePurchaseKind }   from "@/billing/mollie-fulfil";

export async function mollieCheckoutResponse(
  client:  SupabaseClient,
  request: NextRequest,
  purchase: {
    tenantId:    string;
    kind:        MolliePurchaseKind;
    bundleId:    string | null;
    amountCents: number;
    description: string;
  },
): Promise<NextResponse> {
  if (!mollieConfigured()) {
    return NextResponse.json(
      { error: "Mollie is not configured. Add MOLLIE_API_KEY to the environment variables." },
      { status: 500 },
    );
  }

  const publicBaseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? null;
  const origin        = request.headers.get("origin") ?? publicBaseUrl ?? "";
  if (!origin) {
    return NextResponse.json({ error: "Could not determine the site address for the return." }, { status: 500 });
  }

  try {
    const { url, paymentId } = await startMollieCheckout(client, { ...purchase, origin, publicBaseUrl });
    console.info("[billing/mollie] payment created", {
      tenantId: purchase.tenantId, kind: purchase.kind, bundleId: purchase.bundleId, paymentId,
    });
    return NextResponse.json({ url, provider: "mollie" });
  } catch (err) {
    const msg = err instanceof MollieError || err instanceof Error ? err.message : String(err);
    console.error("[billing/mollie] could not create the payment:", msg);
    return NextResponse.json({ error: `Mollie error: ${msg}` }, { status: 500 });
  }
}
