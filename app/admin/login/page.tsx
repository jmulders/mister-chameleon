import { loginAction } from "./actions";

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
 */

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;

  const errorMessage =
    error === "invalid_credentials"
      ? "Incorrect email or password. Please try again."
      : error === "account_disabled"
        ? "This account has been deactivated. Contact your platform administrator."
        : error === "session_expired"
          ? "Your session has expired. Please sign in again."
          : error === "server_error"
            ? "A server error occurred. Please try again in a moment."
            : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Logo / heading */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Admin Sign In</h1>
          <p className="mt-1 text-sm text-slate-400">
            Mister Chameleon Platform
          </p>
        </div>

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
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder-slate-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-slate-300"
            >
              Password
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
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
