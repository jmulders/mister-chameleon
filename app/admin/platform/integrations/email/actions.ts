/**
 * Platform Email Integration Server Actions
 *
 * Reads and writes the "email" row in `platform_settings`.
 * Provides the platform-level email transport that all tenants fall back to
 * when they have no per-tenant transport configured in `tenant_email_transport`.
 *
 * ─── Transport resolution order at send-time ──────────────────────────────────
 *
 *   1. Per-tenant DB config  (tenant_email_transport)       — highest priority
 *   2. Platform DB config    (platform_settings.email)      — this page
 *   3. Env vars              (RESEND_API_KEY / SMTP_HOST)   — legacy fallback
 *   4. None                  — silent skip
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Read actions strip all secret values before returning.
 *   Write actions accept secrets but never echo them back.
 *   Secrets (resendApiKey, smtpPassword) are encrypted at rest using
 *   AES-256-GCM (lib/email-crypto.ts) when EMAIL_ENCRYPTION_KEY is set.
 */

"use server";

import { revalidatePath }                    from "next/cache";
import {
  getPlatformEmailSettings,
  savePlatformEmailSettings,
  emailPlatformFlags,
}                                            from "@/platform/platform-store";
import { encryptSecret }                    from "@/lib/email-crypto";
import { getRequiredAdminSession, isSuperAdmin } from "@/lib/admin-auth/authorization";
import { sendMail, resolveTransportConfig }  from "@/forms/mail-transport";
import { serverEnv }                         from "@/lib/env";

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * The safe shape returned to client components.
 * Secrets replaced with boolean flags.
 */
export interface SafePlatformEmailConfig {
  transportType:   "resend" | "smtp" | "none";
  configured:      boolean;
  fromName:        string;
  fromEmail:       string;
  backofficeEmail: string;
  hasResendKey:    boolean;
  smtpHost:        string;
  smtpPort:        number;
  smtpUsername:    string;
  hasSmtpPassword: boolean;
  smtpSecure:      boolean;
  updatedAt:       string | null;
}

/**
 * Load platform email settings, secrets stripped.
 */
export async function getPlatformEmailAction(): Promise<{
  ok:     true;
  config: SafePlatformEmailConfig;
} | {
  ok:     false;
  error:  string;
}> {
  const result = await getPlatformEmailSettings();

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const flags = emailPlatformFlags(result.data);

  return {
    ok: true,
    config: {
      ...flags,
      updatedAt: result.updatedAt,
    },
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Form input from the client.
 * Secret fields are empty string when the user wants to preserve the stored value.
 */
export interface PlatformEmailFormInput {
  transportType:  "resend" | "smtp" | "none";
  fromName:       string;
  fromEmail:      string;
  backofficeEmail: string;
  /** Empty string = preserve existing key. */
  resendApiKey:   string;
  smtpHost:       string;
  smtpPort:       string;   // string because it comes from a form input
  smtpUsername:   string;
  /** Empty string = preserve existing password. */
  smtpPassword:   string;
  smtpSecure:     boolean;
}

/**
 * Save platform email settings.
 *
 * Secrets are only written when the client sends a non-empty value.
 * Empty string = "keep existing".
 */
export async function savePlatformEmailAction(
  input: PlatformEmailFormInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const transportType: "resend" | "smtp" | "none" =
    input.transportType === "resend" || input.transportType === "smtp"
      ? input.transportType
      : "none";

  // ── Load existing row to preserve secrets when client sends empty ──────────
  const existing = await getPlatformEmailSettings();
  const prev     = existing.ok ? existing.data : {};

  const patch: Record<string, unknown> = {
    transportType,
    fromName:       input.fromName.trim()       || undefined,
    fromEmail:      input.fromEmail.trim()      || undefined,
    backofficeEmail: input.backofficeEmail.trim() || undefined,
  };

  if (transportType === "resend") {
    const newKey = input.resendApiKey.trim();
    patch.resendApiKey = newKey
      ? encryptSecret(newKey)
      : (prev.resendApiKey ? encryptSecret(prev.resendApiKey) : undefined);  // preserve (re-encrypt; prev is decrypted on read)
  }

  if (transportType === "smtp") {
    patch.smtpHost     = input.smtpHost.trim()     || undefined;
    patch.smtpPort     = Number(input.smtpPort)    || 587;
    patch.smtpUsername = input.smtpUsername.trim() || undefined;
    patch.smtpSecure   = Boolean(input.smtpSecure);

    const newPw = input.smtpPassword.trim();
    patch.smtpPassword = newPw
      ? encryptSecret(newPw)
      : (prev.smtpPassword ? encryptSecret(prev.smtpPassword) : undefined);  // preserve (re-encrypt; prev is decrypted on read)
  }

  const result = await savePlatformEmailSettings(
    patch as Parameters<typeof savePlatformEmailSettings>[0],
  );

  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/email");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

/**
 * Send a test email using the PLATFORM transport (ignores any tenant transport).
 * Verifies the configured Resend/SMTP credentials + from-address end-to-end.
 * Super-admin only. Save your settings first — this uses the stored config.
 */
export async function sendPlatformTestEmailAction(
  recipientEmail: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) return { ok: false, error: "Only platform admins can send a test email." };

  const to = recipientEmail?.trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "Enter a valid recipient email." };

  const result   = await getPlatformEmailSettings();
  const platform = result.ok ? result.data : null;
  const transport = resolveTransportConfig(null, platform);
  if (transport.type === "none") {
    return { ok: false, error: "No platform transport configured, set Resend or SMTP above and Save first." };
  }

  const fromEmail = platform?.fromEmail ?? serverEnv.email.fromAddress ?? undefined;
  if (!fromEmail) {
    return { ok: false, error: "No from-address: set 'From email' above and Save first." };
  }
  const from = platform?.fromName?.trim() ? `${platform.fromName.trim()} <${fromEmail}>` : fromEmail;

  const res = await sendMail(
    {
      from,
      to:      [to],
      subject: "Test email: Mister Chameleon platform",
      text:    `Platform email test.\n\nTransport: ${transport.type}\nFrom: ${from}\nSent: ${new Date().toISOString()}`,
      html:    `<p>Platform email test: your transport works. ✅</p><p style="color:#666;font-size:12px">Transport: ${transport.type} · From: ${from} · ${new Date().toISOString()}</p>`,
    },
    transport,
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, message: `Test email sent to ${to} via ${transport.type}.` };
}

/**
 * Clear the platform email transport (set to "none").
 * Preserves from/backofficeEmail fields; only resets transport type and secrets.
 */
export async function clearPlatformEmailTransportAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await savePlatformEmailSettings({
    transportType: "none",
    resendApiKey:  "",
    smtpPassword:  "",
  });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/email");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

