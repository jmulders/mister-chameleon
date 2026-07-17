/**
 * POST /api/billing/create-session-bundle-checkout
 *
 * Create a Stripe Checkout session for a one-time session credit bundle
 * purchase.  Session credits are personalised-visit top-ups — separate from
 * the enrichment credit (Chameleon Credits) wallet.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId: string;   // Tenant slug, e.g. "mister-chameleon"
 *     bundleId: string;   // "sessions_10k" | "sessions_50k" | "sessions_200k"
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { url: string }  — Stripe Checkout URL (payment mode, one-time charge).
 *
 * ─── Return flow ─────────────────────────────────────────────────────────────
 *
 *   On success, Stripe redirects to:
 *     /admin/tenants/{tenantId}/billing?session_bundle=success&bundle_id={id}&session_id={cs_xxx}
 *
 *   The billing page calls confirmSessionBundlePurchaseAction(tenantId, cs_xxx)
 *   which verifies the session and calls the add_session_credits() Postgres RPC.
 *   This works without webhooks — critical for local development.
 *
 *   On cancel, Stripe redirects to:
 *     /admin/tenants/{tenantId}/billing?session_bundle=cancelled
 *
 * ─── Stripe metadata ─────────────────────────────────────────────────────────
 *
 *   type        = "session_bundle"      — distinguishes from "credit_bundle"
 *   tenant_id   = tenantId
 *   bundle_id   = bundleId
 *   stripe_mode = "test" | "live"
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import Stripe                        from "stripe";
import { SESSION_CREDIT_BUNDLES }    from "@/billing/plans";
import { getPlatformStripeSettings } from "@/platform/platform-store";
import { getStripeMode, STRIPE_API_VERSION } from "@/billing/stripe-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ────────────────────────────────────────────────────────────

  let body: { tenantId?: string; bundleId?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, bundleId } = body;

  if (!tenantId || !bundleId) {
    return NextResponse.json(
      { error: "tenantId and bundleId are required" },
      { status: 400 },
    );
  }

  // ── 2. Resolve bundle ────────────────────────────────────────────────────────

  const bundle = SESSION_CREDIT_BUNDLES.find((b) => b.id === bundleId);
  if (!bundle) {
    return NextResponse.json(
      { error: `Unknown session bundle: ${bundleId}. Valid: ${SESSION_CREDIT_BUNDLES.map((b) => b.id).join(", ")}` },
      { status: 400 },
    );
  }

  if (!bundle.stripePrice) {
    return NextResponse.json(
      {
        error:
          `Session bundle "${bundleId}" has no Stripe Price ID configured. ` +
          `Add STRIPE_PRICE_SESSIONS_10K / _50K / _200K to your environment variables and ` +
          `create matching one-time prices in your Stripe dashboard.`,
      },
      { status: 500 },
    );
  }

  // ── 3. Init Supabase ─────────────────────────────────────────────────────────

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 4. Verify tenant exists ──────────────────────────────────────────────────

  const { data: tenant } = await client
    .from("tenant_settings")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // ── 5. Resolve Stripe secret key ─────────────────────────────────────────────

  const stripeMode = getStripeMode();

  let stripeSecretKey: string | undefined =
    stripeMode === "test"
      ? (process.env["STRIPE_TEST_SECRET_KEY"] ?? process.env["STRIPE_SECRET_KEY"])
      : process.env["STRIPE_SECRET_KEY"];

  if (!stripeSecretKey) {
    try {
      const stripeSettings = await getPlatformStripeSettings();
      if (stripeSettings.ok) {
        stripeSecretKey = stripeSettings.data.secretKey?.trim() ?? undefined;
      }
    } catch { /* non-fatal */ }
  }

  if (!stripeSecretKey) {
    return NextResponse.json(
      {
        error:
          stripeMode === "test"
            ? "Stripe test key not configured. Add STRIPE_TEST_SECRET_KEY to .env.local."
            : "Stripe not configured. Add STRIPE_SECRET_KEY to .env.local.",
      },
      { status: 500 },
    );
  }

  // ── 6. Look up Stripe customer ───────────────────────────────────────────────

  const effectiveMode = stripeSecretKey.startsWith("sk_test_") ? "test" : "live";
  const walletCol     = effectiveMode === "test" ? "stripe_test_customer_id" : "stripe_customer_id";

  const { data: walletRow } = await client
    .from("tenant_wallets")
    .select(walletCol)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const stripeCustomerId =
    (walletRow as Record<string, string | null | undefined> | null)?.[walletCol] ?? undefined;

  // ── 7. Build redirect URLs ───────────────────────────────────────────────────

  const origin     = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const successUrl = `${origin}/admin/tenants/${tenantId}/billing?session_bundle=success&bundle_id=${bundleId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/admin/tenants/${tenantId}/billing?session_bundle=cancelled`;

  // ── 8. Create Stripe Checkout session ────────────────────────────────────────

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });

    const session = await stripe.checkout.sessions.create({
      mode:        "payment",
      line_items:  [{ price: bundle.stripePrice!.trim(), quantity: 1 }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      customer:    stripeCustomerId,
      metadata: {
        tenant_id:   tenantId,
        bundle_id:   bundleId,
        type:        "session_bundle",
        stripe_mode: effectiveMode,
      },
    });

    if (!session.url) throw new Error("Stripe Checkout session URL is null");
    return NextResponse.json({ url: session.url });

  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error("[billing/create-session-bundle-checkout] Stripe error:", msg);
    return NextResponse.json({ error: `Stripe error: ${msg}` }, { status: 500 });
  }
}
