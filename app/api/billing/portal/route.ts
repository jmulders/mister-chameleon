/**
 * POST /api/billing/portal
 *
 * Create a Stripe Billing Portal session and redirect the browser.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   { tenantId: string }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { url: string }  — Stripe Billing Portal URL.
 *
 * ─── What the portal offers ──────────────────────────────────────────────────
 *
 *   • View and download invoices
 *   • Update payment method
 *   • Cancel or update subscription
 *   • View upcoming invoices
 *
 *   Portal configuration is managed in the Stripe Dashboard under
 *   Settings → Billing → Customer portal.
 *
 * ─── Prerequisite ────────────────────────────────────────────────────────────
 *
 *   The tenant must have an existing Stripe customer ID (i.e., they've
 *   completed at least one checkout). Returns 400 if no customer exists yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { createBillingPortalSession } from "@/billing/stripe";
import { rethrowNextInternal } from "@/lib/server-action-guard";
import {
  getRequiredAdminSession,
  canAccessTenant,
} from "@/lib/admin-auth/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 0. Auth — any admin assigned to the target tenant may open the portal ────

  let session;
  try {
    session = await getRequiredAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 1. Parse body ────────────────────────────────────────────────────────────

  // flow: optional.  "payment_method_update" opens the portal directly on the
  // card management screen instead of the general portal home.
  let body: { tenantId?: string; flow?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, flow } = body;
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // Verify the caller has access to this tenant.
  const hasAccess = await canAccessTenant(session, tenantId);
  if (!hasAccess) {
    return NextResponse.json(
      { error: "You do not have access to this tenant." },
      { status: 403 },
    );
  }

  // ── 2. Init Supabase ─────────────────────────────────────────────────────────

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 3. Look up Stripe customer ID ────────────────────────────────────────────

  const { data: sub, error: subErr } = await client
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (subErr) {
    console.error("[billing/portal] DB error:", subErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const stripeCustomerId = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id;

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer found for this tenant. Complete a checkout first." },
      { status: 400 },
    );
  }

  // ── 4. Build return URL ──────────────────────────────────────────────────────
  //
  // Append ?portal=return so the billing page can detect the return and
  // immediately sync the payment method from Stripe (webhooks don't fire on
  // localhost, so we need a pull-based sync on return).

  const origin    = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const returnUrl = `${origin}/admin/tenants/${tenantId}/billing?portal=return`;

  // ── 5. Create portal session ─────────────────────────────────────────────────

  try {
    const portalUrl = await createBillingPortalSession(stripeCustomerId, returnUrl, flow);
    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    rethrowNextInternal(err);
    console.error("[billing/portal] Stripe error:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
