import Link from "next/link";
import { verifyTotpAction, verifyBackupCodeAction } from "./actions";
import { SIGN_IN_TEXTS, twoFaError } from "@/lib/admin-auth/sign-in-texts";
import { getSiteLocale } from "@/lib/site-texts/server";

/**
 * TOTP Challenge Page — Step 2 of the admin login flow.
 *
 * Shown when the user has 2FA enabled and has just passed the password check.
 * Accepts either:
 *   • A 6-digit TOTP code from their authenticator app.
 *   • A one-time backup code (accessible via the "Use a backup code" toggle).
 *
 * The page is auth-shell free (same as /admin/login) because the admin layout
 * detects the /admin/login prefix and renders only children.
 */

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function TwoFaChallengePage({ searchParams }: Props) {
  const { error } = await searchParams;

  const t            = SIGN_IN_TEXTS[await getSiteLocale()];
  const errorMessage = twoFaError(t, error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">
            {t.twoFaHeading}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t.twoFaIntro}
          </p>
        </div>

        {/* Error banner */}
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* ── TOTP form ── */}
        <form action={verifyTotpAction} className="space-y-4">
          <div>
            <label
              htmlFor="code"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              {t.twoFaCode}
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={7} /* allow "123 456" with space */
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-lg tracking-[0.3em] text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="123456"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-colors"
          >
            {t.twoFaVerify}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">{t.or}</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* ── Backup code form ── */}
        <details className="group">
          <summary className="cursor-pointer text-center text-sm text-slate-400 hover:text-slate-200 list-none">
            {t.useABackupCode}
          </summary>
          <form action={verifyBackupCodeAction} className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="backup-code"
                className="mb-1.5 block text-sm font-medium text-slate-300"
              >
                {t.backupCode}
              </label>
              <input
                id="backup-code"
                name="code"
                type="text"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="xxxxxxxxxx-xxxxxxxxxx"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {t.backupCodeOnce}
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-sm hover:bg-slate-700 transition-colors"
            >
              {t.useBackupCode}
            </button>
          </form>
        </details>

        {/* Back link */}
        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/admin/login" className="hover:text-slate-200 underline">
            ← {t.backToSignIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
