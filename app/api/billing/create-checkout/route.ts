/**
 * POST /api/billing/create-checkout
 *
 * Create a Stripe Checkout session for a subscription plan upgrade.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId:     string;          // UUID of the tenant to upgrade
 *     planId:       string;          // "starter" | "growth" | "pro"
 *     billingCycle: "monthly" | "annual";
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { url: string }  — Stripe Checkout URL to redirect the browser to.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   Admin-only route. Validates the requesting user is an admin via
 *   Supabase Auth session on the service-role client.
 *
 * ─── Stripe flow ─────────────────────────────────────────────────────────────
 *
 *   1. Looks up the tenant's existing Stripe customer ID (if any) from
 *      the subscriptions table.
 *   2. Passes customer_id to avoid creating duplicate Stripe customers.
 *   3. On success, Stripe fires checkout.session.completed → webhook handler
 *      upserts subscription row and grants initial credits.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { BILLING_PLANS, getResolvedPlanStripePriceId } from "@/billing/plans";
import { createCheckoutSession }     from "@/billing/stripe";
import {
  getRequiredAdminSession,
  canAccessTenant,
} from "@/lib/admin-auth/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 0. Auth — any admin assigned to the target tenant may initiate checkout ──

  let session;
  try {
    session = await getRequiredAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Parse body ────────────────────────────────────────────────────────────

  let body: { tenantId?: string; planId?: string; billingCycle?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, planId, billingCycle } = body;

  if (!tenantId || !planId || !billingCycle) {
    return NextResponse.json(
      { error: "tenantId, planId, and billingCycle are required" },
      { status: 400 },
    );
  }

  if (billingCycle !== "monthly" && billingCycle !== "annual") {
    return NextResponse.json(
      { error: "billingCycle must be 'monthly' or 'annual'" },
      { status: 400 },
    );
  }

  if (!BILLING_PLANS[planId as keyof typeof BILLING_PLANS]) {
    return NextResponse.json(
      { error: `Unknown plan: ${planId}` },
      { status: 400 },
    );
  }

  // ── 1b. Verify the caller has access to this tenant ──────────────────────────
  //
  // Super-admins pass automatically.  Tenant-admin users must be assigned to
  // this specific tenant in admin_user_tenants.

  const hasAccess = await canAccessTenant(session, tenantId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "You do not have access to this tenant." },
      { status: 403 },
    );
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

  // ── 3. Verify tenant exists (tenant_settings uses TEXT tenant_id slug) ────────

  const { data: tenantRow } = await client
    .from("tenant_settings")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!tenantRow) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // ── 4. Look up existing Stripe customer ID ───────────────────────────────────

  const { data: existingSub } = await client
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const stripeCustomerId = (existingSub as { stripe_customer_id?: string } | null)
    ?.stripe_customer_id;

  // ── 5. Build redirect URLs ───────────────────────────────────────────────────

  const origin     = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const successUrl = `${origin}/admin/tenants/${tenantId}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/admin/tenants/${tenantId}/billing?checkout=cancelled`;

  // ── 6. Resolve Stripe Price ID (env → DB fallback) ──────────────────────────

  const resolvedPriceId = await getResolvedPlanStripePriceId(
    planId,
    billingCycle as "monthly" | "annual",
  );

  // ── 7. Create Checkout session ───────────────────────────────────────────────

  try {
    const checkoutUrl = await createCheckoutSession({
      tenantId,
      planId,
      billingCycle: billingCycle as "monthly" | "annual",
      successUrl,
      cancelUrl,
      stripeCustomerId,
      priceId: resolvedPriceId,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[billing/create-checkout] Stripe error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
