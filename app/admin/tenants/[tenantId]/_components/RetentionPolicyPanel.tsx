"use client";

/**
 * RetentionPolicyPanel
 *
 * Sets the tenant's post-termination deletion window — how long after a tenant
 * cancels their personal data (visitor profiles etc.) is kept before deletion.
 * Default is 30 days (AVG-aligned); a tenant can agree a different window,
 * effective from a chosen date so the change is auditable.
 *
 * Live profiles auto-expire on a rolling 90-day window regardless; this governs
 * the deletion obligation after the contract ends.
 */

import { useState, useTransition } from "react";
import type { RetentionPolicy } from "@/lib/retention/retention-policy-store";

interface RetentionPolicyPanelProps {
  initialPolicy: RetentionPolicy;
  /** Bound server action — `setRetentionPolicyAction.bind(null, tenantId)` */
  setAction: (
    days: number,
    effectiveFrom: string | null,
  ) => Promise<{ ok: true; policy: RetentionPolicy } | { ok: false; error: string }>;
}

export function RetentionPolicyPanel({ initialPolicy, setAction }: RetentionPolicyPanelProps) {
  const [days, setDays] = useState<number>(initialPolicy.postTerminationDeletionDays);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(initialPolicy.effectiveFrom ?? "");
  const [saved, setSaved] = useState<RetentionPolicy>(initialPolicy);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    days !== saved.postTerminationDeletionDays ||
    (effectiveFrom || null) !== (saved.effectiveFrom ?? null);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await setAction(days, effectiveFrom || null);
      if (result.ok) {
        setSaved(result.policy);
        setDays(result.policy.postTerminationDeletionDays);
        setEffectiveFrom(result.policy.effectiveFrom ?? "");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="text-sm font-semibold text-neutral-900">Data retention after termination</p>
      <p className="mt-1 text-xs text-neutral-500">
        How long after this tenant cancels their personal data is kept before
        deletion. Default is 30 days. Live profiles auto-expire on a rolling
        90-day window regardless.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Deletion window (days)</span>
          <input
            type="number"
            min={1}
            max={3650}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={isPending}
            className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-700">Effective from (optional)</span>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            disabled={isPending}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
          />
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !dirty}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Current: personal data deleted within{" "}
        <span className="font-medium text-neutral-700">{saved.postTerminationDeletionDays} days</span>{" "}
        of termination
        {saved.effectiveFrom ? `, effective from ${saved.effectiveFrom}` : ""}.
      </p>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
