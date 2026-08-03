"use client";

/**
 * SnippetTimingEditor
 *
 * Per-tenant snippet timing. The snippet hides the page briefly waiting for the
 * personalisation decision (REVEAL_MS), and aborts the decide request after a
 * hard cap (CALL_MS). On a slow or low-traffic backend the cold-start decide can
 * exceed the defaults, so these let an operator give it more room. The values
 * are baked into the copied embed as data-mc-reveal-ms / data-mc-call-ms.
 *
 * Leave a field blank to use the snippet default (reveal 700, abort 4000).
 */

import { useState, useTransition } from "react";
import { saveSnippetTimingAction } from "../actions";

interface Props {
  tenantId:        string;
  initialRevealMs: number | null;
  initialCallMs:   number | null;
}

function toField(v: number | null): string {
  return typeof v === "number" ? String(v) : "";
}

export function SnippetTimingEditor({ tenantId, initialRevealMs, initialCallMs }: Props) {
  const [reveal, setReveal] = useState<string>(() => toField(initialRevealMs));
  const [call,   setCall]   = useState<string>(() => toField(initialCallMs));
  const [error,  setError]  = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);
  const [isPending, startTransition] = useTransition();

  function parse(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveSnippetTimingAction(tenantId, parse(reveal), parse(call));
      if (result.ok) setSaved(true);
      else if ("error" in result) setError(result.error as string);
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Timing</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          How long the snippet waits before showing the page, and how long it lets the
          decision request run. Raise these for a slow or low-traffic backend where the
          first (cold) request is slow. Saved values are baked into the embed below.
        </p>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Reveal delay (ms)</span>
            <input
              type="number" min={0} max={5000} step={50}
              value={reveal}
              onChange={(e) => { setReveal(e.target.value); setSaved(false); }}
              placeholder="700 (default)"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm text-neutral-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Page stays hidden this long to avoid a visible swap. A later decision is still applied.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-neutral-700">Request timeout (ms)</span>
            <input
              type="number" min={500} max={15000} step={100}
              value={call}
              onChange={(e) => { setCall(e.target.value); setSaved(false); }}
              placeholder="4000 (default)"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm text-neutral-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              Hard cap before the decide request is aborted. Raise it for slow cold starts.
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-green-600">Saved — copy the embed again</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save timing"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <ul className="space-y-2 pt-1 text-xs text-neutral-500">
          <li className="flex gap-2"><span className="text-indigo-400">•</span> Leave blank to use the defaults (reveal 700 ms, timeout 4000 ms).</li>
          <li className="flex gap-2"><span className="text-indigo-400">•</span> Clamped to reveal 0–5000 ms and timeout 500–15000 ms.</li>
          <li className="flex gap-2"><span className="text-indigo-400">•</span> After saving, re-copy the embed on the Install tab so the new values are on your site.</li>
        </ul>
      </div>
    </section>
  );
}
