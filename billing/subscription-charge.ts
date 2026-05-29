/**
 * billing/subscription-charge.ts
 *
 * Off-session Stripe PaymentIntent charge for subscription renewals.
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 *   Attempts to charge the tenant's saved Stripe payment method for the given
 *   amount.  Used by the billing-renewal cron to collect the subscription fee
 *   before advancing the billing period.
 *
 * ─── Payment flow ─────────────────────────────────────────────────────────────
 *
 *   1. Load the tenant's wallet row to find:
 *        stripe_customer_id / stripe_test_customer_id (mode-aware)
 *        stripe_payment_method_id / stripe_test_payment_method_id (mode-aware)
 *
 *   2. If no customer ID or no payment method:
 *        → return { ok: false, noPaymentMethod: true }
 *        → caller should markTenantPastDue + sendDunningEmail
 *
 *   3. Create a Stripe PaymentIntent with:
 *        off_session:   true   — no 3DS interaction expected
 *        confirm:       true   — charge immediately
 *        payment_method:       — saved PM ID
 *        customer:             — Stripe customer ID for the right mode
 *        amount + currency
 *
 *   4. If PaymentIntent status = "succeeded" → return { ok: true }
 *      If status requires action / failed → return { ok: false }
 *
 * ─── Mode awareness ───────────────────────────────────────────────────────────
 *
 *   Uses `getStripeMode()` / `getStripeClient()` / `resolveCustomerId()` /
 *   `resolvePaymentMethodId()` from billing/stripe-config.ts so live and test
 *   customers are never mixed.
 *
 *   Wallets in `test_simulated` mode are never charged — caller must guard.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStripeClient,
  getStripeMode,
  resolveCustomerId,
  resolvePaymentMethodId,
} from "./stripe-config";
import { logger } from "@/lib/logger";

// ── Result types ───────────────────────────────────────────────────────────────

export type SubscriptionChargeResult =
  | { ok: true;  paymentIntentId: string }
  | { ok: false; error: string; noPaymentMethod: boolean };

// ── Local wallet shape ─────────────────────────────────────────────────────────

interface WalletRow {
  stripe_customer_id:            string | null;
  stripe_test_customer_id:       string | null;
  stripe_payment_method_id:      string | null;
  stripe_test_payment_method_id: string | null;
  test_mode:                     string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Attempt to charge the tenant's saved Stripe payment method for the given
 * amount (in euro cents).
 *
 * @param client      Supabase service-role client
 * @param tenantId    Tenant slug (e.g. "acme-corp")
 * @param amountCents Amount to charge in euro cents (e.g. 34900 for €349)
 * @param description Optional description shown in the Stripe dashboard
 */
export async function attemptSubscriptionCharge(
  client:      SupabaseClient,
  tenantId:    string,
  amountCents: number,
  description?: string,
): Promise<SubscriptionChargeResult> {
  // ── Load wallet ──────────────────────────────────────────────────────────────
  const { data: wallet, error: walletErr } = await client
    .from("tenant_wallets")
    .select(
      "stripe_customer_id, stripe_test_customer_id, " +
      "stripe_payment_method_id, stripe_test_payment_method_id, test_mode",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (walletErr || !wallet) {
    logger.warn("[subscription-charge] Wallet not found", { tenantId });
    return { ok: false, error: "Wallet not found.", noPaymentMethod: true };
  }

  const row = wallet as unknown as WalletRow;

  // ── Guard: simulated wallets must not call Stripe ───────────────────────────
  if (row.test_mode === "test_simulated") {
    logger.info("[subscription-charge] Skipping charge — wallet is test_simulated", { tenantId });
    // Treat as no payment method so the caller marks past_due appropriately.
    // In test environments the operator is responsible for manually clearing dues.
    return { ok: false, error: "Wallet is in simulated mode — no real charge made.", noPaymentMethod: true };
  }

  // ── Resolve mode-specific IDs ────────────────────────────────────────────────
  const customerId       = resolveCustomerId(row);
  const paymentMethodId  = resolvePaymentMethodId(row);

  if (!customerId || !paymentMethodId) {
    logger.info("[subscription-charge] No payment method on file", {
      tenantId,
      hasCustomer:       Boolean(customerId),
      hasPaymentMethod:  Boolean(paymentMethodId),
    });
    return {
      ok:               false,
      error:            "No Stripe payment method on file for this tenant.",
      noPaymentMethod:  true,
    };
  }

  // ── Create off-session PaymentIntent ────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = getStripeClient() as any;
    const mode   = getStripeMode();

    const intent = await stripe.paymentIntents.create({
      amount:           amountCents,
      currency:         "eur",
      customer:         customerId,
      payment_method:   paymentMethodId,
      off_session:      true,
      confirm:          true,
      description:      description ?? `Subscription renewal — tenant: ${tenantId}`,
      metadata:         { tenant_id: tenantId, stripe_mode: mode },
    });

    if (intent.status === "succeeded") {
      logger.info("[subscription-charge] Charge succeeded", {
        tenantId,
        paymentIntentId: intent.id,
        amountCents,
      });
      return { ok: true, paymentIntentId: intent.id as string };
    }

    // Any other status (requires_action, requires_payment_method, etc.) → failed.
    logger.warn("[subscription-charge] Charge did not succeed", {
      tenantId,
      status:          intent.status,
      paymentIntentId: intent.id,
    });
    return {
      ok:              false,
      error:           `Payment status: ${intent.status as string}`,
      noPaymentMethod: false,
    };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[subscription-charge] Stripe PaymentIntent creation failed", {
      tenantId, amountCents, error: message,
    });
    return { ok: false, error: message, noPaymentMethod: false };
  }
}
