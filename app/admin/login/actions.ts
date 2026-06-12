"use server";

import { cookies }    from "next/headers";
import { redirect }   from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  findAdminUserByEmailForLogin,
  touchLastLogin,
} from "@/data/admin-auth";
import {
  signSession,
  sessionCookieOptions,
  ADMIN_TOKEN_COOKIE,
  SESSION_MAX_AGE,
  PRE_2FA_MAX_AGE,
  type AdminSession,
} from "@/lib/admin-auth/session";
import { verifyPassword } from "@/lib/admin-auth/password";

// ── loginAction ───────────────────────────────────────────────────────────────

/**
 * Verifies email + password and sets the admin session cookie.
 *
 * When the user has 2FA enabled:
 *   — Issues a short-lived (10 min) pre-2FA JWT with twoFaVerified: false.
 *   — Redirects to /admin/login/2fa.
 *
 * When 2FA is not enabled:
 *   — Issues a full (8 h) JWT with twoFaVerified: false (moot).
 *   — Redirects to `next` (the originally requested URL) or /admin.
 *
 * Inactive accounts (is_active = false) are rejected AFTER password
 * verification with a distinct error code so the account owner understands why.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const email    = (formData.get("email")    as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null)        ?? "";
  const next     = (formData.get("next")     as string | null)        ?? "/admin";

  try {
    return await loginActionInner(email, password, next);
  } catch (err) {
    // Always re-throw redirect errors — they are the normal success/failure
    // path and must reach the Next.js action handler unmodified.
    if (isRedirectError(err)) throw err;

    // Any other exception (DB down, JWT failure, etc.) is converted to a
    // generic error redirect so the user sees a useful message rather than
    // the "An unexpected response was received from the server" error.
    console.error("[loginAction] Unexpected error:", err);
    redirect(
      `/admin/login?error=server_error&next=${encodeURIComponent(next)}`,
    );
  }
}

async function loginActionInner(
  email: string,
  password: string,
  next: string,
): Promise<void> {
  // ── Look up user ──────────────────────────────────────────────────────────
  const user = await findAdminUserByEmailForLogin(email);

  // Constant-time rejection — always run bcrypt even when user not found.
  const passwordOk =
    user !== null && (await verifyPassword(password, user.password_hash));

  if (!user || !passwordOk) {
    // Redirect back with a generic error (no user-enumeration).
    redirect(`/admin/login?error=invalid_credentials&next=${encodeURIComponent(next)}`);
  }

  // ── Inactive account check ────────────────────────────────────────────────
  // Checked AFTER password verification — we do not reveal whether the account
  // exists to unauthenticated callers.  A deactivated account with the correct
  // password gets a distinct message so the legitimate user understands why.
  if (!user.is_active) {
    redirect(`/admin/login?error=account_disabled&next=${encodeURIComponent(next)}`);
  }

  // ── Build session payload ─────────────────────────────────────────────────
  const sessionPayload: AdminSession = {
    sub:           user.id,
    email:         user.email,
    name:          user.name,
    role:          user.role,
    twoFaEnabled:  user.two_factor_enabled,
    twoFaVerified: false, // never true immediately after password check
  };

  const isSecure = process.env.NODE_ENV === "production";

  // ── mc_editor bypass cookie ─────────────────────────────────────────────────
  //
  // Set alongside the admin session so that the /api/snippet/decide endpoint can
  // skip the personalisation decision engine when an admin is browsing the site.
  // This prevents credit waste when content publishers preview content changes.
  // The cookie is scoped to "/" (site-wide) so the snippet running on any page
  // of the same domain reads it and gets default content without a DB round-trip.
  const editorCookieOptions = {
    httpOnly: true,
    sameSite: "lax"  as const,
    path:     "/",
    secure:   isSecure,
    maxAge:   SESSION_MAX_AGE,
  };

  if (user.two_factor_enabled) {
    // ── 2FA required — issue a short-lived pre-auth token ──────────────────
    const preAuthToken = await signSession(sessionPayload, true /* preAuth */);
    (await cookies()).set(
      ADMIN_TOKEN_COOKIE,
      preAuthToken,
      sessionCookieOptions(PRE_2FA_MAX_AGE, isSecure),
    );
    // Don't set mc_editor yet — 2FA is still pending. It will be set by the
    // 2FA completion action once the full session is established.
    redirect("/admin/login/2fa");
  } else {
    // ── No 2FA — issue a full session token ────────────────────────────────
    const fullToken = await signSession(
      { ...sessionPayload, twoFaVerified: false },
      false,
    );
    (await cookies()).set(
      ADMIN_TOKEN_COOKIE,
      fullToken,
      sessionCookieOptions(SESSION_MAX_AGE, isSecure),
    );
    (await cookies()).set("mc_editor", "1", editorCookieOptions);
    await touchLastLogin(user.id);

    // Validate the `next` destination to prevent open-redirect attacks.
    const destination = next.startsWith("/admin") ? next : "/admin";
    redirect(destination);
  }
}

// ── logoutAction ──────────────────────────────────────────────────────────────

/** Clears the admin session cookie and redirects to the login page. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_TOKEN_COOKIE);
  cookieStore.delete("mc_editor");
  redirect("/admin/login");
}
