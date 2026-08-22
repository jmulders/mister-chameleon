import Link from "next/link";
import { requestPasswordResetAction } from "./actions";

/**
 * Admin Forgot Password Page
 *
 * Enter an email to receive a reset link. The response is always the same
 * neutral confirmation, whether or not the email belongs to an account, so it
 * cannot be used to discover which emails are registered.
 */

interface Props {
  searchParams: Promise<{ sent?: string }>;
}

export default async function AdminForgotPasswordPage({ searchParams }: Props) {
  const { sent } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-400">Mister Chameleon Platform</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-4 text-sm text-slate-300">
            <p>If an account exists for that email, a reset link is on its way. The link expires in 45 minutes.</p>
            <p className="mt-3">
              <Link href="/admin/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form action={requestPasswordResetAction} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter your admin email and we will send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-300">
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
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-colors"
            >
              Send reset link
            </button>
            <p className="pt-1 text-center text-sm">
              <Link href="/admin/login" className="text-slate-400 hover:text-slate-200 transition-colors">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
