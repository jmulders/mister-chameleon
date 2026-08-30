"use client";

/**
 * GlobalRulesToggle
 *
 * Tenant-level master switch for the rules engine.
 * When the toggle is off, the RulesDecisionProvider skips all rule evaluation
 * for this tenant and falls straight through to the defaultPlan.
 *
 * Renders a clearly labelled toggle with a contextual description so that
 * operators understand the impact before flipping it.
 */

import { useState, useTransition } from "react";

interface GlobalRulesToggleProps {
  /** Current persisted state (read from DB / seed config). */
  initialEnabled: boolean;
  /** Bound server action — `setTenantRulesEnabledAction.bind(null, tenantId)` */
  setEnabledAction: (enabled: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function GlobalRulesToggle({ initialEnabled, setEnabledAction }: GlobalRulesToggleProps) {
  const [enabled, setEnabled]   = useState(initialEnabled);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
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
          <p className="text-sm font-semibold text-neutral-900">
            Rules engine: revert to default experience
          </p>
          <p className="text-xs text-neutral-500">
            {enabled
              ? "Rules are evaluated for every visitor request. Turn this off to instantly serve this tenant the default, non-personalized experience, no deploy required, effective on the next page view."
              : "Personalization is off for this tenant. Every visitor receives the default, non-personalized experience. Turning this back on re-enables the rules below immediately."}
          </p>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable rules engine"
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
            Default plan will be served to all visitors.
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
