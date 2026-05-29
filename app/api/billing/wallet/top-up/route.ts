/**
 * POST /api/billing/wallet/top-up
 *
 * Initiate a manual wallet top-up for a tenant via Stripe Checkout.
 *
 * ─── Mode-aware ───────────────────────────────────────────────────────────────
 *
 *   Uses the Stripe mode determined by STRIPE_MODE env var:
 *
 *   STRIPE_MODE=live (default)
 *     → sk_live_… key, real Stripe checkout, real charges.
 *     → Customer ID from subscriptions.stripe_customer_id.
 *
 *   STRIPE_MODE=test
 *     → sk_test_… key, Stripe test checkout, no real charges.
 *     → Customer ID from tenant_wallets.stripe_test_customer_id (created on demand).
 *     → Test card numbers: https://stripe.com/docs/testing#cards
 *       Most common: 4242 4242 4242 4242 (success), 4000 0000 0000 0002 (decline)
 *
 * ─── Flow ─────────────────────────────────────────────────────────────────────
 *
 *   1. Validate body: { tenantId, amountCents }.
 *   2. Look up / create Stripe customer (mode-aware).
 *   3. Create Stripe Checkout session in "payment" mode.
 *   4. Return { url } — caller redirects to Stripe Checkout.
 *   5. After payment, Stripe fires checkout.session.completed.
 *   6. Webhook handler (billing/stripe.ts) reads metadata and calls creditWallet().
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   wallet_simulated wallets can still call this route (they're not blocked here)
 *   but the wallet's test_mode does NOT affect which Stripe keys are used.
 *   STRIPE_MODE is the global switch.  Simulated wallets should use the test-mode
 *   panel instead of Stripe Checkout for balance manipulation.
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                from "@supabase/supabase-js";
import { getOrCreateStripeCustomer }   from "@/billing/stripe";
import { getStripeClient, getStripeMode, getStripeModeInfo } from "@/billing/stripe-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serviceRoleClient() {
  const url  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key  = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Supabase service-role env vars missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {

  // ── 1. Parse + validate body ─────────────────────────────────────────────────

  let body: { tenantId?: string; amountCents?: number };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, amountCents } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }
  if (!amountCents || typeof amountCents !== "number" || amountCents < 100) {
    return NextResponse.json(
      { error: "amountCents must be a number ≥ 100 (€1.00 minimum)" },
      { status: 400 },
    );
  }
  if (amountCents > 100_000) {
    return NextResponse.json(
      { error: "amountCents exceeds the maximum allowed per top-up (€1000)" },
      { status: 400 },
    );
  }

  // ── 2. Init Supabase ─────────────────────────────────────────────────────────

  let client: ReturnType<typeof serviceRoleClient>;
  try {
    client = serviceRoleClient();
  } catch (err) {
    console.error("[wallet/top-up] Supabase init error:", err);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // ── 3. Resolve Stripe customer (mode-aware) ──────────────────────────────────
  //
  // getOrCreateStripeCustomer() selects the correct column and Stripe environment
  // based on STRIPE_MODE:
  //   live → subscriptions.stripe_customer_id  (sk_live_… customer)
  //   test → tenant_wallets.stripe_test_customer_id (sk_test_… customer)

  let stripeCustomerId: string;
  try {
    stripeCustomerId = await getOrCreateStripeCustomer(client, tenantId);
  } catch (err) {
    console.error("[wallet/top-up] getOrCreateStripeCustomer error:", err);
    return NextResponse.json(
      { error: "Could not resolve Stripe customer" },
      { status: 500 },
    );
  }

  // ── 4. Build success / cancel URLs ───────────────────────────────────────────

  const origin     = request.headers.get("origin") ?? process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const successUrl = `${origin}/admin/tenants/${tenantId}/billing?checkout=success&wallet=1`;
  const cancelUrl  = `${origin}/admin/tenants/${tenantId}/billing?checkout=cancelled&wallet=1`;

  // ── 5. Create Stripe Checkout session (mode-aware) ───────────────────────────
  //
  // Uses the correct Stripe client (test or live) based on STRIPE_MODE.
  // mode=test → test keys, Stripe test checkout, no real money.
  // mode=live → live keys, real Stripe checkout.

  const stripeMode = getStripeMode();

  try {
    const stripe = getStripeClient(stripeMode);

    const session = await stripe.checkout.sessions.create({
      mode:     "payment",
      customer: stripeCustomerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency:     "eur",
            unit_amount:  amountCents,
            product_data: {
              name:        stripeMode === "test"
                ? "[TEST] Wallet top-up"
                : "Wallet top-up",
              description: `Add €${(amountCents / 100).toFixed(2)} to your enrichment wallet` +
                (stripeMode === "test" ? " (test mode — no real charge)" : ""),
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata: {
        type:         "wallet_top_up",
        tenant_id:    tenantId,
        amount_cents: String(amountCents),
        stripe_mode:  stripeMode,
      },
      payment_intent_data: {
        metadata: {
          tenant_id:   tenantId,
          purpose:     "wallet_top_up",
          stripe_mode: stripeMode,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe returned no checkout URL" }, { status: 500 });
    }

    console.info("[wallet/top-up] Checkout session created", {
      tenantId,
      amountCents,
      sessionId:   session.id,
      stripeMode,
      customerId:  stripeCustomerId,
    });

    const modeInfo = getStripeModeInfo();
    return NextResponse.json({
      url:        session.url,
      stripeMode,
      isTestMode: modeInfo.isTest,
    });

  } catch (err) {
    console.error("[wallet/top-up] Stripe checkout error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Stripe error" },
      { status: 500 },
    );
  }
}
