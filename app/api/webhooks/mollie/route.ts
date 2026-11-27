/**
 * POST /api/webhooks/mollie
 *
 * Mollie calls this when a payment changes state. The body is form-encoded
 * and holds one thing, the payment id (`id=tr_…`). It says nothing about the
 * state and carries no signature. The handler reads the payment back from
 * Mollie with the platform's key and acts on that answer alone, so a forged
 * call can do no more than make the platform look at a payment again.
 *
 * Answers:
 *   200  handled, or nothing to do (an id that is not ours, a payment that
 *        is not paid). Mollie stops calling.
 *   500  the payment could not be read or delivered. Mollie tries again, ten
 *        times over about a day.
 *
 * The answer never says whether an id exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb }                     from "@/data/db";
import { isMolliePaymentId, mollieConfigured, MollieError } from "@/billing/mollie";
import { settleMolliePayment }       from "@/billing/mollie-checkout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DONE = () => new NextResponse(null, { status: 200 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  let id: unknown = null;
  try {
    id = (await request.formData()).get("id");
  } catch {
    return DONE();
  }
  if (!isMolliePaymentId(id)) return DONE();

  if (!mollieConfigured()) {
    // A webhook for a site without a key: ask Mollie to come back, the key
    // may be on its way in a new deployment.
    console.error("[mollie-webhook] MOLLIE_API_KEY is not set, cannot read the payment");
    return new NextResponse(null, { status: 500 });
  }

  try {
    const { payment, result } = await settleMolliePayment(getDb(), id);
    console.info("[mollie-webhook]", {
      paymentId: payment.id,
      status:    payment.status,
      outcome:   result.outcome,
      ...(result.outcome === "refused" ? { reason: result.reason } : {}),
    });
    return DONE();
  } catch (err) {
    // An id Mollie does not know under this key is not ours: nothing to retry.
    if (err instanceof MollieError && (err.status === 404 || err.status === 410)) return DONE();
    console.error("[mollie-webhook] could not settle the payment", {
      paymentId: id,
      error:     err instanceof Error ? err.message : String(err),
    });
    return new NextResponse(null, { status: 500 });
  }
}
