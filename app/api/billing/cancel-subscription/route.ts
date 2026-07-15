/**
 * POST /api/billing/cancel-subscription
 *
 * Cancel a tenant's Stripe subscription at the end of the current billing period.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   { tenantId: string }
 *
 * ─── Behaviour ────────────────────────────────────────────────────────────────
 *
 *   Sets `cancel_at_period_end = true` on the Stripe subscription — the tenant
 *   retains access until the period ends.  The local DB row is updated immediately
 *   to show the pending cancellation in the UI; Stripe will fire
 *   customer.subscription.deleted when the period actually ends.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   Admin-only route.  Only callable from the /admin section.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
// getStripeClient — NOT getStripe, which has never existed. This route imported
// a non-existent export, so webpack emitted only a warning ("Attempted import
// error") and the build passed; the failure surfaced at runtime instead, as a
// TypeError on every cancellation attempt. getStripeClient() picks live or test
// itself via getStripeMode().
import { getStripeClient }           from "@/billing/stripe-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripeAny(): any { return getStripeClient(); }

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ────────────────────────────────────────────────────────────

  let body: { tenantId?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId } = body;
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // ── 2. Init Supabase (service-role) ─────────────────────────────────────────

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 3. Load subscription ─────────────────────────────────────────────────────

  const { data: sub } = await client
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "No subscription found for this tenant" }, { status: 404 });
  }

  const stripeSubId = (sub as { stripe_subscription_id?: string | null }).stripe_subscription_id;

  if (!stripeSubId) {
    return NextResponse.json(
      { error: "Subscription has no Stripe subscription ID — may be a free/unlinked plan" },
      { status: 400 },
    );
  }

  const currentStatus = (sub as { status?: string }).status;
  if (currentStatus === "canceled") {
    return NextResponse.json({ error: "Subscription is already canceled" }, { status: 400 });
  }

  // ── 4. Cancel in Stripe (at period end) ─────────────────────────────────────

  try {
    await stripeAny().subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    console.error("[billing/cancel-subscription] Stripe error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  // ── 5. Update local DB immediately ──────────────────────────────────────────
  // Webhook will fire later but we want the UI to reflect the cancellation now.

  await client
    .from("subscriptions")
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  return NextResponse.json({ ok: true, message: "Subscription will cancel at period end" });
}
