/**
 * POST /api/trial/checkout-session
 *
 * Initiates a Stripe-first trial signup:
 *
 *   1. Validates inputs (same rules as /api/trial/start)
 *   2. Checks email is not already registered
 *   3. Hashes the password with bcrypt (12 rounds)
 *   4. Stores a pending_trial_signups row (hashed pw + plan info)
 *   5. Creates a Stripe Checkout Session (subscription, 14-day trial,
 *      card required upfront — payment_method_collection: "always")
 *   6. Updates the pending row with the Stripe session ID
 *   7. Returns { url } — the browser redirects to Stripe Checkout
 *
 * ─── After payment ────────────────────────────────────────────────────────────
 *
 *   Stripe fires checkout.session.completed → /api/webhooks/stripe
 *   The webhook handler reads the pending_trial_signups row and creates
 *   the admin_user + tenant_settings, then marks the row completed.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     name:      string;
 *     email:     string;
 *     company:   string;
 *     password:  string;
 *     planId:    "starter" | "growth" | "pro";
 *   }
 *
 * ─── Response (success, 200) ──────────────────────────────────────────────────
 *
 *   { url: string }  — Stripe Checkout URL
 *
 * ─── Response (error, 4xx / 5xx) ─────────────────────────────────────────────
 *
 *   { error: string }
 */

import { NextRequest, NextResponse }             from "next/server";
import { getDb }                                 from "@/data/db";
import { hashPassword, validatePasswordStrength } from "@/lib/admin-auth/password";
import { findAdminUserByEmailForLogin }           from "@/data/admin-auth";
import Stripe                                     from "stripe";
import { getResolvedPlanStripePriceId }          from "@/billing/plans";
import { resolveStripeCredentials }              from "@/platform/platform-store";
import { headers }                               from "next/headers";
import { getActiveTenant }                       from "@/tenant/server";
import { resolveSession }                        from "@/data/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest): Promise<NextResponse> {

  // ── 1. Parse body ────────────────────────────────────────────────────────────

  let body: { name?: string; email?: string; company?: string; password?: string; planId?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name     = (body.name    ?? "").trim();
  const email    = (body.email   ?? "").trim().toLowerCase();
  const company  = (body.company ?? "").trim();
  const password = body.password ?? "";
  const planId   = (body.planId  ?? "starter").toLowerCase();

  // ── 2. Validate ──────────────────────────────────────────────────────────────

  if (!name)                        return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  if (!company)                     return NextResponse.json({ error: "Company name is required." }, { status: 400 });

  const passwordError = validatePasswordStrength(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  if (!["starter", "growth", "pro"].includes(planId)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  // ── 3. Check email uniqueness ────────────────────────────────────────────────

  try {
    const existing = await findAdminUserByEmailForLogin(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in instead." },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error("[trial/checkout-session] email lookup error:", err);
    return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 });
  }

  // ── 4. Hash password ─────────────────────────────────────────────────────────

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    console.error("[trial/checkout-session] bcrypt error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }

  // ── 5. Store pending signup ──────────────────────────────────────────────────

  const db = getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pending, error: pendingError } = await (db as any)
    .from("pending_trial_signups")
    .insert({ name, email, company, password_hash: passwordHash, plan_id: planId })
    .select("id")
    .single();

  if (pendingError || !pending?.id) {
    console.error("[trial/checkout-session] pending insert error:", pendingError?.message);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }

  const pendingId = pending.id as string;

  // ── 6. Resolve Stripe credentials + price ID ────────────────────────────────
  // Credentials are resolved first so mode can be passed to price ID lookup —
  // test mode uses stripe_test_monthly_price_id, live mode uses stripe_monthly_price_id.

  const stripeCredentials = await resolveStripeCredentials();

  console.log(
    `[trial/checkout-session] Stripe mode=${stripeCredentials.mode} ` +
    `key=${stripeCredentials.secretKey ? stripeCredentials.secretKey.slice(0, 14) + "…" : "(none)"} ` +
    `webhookSecret=${stripeCredentials.webhookSecret ? "set" : "(none)"}`,
  );

  const priceId = await getResolvedPlanStripePriceId(planId, "monthly", stripeCredentials.mode) ?? null;

  console.log(`[trial/checkout-session] Resolved price ID for plan="${planId}" mode="${stripeCredentials.mode}": ${priceId ?? "(none)"}`);

  if (!priceId) {
    console.error(`[trial/checkout-session] No Stripe price ID for plan "${planId}" (mode=${stripeCredentials.mode}). Configure it at /admin/platform/billing/plans.`);
    return NextResponse.json(
      { error: `Stripe price not configured for the ${planId} plan. Contact support.` },
      { status: 500 },
    );
  }

  // ── 7. Create Stripe Checkout session ────────────────────────────────────────

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  // Resolve the marketing-site tenant + visitor session so the purchase
  // conversion fired from the Stripe webhook can be attributed to the right
  // ad account (the site the buyer came from, not the new customer tenant).
  let siteTenantId = "";
  let mcSessionId  = "";
  try { siteTenantId = (await getActiveTenant()).tenantId; } catch { /* fail-open */ }
  try { mcSessionId  = resolveSession((await headers()).get("cookie")).sessionId ?? ""; } catch { /* fail-open */ }

  let checkoutUrl: string;
  try {
    const { secretKey } = stripeCredentials;
    if (!secretKey) {
      console.error("[trial/checkout-session] No Stripe secret key configured.");
      return NextResponse.json({ error: "Payment provider not configured. Contact support." }, { status: 500 });
    }
    const stripe = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
      typescript: true,
    });
    const session = await stripe.checkout.sessions.create({
      mode:        "subscription",
      line_items:  [{ price: priceId, quantity: 1 }],
      // Always collect a payment method even during the trial period.
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: 14,
        metadata: { type: "trial_signup", pending_signup_id: pendingId, plan_id: planId },
      },
      customer_email: email,
      metadata: {
        type:              "trial_signup",
        pending_signup_id: pendingId,
        plan_id:           planId,
        ...(siteTenantId ? { mc_site_tenant: siteTenantId } : {}),
        ...(mcSessionId  ? { mc_session_id:  mcSessionId  } : {}),
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/checkout`,
    });

    if (!session.url) throw new Error("Stripe session URL is null");
    checkoutUrl = session.url;

    // ── 8. Persist stripe_session_id on the pending row ──────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from("pending_trial_signups")
      .update({ stripe_session_id: session.id })
      .eq("id", pendingId);

  } catch (err) {
    console.error("[trial/checkout-session] Stripe error:", err instanceof Error ? err.message : err);
    // Clean up the pending row so the user can retry without hitting an email conflict
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from("pending_trial_signups").delete().eq("id", pendingId);
    return NextResponse.json({ error: "Payment provider error. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ url: checkoutUrl });
}
