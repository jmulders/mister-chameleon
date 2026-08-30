/**
 * FailureSignalsPanel
 *
 * The "is anything failing silently?" view. Storage, mail and decide each
 * degrade safely at runtime, which hides failures from operators. This panel
 * surfaces the recorded failure signals so a quiet death becomes visible.
 *
 * Pure server component: renders a summary + recent list gathered upstream.
 */

import type { FailureSignal, FailureSurfaceSummary } from "@/lib/observability/failure-signal-store";

interface FailureSignalsPanelProps {
  summary: FailureSurfaceSummary[];
  recent:  FailureSignal[];
}

const SURFACE_LABEL: Record<string, string> = {
  storage: "Form storage",
  mail:    "Mail sending",
  decide:  "Decide",
};

function fmt(iso: string | null): string {
  if (!iso) return "n/a";
  try {
    return new Date(iso).toLocaleString("en-GB");
  } catch {
    return iso;
  }
}

export function FailureSignalsPanel({ summary, recent }: FailureSignalsPanelProps) {
  const anyFailures = summary.some((s) => s.count > 0);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-neutral-900">Failure signals</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          Storage, mail and decide fail safely, and therefore silently. This layer
          makes that visible. Green means nothing was recorded in the recent window;
          amber means something failed quietly and needs attention.
        </p>
      </div>

      {/* Per-surface health */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {summary.map((s) => {
          const ok = s.count === 0;
          return (
            <div
              key={s.surface}
              className={`rounded-lg border px-4 py-3 ${
                ok ? "border-neutral-200 bg-white" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-900">
                  {SURFACE_LABEL[s.surface] ?? s.surface}
                </p>
                <span
                  className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"}`}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {ok ? "No recent failures" : `${s.count} recent failure${s.count === 1 ? "" : "s"}`}
              </p>
              {!ok && <p className="mt-0.5 text-[11px] text-amber-700">Last: {fmt(s.last)}</p>}
            </div>
          );
        })}
      </div>

      {/* Recent list */}
      {anyFailures && (
        <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Surface</th>
                <th className="px-3 py-2 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 25).map((s, i) => (
                <tr key={`${s.at}-${i}`} className="border-t border-neutral-100">
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-500">{fmt(s.at)}</td>
                  <td className="px-3 py-2 text-neutral-700">{SURFACE_LABEL[s.surface] ?? s.surface}</td>
                  <td className="px-3 py-2 text-neutral-600">{s.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
