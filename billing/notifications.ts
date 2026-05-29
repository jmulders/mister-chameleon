/**
 * billing/notifications.ts
 *
 * Wallet notification stubs — low balance, empty wallet, enrichments paused,
 * auto-reload success/failure.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   All notification functions follow a consistent pattern:
 *     1. Read tenant wallet to find notification preferences + channel addresses.
 *     2. Determine which channels are enabled (email / SMS).
 *     3. Dispatch notifications (email via Resend/SendGrid; SMS stubbed).
 *     4. Never throw — notification failure must not block the caller.
 *
 *   Currently all email/SMS sends are STUBBED: they log the payload but do not
 *   make real network calls.  Wire up a real email provider (e.g. Resend, SES)
 *   by replacing the `sendEmail` stub below.
 *
 * ─── Extending ────────────────────────────────────────────────────────────────
 *
 *   To add real email delivery, replace `sendEmail` with a call to your email
 *   provider SDK.  The payload shape is stable.
 *
 *   To add real SMS delivery, replace `sendSms` with a Twilio / MessageBird
 *   call.  The phone number comes from wallet.notification_phone.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantWallet } from "./types";
import { serializeError } from "./errors";

// ── Email / SMS stubs ─────────────────────────────────────────────────────────
//
// Replace these with real provider calls when you're ready to deliver messages.

interface EmailPayload {
  to:      string;
  subject: string;
  body:    string;
}

interface SmsPayload {
  to:   string;
  body: string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  // STUB — wire up Resend / SES / SendGrid here.
  console.info("[billing/notifications] [STUB] email notification", {
    to:      payload.to,
    subject: payload.subject,
  });
}

async function sendSms(payload: SmsPayload): Promise<void> {
  // STUB — wire up Twilio / MessageBird here.
  console.info("[billing/notifications] [STUB] SMS notification", {
    to: payload.to,
  });
}

// ── Wallet reader ─────────────────────────────────────────────────────────────

async function getWalletPrefs(
  client:   SupabaseClient,
  tenantId: string,
): Promise<Pick<TenantWallet,
  | "notify_email" | "notify_sms"
  | "notification_email" | "notification_phone"
> | null> {
  const { data, error } = await client
    .from("tenant_wallets")
    .select("notify_email, notify_sms, notification_email, notification_phone")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Pick<TenantWallet, "notify_email" | "notify_sms" | "notification_email" | "notification_phone">;
}

// ── Notification helpers ──────────────────────────────────────────────────────

function centsToEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

// ── Public notification functions ─────────────────────────────────────────────

/**
 * Notify the tenant that their wallet balance is running low.
 * Fires when balance drops below `low_balance_threshold_cents` after a debit.
 */
export async function notifyLowBalance(
  client:      SupabaseClient,
  tenantId:    string,
  balanceCents: number,
): Promise<void> {
  try {
    const prefs = await getWalletPrefs(client, tenantId);
    if (!prefs) return;

    const message = `Your enrichment wallet balance is running low: ${centsToEuro(balanceCents)} remaining. Top up now to avoid enrichments being paused.`;

    if (prefs.notify_email && prefs.notification_email) {
      await sendEmail({
        to:      prefs.notification_email,
        subject: `[Mister Chameleon] Low wallet balance — ${centsToEuro(balanceCents)} remaining`,
        body:    message,
      });
    }
    if (prefs.notify_sms && prefs.notification_phone) {
      await sendSms({ to: prefs.notification_phone, body: message });
    }
  } catch (err) {
    console.error("[billing/notifications] notifyLowBalance error", {
      tenantId, ...serializeError(err),
    });
  }
}

/**
 * Notify the tenant that their wallet is empty and enrichments have been paused.
 * Fires when balance reaches 0 after a debit.
 */
export async function notifyEmptyWallet(
  client:   SupabaseClient,
  tenantId: string,
): Promise<void> {
  try {
    const prefs = await getWalletPrefs(client, tenantId);
    if (!prefs) return;

    const message = `Your enrichment wallet is empty. Billable enrichments have been paused. Top up your wallet to resume enrichment services.`;

    if (prefs.notify_email && prefs.notification_email) {
      await sendEmail({
        to:      prefs.notification_email,
        subject: `[Mister Chameleon] Wallet empty — enrichments paused`,
        body:    message,
      });
    }
    if (prefs.notify_sms && prefs.notification_phone) {
      await sendSms({ to: prefs.notification_phone, body: message });
    }
  } catch (err) {
    console.error("[billing/notifications] notifyEmptyWallet error", {
      tenantId, ...serializeError(err),
    });
  }
}

/**
 * Notify that enrichments were blocked during a request due to wallet state.
 * Fires once per enrichment session (not per call) to avoid spam.
 */
export async function notifyEnrichmentsPaused(
  client:   SupabaseClient,
  tenantId: string,
  reason:   string,
): Promise<void> {
  try {
    const prefs = await getWalletPrefs(client, tenantId);
    if (!prefs) return;

    const message = `Enrichments were paused for a visitor session. Reason: ${reason}. Please top up your wallet or check your wallet settings.`;

    if (prefs.notify_email && prefs.notification_email) {
      await sendEmail({
        to:      prefs.notification_email,
        subject: `[Mister Chameleon] Enrichments paused — ${reason}`,
        body:    message,
      });
    }
    // Not sent via SMS to avoid SMS spam from high-traffic sites.
  } catch (err) {
    console.error("[billing/notifications] notifyEnrichmentsPaused error", {
      tenantId, ...serializeError(err),
    });
  }
}

/**
 * Notify that auto-reload successfully added funds to the wallet.
 */
export async function notifyAutoReloadSuccess(
  client:      SupabaseClient,
  tenantId:    string,
  amountCents: number,
  newBalance:  number,
): Promise<void> {
  try {
    const prefs = await getWalletPrefs(client, tenantId);
    if (!prefs) return;

    const message = `Auto-reload successful: ${centsToEuro(amountCents)} added to your enrichment wallet. New balance: ${centsToEuro(newBalance)}.`;

    if (prefs.notify_email && prefs.notification_email) {
      await sendEmail({
        to:      prefs.notification_email,
        subject: `[Mister Chameleon] Auto-reload success — ${centsToEuro(amountCents)} added`,
        body:    message,
      });
    }
    if (prefs.notify_sms && prefs.notification_phone) {
      await sendSms({ to: prefs.notification_phone, body: message });
    }
  } catch (err) {
    console.error("[billing/notifications] notifyAutoReloadSuccess error", {
      tenantId, ...serializeError(err),
    });
  }
}

/**
 * Notify that auto-reload failed — payment could not be processed.
 * This is a high-priority notification; enrichments may be paused.
 */
export async function notifyAutoReloadFailure(
  client:   SupabaseClient,
  tenantId: string,
  reason:   string,
): Promise<void> {
  try {
    const prefs = await getWalletPrefs(client, tenantId);
    if (!prefs) return;

    const message = `Auto-reload failed: ${reason}. Please check your payment method and top up manually to avoid service interruption.`;

    if (prefs.notify_email && prefs.notification_email) {
      await sendEmail({
        to:      prefs.notification_email,
        subject: `[Mister Chameleon] Auto-reload FAILED — action required`,
        body:    message,
      });
    }
    if (prefs.notify_sms && prefs.notification_phone) {
      await sendSms({ to: prefs.notification_phone, body: message });
    }
  } catch (err) {
    console.error("[billing/notifications] notifyAutoReloadFailure error", {
      tenantId, ...serializeError(err),
    });
  }
}

/**
 * Notify the tenant that their saved card requires 3DS / SCA authentication
 * before an off-session charge can complete.
 *
 * Off-session auto-reload cannot complete 3DS; the tenant must authenticate
 * manually via the Stripe Billing Portal.  Link them there so they can update
 * their payment method or confirm the charge.
 *
 * @param stripePaymentIntentId  Used to construct the Billing Portal deep-link.
 */
export async function notifyActionRequired(
  client:                SupabaseClient,
  tenantId:              string,
  stripePaymentIntentId: string,
): Promise<void> {
  try {
    const prefs = await getWalletPrefs(client, tenantId);
    if (!prefs) return;

    const message =
      `Auto-reload could not complete: your payment method requires additional authentication (3DS / SCA). ` +
      `Please visit the Billing Portal to update your payment method or confirm the pending charge. ` +
      `Stripe PaymentIntent: ${stripePaymentIntentId}`;

    if (prefs.notify_email && prefs.notification_email) {
      await sendEmail({
        to:      prefs.notification_email,
        subject: `[Mister Chameleon] Payment authentication required — auto-reload paused`,
        body:    message,
      });
    }
    if (prefs.notify_sms && prefs.notification_phone) {
      await sendSms({ to: prefs.notification_phone, body: message });
    }
  } catch (err) {
    console.error("[billing/notifications] notifyActionRequired error", {
      tenantId, ...serializeError(err),
    });
  }
}
