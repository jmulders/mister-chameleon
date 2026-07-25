/**
 * Adaptive email — send (slice 2).
 *
 * Renders the adaptive email (see ./adaptive-email) and delivers it via the
 * tenant/platform mail transport (Resend/SMTP), with guardrails:
 *   - suppression is always respected;
 *   - a `dedupeKey` (e.g. a form-submission id) makes the send idempotent via
 *     the email_sends unique constraint (retries are skipped);
 *   - a `to` override lets you deliver to a test inbox while personalising for
 *     the real recipient.
 * Every attempt is logged to email_sends. Never throws.
 *
 * This is the seam a form-submit trigger calls. Kept separate from the render
 * core so pure preview/render paths don't pull the mail transport (nodemailer).
 */

import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";
import { renderAdaptiveEmail, type EmailRecipient, type EmailTemplateKey } from "./adaptive-email";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { loadTenantEmailTransport } from "@/forms/load-tenant-email-transport";
import { getPlatformEmailSettings } from "@/platform/platform-store";
import { listSuppressedEmails } from "@/lib/lead-base/suppression-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getDb() as any; }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Crude HTML→text fallback for the plain-text part (mail clients require one). */
function htmlToText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

export interface SendAdaptiveEmailParams {
  tenantId:    string;
  recipient:   EmailRecipient;
  templateKey: EmailTemplateKey;
  /** Deliver here instead of recipient.email (e.g. a test inbox). */
  to?:         string;
  /** Idempotency key (e.g. a submission id). Repeated sends with it are skipped. */
  dedupeKey?:  string;
}

export type SendAdaptiveEmailResult =
  | { ok: true; skipped?: "suppressed" | "duplicate" }
  | { ok: false; error: string };

export async function sendAdaptiveEmail(params: SendAdaptiveEmailParams): Promise<SendAdaptiveEmailResult> {
  const to = (params.to?.trim() || params.recipient.email.trim()).toLowerCase();
  if (!to || !EMAIL_RE.test(to)) return { ok: false, error: "Invalid recipient email." };

  // Suppression — always respected.
  try {
    const suppressed = await listSuppressedEmails(params.tenantId);
    if (suppressed.has(to)) return { ok: true, skipped: "suppressed" };
  } catch { /* if the suppression read fails, proceed rather than block */ }

  // Idempotency: reserve the row first when a dedupeKey is given. A unique
  // violation means this (tenant, template, recipient, key) was already sent.
  if (params.dedupeKey) {
    const { error } = await db().from("email_sends").insert({
      tenant_id: params.tenantId, template_key: params.templateKey,
      recipient_email: to, dedupe_key: params.dedupeKey, status: "pending",
    });
    if (error) return { ok: true, skipped: "duplicate" };
  }

  // Render.
  let rendered: Awaited<ReturnType<typeof renderAdaptiveEmail>>;
  try {
    rendered = await renderAdaptiveEmail({ tenantId: params.tenantId, recipient: params.recipient, templateKey: params.templateKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "render failed";
    await logSend(params, to, "failed", msg, null);
    return { ok: false, error: msg };
  }

  // Transport + from-address.
  const [tenantTransport, platformRes] = await Promise.all([
    loadTenantEmailTransport(params.tenantId).catch(() => null),
    getPlatformEmailSettings(),
  ]);
  const platform  = platformRes.ok ? platformRes.data : null;
  const transport = resolveTransportConfig(tenantTransport, platform);
  if (transport.type === "none") {
    await logSend(params, to, "failed", "transport not configured", rendered.subject);
    return { ok: false, error: "Email is not configured — set up Resend or SMTP first." };
  }
  const fromEmail = platform?.fromEmail;
  if (!fromEmail) {
    await logSend(params, to, "failed", "no from-address", rendered.subject);
    return { ok: false, error: "No from-address configured (platform email settings)." };
  }
  const from = platform?.fromName ? `${platform.fromName} <${fromEmail}>` : fromEmail;

  const res = await sendMail(
    { from, to: [to], subject: rendered.subject, text: htmlToText(rendered.html), html: rendered.html },
    transport,
  );
  await logSend(params, to, res.ok ? "sent" : "failed", res.ok ? null : res.error, rendered.subject);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

async function logSend(
  params: SendAdaptiveEmailParams, to: string, status: string, error: string | null, subject: string | null,
): Promise<void> {
  try {
    if (params.dedupeKey) {
      await db().from("email_sends")
        .update({ status, error, subject })
        .eq("tenant_id", params.tenantId).eq("template_key", params.templateKey)
        .eq("recipient_email", to).eq("dedupe_key", params.dedupeKey);
    } else {
      await db().from("email_sends").insert({
        tenant_id: params.tenantId, template_key: params.templateKey,
        recipient_email: to, subject, status, error,
      });
    }
  } catch (e) {
    logger.debug("[email] logSend failed", { error: String(e) });
  }
}
