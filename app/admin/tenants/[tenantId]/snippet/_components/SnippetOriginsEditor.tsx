"use client";

/**
 * SnippetOriginsEditor
 *
 * Restricts which hostnames may call /api/snippet/decide with this tenant's
 * site key. The site key is public (it ships in the snippet), so without this a
 * leaked key could be replayed from any site to run up the tenant's usage.
 *
 * Opt-in: an EMPTY list means no restriction (existing behaviour). Once at least
 * one host is saved, the decide endpoint rejects any request whose Origin (or
 * Referer) host is not on the list with a 403. A leading "www." is treated as
 * equivalent to the apex; every other subdomain must be listed explicitly.
 */

import { useState, useTransition } from "react";
import { saveSnippetAllowedOriginsAction } from "../actions";

interface Props {
  tenantId:       string;
  initialOrigins: readonly string[];
}

function toRows(origins: readonly string[]): string[] {
  return origins.length > 0 ? [...origins] : [""];
}

export function SnippetOriginsEditor({ tenantId, initialOrigins }: Props) {
  const [rows,    setRows]    = useState<string[]>(() => toRows(initialOrigins));
  const [error,   setError]   = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);
  const [isPending, startTransition] = useTransition();

  const restricted = initialOrigins.length > 0;

  function update(i: number, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? value : r)));
    setSaved(false);
  }
  function addRow()      { setRows((prev) => [...prev, ""]); }
  function removeRow(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [""];
    });
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const origins = rows.map((r) => r.trim()).filter(Boolean);
      const result = await saveSnippetAllowedOriginsAction(tenantId, origins);
      if (result.ok) setSaved(true);
      else if ("error" in result) setError(result.error as string);
    });
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Allowed origins</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Limit which domains may use this site key. The key is public, so this stops a
          leaked key from being replayed on other sites to run up your usage.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <div className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${restricted ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {restricted
            ? "Enforced. Requests from any other origin are rejected (403)."
            : "Not restricted. The key works from any origin. Add at least one domain to lock it down."}
        </div>

        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-3 items-center">
            <input
              type="text"
              value={row}
              onChange={(e) => update(i, e.target.value)}
              placeholder="nascita.nl"
              className="rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm text-neutral-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="Remove origin"
              className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-red-500 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add domain
          </button>

          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-medium text-green-600">Saved</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save origins"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <ul className="space-y-2 pt-1 text-xs text-neutral-500">
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            Enter bare hostnames (e.g. <code className="font-mono bg-neutral-100 px-1 rounded">nascita.nl</code>). Scheme, port and path are ignored.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <code className="font-mono bg-neutral-100 px-1 rounded">www.</code> is treated the same as the apex; add other subdomains (staging., app.) explicitly.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            Removing all domains turns the restriction off again.
          </li>
        </ul>
      </div>
    </section>
  );
}
