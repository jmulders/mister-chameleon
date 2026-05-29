/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint — handles both live and test mode events.
 *
 * ─── Security ────────────────────────────────────────────────────────────────
 *
 *   Signature verification uses the correct secret for the current STRIPE_MODE:
 *     live  → STRIPE_WEBHOOK_SECRET
 *     test  → STRIPE_TEST_WEBHOOK_SECRET (from Stripe CLI or Dashboard test endpoint)
 *
 *   After verification, event.livemode is validated against STRIPE_MODE.
 *   A live Stripe event received while STRIPE_MODE=test (or vice versa) is
 *   rejected with a 400 — it will NOT be processed, preventing data corruption.
 *
 * ─── Test mode setup ─────────────────────────────────────────────────────────
 *
 *   1. Set STRIPE_MODE=test and STRIPE_TEST_SECRET_KEY in your environment.
 *   2. Run: stripe listen --forward-to <your-url>/api/webhooks/stripe
 *   3. Copy the signing secret printed by the CLI into STRIPE_TEST_WEBHOOK_SECRET.
 *   4. Test events from `stripe trigger payment_intent.succeeded` will flow through
 *      this endpoint and be verified with the CLI-provided secret.
 *
 *   In Stripe Dashboard test mode, you can also register a separate test webhook
 *   endpoint pointing to /api/webhooks/stripe with your test webhook secret.
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 *   All handlers are idempotent at the business logic level.
 *   Additionally, recordWebhookEvent() uses INSERT ON CONFLICT DO NOTHING so
 *   that duplicate event deliveries produce at most one audit row.
 *
 * ─── Audit log ───────────────────────────────────────────────────────────────
 *
 *   Every processed event is recorded in wallet_webhook_events for admin
 *   visibility.  Failed handler calls are also recorded with their error.
 *   Audit log failures are non-fatal — the webhook response is not affected.
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                from "@supabase/supabase-js";
import Stripe                          from "stripe";
import {
  handleStripeWebhook,
  recordWebhookEvent,
}                                       from "@/billing/stripe";
import { resolveStripeCredentials }    from "@/platform/platform-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {

  // ── 1. Read raw body ────────────────────────────────────────────────────────

  const payload   = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 400 });
  }

  // ── 2. Resolve credentials from DB (+ env fallback) ─────────────────────────
  //
  // resolveStripeCredentials() reads from the platform_settings DB row saved
  // via /admin/platform/integrations/stripe, falling back to env vars.
  // This means no env vars are needed if the admin dashboard is configured.

  const { secretKey, webhookSecret, mode } = await resolveStripeCredentials();

  if (!webhookSecret) {
    console.error("[stripe-webhook] No webhook secret configured. Set it at /admin/platform/integrations/stripe.");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  if (!secretKey) {
    console.error("[stripe-webhook] No Stripe secret key configured.");
    return NextResponse.json({ error: "Stripe secret key not configured" }, { status: 500 });
  }

  // ── 3. Verify signature ──────────────────────────────────────────────────────

  const stripeClient = new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil" as Parameters<typeof Stripe>[1]["apiVersion"],
    typescript: true,
  });

  let event: Stripe.Event;
  try {
    event = stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    console.warn("[stripe-webhook] Invalid webhook signature — rejected");
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // ── 4. Validate livemode vs resolved mode ────────────────────────────────────
  //
  // mode is inferred from the publishable key prefix (pk_test_ → test).
  // Reject events whose livemode doesn't match to prevent data contamination.

  const expectedLive = mode === "live";
  if (event.livemode !== expectedLive) {
    const modeError = `livemode_mismatch: event.livemode=${event.livemode} but resolved mode=${mode}`;
    console.error(`[stripe-webhook] ${modeError}`, { eventId: event.id, eventType: event.type });
    // Return 200 so Stripe stops retrying — this is a config mismatch, not transient.
    return NextResponse.json({ received: true, error: modeError, action: "livemode_mismatch" });
  }

  // ── 4. Initialise Supabase ──────────────────────────────────────────────────

  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    console.error("[stripe-webhook] Supabase env vars missing");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 5. Handle event ─────────────────────────────────────────────────────────

  let result: { handled: boolean; action: string; tenantId: string | null };
  let handlerError: string | undefined;

  try {
    result = await handleStripeWebhook(client, event, mode);

    console.log(
      `[stripe-webhook] ${event.type} → ${result.action} ` +
      `(handled=${result.handled}, tenant=${result.tenantId ?? "unknown"}, ` +
      `livemode=${event.livemode})`,
    );
  } catch (err) {
    handlerError = (err as Error).message ?? String(err);
    result = { handled: false, action: "handler_threw", tenantId: null };

    console.error(`[stripe-webhook] Error handling ${event.type}:`, err);
  }

  // ── 6. Record audit event ───────────────────────────────────────────────────
  //
  // Non-fatal: audit log failure must not prevent the 200 response.

  await recordWebhookEvent(
    client,
    event.id,
    event.type,
    event.livemode,
    result.tenantId,
    result.handled,
    result.action,
    handlerError,
  );

  // ── 7. Respond ──────────────────────────────────────────────────────────────
  //
  // Always return 200 after recording the event.  Returning non-200 causes
  // Stripe to retry — only do that if you want the event redelivered.
  // Handler errors are logged and recorded in the audit log for investigation.

  return NextResponse.json({
    received: true,
    event:    event.type,
    action:   result.action,
    handled:  result.handled,
    livemode: event.livemode,
    ...(handlerError ? { error: handlerError } : {}),
  });
}
