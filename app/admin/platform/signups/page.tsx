/**
 * app/admin/platform/signups/page.tsx
 *
 * Pending Signups — admin dashboard for managing trial signups that came
 * through the Stripe checkout flow.
 *
 * ─── Why this page exists ─────────────────────────────────────────────────────
 *
 *   When a prospect completes the Stripe checkout, a webhook fires to create
 *   their tenant and user.  Occasionally the webhook is delayed or fails
 *   (local dev, network blip, Stripe CLI not running).  This page lets a
 *   platform admin manually:
 *
 *     • Process — create the tenant + user without needing Stripe to resend
 *     • Resend email — re-send the welcome email for a completed signup
 *     • Dismiss — hide a row that is no longer relevant
 *
 * ─── Data source ──────────────────────────────────────────────────────────────
 *
 *   pending_trial_signups table — written by the /api/trial/register endpoint
 *   at checkout time and updated by the Stripe webhook handler.
 *
 * ─── Access control ───────────────────────────────────────────────────────────
 *
 *   Requires a platform-admin session (getRequiredAdminSession).
 */

import { createClient }            from "@supabase/supabase-js";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { SignupsClient }           from "./_components/SignupsClient";
import type { SignupRow }          from "./_components/SignupsClient";

export const dynamic = "force-dynamic";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SignupsPage() {
  await getRequiredAdminSession();

  const db = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // Fetch all signups, most recent first.
  // Status order: pending first, then completed, then dismissed.
  const { data, error } = await db
    .from("pending_trial_signups")
    .select("id, name, email, company, plan_id, status, stripe_session_id, created_at, completed_at")
    .order("created_at", { ascending: false });

  const rows: SignupRow[] = (data ?? []) as SignupRow[];

  const pendingCount = rows.filter(r => r.status === "pending").length;

  return (
    <div className="max-w-6xl p-8 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            Pending Signups
            {pendingCount > 0 && (
              <span className="ml-2.5 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-700">
                {pendingCount} pending
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Trial signups from the Stripe checkout flow. Use{" "}
            <strong className="font-medium text-neutral-700">Process</strong> to manually create a tenant
            when the Stripe webhook was missed or delayed.
          </p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Could not load signups</p>
          <p className="mt-0.5 text-xs text-red-600">{error.message}</p>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">How the signup flow works</p>
        <ol className="space-y-1 text-sm text-blue-700 list-decimal list-inside">
          <li>Prospect fills out the trial form → row created in <code className="text-[11px] font-mono bg-blue-100 px-1 rounded">pending_trial_signups</code> with status <em>pending</em></li>
          <li>Stripe checkout completes → webhook fires → tenant + user created → status becomes <em>completed</em></li>
          <li>If the webhook was missed, click <strong>Process</strong> on the pending row to create the tenant manually</li>
          <li>If the welcome email failed to send, click <strong>Resend email</strong> on a completed row</li>
        </ol>
      </div>

      {/* Table */}
      {!error && <SignupsClient initialRows={rows} />}

    </div>
  );
}
