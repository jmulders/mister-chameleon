/**
 * POST /api/billing/create-credit-session  ← DEPRECATED
 *
 * This route is a legacy stub.  The canonical credit-bundle checkout endpoint is:
 *
 *   POST /api/billing/create-bundle-checkout
 *
 * ─── Migration note ────────────────────────────────────────────────────────────
 *
 *   Differences from the canonical route:
 *     • Used old bundle IDs: "credits_1k" / "credits_5k" / "credits_20k"
 *       Canonical bundle IDs: "credits_100" / "credits_500" / "credits_1000"
 *       (from CREDIT_BUNDLES in billing/plans.ts)
 *     • Used lib/stripe.ts proxy — canonical uses billing/stripe.ts
 *     • Metadata key was "credit_amount" — canonical uses "credits" (from bundle definition)
 *
 *   Any client code that POSTs to this URL should be updated to use:
 *     /api/billing/create-bundle-checkout
 *
 *   Request body shape (canonical):
 *     {
 *       tenantId: string;   // UUID
 *       bundleId: string;   // see CREDIT_BUNDLES in billing/plans.ts
 *     }
 */

import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error:     "This endpoint is deprecated.",
      canonical: "/api/billing/create-bundle-checkout",
      note:      "Bundle IDs have changed. See CREDIT_BUNDLES in billing/plans.ts for valid IDs.",
    },
    { status: 410 },
  );
}
