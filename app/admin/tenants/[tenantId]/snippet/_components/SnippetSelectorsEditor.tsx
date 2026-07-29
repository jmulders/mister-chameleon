"use client";

/**
 * SnippetSelectorsEditor
 *
 * Maps slot names to CSS selectors so the snippet can personalise elements that
 * carry no `data-mc-slot` attribute — the WordPress / page-builder path, where
 * the operator can't edit the theme markup. The saved map is returned to the
 * snippet by /api/snippet/decide as `selectors`.
 *
 * Rows are edited locally and persisted in one go; blank rows are dropped
 * server-side by sanitizeSelectorMap.
 */

import { useState, useTransition } from "react";
import { saveSnippetSelectorMapAction } from "../actions";

interface Row { key: string; selector: string }

interface SnippetSelectorsEditorProps {
  tenantId:      string;
  initialMap:    Record<string, string>;
  /** Known slot names, offered as datalist suggestions for the key field. */
  slotSuggestions: readonly string[];
}

function mapToRows(map: Record<string, string>): Row[] {
  const rows = Object.entries(map).map(([key, selector]) => ({ key, selector }));
  return rows.length > 0 ? rows : [{ key: "", selector: "" }];
}

export function SnippetSelectorsEditor({
  tenantId,
  initialMap,
  slotSuggestions,
}: SnippetSelectorsEditorProps) {
  const [rows,    setRows]    = useState<Row[]>(() => mapToRows(initialMap));
  const [error,   setError]   = useState<string | null>(null);
  const [saved,   setSaved]   = useState(false);
  const [isPending, startTransition] = useTransition();

  function update(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
    setSaved(false);
  }

  function addRow() {
    setRows((prev) => [...prev, { key: "", selector: "" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [{ key: "", selector: "" }];
    });
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const entries = rows
        .map((r) => ({ key: r.key.trim(), selector: r.selector.trim() }))
        .filter((r) => r.key && r.selector);
      const result = await saveSnippetSelectorMapAction(tenantId, entries);
      if (result.ok) {
        setSaved(true);
      } else if ("error" in result) {
        setError(result.error as string);
      }
    });
  }

  const listId = "mc-slot-suggestions";

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Selector mapping</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          For sites where you can&apos;t add <code className="font-mono text-xs">data-mc-slot</code> attributes
          (WordPress page builders, etc.). Point a slot at a CSS selector and the snippet
          swaps that element directly.
        </p>
      </div>

      <div className="px-6 py-5 space-y-4">
        <datalist id={listId}>
          {slotSuggestions.map((s) => <option key={s} value={s} />)}
        </datalist>

        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[1fr_1fr_auto] gap-3 px-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <span>Slot name</span>
          <span>CSS selector</span>
          <span className="w-8" aria-hidden />
        </div>

        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
            <input
              type="text"
              list={listId}
              value={row.key}
              onChange={(e) => update(i, "key", e.target.value)}
              placeholder="hero-title"
              className="rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm text-neutral-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <input
              type="text"
              value={row.selector}
              onChange={(e) => update(i, "selector", e.target.value)}
              placeholder=".hero h1"
              className="rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm text-neutral-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              aria-label="Remove row"
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
            Add mapping
          </button>

          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-medium text-green-600">Saved</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save mappings"}
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
            Selectors run on the visitor&apos;s page. A blank or invalid selector is ignored. It never breaks the host page.
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <code className="font-mono bg-neutral-100 px-1 rounded">data-mc-slot</code> attributes still work; selectors are an additional way to reach an element.
          </li>
        </ul>
      </div>
    </section>
  );
}
