"use client";

/**
 * SelfServiceToggle
 *
 * Tenant-level opt-in to self-service mode. Default OFF: the platform is
 * agency-led unless a tenant (or admin) turns this on. When on, self-service
 * authoring features become available to the tenant.
 */

import { useState, useTransition } from "react";

interface SelfServiceToggleProps {
  initialEnabled: boolean;
  /** Bound server action — `setSelfServiceEnabledAction.bind(null, tenantId)` */
  setEnabledAction: (enabled: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function SelfServiceToggle({ initialEnabled, setEnabledAction }: SelfServiceToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setError(null);
    startTransition(async () => {
      const result = await setEnabledAction(next);
      if (result.ok) setEnabled(next);
      else setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-neutral-900">Self-service mode</p>
          <p className="text-xs text-neutral-500">
            {enabled
              ? "This tenant can author their own variants and copy. Turn off to return to agency-led."
              : "Agency-led (default). Turn on to let this tenant author their own variants and copy."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable self-service mode"
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
            enabled ? "bg-brand-600" : "bg-neutral-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            enabled ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {isPending ? "Saving…" : enabled ? "Self-service" : "Agency-led"}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
