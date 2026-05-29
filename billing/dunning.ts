/**
 * billing/dunning.ts
 *
 * Subscription dunning lifecycle — past_due state management, quarantine
 * enforcement, per-tenant email configuration, and email dispatch.
 *
 * ─── Lifecycle ────────────────────────────────────────────────────────────────
 *
 *   1. Renewal charge fails / no payment method on file
 *      → markTenantPastDue()     (status = "past_due", payment_due_since = now())
 *      → sendDunningEmail()      (one-time, tracked via dunning_email_sent_at)
 *
 *   2. Quarantine window (default 8 days, configurable per tenant)
 *      → getDunningState().isQuarantined = true
 *      → /api/snippet/decide returns { slots: {} } — no personalisation
 *
 *   3. Quarantine expires with no payment
 *      → markTenantUnpaid()      (status = "unpaid")
 *      → getDunningState().isBlocked = true
 *      → /api/snippet/decide returns 404
 *
 *   4. Payment received (via Stripe webhook or admin action)
 *      → clearTenantDunning()    (status = "active", dunning fields cleared)
 *      → normal service resumes
 *
 * ─── Email template variables ─────────────────────────────────────────────────
 *
 *   {{tenant_name}}     — tenant display name from tenant_settings
 *   {{plan_name}}       — e.g. "Growth"
 *   {{amount}}          — formatted amount e.g. "€ 349,00"
 *   {{due_date}}        — date the period expired (e.g. "1 May 2026")
 *   {{quarantine_end}}  — date service will be blocked (due + quarantine_days)
 *   {{payment_link}}    — optional URL from dunning settings; empty string if unset
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended).
 *   Do NOT import in client components.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { logger } from "@/lib/logger";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TenantDunningSettings {
  tenant_id:       string;
  email_subject:   string;
  email_body:      string;
  billing_email:   string | null;
  quarantine_days: number;
  payment_link:    string | null;
  created_at:      string;
  updated_at:      string;
}

export type TenantDunningSettingsInput = Pick<
  TenantDunningSettings,
  "email_subject" | "email_body" | "billing_email" | "quarantine_days" | "payment_link"
>;

const DEFAULT_EMAIL_SUBJECT = "Your subscription payment is due";
const DEFAULT_EMAIL_BODY = `Hi,

Your subscription to {{plan_name}} is now past due. The amount of {{amount}} was due on {{due_date}}.

To avoid service interruption, please arrange payment before {{quarantine_end}}.

After that date, personalisation will be suspended until payment is received.

{{payment_link}}

If you have any questions, please reply to this email.

Best regards,
The Mister Chameleon team`;
const DEFAULT_QUARANTINE_DAYS = 8;

// ── Dunning state ──────────────────────────────────────────────────────────────

export interface DunningState {
  /** True when subscription is past_due and still within the quarantine window. */
  isQuarantined: boolean;
  /** True when subscription is unpaid (quarantine has expired, service blocked). */
  isBlocked:     boolean;
  /** ISO date when quarantine ends (service blocks). Null if not in dunning. */
  quarantineUntil: string | null;
  /** Days remaining in quarantine window. 0 if expired or not in quarantine. */
  daysRemaining:   number;
}

/**
 * Compute the current dunning state from a subscription row and its dunning
 * settings.  Pure function — no DB calls.
 *
 * @param status             Current subscription status
 * @param paymentDueSince    Timestamp of when the subscription became past_due
 * @param quarantineDays     Days before service blocks (from dunning settings, default 8)
 */
export function getDunningState(
  status:           string,
  paymentDueSince:  string | null | undefined,
  quarantineDays:   number = DEFAULT_QUARANTINE_DAYS,
): DunningState {
  if (status === "unpaid") {
    return { isQuarantined: false, isBlocked: true, quarantineUntil: null, daysRemaining: 0 };
  }

  if (status !== "past_due" || !paymentDueSince) {
    return { isQuarantined: false, isBlocked: false, quarantineUntil: null, daysRemaining: 0 };
  }

  const dueDate  = new Date(paymentDueSince);
  const blockAt  = new Date(dueDate.getTime() + quarantineDays * 24 * 60 * 60 * 1000);
  const now      = new Date();
  const msLeft   = blockAt.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  if (msLeft <= 0) {
    // Quarantine expired but status hasn't been flipped to "unpaid" yet — treat as blocked.
    return { isQuarantined: false, isBlocked: true, quarantineUntil: blockAt.toISOString(), daysRemaining: 0 };
  }

  return {
    isQuarantined:   true,
    isBlocked:       false,
    quarantineUntil: blockAt.toISOString(),
    daysRemaining:   daysLeft,
  };
}

// ── DB state transitions ───────────────────────────────────────────────────────

/**
 * Mark a subscription as past_due and record the moment it became due.
 * Sets payment_due_since if not already set (idempotent on repeated calls).
 * The dunning_email_sent_at is NOT set here — sendDunningEmail() sets it.
 */
export async function markTenantPastDue(
  client:   SupabaseClient,
  tenantId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Only set payment_due_since the first time — repeated cron runs must not
  // reset it and inadvertently extend the quarantine window.
  const { data: existing } = await client
    .from("subscriptions")
    .select("status, payment_due_since")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const updateFields: Record<string, unknown> = {
    status:     "past_due",
    updated_at: now,
  };
  if (!existing?.payment_due_since) {
    updateFields["payment_due_since"] = now;
  }

  const { error } = await client
    .from("subscriptions")
    .update(updateFields)
    .eq("tenant_id", tenantId);

  if (error) {
    logger.error("[billing/dunning] markTenantPastDue error", { tenantId, error: error.message });
    throw new Error(`markTenantPastDue: ${error.message}`);
  }

  logger.info("[billing/dunning] marked past_due", { tenantId });
}

/**
 * Escalate a past_due subscription to unpaid (quarantine expired, block service).
 */
export async function markTenantUnpaid(
  client:   SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .update({ status: "unpaid", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  if (error) {
    logger.error("[billing/dunning] markTenantUnpaid error", { tenantId, error: error.message });
    throw new Error(`markTenantUnpaid: ${error.message}`);
  }

  logger.info("[billing/dunning] marked unpaid (service blocked)", { tenantId });
}

/**
 * Clear dunning state and restore subscription to active.
 * Called after successful payment is confirmed (Stripe webhook or admin action).
 */
export async function clearTenantDunning(
  client:   SupabaseClient,
  tenantId: string,
): Promise<void> {
  const { error } = await client
    .from("subscriptions")
    .update({
      status:                "active",
      payment_due_since:     null,
      dunning_email_sent_at: null,
      updated_at:            new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (error) {
    logger.error("[billing/dunning] clearTenantDunning error", { tenantId, error: error.message });
    throw new Error(`clearTenantDunning: ${error.message}`);
  }

  logger.info("[billing/dunning] dunning cleared — service restored", { tenantId });
}

// ── Settings CRUD ──────────────────────────────────────────────────────────────

/**
 * Fetch the dunning settings for a tenant.
 * Returns defaults when no row exists (non-destructive — does not insert).
 */
export async function getTenantDunningSettings(
  client:   SupabaseClient,
  tenantId: string,
): Promise<TenantDunningSettings> {
  const { data, error } = await client
    .from("tenant_dunning_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    logger.warn("[billing/dunning] getTenantDunningSettings error — using defaults", {
      tenantId, error: error.message,
    });
  }

  if (!data) {
    const now = new Date().toISOString();
    return {
      tenant_id:       tenantId,
      email_subject:   DEFAULT_EMAIL_SUBJECT,
      email_body:      DEFAULT_EMAIL_BODY,
      billing_email:   null,
      quarantine_days: DEFAULT_QUARANTINE_DAYS,
      payment_link:    null,
      created_at:      now,
      updated_at:      now,
    };
  }

  return data as TenantDunningSettings;
}

/**
 * Upsert dunning settings for a tenant.
 */
export async function saveTenantDunningSettings(
  client:   SupabaseClient,
  tenantId: string,
  input:    TenantDunningSettingsInput,
): Promise<TenantDunningSettings> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("tenant_dunning_settings")
    .upsert(
      { tenant_id: tenantId, ...input, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`saveTenantDunningSettings: ${error.message}`);
  }

  return data as TenantDunningSettings;
}

// ── Email dispatch ─────────────────────────────────────────────────────────────

/**
 * Send the payment-due dunning email for a tenant.
 *
 * Idempotent: if dunning_email_sent_at is already set on the subscription,
 * this function returns early without sending.
 *
 * Template variables supported in email_subject and email_body:
 *   {{tenant_name}}    — display name from tenant_settings
 *   {{plan_name}}      — e.g. "Growth"
 *   {{amount}}         — formatted amount e.g. "€ 349,00"
 *   {{due_date}}       — date the period expired
 *   {{quarantine_end}} — date service will block
 *   {{payment_link}}   — optional URL, empty string if not configured
 */
export async function sendDunningEmail(
  client:    SupabaseClient,
  tenantId:  string,
  variables: {
    planName:    string;
    amountCents: number;
    dueDate:     string;
    quarantineEnd: string;
  },
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  // ── Guard: already sent? ─────────────────────────────────────────────────────
  const { data: sub } = await client
    .from("subscriptions")
    .select("dunning_email_sent_at, payment_due_since")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (sub?.dunning_email_sent_at) {
    logger.debug("[billing/dunning] sendDunningEmail: already sent, skipping", { tenantId });
    return { ok: true, skipped: true };
  }

  // ── Fetch dunning settings + tenant info ─────────────────────────────────────
  const [settings, tenantRow, walletRow] = await Promise.all([
    getTenantDunningSettings(client, tenantId),
    client.from("tenant_settings").select("settings").eq("tenant_id", tenantId).maybeSingle(),
    client.from("tenant_wallets").select("notification_email").eq("tenant_id", tenantId).maybeSingle(),
  ]);

  const tenantName   = (tenantRow.data?.settings as Record<string, unknown> | null)?.name as string | undefined ?? tenantId;
  const walletEmail  = (walletRow.data as { notification_email: string | null } | null)?.notification_email ?? null;
  const recipientEmail = settings.billing_email ?? walletEmail;

  if (!recipientEmail) {
    logger.warn("[billing/dunning] sendDunningEmail: no recipient email configured", { tenantId });
    return { ok: false, error: "No billing email configured for this tenant." };
  }

  // ── Build template ────────────────────────────────────────────────────────────
  const amountFormatted = new Intl.NumberFormat("nl-NL", {
    style: "currency", currency: "EUR",
  }).format(variables.amountCents / 100);

  const templateVars: Record<string, string> = {
    tenant_name:    tenantName,
    plan_name:      variables.planName,
    amount:         amountFormatted,
    due_date:       new Date(variables.dueDate).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    }),
    quarantine_end: new Date(variables.quarantineEnd).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    }),
    payment_link:   settings.payment_link ?? "",
  };

  const interpolate = (tpl: string) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => templateVars[key] ?? "");

  const subject = interpolate(settings.email_subject);
  const text    = interpolate(settings.email_body).trim();

  // ── Resolve from address ───────────────────────────────────────────────────
  const fromAddress =
    process.env["MAIL_FROM_ADDRESS"] ??
    process.env["BACKOFFICE_EMAIL"] ??
    "billing@misterchameleon.com";

  // ── Resolve transport ──────────────────────────────────────────────────────
  // No per-tenant transport loaded here — billing emails always use platform config.
  const transport = resolveTransportConfig(null, null);

  // ── Send ───────────────────────────────────────────────────────────────────
  const result = await sendMail(
    { from: fromAddress, to: [recipientEmail], subject, text },
    transport,
  );

  if (!result.ok) {
    logger.error("[billing/dunning] sendDunningEmail failed", {
      tenantId, recipient: recipientEmail, error: result.error,
    });
    return { ok: false, error: result.error };
  }

  // ── Mark email as sent ─────────────────────────────────────────────────────
  await client
    .from("subscriptions")
    .update({ dunning_email_sent_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  logger.info("[billing/dunning] dunning email sent", { tenantId, to: recipientEmail });
  return { ok: true };
}
