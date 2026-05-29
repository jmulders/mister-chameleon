"use client";

/**
 * DeleteTenantPanel
 *
 * Danger-zone component rendered at the bottom of the Tenant Settings page
 * (super-admin only).  Shows a confirmation dialog that requires the user to
 * type the tenant ID before the delete is allowed.
 */

import { useState, useTransition } from "react";
import { deleteTenantAction }      from "../actions";

interface Props {
  tenantId:   string;
  tenantName: string;
}

export function DeleteTenantPanel({ tenantId, tenantName }: Props) {
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
      // deleteTenantAction redirects on success; we only land here on error.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      {/* ── Danger zone card ────────────────────────────────────────────────── */}
      <div className="mt-10 rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-base font-semibold text-red-800">Danger zone</h3>
        <p className="mt-1 text-sm text-red-700">
          Deleting a tenant is <strong>permanent and irreversible</strong>. All
          settings, rules, experiments, and billing data for{" "}
          <strong>{tenantName || tenantId}</strong> will be removed immediately.
        </p>
        <p className="mt-1 text-sm text-red-600">
          If this tenant has an active Stripe subscription, cancel it in the
          Stripe Dashboard first.
        </p>
        <button
          type="button"
          onClick={() => { setOpen(true); setConfirm(""); setError(null); }}
          className="mt-4 inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Delete tenant…
        </button>
      </div>

      {/* ── Confirmation dialog ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900">Delete tenant?</h2>
            <p className="mt-2 text-sm text-gray-600">
              This will permanently delete{" "}
              <strong>{tenantName || tenantId}</strong> and all its data.
              This action cannot be undone.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Type <code className="rounded bg-gray-100 px-1 py-0.5 text-red-700">{tenantId}</code> to confirm
              </label>
              <input
                type="text"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={tenantId}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-700 rounded bg-red-50 border border-red-200 px-3 py-2">
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
