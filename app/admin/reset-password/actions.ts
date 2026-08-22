"use server";

/**
 * Reset-password action.
 *
 * Validates the single-use token (hash match + not expired), enforces password
 * strength, writes the new hash, clears the token, and bumps session_epoch to
 * invalidate existing sessions. Does not auto-login: the user signs in again
 * with the new password and, if enabled, their 2FA code (reset never bypasses
 * 2FA). Never logs the token or password.
 */

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { hashPassword, validatePasswordStrength } from "@/lib/admin-auth/password";
import { validateResetToken } from "@/lib/admin-auth/password-reset";
import { completePasswordReset } from "@/data/admin-auth";

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token    = (formData.get("token") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const confirm  = (formData.get("confirm") as string | null) ?? "";
  const withToken = (code: string) => `/admin/reset-password?token=${encodeURIComponent(token)}&error=${code}`;

  try {
    const valid = await validateResetToken(token);
    if (!valid) redirect("/admin/reset-password?error=invalid");

    if (password !== confirm) redirect(withToken("mismatch"));

    const strengthError = validatePasswordStrength(password);
    if (strengthError) redirect(withToken("weak"));

    const passwordHash = await hashPassword(password);
    const ok = await completePasswordReset(valid!.id, passwordHash, valid!.sessionEpoch);
    if (!ok) redirect(withToken("server"));

    redirect("/admin/login?reset=1");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[resetPasswordAction] error");
    redirect(withToken("server"));
  }
}
