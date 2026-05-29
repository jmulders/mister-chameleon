/**
 * POST /api/billing/create-checkout-session  ← DEPRECATED
 *
 * This route is a legacy stub.  The canonical subscription checkout endpoint is:
 *
 *   POST /api/billing/create-checkout
 *
 * ─── Migration note ────────────────────────────────────────────────────────────
 *
 *   Differences from the canonical route:
 *     • Used "yearly" spelling — canonical uses "annual"
 *     • Used lib/stripe.ts proxy — canonical uses billing/stripe.ts
 *     • lacked admin-session validation
 *     • Success/cancel URLs pointed to /admin/billing (wrong for multi-tenant admin)
 *
 *   Any client code that POSTs to this URL should be updated to use:
 *     /api/billing/create-checkout
 *
 *   Request body shape (canonical):
 *     {
 *       tenantId:     string;          // UUID
 *       planId:       string;          // "starter" | "growth" | "pro"
 *       billingCycle: "monthly" | "annual";
 *     }
 */

import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error:     "This endpoint is deprecated.",
      canonical: "/api/billing/create-checkout",
      note:      "Use billingCycle: 'annual' (not 'yearly') in the canonical route.",
    },
    { status: 410 },
  );
}
