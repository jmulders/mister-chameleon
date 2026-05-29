/**
 * POST /api/billing/create-bundle-checkout
 *
 * Create a Stripe Checkout session for a one-time credit bundle purchase.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId: string;   // Tenant slug, e.g. "mister-chameleon"
 *     bundleId: string;   // e.g. "credits_250" | "credits_1000" | "credits_5000"
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { url: string }  — Stripe Checkout URL (payment mode, one-time charge).
 *
 * ─── Stripe flow ─────────────────────────────────────────────────────────────
 *
 *   Uses Stripe Checkout in "payment" mode (not subscription mode).
 *   On success, Stripe fires checkout.session.completed with
 *   metadata.type = "credit_bundle". The webhook handler calls addCredits()
 *   and logs the transaction to credit_transactions.
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 *   The Stripe event ID is stored as stripe_event_id in credit_transactions.
 *   Duplicate webhook deliveries for the same purchase are safely ignored.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import Stripe                        from "stripe";
import { CREDIT_BUNDLES }            from "@/billing/plans";
import { getPlatformStripeSettings } from "@/platform/platform-store";
import { getStripeMode }             from "@/billing/stripe-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Route handler ──────────────────────────────────────────────────────────────

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

  const bundle = CREDIT_BUNDLES.find((b) => b.id === bundleId);
  if (!bundle) {
    return NextResponse.json(
      { error: `Unknown bundle: ${bundleId}. Valid: ${CREDIT_BUNDLES.map((b) => b.id).join(", ")}` },
      { status: 400 },
    );
  }

  if (!bundle.stripePrice) {
    return NextResponse.json(
      { error: `Bundle ${bundleId} has no Stripe Price ID configured. Set STRIPE_PRICE_${bundleId.toUpperCase()} in env.` },
      { status: 500 },
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

  // ── 3. Verify tenant exists ──────────────────────────────────────────────────
  //
  //  Tenants are stored in `tenant_settings` keyed by slug (tenant_id column),
  //  not in a `tenants` table.  A missing row means the slug is invalid.

  const { data: tenant } = await client
    .from("tenant_settings")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // ── 5. Resolve Stripe secret key (mode-aware) ───────────────────────────────
  //
  //  Resolution order — env vars take priority because the price IDs in
  //  STRIPE_PRICE_* also come from env vars; both MUST be from the same
  //  Stripe account and mode.  The DB (admin UI) key is used as a fallback.
  //
  //  Test mode  (STRIPE_MODE=test):   STRIPE_TEST_SECRET_KEY → DB key
  //  Live mode  (STRIPE_MODE unset):  STRIPE_SECRET_KEY      → DB key

  const stripeMode = getStripeMode();

  let stripeSecretKey: string | undefined =
    stripeMode === "test"
      ? (process.env["STRIPE_TEST_SECRET_KEY"] ?? process.env["STRIPE_SECRET_KEY"])
      : process.env["STRIPE_SECRET_KEY"];

  if (!stripeSecretKey) {
    // Fall back to the key saved via Admin → Platform → Integrations → Stripe.
    try {
      const stripeSettings = await getPlatformStripeSettings();
      if (stripeSettings.ok) {
        stripeSecretKey = stripeSettings.data.secretKey?.trim() ?? undefined;
      }
    } catch {
      // Non-fatal — error returned below
    }
  }

  if (!stripeSecretKey) {
    return NextResponse.json(
      {
        error:
          stripeMode === "test"
            ? "Stripe test key not found. Add STRIPE_TEST_SECRET_KEY=sk_test_… to .env.local, or save your test secret key at Admin → Platform → Integrations → Stripe."
            : "Stripe is not configured. Add STRIPE_SECRET_KEY=sk_live_… to .env.local, or save your secret key at Admin → Platform → Integrations → Stripe.",
      },
      { status: 500 },
    );
  }

  // ── 4. Look up existing Stripe customer ──────────────────────────────────────
  //
  //  Derive the actual mode from the resolved key prefix — not from STRIPE_MODE.
  //  A sk_test_ key can only work with test prices/customers, regardless of what
  //  STRIPE_MODE says.  This prevents cross-mode contamination when the admin UI
  //  stores a test key but STRIPE_MODE is unset (defaulting to "live").
  //
  //  stripe_customer_id      → live mode (sk_live_ key)
  //  stripe_test_customer_id → test mode (sk_test_ key)

  const effectiveMode = stripeSecretKey.startsWith("sk_test_") ? "test" : "live";
  const walletCol = effectiveMode === "test" ? "stripe_test_customer_id" : "stripe_customer_id";

  const { data: walletRow } = await client
    .from("tenant_wallets")
    .select(walletCol)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const stripeCustomerId =
    (walletRow as Record<string, string | null | undefined> | null)?.[walletCol] ?? undefined;

  // ── 6. Build redirect URLs ───────────────────────────────────────────────────

  const origin     = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const successUrl = `${origin}/admin/tenants/${tenantId}/billing?bundle=success&bundle_id=${bundleId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/admin/tenants/${tenantId}/billing?bundle=cancelled`;

  // ── 7. Create Checkout session ───────────────────────────────────────────────

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
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
        type:        "credit_bundle",
        stripe_mode: effectiveMode,
      },
    });

    if (!session.url) throw new Error("Stripe Checkout session URL is null");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    console.error("[billing/create-bundle-checkout] Stripe error:", msg);

    // "No such price" almost always means the secret key and price ID are from
    // different Stripe modes (test vs live) or different accounts.
    const hint = msg.includes("No such price")
      ? ` — the price ID and secret key may be from different Stripe modes or accounts. ` +
        `Key mode in use: ${stripeMode}. ` +
        `Ensure STRIPE_PRICE_* in .env.local and your secret key are from the same Stripe account.`
      : "";

    return NextResponse.json(
      { error: msg + hint },
      { status: 500 },
    );
  }
}
