/**
 * billing/stripe.ts
 *
 * Stripe integration — checkout sessions, billing portal, webhook handling.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   This file MUST NOT be imported in client components.  It imports the
 *   Stripe Node.js SDK and accesses server-only environment variables.
 *
 * ─── Mode model ───────────────────────────────────────────────────────────────
 *
 *   This module is mode-aware.  All Stripe calls use the client returned by
 *   getStripeClient() from billing/stripe-config.ts, which selects live or test
 *   credentials based on STRIPE_MODE.
 *
 *   Three modes exist — see billing/stripe-config.ts for the full specification:
 *     stripe_live        — real keys, real money (default)
 *     stripe_test        — test keys, test customers, no real charges
 *     wallet_simulated   — no Stripe at all (callers must guard before this file)
 *
 * ─── Webhook events handled ──────────────────────────────────────────────────
 *
 *   checkout.session.completed        — new subscription OR credit bundle OR wallet top-up
 *   customer.subscription.created    — persist period dates
 *   customer.subscription.updated    — plan change, status change
 *   customer.subscription.deleted    — cancellation
 *   invoice.created                  — sync period dates
 *   invoice.paid                     — new billing period, reset included credits
 *   invoice.payment_failed           — mark subscription as past_due
 *   payment_intent.succeeded         — wallet auto-reload credit (webhook-only path)
 *   payment_intent.payment_failed    — wallet auto-reload failure
 *   payment_intent.requires_action   — wallet auto-reload 3DS required
 */

import Stripe                          from "stripe";
import { createClient }                from "@supabase/supabase-js";
import type { SupabaseClient }          from "@supabase/supabase-js";
import { getPlan, BILLING_PLANS, CREDIT_BUNDLES, getResolvedPlanStripePriceId } from "./plans";
import { addCredits, isSchemaMissingCode }        from "./usage";
import { syncPackageKeyFromPlan }                 from "./subscriptions";
import {
  markTenantPastDue,
  markTenantUnpaid,
  sendDunningEmail,
  getTenantDunningSettings,
}                                                 from "./dunning";
import { serializeError }              from "./errors";
import {
  getStripeClient,
  getStripeWebhookSecret,
  getStripeMode,
  validateEventLivemode,
  type StripeMode,
} from "./stripe-config";

// ── TypeScript 5.9.3-beta Stripe SDK compatibility shim ───────────────────────
//
// TS 5.9.3-beta fails to resolve a subset of Stripe instance properties.
// Cast to any in one place so call-sites remain readable.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripeAny(mode?: StripeMode): any { return getStripeClient(mode); }

// ── Local shapes for Stripe objects (TS 5.9.3-beta workaround) ───────────────

interface StripeCheckoutSession {
  url:          string | null;
  mode:         string | null;
  metadata:     Record<string, string | undefined> | null;
  customer:     string | null;
  subscription: string | null;
}

interface StripeSubscriptionItem {
  plan?:                 { interval?: string };
  // Sinds Stripe API 2024-09-30 leeft de facturatieperiode HIER, op het item —
  // niet meer op de root van het subscription-object.
  current_period_start?: number;
  current_period_end?:   number;
}

interface StripeSubscription {
  id:                    string;
  status:                string;
  customer:              string;
  metadata:              Record<string, string | undefined>;
  items:                 { data: Array<StripeSubscriptionItem> };
  start_date?:           number;
  billing_cycle_anchor?: number;
  // ── current_period_start/end zijn hier OPTIONEEL en dat is de hele bug ───────
  //
  // Dit type verklaarde ze ooit als verplichte root-velden (`: number`). Dat was
  // dezelfde leugen als de verwijderde `declare module "stripe"`-shim: sinds API
  // 2024-09-30 staan ze op items.data[0], niet op de root. De `as unknown as`-cast
  // in de handlers dwong het echte Stripe-object in dit foute type, dus de
  // typecheck zweeg. Bij runtime was sub.current_period_end dus undefined, en
  // `new Date(undefined * 1000).toISOString()` gooit een RangeError. De handler
  // crashte, de route ving het in try/catch, logde handler_threw en gaf tóch 200 —
  // Stripe dacht "afgeleverd" terwijl de database nooit werd bijgewerkt. Zo kon
  // een levend abonnement een maand achterlopen. Optioneel gelaten zodat oude
  // payloads (van vóór 2024-09-30) nog steeds resolven via de fallback hieronder.
  current_period_start?: number;
  current_period_end?:   number;
  cancel_at_period_end:  boolean;
  canceled_at:           number | null;
}

/**
 * Lees de huidige facturatieperiode uit een subscription, waar Stripe hem ook
 * heeft gezet. Voorkeur: item-niveau (huidige API). Terugval: de oude root-velden
 * (payloads van vóór 2024-09-30), dan billing_cycle_anchor / start_date. Zo komt
 * er altijd een coherente start uit en nooit een NaN die de handler laat crashen.
 */
export function subscriptionPeriod(sub: StripeSubscription): { start: number; end: number | null } {
  const item = sub.items?.data?.[0];
  const start =
    item?.current_period_start ??
    sub.current_period_start ??
    sub.start_date ??
    sub.billing_cycle_anchor ??
    Math.floor(Date.now() / 1000);
  const end =
    item?.current_period_end ??
    sub.current_period_end ??
    null;
  return { start, end };
}

/**
 * Realign a just-converted trial to the calendar month (the 1st).
 *
 * ─── Waarom ──────────────────────────────────────────────────────────────────
 *
 * Een trial-checkout kan geen billing_cycle_anchor zetten (Stripe verbiedt trial +
 * anchor in Checkout), dus het anker volgt trial_end = aanmelddag + 14 dagen — een
 * willekeurige dag van de maand. Bij conversie erft het abonnement dan exact de
 * kalendermaand-drift die de rest van deze codebase juist wegwerkt: een periode van
 * bijv. de 9e → de 9e loopt dwars door de cap-reset op de 1e.
 *
 * Gekozen aanpak (optie b): laat de trial exact 14 dagen duren, en herank bij
 * conversie naar de eerstvolgende 1e met `proration_behavior=none` — een paar gratis
 * dagen, daarna facturatie op de 1e.
 *
 * ─── De lus-guard ────────────────────────────────────────────────────────────
 *
 * trial_end zetten maakt het abonnement opnieuw `trialing` tot de 1e; op de 1e gaat
 * het weer trialing→active en vuurt dit event nóg een keer. Zónder guard zou het
 * elke maand opnieuw herankeren (oneindig gratis). Daarom: is de periode al netjes
 * op middernacht-de-1e uitgelijnd, dan doen we niets.
 */
export function trialConversionRealign(
  sub: StripeSubscription,
  previousStatus: string | undefined,
  now: Date = new Date(),
): { realign: boolean; trialEnd: number } {
  const justConverted = previousStatus === "trialing" && sub.status === "active";
  const end = subscriptionPeriod(sub).end;
  if (!justConverted || end == null) return { realign: false, trialEnd: 0 };

  const endDate = new Date(end * 1000);
  const alreadyAligned =
    endDate.getUTCDate() === 1 &&
    endDate.getUTCHours() === 0 &&
    endDate.getUTCMinutes() === 0 &&
    endDate.getUTCSeconds() === 0;
  if (alreadyAligned) return { realign: false, trialEnd: 0 };

  return { realign: true, trialEnd: nextCalendarMonthStartUnix(now) };
}

// ── RPC availability helper ────────────────────────────────────────────────────
//
// Like isSchemaMissingCode but also covers the RPC-not-found errors that
// PostgREST returns when a Postgres function doesn't exist yet.

function isSchemaMissingRpcCode(code: string | null | undefined): boolean {
  return (
    isSchemaMissingCode(code) ||
    code === "42883" // undefined_function — function does not exist in pg
  );
}

// ── Customer management ────────────────────────────────────────────────────────

/**
 * Return the existing Stripe customer ID for a tenant, or create a new one.
 *
 * Mode-aware:
 *   live  → looks in subscriptions.stripe_customer_id
 *   test  → looks in tenant_wallets.stripe_test_customer_id
 *
 * In test mode, a test customer is created with Stripe's test key and stored
 * in the separate stripe_test_customer_id column — live customer IDs are never
 * touched.
 */
export async function getOrCreateStripeCustomer(
  client:    SupabaseClient,
  tenantId:  string,
  email?:    string,
  name?:     string,
): Promise<string> {
  const mode = getStripeMode();

  if (mode === "test") {
    return getOrCreateTestStripeCustomer(client, tenantId, email, name);
  }

  // ── Live mode: check subscriptions table ─────────────────────────────────
  const { data: existing } = await client
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const existingId = (existing as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (existingId) return existingId;

  // Create a live customer
  const stripe   = getStripeClient("live");
  const customer = await stripe.customers.create({
    metadata: { tenant_id: tenantId },
    ...(email ? { email } : {}),
    ...(name  ? { name  } : {}),
  });

  await upsertSubscription(client, tenantId, {
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

/**
 * Return or create a Stripe TEST customer for a tenant.
 * Stored in tenant_wallets.stripe_test_customer_id — never in subscriptions.
 */
async function getOrCreateTestStripeCustomer(
  client:   SupabaseClient,
  tenantId: string,
  email?:   string,
  name?:    string,
): Promise<string> {
  const { data: wallet } = await client
    .from("tenant_wallets")
    .select("stripe_test_customer_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const existing = (wallet as { stripe_test_customer_id?: string | null } | null)?.stripe_test_customer_id;
  if (existing) return existing;

  // Create a test customer using test Stripe keys
  const stripe   = getStripeClient("test");
  const customer = await stripe.customers.create({
    metadata: { tenant_id: tenantId, stripe_mode: "test" },
    ...(email ? { email } : {}),
    ...(name  ? { name  } : {}),
  });

  // Persist to wallet row, not subscriptions
  await client
    .from("tenant_wallets")
    .update({ stripe_test_customer_id: customer.id })
    .eq("tenant_id", tenantId);

  console.info("[billing/stripe] Created Stripe test customer", {
    tenantId,
    customerId: customer.id,
  });

  return customer.id;
}

// ── Calendar-month billing anchor ─────────────────────────────────────────────

/**
 * The Unix timestamp (seconds) of 00:00:00 UTC on the next 1st of the month.
 *
 * ─── Why every subscription anchors to the 1st ───────────────────────────────
 *
 *   The session bundle resets on `month_key`, a UTC calendar month (see
 *   billing/plan-enforcement.ts). Stripe's default anchor is the signup moment,
 *   so a tenant who subscribed on the 27th was invoiced 27th→27th while their
 *   cap reset on the 1st. Their paid period straddled two monthly buckets: up to
 *   two full bundles for one month's money, with nothing in the system noticing.
 *
 *   Anchoring here to 00:00 UTC on the 1st makes the invoice period and the cap
 *   window the same window, by construction rather than by coincidence. Stripe
 *   prorates the partial first month automatically (proration_behavior defaults
 *   to create_prorations): subscribe on the 15th, pay half a month, then full
 *   months from the 1st.
 *
 * ─── On the timezone ─────────────────────────────────────────────────────────
 *
 *   00:00 UTC, not 00:00 Amsterdam, on purpose. month_key is derived from a UTC
 *   ISO string, so a local-midnight anchor would reintroduce the same drift this
 *   fixes — just smaller (one or two hours instead of two weeks). The cost is
 *   that a Dutch tenant's month rolls over at 01:00/02:00 local; two hours of
 *   1 July traffic book to June. Both numbers agree with each other and with the
 *   invoice, which is what matters. Label it in the dashboard, don't "fix" it.
 *
 *   Always in the future and never more than ~31 days out, so it satisfies
 *   Stripe's constraint that the anchor fall within one billing interval.
 */
export function nextCalendarMonthStartUnix(now: Date = new Date()): number {
  const firstOfNextMonth = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1, // Date.UTC rolls December → January of the next year
    1, 0, 0, 0, 0,
  );
  return Math.floor(firstOfNextMonth / 1000);
}

// ── Checkout sessions ──────────────────────────────────────────────────────────

export interface CheckoutSessionOptions {
  tenantId:          string;
  planId:            string;
  billingCycle:      "monthly" | "annual";
  successUrl:        string;
  cancelUrl:         string;
  customerEmail?:    string;
  stripeCustomerId?: string;
  /**
   * Pre-resolved Stripe Price ID.  When supplied, skips the env-var lookup on
   * BILLING_PLANS and uses this value directly.  Pass this from the checkout
   * route after calling `getResolvedPlanStripePriceId()` so that DB-stored
   * price IDs work without requiring env vars in production.
   */
  priceId?: string;
}

/**
 * Create a Stripe Checkout session for a new or upgraded subscription.
 * Uses the Stripe client appropriate for the current STRIPE_MODE.
 */
export async function createCheckoutSession(
  opts: CheckoutSessionOptions,
): Promise<string> {
  const stripe = getStripeClient();

  // Use caller-supplied priceId first (resolved from DB), then fall back to
  // the env-var-backed BILLING_PLANS static config.
  const plan    = getPlan(opts.planId);
  const priceId = opts.priceId
    ?? (opts.billingCycle === "annual" ? plan.stripePriceIds.annual : plan.stripePriceIds.monthly);

  if (!priceId) {
    const envKey = `STRIPE_PRICE_${opts.planId.toUpperCase()}_${opts.billingCycle.toUpperCase()}`;
    throw new Error(
      `[billing/stripe] Stripe Price ID not configured for plan "${opts.planId}" ` +
      `(${opts.billingCycle}). Set ${envKey} in the environment or add it to ` +
      `the billing_plans table at /admin/platform/billing/plans.`,
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode:          "subscription",
    line_items:    [{ price: priceId, quantity: 1 }],
    success_url:   opts.successUrl,
    cancel_url:    opts.cancelUrl,
    customer:      opts.stripeCustomerId,
    customer_email: !opts.stripeCustomerId ? opts.customerEmail : undefined,
    metadata: {
      tenant_id:     opts.tenantId,
      plan_id:       opts.planId,
      billing_cycle: opts.billingCycle,
      stripe_mode:   getStripeMode(),
    },
    subscription_data: {
      metadata: {
        tenant_id: opts.tenantId,
        plan_id:   opts.planId,
      },
      // Bill on the 1st, like the cap resets on the 1st. Without this Stripe
      // anchors to the signup moment and the two windows drift apart — see
      // nextCalendarMonthStartUnix. proration_behavior is left at its default
      // (create_prorations), so the partial first month is charged pro rata.
      billing_cycle_anchor: nextCalendarMonthStartUnix(),
    },
  });

  if (!session.url) throw new Error("[billing/stripe] Stripe Checkout session URL is null");
  return session.url;
}

/**
 * Create a Checkout session for a one-time credit bundle purchase.
 */
export async function createCreditBundleCheckout(opts: {
  tenantId:          string;
  bundleId:          string;
  successUrl:        string;
  cancelUrl:         string;
  stripeCustomerId?: string;
}): Promise<string> {
  const stripe = getStripeClient();
  const bundle = CREDIT_BUNDLES.find((b) => b.id === opts.bundleId);
  if (!bundle) {
    throw new Error(
      `[billing/stripe] Unknown credit bundle: "${opts.bundleId}". ` +
      `Valid IDs: ${CREDIT_BUNDLES.map((b) => b.id).join(", ")}`,
    );
  }
  if (!bundle.stripePrice) {
    const envKey = `STRIPE_PRICE_${opts.bundleId.toUpperCase()}`;
    throw new Error(
      `[billing/stripe] Stripe Price ID not configured for bundle "${opts.bundleId}". ` +
      `Set ${envKey} in the environment.`,
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode:        "payment",
    line_items:  [{ price: bundle.stripePrice, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url:  opts.cancelUrl,
    customer:    opts.stripeCustomerId,
    metadata: {
      tenant_id:   opts.tenantId,
      bundle_id:   opts.bundleId,
      type:        "credit_bundle",
      stripe_mode: getStripeMode(),
    },
  });

  if (!session.url) throw new Error("[billing/stripe] Credit bundle Checkout session URL is null");
  return session.url;
}

/**
 * Create a one-time Checkout session to pre-pay the first period of a pending
 * plan change.  Used when a platform-managed tenant (no stripe_subscription_id)
 * schedules a plan upgrade — payment is collected immediately but the plan
 * activates at the start of the next billing period.
 *
 * The checkout session is created in `payment` mode (not subscription) so no
 * new Stripe Subscription is created.  The calling action sets
 * `pending_plan_paid_at` on the subscription row after the session completes.
 */
export async function createPlanChangeCheckout(opts: {
  tenantId:        string;
  newPlanId:       string;
  billingCycle:    "monthly" | "annual";
  amountCents:     number;
  successUrl:      string;
  cancelUrl:       string;
  stripeCustomerId?: string;
  description?:    string;
}): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stripe = getStripeClient() as any;

  const session = await stripe.checkout.sessions.create({
    mode:        "payment",
    line_items:  [
      {
        price_data: {
          currency:     "eur",
          unit_amount:  opts.amountCents,
          product_data: {
            name:        opts.description ?? `${opts.newPlanId} plan — first period`,
            description: `${opts.billingCycle === "annual" ? "Annual" : "Monthly"} billing cycle`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: opts.successUrl,
    cancel_url:  opts.cancelUrl,
    customer:    opts.stripeCustomerId,
    // Save the card for future off-session charges (monthly renewal).
    payment_intent_data: {
      setup_future_usage: "off_session",
    },
    metadata: {
      tenant_id:     opts.tenantId,
      plan_id:       opts.newPlanId,
      billing_cycle: opts.billingCycle,
      type:          "plan_change",
      stripe_mode:   getStripeMode(),
    },
  });

  if (!session.url) throw new Error("[billing/stripe] Plan-change Checkout session URL is null");
  return session.url as string;
}

/**
 * Create a Stripe Billing Portal session (mode-aware).
 *
 * @param flow  Optional flow type.  Pass "payment_method_update" to open the
 *              portal directly on the card management screen rather than the
 *              general portal home.  This works regardless of whether the
 *              portal configuration has the feature enabled as a menu item.
 */
export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl:        string,
  flow?:            string,
): Promise<string> {
  const params: Record<string, unknown> = {
    customer:   stripeCustomerId,
    return_url: returnUrl,
  };

  // flow_data drives the portal to a specific screen on load.
  // "payment_method_update" opens directly to the card management UI.
  if (flow === "payment_method_update") {
    params["flow_data"] = { type: "payment_method_update" };
  }

  const session = await stripeAny().billingPortal.sessions.create(params) as { url: string };
  return session.url;
}

// ── Webhook ────────────────────────────────────────────────────────────────────

/**
 * Verify the Stripe webhook signature and parse the event.
 *
 * Mode-aware: uses STRIPE_TEST_WEBHOOK_SECRET when STRIPE_MODE=test,
 * STRIPE_WEBHOOK_SECRET otherwise.
 *
 * Returns null if the signature is invalid — caller should return HTTP 400.
 */
export function parseWebhookEvent(
  payload:   string | Buffer,
  signature: string,
): Stripe.Event | null {
  const secret = getStripeWebhookSecret();
  try {
    return getStripeClient().webhooks.constructEvent(
      payload as unknown as string,
      signature,
      secret,
    );
  } catch {
    return null;
  }
}

/**
 * Record a webhook event in the wallet_webhook_events audit log.
 *
 * Uses INSERT … ON CONFLICT DO NOTHING for idempotency — duplicate deliveries
 * of the same stripe_event_id are silently discarded.
 *
 * @param tenantId  Optional — not all events carry tenant_id in metadata.
 */
export async function recordWebhookEvent(
  client:        SupabaseClient,
  stripeEventId: string,
  eventType:     string,
  livemode:      boolean,
  tenantId:      string | null,
  handled:       boolean,
  action:        string,
  error?:        string,
): Promise<void> {
  try {
    const { error: dbErr } = await client.from("wallet_webhook_events").upsert(
      {
        stripe_event_id: stripeEventId,
        event_type:      eventType,
        livemode,
        tenant_id:       tenantId ?? null,
        handled,
        action,
        error:           error ?? null,
        received_at:     new Date().toISOString(),
      } as never,
      { onConflict: "stripe_event_id", ignoreDuplicates: true },
    );
    if (dbErr) {
      if (dbErr.code === "42P01") {
        // Table missing — migration 047 not yet applied.  Silently skip.
        // This is expected on DBs where migration 046 failed due to the FK bug.
        console.warn("[billing/stripe] recordWebhookEvent: wallet_webhook_events table missing — run migration 047");
        return;
      }
      console.error("[billing/stripe] recordWebhookEvent DB error", {
        stripeEventId,
        ...serializeError(dbErr),
      });
    }
  } catch (err) {
    // Non-fatal — audit log failure must never break the webhook flow.
    console.error("[billing/stripe] recordWebhookEvent failed", {
      stripeEventId,
      ...serializeError(err),
    });
  }
}

/**
 * Stripe webhook health signal for the admin integrations page.
 *
 * Counts recently-recorded `livemode_mismatch` events. A non-zero count means
 * Stripe events are arriving whose livemode does not match the platform's
 * resolved mode — almost always LIVE subscription events hitting a platform that
 * is still configured with TEST keys, so live billing is silently not processed.
 * (The webhook route now records these instead of dropping them, so this lights
 * up the moment it happens rather than hiding a stalled subscription for weeks.)
 */
export async function getStripeWebhookHealth(): Promise<{
  mismatchCount:        number;
  lastMismatchAt:       string | null;
  lastMismatchLivemode: boolean | null;
}> {
  const empty = { mismatchCount: 0, lastMismatchAt: null, lastMismatchLivemode: null };
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return empty;
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await client
      .from("wallet_webhook_events")
      .select("received_at, livemode")
      .eq("action", "livemode_mismatch")
      .order("received_at", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as Array<{ received_at: string | null; livemode: boolean | null }>;
    return {
      mismatchCount:        rows.length,
      lastMismatchAt:       rows[0]?.received_at ?? null,
      lastMismatchLivemode: rows[0]?.livemode ?? null,
    };
  } catch {
    return empty;
  }
}

/**
 * Handle a Stripe webhook event.
 *
 * Idempotent — safe to call multiple times with the same event.
 * Returns { handled: true, action: string, tenantId: string | null }.
 *
 * The caller (webhook route) is responsible for calling recordWebhookEvent()
 * with the result so the audit log stays current.
 */
/**
 * Resolve the tenant a Stripe subscription belongs to.
 *
 * Prefers the `tenant_id` stamped into the subscription metadata at creation.
 * Falls back to a lookup in our `subscriptions` table by stripe_subscription_id,
 * then stripe_customer_id. The fallback recovers subscriptions created before the
 * metadata was stamped (e.g. legacy trial-signup subs, where the tenant slug was
 * only minted inside the webhook AFTER the subscription existed) so their
 * lifecycle events stop silently no-op-ing.
 *
 * Also returns the existing stored plan, so callers can preserve it when the
 * event carries no `plan_id` metadata instead of clobbering it to "starter".
 */
async function resolveTenantForSub(
  client: SupabaseClient,
  sub:    { id?: string | null; customer?: string | null; metadata?: Record<string, string | undefined> | null },
): Promise<{ tenantId: string; existingPlan: string | null } | null> {
  const metaTenant = sub.metadata?.tenant_id ?? null;
  if (metaTenant) {
    const { data } = await client
      .from("subscriptions").select("plan").eq("tenant_id", metaTenant).maybeSingle();
    return { tenantId: metaTenant, existingPlan: (data?.plan as string | null) ?? null };
  }
  if (sub.id) {
    const { data } = await client
      .from("subscriptions").select("tenant_id, plan").eq("stripe_subscription_id", sub.id).maybeSingle();
    if (data?.tenant_id) return { tenantId: data.tenant_id as string, existingPlan: (data.plan as string | null) ?? null };
  }
  if (sub.customer) {
    const { data } = await client
      .from("subscriptions").select("tenant_id, plan").eq("stripe_customer_id", sub.customer).maybeSingle();
    if (data?.tenant_id) return { tenantId: data.tenant_id as string, existingPlan: (data.plan as string | null) ?? null };
  }
  return null;
}

export async function handleStripeWebhook(
  client:         SupabaseClient,
  event:          Stripe.Event,
  /** Resolved mode from the caller (DB + env). When provided, skips the internal
   *  env-var-only check so DB-configured mode is respected. */
  resolvedMode?:  "live" | "test",
): Promise<{ handled: boolean; action: string; tenantId: string | null }> {

  // ── Mode safety: reject livemode mismatch ─────────────────────────────────
  //
  // Use the caller-resolved mode when available (DB + env priority).
  // Fall back to getStripeMode() (env-only) for backward compatibility.
  const effectiveMode = resolvedMode ?? getStripeMode();
  const expectedLive  = effectiveMode === "live";
  if (event.livemode !== expectedLive) {
    const modeError = `event.livemode=${event.livemode} but mode=${effectiveMode}`;
    console.error(`[billing/stripe] Livemode mismatch: ${modeError}`, {
      eventId:  event.id,
      livemode: event.livemode,
      mode:     effectiveMode,
    });
    return { handled: false, action: "livemode_mismatch", tenantId: null };
  }

  switch (event.type) {

    // ── checkout.session.completed ─────────────────────────────────────────────

    case "checkout.session.completed": {
      const session = event.data.object as unknown as StripeCheckoutSession;

      // ── Wallet manual top-up ──────────────────────────────────────────────
      if (session.metadata?.type === "wallet_top_up") {
        const tenantId    = session.metadata.tenant_id ?? null;
        const amountCents = parseInt(session.metadata.amount_cents ?? "0", 10);
        if (tenantId && amountCents > 0) {
          const { creditWallet } = await import("./wallet");
          await creditWallet(
            client,
            tenantId,
            amountCents,
            "top_up_manual",
            "stripe_checkout",
            session.customer as string | undefined,
            `Manual top-up via Stripe Checkout (${event.livemode ? "live" : "test"})`,
          );

          // In test mode, store the test customer ID on the wallet row so future
          // top-ups and auto-reloads can reuse it without creating a new customer.
          if (!event.livemode && session.customer) {
            await client
              .from("tenant_wallets")
              .update({ stripe_test_customer_id: session.customer })
              .eq("tenant_id", tenantId);
          }
        }
        return { handled: true, action: "wallet_top_up_processed", tenantId: tenantId ?? null };
      }

      // ── Trial signup — create tenant + admin user ─────────────────────────
      if (session.metadata?.type === "trial_signup") {
        const pendingId = session.metadata.pending_signup_id;
        if (!pendingId) {
          return { handled: false, action: "trial_signup_missing_pending_id", tenantId: null };
        }

        // Fetch the pending signup row
        const { data: pending, error: fetchErr } = await client
          .from("pending_trial_signups")
          .select("*")
          .eq("id", pendingId)
          .eq("status", "pending")
          .maybeSingle();

        if (fetchErr || !pending) {
          console.error("[stripe-webhook] trial_signup: pending row not found or already processed", pendingId);
          return { handled: false, action: "trial_signup_pending_not_found", tenantId: null };
        }

        const { name, email, company, password_hash, plan_id } = pending as {
          name: string; email: string; company: string; password_hash: string; plan_id: string;
        };

        // Derive a unique tenant slug
        function slugify(s: string) {
          return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tenant";
        }
        async function uniqueSlug(base: string): Promise<string> {
          let attempt = 0;
          while (true) {
            const candidate = attempt === 0 ? slugify(base) : `${slugify(base)}-${attempt}`;
            const { data } = await client.from("tenant_settings").select("tenant_id").eq("tenant_id", candidate).maybeSingle();
            if (!data) return candidate;
            attempt++;
            if (attempt > 99) return `${slugify(base)}-${Date.now()}`;
          }
        }
        const tenantId = await uniqueSlug(company);

        const now          = new Date().toISOString();
        const trialEndsAt  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        const planLabel    = plan_id.charAt(0).toUpperCase() + plan_id.slice(1);

        // Create admin_user
        const { data: newUser, error: userErr } = await client
          .from("admin_users")
          .insert({ email, password_hash, name, role: "tenant_admin", is_active: true, created_at: now, updated_at: now })
          .select("id")
          .single();

        if (userErr || !newUser?.id) {
          console.error("[stripe-webhook] trial_signup: admin_users insert failed", userErr?.message);
          await client.from("pending_trial_signups").update({ status: "failed" }).eq("id", pendingId);
          return { handled: false, action: "trial_signup_user_create_failed", tenantId: null };
        }

        const userId = newUser.id as string;

        // Create tenant_settings
        const { error: tenantErr } = await client
          .from("tenant_settings")
          .insert({
            id:         tenantId,
            tenant_id:  tenantId,
            settings: {
              tenantId,
              name:       company,
              packageKey: plan_id,
              features:   { experiments: true, ai: plan_id !== "starter", analytics: true },
              ai:         { mode: "disabled" },
              cms:        { provider: "sanity", projectId: "", dataset: "production" },
              design:     { theme: "default" },
              trial:      { active: true, startedAt: now, endsAt: trialEndsAt },
            },
            updated_at: now,
          });

        if (tenantErr) {
          console.error("[stripe-webhook] trial_signup: tenant_settings insert failed", tenantErr.message);
          await client.from("admin_users").delete().eq("id", userId);
          await client.from("pending_trial_signups").update({ status: "failed" }).eq("id", pendingId);
          return { handled: false, action: "trial_signup_tenant_create_failed", tenantId: null };
        }

        // Bind user to tenant
        await client.from("admin_user_tenants").insert({ user_id: userId, tenant_id: tenantId, created_at: now });

        // Store Stripe customer + subscription on the new tenant
        const customerId = session.customer as string | null;
        const subId      = session.subscription as string | null;
        if (customerId && subId) {
          const { error: subErr } = await client.from("subscriptions").upsert({
            tenant_id:              tenantId,
            stripe_customer_id:     customerId,
            stripe_subscription_id: subId,
            plan:                   plan_id,
            status:                 "trialing",
            billing_cycle:          "monthly",
            current_period_start:   now,
            current_period_end:     trialEndsAt,
          }, { onConflict: "tenant_id" });
          if (subErr) {
            console.error("[stripe-webhook] trial_signup: subscriptions upsert failed:", subErr.message);
          }

          // Stamp tenant_id + plan_id onto the Stripe subscription so ALL future
          // lifecycle webhooks (subscription.updated on trial conversion,
          // invoice.*) can resolve the tenant. The slug is only minted here,
          // AFTER Stripe created the subscription, so without this back-stamp the
          // subscription is orphaned from its own events and the trial→active /
          // dunning transitions silently no-op. Non-fatal on failure — the DB row
          // exists and resolveTenantForSub() also falls back to a sub-id lookup.
          try {
            await stripeAny().subscriptions.update(subId, {
              metadata: { tenant_id: tenantId, plan_id, type: "trial_signup" },
            });
          } catch (metaErr) {
            console.warn("[stripe-webhook] trial_signup: failed to stamp subscription metadata", metaErr);
          }
        } else {
          console.warn("[stripe-webhook] trial_signup: no customerId or subId on session, subscription row not created", { customerId, subId });
        }

        // Mark pending row as completed
        await client
          .from("pending_trial_signups")
          .update({ status: "completed", completed_at: now })
          .eq("id", pendingId);

        // Fire welcome + admin notification emails (best-effort)
        try {
          const { sendMail, resolveTransportConfig }  = await import("@/forms/mail-transport");
          const { serverEnv }                          = await import("@/lib/env");
          const { getPlatformEmailSettings }           = await import("@/platform/platform-store");
          const platformEmailResult                    = await getPlatformEmailSettings();
          const platformEmailConfig                    = platformEmailResult.ok ? platformEmailResult.data : null;
          const transport                              = resolveTransportConfig(null, platformEmailConfig);
          const fromAddress    = serverEnv.email.fromAddress ?? "Mister Chameleon <hello@mister-chameleon.com>";
          const adminAddress   = serverEnv.email.backofficeEmail;
          const trialEndDate   = new Date(trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

          const welcomeResult = await sendMail({
            from: fromAddress, to: [email],
            subject: `Welcome to Mister Chameleon — your ${planLabel} trial has started`,
            text: `Hi ${name},\n\nYour ${planLabel} trial is active until ${trialEndDate}.\n\nLog in: https://mister-chameleon.com/admin\n\nThe Mister Chameleon team`,
            html: `<p>Hi ${name},</p><p>Your <strong>${planLabel} trial</strong> is active until <strong>${trialEndDate}</strong>.</p><p><a href="https://mister-chameleon.com/admin" style="background:#4f46e5;color:white;padding:0.75rem 1.5rem;border-radius:0.5rem;text-decoration:none;font-weight:600;display:inline-block;">Go to your dashboard</a></p>`,
          }, transport);
          if (!welcomeResult.ok) {
            console.warn("[stripe-webhook] trial_signup: welcome email failed:", welcomeResult.error);
          } else {
            console.info(`[stripe-webhook] trial_signup: welcome email sent to ${email}`);
          }

          if (adminAddress) {
            const adminResult = await sendMail({
              from: fromAddress, to: [adminAddress],
              subject: `New trial signup (Stripe): ${name} (${planLabel})`,
              text: `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nPlan: ${planLabel}\nTenant: ${tenantId}\nTrial ends: ${trialEndDate}`,
            }, transport);
            if (!adminResult.ok) {
              console.warn("[stripe-webhook] trial_signup: admin notification email failed:", adminResult.error);
            }
          }
        } catch (emailErr) {
          console.warn("[stripe-webhook] trial_signup: email send failed", emailErr);
        }

        console.info(`[stripe-webhook] trial_signup: created user=${userId} tenant=${tenantId} plan=${plan_id}`);
        return { handled: true, action: "trial_signup_completed", tenantId };
      }

      // ── Credit bundle purchase ────────────────────────────────────────────
      if (session.metadata?.type === "credit_bundle") {
        const tenantId = session.metadata.tenant_id ?? null;
        const bundleId = session.metadata.bundle_id;
        const bundle   = CREDIT_BUNDLES.find((b) => b.id === bundleId);
        if (bundle && tenantId) {
          await addCredits(client, tenantId, bundle.credits, "purchase", {
            stripeEventId: event.id,
            bundleId,
            description:   `Purchased ${bundle.label}`,
          });
        }
        return { handled: true, action: "credit_bundle_processed", tenantId: tenantId ?? null };
      }

      // ── New subscription ──────────────────────────────────────────────────
      if (session.mode === "subscription" && session.metadata?.tenant_id) {
        const tenantId    = session.metadata.tenant_id;
        const planId      = session.metadata.plan_id ?? "starter";
        const customerId  = session.customer as string;
        const subId       = session.subscription as string;

        await upsertSubscription(client, tenantId, {
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
          plan:                   planId,
          status:                 "active",
          billing_cycle:          session.metadata.billing_cycle ?? "monthly",
        });

        // Sync packageKey in tenant_settings to match the activated plan.
        await syncPackageKeyFromPlan(client, tenantId, planId);

        // No credit seeding on subscription — plans define features only.
        // Credits are purchased separately (Option B model).

        return { handled: true, action: "subscription_created", tenantId };
      }

      return { handled: false, action: "session_type_not_handled", tenantId: null };
    }

    // ── customer.subscription.created ─────────────────────────────────────────

    case "customer.subscription.created": {
      const sub      = event.data.object as unknown as StripeSubscription;
      const resolved = await resolveTenantForSub(client, sub);
      if (!resolved) return { handled: false, action: "no_tenant_id", tenantId: null };
      const tenantId = resolved.tenantId;

      const planId = sub.metadata?.plan_id ?? resolved.existingPlan ?? "starter";
      const period = subscriptionPeriod(sub);
      await upsertSubscription(client, tenantId, {
        stripe_customer_id:     sub.customer,
        stripe_subscription_id: sub.id,
        plan:                   planId,
        status:                 sub.status,
        billing_cycle:          sub.items.data[0]?.plan?.interval === "year" ? "annual" : "monthly",
        current_period_start:   new Date(period.start * 1000).toISOString(),
        current_period_end:     period.end != null ? new Date(period.end * 1000).toISOString() : null,
        cancel_at_period_end:   sub.cancel_at_period_end,
      });

      // Sync packageKey in tenant_settings to match the subscription plan.
      await syncPackageKeyFromPlan(client, tenantId, planId);

      return { handled: true, action: "subscription_created_from_event", tenantId };
    }

    // ── customer.subscription.updated ─────────────────────────────────────────

    case "customer.subscription.updated": {
      const sub      = event.data.object as unknown as StripeSubscription;
      const resolved = await resolveTenantForSub(client, sub);
      if (!resolved) return { handled: false, action: "no_tenant_id", tenantId: null };
      const tenantId = resolved.tenantId;

      const planId = sub.metadata?.plan_id ?? resolved.existingPlan ?? "starter";
      const period = subscriptionPeriod(sub);
      await upsertSubscription(client, tenantId, {
        stripe_customer_id:     sub.customer,
        stripe_subscription_id: sub.id,
        plan:                   planId,
        status:                 sub.status,
        billing_cycle:          sub.items.data[0]?.plan?.interval === "year" ? "annual" : "monthly",
        current_period_start:   new Date(period.start * 1000).toISOString(),
        current_period_end:     period.end != null ? new Date(period.end * 1000).toISOString() : null,
        cancel_at_period_end:   sub.cancel_at_period_end,
        canceled_at:            sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
      });

      // Sync packageKey in tenant_settings to match the updated plan.
      await syncPackageKeyFromPlan(client, tenantId, planId);

      // Re-activate tenant if subscription came back to active (payment resolved)
      if (sub.status === "active" || sub.status === "trialing") {
        await client
          .from("tenant_settings")
          .update({ is_active_override: null })  // null = auto (back to subscription-driven)
          .eq("tenant_id", tenantId)
          .eq("is_active_override", false);  // only clear if it was false (payment failure)
      }

      // ── Trial converted → align billing to the calendar month (the 1st) ───────
      //
      // See trialConversionRealign(): a converting trial otherwise anchors on an
      // arbitrary day and straddles the UTC-month cap reset. The guard inside makes
      // this a no-op once the period already lands on the 1st, so it cannot loop.
      const previousStatus = (event.data.previous_attributes as { status?: string } | undefined)?.status;
      const realign = trialConversionRealign(sub, previousStatus);
      if (realign.realign) {
        try {
          await stripeAny().subscriptions.update(sub.id, {
            trial_end:          realign.trialEnd,
            proration_behavior: "none",
          });
          console.info(
            `[billing/stripe] trial converted — realigned ${sub.id} to ` +
            `${new Date(realign.trialEnd * 1000).toISOString()} (tenant=${tenantId})`,
          );
        } catch (err) {
          // Non-fatal: the subscription is active and billing works; it just isn't
          // aligned to the 1st. Log for follow-up rather than fail the webhook.
          console.warn(`[billing/stripe] trial realign failed for ${sub.id}:`, err);
        }
      }

      return { handled: true, action: "subscription_updated", tenantId };
    }

    // ── customer.subscription.deleted ─────────────────────────────────────────

    case "customer.subscription.deleted": {
      const sub      = event.data.object as unknown as StripeSubscription;
      const resolved = await resolveTenantForSub(client, sub);
      if (!resolved) return { handled: false, action: "no_tenant_id", tenantId: null };
      const tenantId = resolved.tenantId;

      await client
        .from("subscriptions")
        .update({ status: "canceled", canceled_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);

      // Reset packageKey to "starter" when subscription is canceled.
      await syncPackageKeyFromPlan(client, tenantId, null);

      return { handled: true, action: "subscription_canceled", tenantId };
    }

    // ── invoice.created → sync period dates early ─────────────────────────────

    case "invoice.created": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef  = (invoice as unknown as { subscription?: string }).subscription;
      if (!subRef) return { handled: false, action: "no_subscription", tenantId: null };

      const stripeObj = await stripeAny().subscriptions.retrieve(subRef) as StripeSubscription;
      const resolved  = await resolveTenantForSub(client, stripeObj);
      if (!resolved) return { handled: false, action: "no_tenant_id", tenantId: null };
      const tenantId  = resolved.tenantId;

      const period = subscriptionPeriod(stripeObj);
      await upsertSubscription(client, tenantId, {
        current_period_start: new Date(period.start * 1000).toISOString(),
        current_period_end:   period.end != null ? new Date(period.end * 1000).toISOString() : null,
      });

      return { handled: true, action: "period_dates_synced", tenantId };
    }

    // ── invoice.paid → new billing period ─────────────────────────────────────
    //
    // Credits are NOT reset on renewal — plans define features only.
    // Credits are a separate consumable (Option B model).
    //
    // This handler still applies any deferred plan switch (monthly downgrade
    // that was stored as pending_plan and deferred to period start).

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef  = (invoice as unknown as { subscription?: string }).subscription;
      if (!subRef) return { handled: false, action: "no_subscription", tenantId: null };

      const stripeObj = await stripeAny().subscriptions.retrieve(subRef) as StripeSubscription;
      const resolved  = await resolveTenantForSub(client, stripeObj);
      if (!resolved) return { handled: false, action: "no_tenant_id", tenantId: null };
      const tenantId  = resolved.tenantId;

      // ── Apply pending plan switch if this is the start of a new period ────────

      const { data: subRow } = await client
        .from("subscriptions")
        .select("pending_plan, pending_plan_billing_cycle, stripe_subscription_id")
        .eq("tenant_id", tenantId)
        .maybeSingle() as { data: { pending_plan: string | null; pending_plan_billing_cycle: string | null; stripe_subscription_id: string | null } | null };

      if (subRow?.pending_plan && subRow.stripe_subscription_id) {
        const pendingPlanId = subRow.pending_plan;
        const pendingCycle  = (subRow.pending_plan_billing_cycle ?? "monthly") as "monthly" | "annual";
        const newPriceId    = await getResolvedPlanStripePriceId(pendingPlanId, pendingCycle);

        if (newPriceId) {
          try {
            const currentSub = await stripeAny().subscriptions.retrieve(subRow.stripe_subscription_id) as { items: { data: Array<{ id: string }> } };
            const itemId = currentSub.items.data[0]?.id;
            if (itemId) {
              await stripeAny().subscriptions.update(subRow.stripe_subscription_id, {
                items:              [{ id: itemId, price: newPriceId }],
                metadata:           { plan_id: pendingPlanId },
                proration_behavior: "none",
              });
            }
          } catch (stripeErr) {
            console.error(
              `[billing/stripe] Failed to apply pending plan switch for tenant "${tenantId}":`,
              stripeErr,
            );
            // Non-fatal: pending plan remains; will retry next period
          }
        }

        await client
          .from("subscriptions")
          .update({
            plan:                        pendingPlanId,
            billing_cycle:               pendingCycle,
            pending_plan:                null,
            pending_plan_billing_cycle:  null,
            pending_plan_effective_date: null,
            updated_at:                  new Date().toISOString(),
          })
          .eq("tenant_id", tenantId);

        // Sync packageKey now that the deferred plan change has taken effect.
        await syncPackageKeyFromPlan(client, tenantId, pendingPlanId);
      }

      return { handled: true, action: "invoice_paid", tenantId };
    }

    // ── invoice.payment_failed → mark as past_due ─────────────────────────────

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef  = (invoice as unknown as { subscription?: string }).subscription;
      if (!subRef) return { handled: false, action: "no_subscription", tenantId: null };

      const stripeObj = await stripeAny().subscriptions.retrieve(subRef) as StripeSubscription;
      const resolved  = await resolveTenantForSub(client, stripeObj);
      if (!resolved) return { handled: false, action: "no_tenant_id", tenantId: null };
      const tenantId  = resolved.tenantId;

      // Stripe exhausted all retries and marked the subscription "unpaid" →
      // block service until payment is resolved.
      if (stripeObj.status === "unpaid") {
        await markTenantUnpaid(client, tenantId);
        await client
          .from("tenant_settings")
          .update({ is_active_override: false })
          .eq("tenant_id", tenantId);
        return { handled: true, action: "subscription_unpaid_tenant_disabled", tenantId };
      }

      // First / retrying failure → past_due. Previously this only set
      // status=past_due, so payment_due_since stayed null and no dunning email
      // ever fired for Stripe-backed subs (the cron only duns manually-charged
      // ones). markTenantPastDue sets payment_due_since (idempotent) and
      // sendDunningEmail sends once (guarded by dunning_email_sent_at), closing
      // the gap so quarantine escalation and the email actually run.
      await markTenantPastDue(client, tenantId);
      try {
        const planId      = resolved.existingPlan ?? stripeObj.metadata?.plan_id ?? "starter";
        const planLabel   = planId.charAt(0).toUpperCase() + planId.slice(1);
        const amountCents = typeof invoice.amount_due === "number" ? invoice.amount_due : 0;
        const settings    = await getTenantDunningSettings(client, tenantId);
        const dueSince    = new Date();
        const quarantineEnd = new Date(dueSince.getTime() + settings.quarantine_days * 24 * 60 * 60 * 1000);
        await sendDunningEmail(client, tenantId, {
          planName:      planLabel,
          amountCents,
          dueDate:       dueSince.toISOString(),
          quarantineEnd: quarantineEnd.toISOString(),
        });
      } catch (dunningErr) {
        console.error(`[billing/stripe] dunning steps failed for tenant "${tenantId}":`, dunningErr);
      }

      return { handled: true, action: "subscription_past_due", tenantId };
    }

    // ── payment_intent.succeeded → wallet auto-reload credit ──────────────────

    case "payment_intent.succeeded": {
      const intent = event.data.object as unknown as {
        id: string;
        metadata?: Record<string, string>;
      };

      if (intent.metadata?.wallet_reload === "true") {
        const { handleAutoReloadSuccess } = await import("./auto-reload");
        await handleAutoReloadSuccess(client, intent.id);
        const tenantId = intent.metadata?.tenant_id ?? null;
        return { handled: true, action: "wallet_auto_reload_succeeded", tenantId };
      }

      return { handled: false, action: "payment_intent_succeeded_not_wallet", tenantId: null };
    }

    // ── payment_intent.payment_failed → wallet auto-reload failure ────────────

    case "payment_intent.payment_failed": {
      const intent = event.data.object as unknown as {
        id: string;
        metadata?: Record<string, string>;
        last_payment_error?: { message?: string };
      };

      if (intent.metadata?.wallet_reload === "true") {
        const reason = intent.last_payment_error?.message ?? "Payment failed";
        const { handleAutoReloadFailure } = await import("./auto-reload");
        await handleAutoReloadFailure(client, intent.id, reason, false);
        const tenantId = intent.metadata?.tenant_id ?? null;
        return { handled: true, action: "wallet_auto_reload_failed", tenantId };
      }

      return { handled: false, action: "payment_intent_failed_not_wallet", tenantId: null };
    }

    // ── payment_intent.requires_action → 3DS authentication required ──────────

    case "payment_intent.requires_action": {
      const intent = event.data.object as unknown as {
        id: string;
        metadata?: Record<string, string>;
      };

      if (intent.metadata?.wallet_reload === "true") {
        const { handleAutoReloadFailure } = await import("./auto-reload");
        await handleAutoReloadFailure(
          client,
          intent.id,
          "3DS authentication required — please update your payment method",
          true,
        );
        const tenantId = intent.metadata?.tenant_id ?? null;
        return { handled: true, action: "wallet_auto_reload_requires_action", tenantId };
      }

      return { handled: false, action: "payment_intent_requires_action_not_wallet", tenantId: null };
    }

    default:
      return { handled: false, action: `unhandled_event:${event.type}`, tenantId: null };
  }
}

// ── Internal DB helpers ────────────────────────────────────────────────────────

async function upsertSubscription(
  client:   SupabaseClient,
  tenantId: string,
  fields:   Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .upsert(
      { tenant_id: tenantId, ...fields, updated_at: new Date().toISOString() } as never,
      { onConflict: "tenant_id" },
    );
  if (error) throw error;
}

// Re-export for internal use
export { BILLING_PLANS };
