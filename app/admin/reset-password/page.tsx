import Link from "next/link";
import { resetPasswordAction } from "./actions";
import { validateResetToken } from "@/lib/admin-auth/password-reset";
import { SIGN_IN_TEXTS, resetError } from "@/lib/admin-auth/sign-in-texts";
import { getSiteLocale } from "@/lib/site-texts/server";

/**
 * Admin Reset Password Page
 *
 * Reached from the emailed link (?token=...). Validates the token on load; shows
 * the new-password form when valid, or an "invalid or expired" state otherwise.
 * On success the action redirects to the login page; the user signs in again
 * with the new password and their 2FA code.
 */

interface Props {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function AdminResetPasswordPage({ searchParams }: Props) {
  const { token, error } = await searchParams;
  const valid = token ? await validateResetToken(token) : null;

  const t            = SIGN_IN_TEXTS[await getSiteLocale()];
  const errorMessage = resetError(t, error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">{t.resetHeading}</h1>
          <p className="mt-1 text-sm text-slate-400">Mister Chameleon Platform</p>
        </div>

        {!valid ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-4 py-4 text-sm text-red-300">
            <p>{t.linkInvalid}</p>
            <p className="mt-3">
              <Link href="/admin/forgot-password" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                {t.requestNewLink}
              </Link>
            </p>
          </div>
        ) : (
          <form action={resetPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />

            {errorMessage && (
              <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t.newPassword}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder={t.newPasswordPlaceholder}
              />
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-300">
                {t.confirmPassword}
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder={t.confirmPlaceholder}
              />
            </div>

            <p className="text-xs text-slate-500">
              {t.passwordRule}
            </p>

            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-colors"
            >
              {t.setPassword}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
