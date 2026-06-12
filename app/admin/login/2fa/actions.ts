"use server";

import { cookies }    from "next/headers";
import { redirect }   from "next/navigation";
import {
  findAdminUserById,
  persistBackupCodes,
  touchLastLogin,
} from "@/data/admin-auth";
import {
  verifySession,
  signSession,
  sessionCookieOptions,
  ADMIN_TOKEN_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/admin-auth/session";
import { verifyTotpCode }    from "@/lib/admin-auth/totp";
import { consumeBackupCode } from "@/lib/admin-auth/backup-codes";

// ── Shared: read and validate the pre-2FA session ─────────────────────────────

async function getPreAuthSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  if (!token) return null;

  const session = await verifySession(token);
  // Must be a valid, 2FA-enabled, not-yet-verified session.
  if (!session || !session.twoFaEnabled || session.twoFaVerified) return null;
  return session;
}

// ── verifyTotpAction ──────────────────────────────────────────────────────────

/**
 * Verifies a 6-digit TOTP code and, on success, upgrades the pre-auth cookie
 * to a full session (twoFaVerified: true).
 */
export async function verifyTotpAction(formData: FormData): Promise<void> {
  const code = (formData.get("code") as string | null)?.replace(/\s/g, "") ?? "";

  const session = await getPreAuthSession();
  if (!session) {
    redirect("/admin/login?error=session_expired");
  }

  // Load the user's live TOTP secret from the database.
  const user = await findAdminUserById(session.sub);
  if (!user?.two_factor_secret) {
    redirect("/admin/login?error=session_expired");
  }

  const valid = verifyTotpCode(code, user.two_factor_secret);
  if (!valid) {
    redirect("/admin/login/2fa?error=invalid_code");
  }

  // ── Promote to full session ───────────────────────────────────────────────
  const fullToken = await signSession(
    { ...session, twoFaVerified: true },
    false,
  );
  const isSecure = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_TOKEN_COOKIE, fullToken, sessionCookieOptions(SESSION_MAX_AGE, isSecure));
  cookieStore.set("mc_editor", "1", {
    httpOnly: true, sameSite: "lax", path: "/", secure: isSecure, maxAge: SESSION_MAX_AGE,
  });

  await touchLastLogin(session.sub);
  redirect("/admin");
}

// ── verifyBackupCodeAction ────────────────────────────────────────────────────

/**
 * Verifies a one-time backup code.  On success, removes the code from the
 * stored list (to prevent reuse) and upgrades the session.
 */
export async function verifyBackupCodeAction(formData: FormData): Promise<void> {
  const code = (formData.get("code") as string | null)?.toLowerCase().trim() ?? "";

  const session = await getPreAuthSession();
  if (!session) {
    redirect("/admin/login?error=session_expired");
  }

  const user = await findAdminUserById(session.sub);
  if (!user?.two_factor_backup_codes?.length) {
    redirect("/admin/login/2fa?error=invalid_backup_code");
  }

  const updatedCodes = consumeBackupCode(code, user.two_factor_backup_codes);
  if (!updatedCodes) {
    redirect("/admin/login/2fa?error=invalid_backup_code");
  }

  // Persist the updated code list (used code removed) before granting access.
  await persistBackupCodes(session.sub, updatedCodes);

  const fullToken = await signSession(
    { ...session, twoFaVerified: true },
    false,
  );
  const isSecure = process.env.NODE_ENV === "production";
  const cookieStore2 = await cookies();
  cookieStore2.set(ADMIN_TOKEN_COOKIE, fullToken, sessionCookieOptions(SESSION_MAX_AGE, isSecure));
  cookieStore2.set("mc_editor", "1", {
    httpOnly: true, sameSite: "lax", path: "/", secure: isSecure, maxAge: SESSION_MAX_AGE,
  });

  await touchLastLogin(session.sub);
  redirect("/admin");
}
