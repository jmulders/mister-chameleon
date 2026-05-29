/**
 * POST /api/stripe/webhook  ← DEPRECATED
 *
 * This route is a legacy stub.  The canonical webhook endpoint is:
 *
 *   POST /api/webhooks/stripe
 *
 * ─── Migration note ────────────────────────────────────────────────────────────
 *
 *   This file was the original webhook handler, built against lib/billing/.
 *   It has been superseded by /api/webhooks/stripe, which uses the consolidated
 *   billing/stripe.ts module.
 *
 *   Only ONE webhook URL can be registered in the Stripe Dashboard.
 *   Register: https://<your-domain>/api/webhooks/stripe
 *
 *   This stub returns 301 so any stray Stripe delivery attempts are redirected
 *   to the canonical route.  Because Stripe does not follow redirects for
 *   webhook deliveries, update your Stripe Dashboard webhook URL as soon as
 *   possible.
 *
 * ─── Action required ───────────────────────────────────────────────────────────
 *
 *   1. Open the Stripe Dashboard → Developers → Webhooks.
 *   2. Update (or delete and recreate) the webhook endpoint URL to:
 *        https://<your-domain>/api/webhooks/stripe
 *   3. This file can be removed once the Dashboard has been updated.
 */

import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  // Stripe does not follow redirects for webhook deliveries.
  // This response is informational only; update the Stripe Dashboard URL.
  return NextResponse.json(
    {
      error:      "This webhook endpoint is deprecated.",
      canonical:  "/api/webhooks/stripe",
      action:     "Update your Stripe Dashboard webhook URL to /api/webhooks/stripe",
    },
    { status: 410 },   // 410 Gone — explicitly signals the endpoint is retired
  );
}
