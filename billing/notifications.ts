/**
 * billing/notifications.ts
 *
 * Wallet notifications — low balance, empty wallet, enrichments paused,
 * auto-reload success/failure.
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   All notification functions follow a consistent pattern:
 *     1. Read tenant wallet to find notification preferences + channel addresses.
 *     2. Determine which channels are enabled (email / SMS).
 *     3. Dispatch notifications.
 *     4. Never throw — notification failure must not block the caller.
 *
 * ─── Email delivery ───────────────────────────────────────────────────────────
 *
 *   Email now goes out for real, over the same platform transport that
 *   billing/dunning.ts uses (forms/mail-transport). It used to be a stub that
 *   only did console.info: every function below was correctly wired and fired at
 *   the right moment, but nothing ever left the building. A tenant could run for
 *   weeks with a drained wallet and degraded enrichment without a single warning
 *   — which is exactly what happened on this platform.
 *
 *   Transport is resolved per send (never cached): resolveTransportConfig(null,
 *   null) — billing mail always uses the platform config, never a tenant's own
 *   SMTP. When no transport is configured, sendMail returns ok and logs in dev;
 *   it does not throw.
 *
 * ─── SMS ──────────────────────────────────────────────────────────────────────
 *
 *   Still a stub, and deliberately so: there is no SMS provider in this stack.
 *   notify_sms / notification_phone exist in the schema and in the settings UI,
 *   but nothing delivers. Either wire a provider here, or drop the columns and
 *   the toggle — a switch that promises SMS and sends nothing is worse than no
 *   switch at all.
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantWallet } from "./types";
import { serializeError } from "./errors";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { logger } from "@/lib/logger";

// ── Email / SMS delivery ──────────────────────────────────────────────────────

interface EmailPayload {
  to:      string;
  subject: string;
  body:    string;
}

interface SmsPayload {
  to:   string;
  body: string;
}

/**
 * The platform "from" address for billing mail.
 *
 * Identical chain to billing/dunning.ts, so both billing streams appear from the
 * same sender. Kept as env-only on purpose: this runs inside a debit, and a DB
 * round-trip to platform_settings on every low-balance notification is not worth
 * it for a value that never changes per tenant.
 */
function resolveFromAddress(): string {
  return (
    process.env["MAIL_FROM_ADDRESS"] ??
    process.env["BACKOFFICE_EMAIL"] ??
    "billing@misterchameleon.com"
  );
}

/**
 * Sends a wallet notification email. Never throws: a failed notification must
 * not break a debit, and the caller is usually fire-and-forget.
 */
async function sendEmail(payload: EmailPayload): Promise<void> {
  try {
    const transport = resolveTransportConfig(null, null);

    const result = await sendMail(
      { from: resolveFromAddress(), to: [payload.to], subject: payload.subject, text: payload.body },
      transport,
    );

    if (!result.ok) {
      logger.error("[billing/notifications] wallet email failed", {
        to: payload.to, subject: payload.subject, error: result.error,
      });
    }
  } catch (err) {
    logger.error("[billing/notifications] wallet email threw", {
      to: payload.to, error: serializeError(err),
    });
  }
}

async function sendSms(payload: SmsPayload): Promise<void> {
  // STUB — no SMS provider is configured in this stack. See the module JSDoc:
  // this either gets a provider or the notify_sms toggle should be removed.
  logger.info("[billing/notifications] SMS requested but no provider is wired", {
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
