"use client";

/**
 * GlobalExperimentsToggle
 *
 * Tenant-level master switch for the experiment evaluation layer.
 * When the toggle is off, the ExperimentDecisionProvider skips all experiment
 * evaluation for this tenant — visitors receive the rules/fallback plan
 * with no A/B slot overrides applied.
 *
 * Mirrors the design and behaviour of GlobalRulesToggle.
 */

import { useState, useTransition } from "react";

interface GlobalExperimentsToggleProps {
  /** Current persisted state (read from DB / TenantSettings). */
  initialEnabled: boolean;
  /** Bound server action — `setTenantExperimentsEnabledAction.bind(null, tenantId)` */
  setEnabledAction: (enabled: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Whether A/B experiments are included in the tenant's current plan. */
  planEnabled?: boolean;
}

export function GlobalExperimentsToggle({
  initialEnabled,
  setEnabledAction,
  planEnabled = true,
}: GlobalExperimentsToggleProps) {
  const [enabled, setEnabled]        = useState(initialEnabled);
  const [error, setError]            = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (!planEnabled) return;
    const next = !enabled;
    setError(null);

    startTransition(async () => {
      const result = await setEnabledAction(next);
      if (result.ok) {
        setEnabled(next);
      } else {
        setError(result.error);
      }
    });
  }

  // ── Plan not included ──────────────────────────────────────────────────────
  if (!planEnabled) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-neutral-900">Experiments engine</p>
            <p className="text-xs text-neutral-500">
              A/B experiments are not included in this tenant&apos;s current plan.
              Upgrade the plan to unlock the experiments engine and per-experiment controls.
            </p>
          </div>
          {/* Locked toggle */}
          <div
            className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full border-2 border-transparent bg-neutral-200 opacity-50"
            aria-disabled="true"
          >
            <span className="inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow" />
          </div>
        </div>
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-400" />
            Not available on current plan
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border px-5 py-4 transition-colors ${
        enabled
          ? "border-neutral-200 bg-white"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold text-neutral-900">Experiments engine</p>
          <p className="text-xs text-neutral-500">
            {enabled
              ? "Active experiments are evaluated for every visitor request. Individual experiments below can also be paused."
              : "All experiments are disabled for this tenant. Visitors receive the rules/fallback plan with no A/B overrides."}
          </p>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable experiments engine"
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

      {/* Status pill */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            enabled
              ? "bg-green-100 text-green-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              enabled ? "bg-green-500" : "bg-amber-500"
            }`}
          />
          {isPending ? "Saving…" : enabled ? "Enabled" : "Disabled"}
        </span>

        {!enabled && (
          <span className="text-xs text-amber-700">
            Visitors receive the default plan. No A/B overrides applied.
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
