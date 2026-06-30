/**
 * billing/stripe-config.ts
 *
 * Authoritative source for Stripe mode detection, credential resolution,
 * client creation, and per-wallet ID selection.
 *
 * ─── Mode model ───────────────────────────────────────────────────────────────
 *
 *   Three distinct operational modes exist, and they must NEVER mix:
 *
 *   ① stripe_live   (default)
 *       STRIPE_MODE unset or "live"
 *       Uses sk_live_… keys, real Stripe customers, real money.
 *       Default for all production tenants.
 *
 *   ② stripe_test
 *       STRIPE_MODE=test
 *       Uses sk_test_… keys, test Stripe customers, test cards, zero real charges.
 *       Full Stripe checkout/webhook flow — realistic test of the payment path.
 *       Customer IDs are stored in stripe_test_customer_id (never stripe_customer_id).
 *
 *   ③ wallet_simulated   (separate — wallet.test_mode = 'test_simulated')
 *       No Stripe calls at all.  Balance is manipulated via sim_* Postgres RPCs.
 *       Used to test enrichment blocking / low-balance UX without any Stripe.
 *
 *   Stripe test mode ≠ wallet simulated mode.  They are independent controls:
 *     • A wallet in test_simulated mode never calls Stripe regardless of STRIPE_MODE.
 *     • STRIPE_MODE=test uses real Stripe APIs, just with test keys.
 *
 * ─── Environment variables ─────────────────────────────────────────────────────
 *
 *   Live mode (STRIPE_MODE unset or "live"):
 *     STRIPE_SECRET_KEY              sk_live_…   required
 *     STRIPE_WEBHOOK_SECRET          whsec_…     required for webhook verification
 *
 *   Test mode (STRIPE_MODE=test):
 *     STRIPE_TEST_SECRET_KEY         sk_test_…   required
 *     STRIPE_TEST_WEBHOOK_SECRET     whsec_…     required (from Stripe CLI / Dashboard test endpoint)
 *
 *   Both modes:
 *     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   pk_live_…  client-side (live)
 *     STRIPE_TEST_PUBLISHABLE_KEY          pk_test_…  client-side (test — optional, informational)
 *
 * ─── Safety invariants ────────────────────────────────────────────────────────
 *
 *   • getStripeClient() ALWAYS uses keys matching the current STRIPE_MODE.
 *   • resolveCustomerId() returns stripe_test_customer_id in test mode and
 *     stripe_customer_id in live mode — cross-contamination is impossible.
 *   • The webhook route validates event.livemode against STRIPE_MODE and rejects
 *     mismatches (a test event cannot be processed in live mode, and vice versa).
 *   • wallet_simulated wallets skip all Stripe calls at the caller level before
 *     ever reaching this module.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   This file uses process.env and the Stripe Node SDK.
 *   Never import in client components.
 */

import Stripe from "stripe";

// ── Mode ──────────────────────────────────────────────────────────────────────

export type StripeMode = "live" | "test";

/**
 * Determine the current Stripe mode from the STRIPE_MODE env var.
 *
 * "live" is the default — must explicitly opt into "test".
 * This is intentional: a misconfigured STRIPE_MODE defaults to real money,
 * not to free tests, which makes the failure mode visible.
 */
export function getStripeMode(): StripeMode {
  return process.env["STRIPE_MODE"] === "test" ? "test" : "live";
}

export function isStripeLive(): boolean { return getStripeMode() === "live"; }
export function isStripeTest(): boolean { return getStripeMode() === "test"; }

// ── Credentials ───────────────────────────────────────────────────────────────

/**
 * Return the secret key for the given mode (or current mode if not specified).
 * Throws with an actionable message if the env var is not set.
 */
export function getStripeSecretKey(mode?: StripeMode): string {
  const m = mode ?? getStripeMode();
  if (m === "test") {
    const key = process.env["STRIPE_TEST_SECRET_KEY"];
    if (!key) throw new Error(
      "[stripe-config] STRIPE_TEST_SECRET_KEY is not set. " +
      "Add your Stripe test secret key (sk_test_…) to configure test mode.",
    );
    if (!key.startsWith("sk_test_")) throw new Error(
      `[stripe-config] STRIPE_TEST_SECRET_KEY does not start with 'sk_test_'. ` +
      `Got: ${key.slice(0, 10)}… — check your env vars.`,
    );
    return key;
  }

  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error(
    "[stripe-config] STRIPE_SECRET_KEY is not set.",
  );
  // Warn (not throw) if a test key is used in live mode — likely a misconfiguration.
  if (key.startsWith("sk_test_") && process.env.NODE_ENV === "production") {
    console.warn("[stripe-config] WARNING: STRIPE_MODE is 'live' but STRIPE_SECRET_KEY starts with 'sk_test_'. " +
                 "This means test keys are being used in live mode. Set STRIPE_MODE=test or use your live key.");
  }
  return key;
}

/**
 * Return the webhook signing secret for the given mode.
 * Throws if not configured — the webhook route cannot operate without it.
 */
export function getStripeWebhookSecret(mode?: StripeMode): string {
  const m = mode ?? getStripeMode();
  if (m === "test") {
    const secret = process.env["STRIPE_TEST_WEBHOOK_SECRET"];
    if (!secret) throw new Error(
      "[stripe-config] STRIPE_TEST_WEBHOOK_SECRET is not set. " +
      "Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` to get the signing secret.",
    );
    return secret;
  }

  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("[stripe-config] STRIPE_WEBHOOK_SECRET is not set.");
  return secret;
}

/**
 * Return the publishable key for the given mode (informational — for UI display).
 * Does not throw if missing; returns empty string so callers can show guidance.
 */
export function getStripePublishableKey(mode?: StripeMode): string {
  const m = mode ?? getStripeMode();
  return m === "test"
    ? (process.env["STRIPE_TEST_PUBLISHABLE_KEY"] ?? "")
    : (process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "");
}

// ── Client factory ────────────────────────────────────────────────────────────

// Cache one instance per mode — re-creating on every call is wasteful.
const _clients = new Map<StripeMode, Stripe>();

/**
 * Return a Stripe SDK instance configured for the given mode.
 *
 * Each mode has its own singleton — test and live clients are never shared.
 * Throws immediately with a clear message if the required secret key is missing.
 */
export function getStripeClient(mode?: StripeMode): Stripe {
  const m = mode ?? getStripeMode();
  const cached = _clients.get(m);
  if (cached) return cached;

  const instance = new Stripe(getStripeSecretKey(m), {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pin apiVersion across stripe-node minor type drift
    apiVersion: "2025-08-27.basil" as any,
    typescript: true,
  });

  _clients.set(m, instance);
  return instance;
}

// ── Per-wallet ID resolution ───────────────────────────────────────────────────
//
// Test and live Stripe environments maintain completely separate data.
// We store test customer/PM IDs in dedicated columns so they can never
// overwrite or be confused with live IDs.

type WalletWithStripeIds = {
  stripe_customer_id?:            string | null;
  stripe_test_customer_id?:       string | null;
  stripe_payment_method_id?:      string | null;
  stripe_test_payment_method_id?: string | null;
};

/**
 * Return the Stripe customer ID appropriate for the current (or specified) mode.
 *   live  → stripe_customer_id
 *   test  → stripe_test_customer_id
 */
export function resolveCustomerId(
  wallet: WalletWithStripeIds,
  mode?:  StripeMode,
): string | null {
  return (mode ?? getStripeMode()) === "test"
    ? (wallet.stripe_test_customer_id ?? null)
    : (wallet.stripe_customer_id ?? null);
}

/**
 * Return the Stripe payment method ID appropriate for the current mode.
 *   live  → stripe_payment_method_id
 *   test  → stripe_test_payment_method_id
 */
export function resolvePaymentMethodId(
  wallet: WalletWithStripeIds,
  mode?:  StripeMode,
): string | null {
  return (mode ?? getStripeMode()) === "test"
    ? (wallet.stripe_test_payment_method_id ?? null)
    : (wallet.stripe_payment_method_id ?? null);
}

// ── Mode guard for wallet_simulated ──────────────────────────────────────────

/**
 * Throw if a caller is attempting a real Stripe operation on a simulated wallet.
 *
 * wallet_simulated mode must NEVER reach Stripe — this guard is the last line
 * of defence if the caller forgot to check before calling this module.
 */
export function assertNotSimulated(walletTestMode: string | undefined, context: string): void {
  if (walletTestMode === "test_simulated") {
    throw new Error(
      `[stripe-config] Attempted real Stripe call on a wallet_simulated wallet in ${context}. ` +
      "Simulated wallets must never call Stripe. Check the caller for a missing test_mode guard.",
    );
  }
}

// ── Webhook livemode validation ───────────────────────────────────────────────

/**
 * Validate that a parsed Stripe event's livemode flag matches the current
 * STRIPE_MODE.  Returns an error string if there is a mismatch, null if OK.
 *
 * This prevents:
 *   • Test events being processed in live mode (wrong tenant data mutations)
 *   • Live events being processed in test mode (real money treated as test)
 */
export function validateEventLivemode(event: { livemode: boolean }): string | null {
  const mode = getStripeMode();
  if (mode === "test" && event.livemode === true) {
    return "Received a live-mode Stripe event but STRIPE_MODE=test. Ignoring to prevent data corruption. Update your Stripe webhook URL.";
  }
  if (mode === "live" && event.livemode === false) {
    return "Received a test-mode Stripe event but STRIPE_MODE=live. Ignoring. Are you using the wrong webhook endpoint?";
  }
  return null;
}

// ── Mode summary (for admin UI) ───────────────────────────────────────────────

export interface StripeModeInfo {
  mode:           StripeMode;
  isTest:         boolean;
  isLive:         boolean;
  /** True if the STRIPE_TEST_SECRET_KEY env var is present (key not exposed). */
  testKeyPresent: boolean;
  /** True if the STRIPE_SECRET_KEY env var is present (key not exposed). */
  liveKeyPresent: boolean;
  /** True if the test webhook secret env var is present. */
  testWebhookSecretPresent: boolean;
  /** True if the live webhook secret env var is present. */
  liveWebhookSecretPresent: boolean;
}

/**
 * Return a safe summary of the current Stripe configuration for the admin UI.
 * Never exposes actual key values.
 */
export function getStripeModeInfo(): StripeModeInfo {
  const mode = getStripeMode();
  return {
    mode,
    isTest: mode === "test",
    isLive: mode === "live",
    testKeyPresent:           Boolean(process.env["STRIPE_TEST_SECRET_KEY"]),
    liveKeyPresent:           Boolean(process.env["STRIPE_SECRET_KEY"]),
    testWebhookSecretPresent: Boolean(process.env["STRIPE_TEST_WEBHOOK_SECRET"]),
    liveWebhookSecretPresent: Boolean(process.env["STRIPE_WEBHOOK_SECRET"]),
  };
}
