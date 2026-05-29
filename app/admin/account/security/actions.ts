"use server";

import { cookies }   from "next/headers";
import { redirect }  from "next/navigation";
import {
  findAdminUserById,
  setPendingTotpSecret,
  enableTwoFactor,
  disableTwoFactor,
  replaceBackupCodes,
} from "@/data/admin-auth";
import {
  verifySession,
  signSession,
  sessionCookieOptions,
  ADMIN_TOKEN_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/admin-auth/session";
import {
  generateTotpSecret,
  generateTotpUri,
  generateQrCodeDataUrl,
  verifyTotpCode,
} from "@/lib/admin-auth/totp";
import {
  generateBackupCodes,
  hashBackupCodes,
} from "@/lib/admin-auth/backup-codes";

// ── Shared: get the authenticated admin session ────────────────────────────────

async function requireAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) redirect("/admin/login");

  const session = await verifySession(token);
  if (!session || (session.twoFaEnabled && !session.twoFaVerified)) {
    redirect("/admin/login");
  }
  return session;
}

// ── initSetup2faAction ────────────────────────────────────────────────────────

/**
 * Generates a fresh TOTP secret, stores it as `two_factor_pending_secret`,
 * and returns the QR code data URL + the secret (both server-rendered).
 *
 * Call this from a Server Component action to start the setup flow.
 * The secret is returned only so it can be rendered on the setup page
 * alongside the QR code for users who prefer to enter it manually.
 */
export async function initSetup2faAction(): Promise<{
  qrCodeDataUrl: string;
  secret: string;
} | { error: string }> {
  const session = await requireAdminSession();
  const user    = await findAdminUserById(session.sub);
  if (!user) return { error: "User not found." };

  const secret = generateTotpSecret();
  await setPendingTotpSecret(session.sub, secret);

  const uri          = generateTotpUri(user.email, secret);
  const qrCodeDataUrl = await generateQrCodeDataUrl(uri);

  return { qrCodeDataUrl, secret };
}

// ── confirmEnable2faAction ────────────────────────────────────────────────────

/**
 * Verifies the first TOTP code from the user's authenticator, then:
 *   1. Promotes the pending secret to the live secret.
 *   2. Generates and hashes 10 backup codes.
 *   3. Enables 2FA on the account.
 *   4. Re-issues the session JWT with twoFaEnabled: true, twoFaVerified: true.
 *   5. Returns the plaintext backup codes (shown once, then discarded).
 */
export async function confirmEnable2faAction(
  formData: FormData,
): Promise<{ backupCodes: string[] } | { error: string }> {
  const code = (formData.get("code") as string | null)?.replace(/\s/g, "") ?? "";
  if (!code) return { error: "Please enter the 6-digit code." };

  const session = await requireAdminSession();
  const user    = await findAdminUserById(session.sub);

  if (!user?.two_factor_pending_secret) {
    return { error: "No setup in progress. Please restart the 2FA setup." };
  }

  if (!verifyTotpCode(code, user.two_factor_pending_secret)) {
    return { error: "That code is incorrect or has expired. Please try again." };
  }

  const plaintextCodes = generateBackupCodes();
  const hashedCodes    = hashBackupCodes(plaintextCodes);

  const ok = await enableTwoFactor(session.sub, hashedCodes);
  if (!ok) return { error: "Failed to enable 2FA. Please try again." };

  // Re-issue JWT so the sidebar immediately reflects twoFaEnabled: true.
  const newToken = await signSession(
    { ...session, twoFaEnabled: true, twoFaVerified: true },
    false,
  );
  const isSecure = process.env.NODE_ENV === "production";
  (await cookies()).set(
    ADMIN_TOKEN_COOKIE,
    newToken,
    sessionCookieOptions(SESSION_MAX_AGE, isSecure),
  );

  return { backupCodes: plaintextCodes };
}

// ── disable2faAction ──────────────────────────────────────────────────────────

/**
 * Disables 2FA after re-verifying the current TOTP code (so a stolen
 * session cookie alone is not enough to disable 2FA).
 */
export async function disable2faAction(formData: FormData): Promise<void> {
  const code = (formData.get("code") as string | null)?.replace(/\s/g, "") ?? "";

  const session = await requireAdminSession();
  const user    = await findAdminUserById(session.sub);

  if (!user?.two_factor_secret) {
    redirect("/admin/account/security?error=no_2fa");
  }

  if (!verifyTotpCode(code, user.two_factor_secret)) {
    redirect("/admin/account/security?error=invalid_code");
  }

  await disableTwoFactor(session.sub);

  // Re-issue JWT reflecting disabled 2FA.
  const newToken = await signSession(
    { ...session, twoFaEnabled: false, twoFaVerified: false },
    false,
  );
  const isSecure = process.env.NODE_ENV === "production";
  (await cookies()).set(
    ADMIN_TOKEN_COOKIE,
    newToken,
    sessionCookieOptions(SESSION_MAX_AGE, isSecure),
  );

  redirect("/admin/account/security?success=2fa_disabled");
}

// ── regenerateBackupCodesAction ───────────────────────────────────────────────

/**
 * Replaces the existing backup codes with a fresh set.
 * Requires 2FA to already be enabled and the current TOTP code for confirmation.
 * Returns the new plaintext codes (shown once, then discarded).
 */
export async function regenerateBackupCodesAction(
  formData: FormData,
): Promise<{ backupCodes: string[] } | { error: string }> {
  const code = (formData.get("code") as string | null)?.replace(/\s/g, "") ?? "";

  const session = await requireAdminSession();
  const user    = await findAdminUserById(session.sub);

  if (!user?.two_factor_secret || !user.two_factor_enabled) {
    return { error: "2FA is not enabled on this account." };
  }

  if (!verifyTotpCode(code, user.two_factor_secret)) {
    return { error: "That code is incorrect or has expired. Please try again." };
  }

  const plaintextCodes = generateBackupCodes();
  const hashedCodes    = hashBackupCodes(plaintextCodes);

  const ok = await replaceBackupCodes(session.sub, hashedCodes);
  if (!ok) return { error: "Failed to regenerate backup codes. Please try again." };

  return { backupCodes: plaintextCodes };
}
