"use client";

/**
 * TenantDeleteButton
 *
 * Inline delete button for the tenant list table.
 * Shows a trash icon that appears on row hover; clicking opens a
 * confirmation modal that requires the user to type the tenant ID.
 *
 * Reuses deleteTenantAction which handles super-admin auth, cascade
 * deletion, and redirect back to /admin/tenants on success.
 */

import { useState, useTransition } from "react";
import { deleteTenantAction }      from "../[tenantId]/actions";

interface Props {
  tenantId:   string;
  tenantName: string;
}

export function TenantDeleteButton({ tenantId, tenantName }: Props) {
  const [open,      setOpen]      = useState(false);
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const match = confirm.trim() === tenantId;

  function handleDelete() {
    if (!match) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteTenantAction(tenantId);
      // Action redirects on success — we only reach here on error.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      {/* ── Trash icon button (visible on row hover via group-hover) ────────── */}
      <button
        type="button"
        onClick={() => { setOpen(true); setConfirm(""); setError(null); }}
        title={`Delete ${tenantName || tenantId}`}
        className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white p-1.5 text-red-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>

      {/* ── Confirmation modal ───────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-red-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Delete tenant?</h2>
                <p className="mt-1 text-sm text-gray-600">
                  This permanently deletes <strong>{tenantName || tenantId}</strong> and all
                  its settings, rules, experiments, and billing data. This cannot be undone.
                </p>
                {/* Stripe reminder */}
                <p className="mt-2 text-xs text-amber-700 rounded bg-amber-50 border border-amber-200 px-2.5 py-1.5">
                  If this tenant has an active Stripe subscription, cancel it in the Stripe
                  Dashboard first.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Type{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-red-700">
                  {tenantId}
                </code>{" "}
                to confirm
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && match) handleDelete(); }}
                placeholder={tenantId}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            {error && (
              <p className="mt-3 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!match || isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
