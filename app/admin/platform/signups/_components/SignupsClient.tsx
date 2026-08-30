"use client";

/**
 * app/admin/platform/signups/_components/SignupsClient.tsx
 *
 * Interactive table of pending_trial_signups rows.
 *
 * Each row can be:
 *   • Processed   — creates tenant + user without needing Stripe to resend
 *   • Email retry — re-sends the welcome email (for completed rows)
 *   • Dismissed   — marks the row as dismissed (hides from pending list)
 */

import { useState, useTransition } from "react";
import { processSignupAction, retryEmailAction, dismissSignupAction } from "../actions";

export interface SignupRow {
  id:               string;
  name:             string;
  email:            string;
  company:          string;
  plan_id:          string;
  status:           string;
  stripe_session_id: string | null;
  created_at:       string;
  completed_at:     string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700",
    completed: "bg-green-100 text-green-700",
    dismissed: "bg-neutral-100 text-neutral-500",
    failed:    "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}

function planBadge(planId: string) {
  const map: Record<string, string> = {
    starter: "bg-blue-50 text-blue-600",
    growth:  "bg-violet-50 text-violet-600",
    pro:     "bg-orange-50 text-orange-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[planId] ?? "bg-neutral-100 text-neutral-600"}`}>
      {planId}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day:    "numeric",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Row component ─────────────────────────────────────────────────────────────

function SignupRow({ row, onUpdated }: { row: SignupRow; onUpdated: () => void }) {
  const [isPending,   startTransition] = useTransition();
  const [feedback,    setFeedback]     = useState<{ ok: boolean; msg: string } | null>(null);

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 5000);
  }

  function handleProcess() {
    startTransition(async () => {
      const result = await processSignupAction(row.id);
      if (result.ok) {
        flash(true, `Tenant "${result.tenantId}" created successfully.`);
        onUpdated();
      } else {
        flash(false, result.error);
      }
    });
  }

  function handleRetryEmail() {
    startTransition(async () => {
      const result = await retryEmailAction(row.id);
      if (result.ok) {
        flash(true, "Welcome email sent.");
      } else {
        flash(false, result.error);
      }
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissSignupAction(row.id);
      if (result.ok) {
        onUpdated();
      } else {
        flash(false, result.error);
      }
    });
  }

  return (
    <>
      <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
        {/* Name + email */}
        <td className="py-3.5 pl-4 pr-4">
          <p className="text-sm font-medium text-neutral-900">{row.name}</p>
          <p className="text-xs text-neutral-500">{row.email}</p>
        </td>

        {/* Company */}
        <td className="py-3.5 pr-4 text-sm text-neutral-700">{row.company}</td>

        {/* Plan */}
        <td className="py-3.5 pr-4">{planBadge(row.plan_id)}</td>

        {/* Status */}
        <td className="py-3.5 pr-4">{statusBadge(row.status)}</td>

        {/* Stripe session */}
        <td className="py-3.5 pr-4">
          {row.stripe_session_id ? (
            <span className="font-mono text-[10px] text-neutral-500 break-all">
              {row.stripe_session_id.slice(0, 28)}…
            </span>
          ) : (
            <span className="text-xs text-neutral-300">, </span>
          )}
        </td>

        {/* Created */}
        <td className="py-3.5 pr-4 text-xs text-neutral-500 whitespace-nowrap">
          {fmtDate(row.created_at)}
        </td>

        {/* Actions */}
        <td className="py-3.5 pl-2 pr-4">
          <div className="flex items-center gap-2 flex-wrap">
            {row.status === "pending" && (
              <>
                <button
                  onClick={handleProcess}
                  disabled={isPending}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Processing…" : "Process"}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={isPending}
                  className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
            {row.status === "completed" && (
              <button
                onClick={handleRetryEmail}
                disabled={isPending}
                className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Sending…" : "Resend email"}
              </button>
            )}
            {row.status === "dismissed" && (
              <span className="text-xs text-neutral-300">dismissed</span>
            )}
          </div>
        </td>
      </tr>

      {/* Inline feedback row */}
      {feedback && (
        <tr>
          <td colSpan={7} className="pb-2 pl-4 pr-4">
            <div className={`rounded-md px-3 py-2 text-xs ${feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {feedback.msg}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function SignupsClient({
  initialRows,
}: {
  initialRows: SignupRow[];
}) {
  const [rows, setRows] = useState<SignupRow[]>(initialRows);

  // After a mutation, refetch from the server via a soft reload of state.
  // Since this is a server-rendered page, we trigger a full page refresh
  // (which revalidates the server data) for simplicity.
  function handleUpdated() {
    // Trigger Next.js router refresh to re-run the server component.
    window.location.reload();
  }

  const pending   = rows.filter(r => r.status === "pending");
  const completed = rows.filter(r => r.status === "completed");
  const dismissed = rows.filter(r => r.status === "dismissed");

  function Table({
    label,
    data,
    emptyText,
  }: {
    label:     string;
    data:      SignupRow[];
    emptyText: string;
  }) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            {label}
            <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {data.length}
            </span>
          </h2>
        </div>

        {data.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-400">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="py-3 pl-4 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Contact</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Company</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Plan</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Stripe session</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Signed up</th>
                  <th className="py-3 pl-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <SignupRow key={row.id} row={row} onUpdated={handleUpdated} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Table
        label="Pending signups"
        data={pending}
        emptyText="No pending signups. All payments have been fully processed."
      />
      <Table
        label="Completed signups"
        data={completed}
        emptyText="No completed signups yet."
      />
      {dismissed.length > 0 && (
        <Table
          label="Dismissed"
          data={dismissed}
          emptyText="No dismissed signups."
        />
      )}
    </div>
  );
}
