import Link from "next/link";
import { BrandLogo } from "@/components/admin/BrandLogo";
import { loginAction } from "./actions";
import { SIGN_IN_TEXTS, signInError } from "@/lib/admin-auth/sign-in-texts";
import { getSiteLocale } from "@/lib/site-texts/server";

/**
 * Admin Login Page
 *
 * Step 1 of the admin authentication flow: email + password.
 * If the account has 2FA enabled, this redirects to /admin/login/2fa
 * after a successful password check (via loginAction).
 *
 * This page is intentionally minimal — no sidebar, no branding beyond the
 * product name. The admin layout passes it through without the shell wrapper
 * because the pathname starts with /admin/login.
 *
 * The texts follow the language of the site (lib/admin-auth/sign-in-texts.ts):
 * a site links here from its own menu.
 */

interface Props {
  searchParams: Promise<{ error?: string; next?: string; reset?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error, next, reset } = await searchParams;

  const t            = SIGN_IN_TEXTS[await getSiteLocale()];
  const errorMessage = signInError(t, error);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / heading */}
        <div className="mb-8 text-center">
          <BrandLogo width={200} className="mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white">{t.signInHeading}</h1>
        </div>

        {/* Reset success banner */}
        {reset && !errorMessage && (
          <div className="mb-4 rounded-lg border border-green-500/40 bg-green-950/50 px-4 py-3 text-sm text-green-300">
            {t.passwordWasReset}
          </div>
        )}

        {/* Error banner */}
        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Login form */}
        <form action={loginAction} className="space-y-4">
          {/* Pass the intended destination through the form */}
          {next && <input type="hidden" name="next" value={next} />}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              {t.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder={t.emailPlaceholder}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              {t.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-colors"
          >
            {t.signIn}
          </button>

          <p className="pt-1 text-center text-sm">
            <Link href="/admin/forgot-password" className="text-slate-400 hover:text-slate-200 transition-colors">
              {t.forgotPassword}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
