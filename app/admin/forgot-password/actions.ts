"use server";

/**
 * Forgot-password request action.
 *
 * Always redirects to the same neutral "sent" state regardless of whether the
 * email belongs to an account (no user enumeration). For an existing account it
 * stores a hashed single-use reset token and emails the link. Rate-limited by IP
 * and by email, with a short per-account cooldown. Never logs the token.
 */

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { findAdminUserByEmailForLogin, setPasswordResetToken } from "@/data/admin-auth";
import { checkRateLimit, extractClientIp } from "@/lib/rate-limiting";
import {
  generateResetToken, sendAdminPasswordResetEmail, RESET_TOKEN_TTL_MS,
} from "@/lib/admin-auth/password-reset";

const COOLDOWN_MS = 60 * 1000;

export async function requestPasswordResetAction(formData: FormData): Promise<void> {
  const email = ((formData.get("email") as string | null) ?? "").toLowerCase().trim();

  try {
    if (email) {
      const ip = extractClientIp(await headers());
      const ipRl    = await checkRateLimit("auth", `pwreset-ip:${ip}`);
      const emailRl = await checkRateLimit("auth", `pwreset-email:${email}`);

      if (ipRl.allowed && emailRl.allowed) {
        const user = await findAdminUserByEmailForLogin(email);
        if (user) {
          const recentlyRequested =
            user.reset_requested_at !== null &&
            Date.now() - Date.parse(user.reset_requested_at) < COOLDOWN_MS;
          if (!recentlyRequested) {
            const { raw, hash } = generateResetToken();
            const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
            await setPasswordResetToken(user.id, hash, expiresAt);
            await sendAdminPasswordResetEmail(user.email, user.name, raw);
          }
        }
      }
    }
  } catch (err) {
    if (isRedirectError(err)) throw err;
    // Never surface internal errors to the requester; keep the neutral response.
    console.error("[requestPasswordResetAction] error");
  }

  redirect("/admin/forgot-password?sent=1");
}
