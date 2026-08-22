import "server-only";

/**
 * Admin password-reset token helpers + the transactional reset email.
 *
 * A reset token is 32 random bytes (base64url); only its SHA-256 hash is stored
 * on admin_users. The raw token travels solely in the emailed link and is never
 * logged. Tokens are single-use and expire after RESET_TOKEN_TTL_MS.
 */

import { randomBytes, createHash } from "node:crypto";
import { sendMail, resolveTransportConfig } from "@/forms/mail-transport";
import { getPlatformEmailSettings } from "@/platform/platform-store";
import { findAdminUserByResetTokenHash } from "@/data/admin-auth";
import { resolvePublicBaseUrl } from "@/lib/base-url";
import { logger } from "@/lib/logger";

/** Reset token lifetime: 45 minutes. */
export const RESET_TOKEN_TTL_MS = 45 * 60 * 1000;

/** SHA-256 hex of a raw reset token (what we store + look up by). */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Generate a new reset token: the raw value (for the link) + its stored hash. */
export function generateResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashResetToken(raw) };
}

/** A reset token that maps to a live (non-expired) account. */
export interface ValidResetToken {
  id:           string;
  email:        string;
  name:         string;
  sessionEpoch: number;
}

/**
 * Validate a raw reset token: it must hash to a stored token that has not
 * expired. Returns the owning account (for the reset), or null when the token is
 * missing, unknown, or expired. Used by both the reset page (GET) and action.
 */
export async function validateResetToken(rawToken: string): Promise<ValidResetToken | null> {
  if (!rawToken) return null;
  const user = await findAdminUserByResetTokenHash(hashResetToken(rawToken));
  if (!user || !user.reset_token_expires_at) return null;
  if (Date.parse(user.reset_token_expires_at) <= Date.now()) return null;
  return { id: user.id, email: user.email, name: user.name, sessionEpoch: user.session_epoch ?? 0 };
}

/** The reset link for a raw token (token-only URL; no email/id). */
export function resetLink(rawToken: string): string {
  return `${resolvePublicBaseUrl()}/admin/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Send the admin password-reset email via the platform transport. Returns false
 * (without throwing) when email is not configured, so the caller can keep the
 * neutral response. Never logs the token or link.
 */
export async function sendAdminPasswordResetEmail(
  toEmail: string,
  toName:  string,
  rawToken: string,
): Promise<boolean> {
  const settings = await getPlatformEmailSettings();
  const platform = settings.ok ? settings.data : null;
  const transport = resolveTransportConfig(null, platform);
  if (transport.type === "none" || !platform?.fromEmail) {
    logger.warn("[admin-password-reset] email transport not configured; skipping send");
    return false;
  }

  const from = `${platform.fromName ?? "Mister Chameleon"} <${platform.fromEmail}>`;
  const link = resetLink(rawToken);
  const subject = "Reset your Mister Chameleon admin password";
  const text =
    `Hi ${toName},\n\n` +
    `We received a request to reset your Mister Chameleon admin password.\n\n` +
    `Reset it here (this link expires in 45 minutes and can be used once):\n${link}\n\n` +
    `After resetting, sign in again with your new password and, if enabled, your two-factor code.\n\n` +
    `If you did not request this, you can safely ignore this email; your password stays unchanged.\n`;
  const html =
    `<p>Hi ${escapeHtml(toName)},</p>` +
    `<p>We received a request to reset your Mister Chameleon admin password.</p>` +
    `<p><a href="${escapeHtml(link)}">Reset your password</a> (this link expires in 45 minutes and can be used once).</p>` +
    `<p>After resetting, sign in again with your new password and, if enabled, your two-factor code.</p>` +
    `<p>If you did not request this, you can safely ignore this email; your password stays unchanged.</p>`;

  try {
    const res = await sendMail({ from, to: [toEmail], subject, text, html }, transport);
    if (!res.ok) logger.warn("[admin-password-reset] email send failed");
    return res.ok;
  } catch {
    logger.warn("[admin-password-reset] email send threw");
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  ));
}
