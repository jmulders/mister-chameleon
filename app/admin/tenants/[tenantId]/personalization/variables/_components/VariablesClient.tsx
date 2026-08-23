"use client";

/**
 * Copy Variables editor (client).
 *
 * A list of insertable variables: token, optional label, a source (built-in
 * field or declared custom attribute), an optional value map (raw -> display,
 * with a "*" catch-all row), and an optional fallback. Saves via
 * saveCopyVariablesAction. English UI.
 */

import { useState, useTransition } from "react";
import type { CopyVariable } from "@/tenant/types";
import { saveCopyVariablesAction, type CopyVariableDraft } from "../actions";
import type { SourceOption } from "../page";

interface MapRow { from: string; to: string }
interface Row {
  token:      string;
  label:      string;
  sourceKind: "builtin" | "custom";
  sourceKey:  string;
  valueMap:   MapRow[];
  fallback:   string;
  /** UI-only: true once the operator edits the token, so a source change keeps their alias. */
  tokenTouched: boolean;
}

// Mirror the server validator (actions.ts TOKEN_RE): lowercase letters, digits, - or _, 1..40.
const TOKEN_RE = /^[a-z0-9_-]{1,40}$/;

/** A source's human label without the " (custom)" suffix used in the dropdown. */
function sourceLabel(o: SourceOption): string {
  return o.label.replace(/\s*\(custom\)\s*$/i, "").trim();
}

/** Derive a valid, token-safe alias from a source key. */
function deriveToken(sourceKey: string): string {
  return sourceKey
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function findSource(sourceOptions: SourceOption[], kind: "builtin" | "custom", key: string): SourceOption | undefined {
  return sourceOptions.find((o) => o.kind === kind && o.key === key);
}

function toRow(v: CopyVariable): Row {
  return {
    token:      v.token,
    label:      v.label ?? "",
    sourceKind: v.source.kind,
    sourceKey:  v.source.kind === "builtin" ? v.source.key : v.source.name,
    valueMap:   (v.valueMap ?? []).map((m) => ({ from: m.from, to: m.to })),
    fallback:   v.fallback ?? "",
    tokenTouched: true, // existing rows have an intentional token; never auto-overwrite it
  };
}

function blankRow(sourceOptions: SourceOption[]): Row {
  const first = sourceOptions[0];
  // Pre-fill token + label from the first source; the token stays an editable alias.
  return {
    token:      first ? deriveToken(first.key) : "",
    label:      first ? sourceLabel(first) : "",
    sourceKind: first?.kind ?? "builtin",
    sourceKey:  first?.key ?? "",
    valueMap:   [],
    fallback:   "",
    tokenTouched: false,
  };
}

const inputCls =
  "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
const inputErrCls =
  "w-full rounded border border-red-400 px-2 py-1.5 text-sm focus:border-red-500 focus:outline-none";

export function VariablesClient({
  tenantId,
  initialVariables,
  sourceOptions,
  defaultRegistry,
}: {
  tenantId:         string;
  initialVariables: CopyVariable[];
  sourceOptions:    SourceOption[];
  defaultRegistry:  CopyVariable[];
}) {
  const [rows, setRows]      = useState<Row[]>(initialVariables.map(toRow));
  const [status, setStatus]  = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startSave] = useTransition();

  function patch(i: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
    setStatus(null);
  }
  function addRow()             { setRows((rs) => [...rs, blankRow(sourceOptions)]); setStatus(null); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); setStatus(null); }
  function materialize()        { setRows(defaultRegistry.map(toRow)); setStatus(null); }

  // Choosing a Source auto-fills the label and (unless the operator has customised
  // it) the token, which stays an editable alias.
  function changeSource(i: number, kind: "builtin" | "custom", key: string) {
    setRows((rs) => rs.map((r, idx) => {
      if (idx !== i) return r;
      const opt = findSource(sourceOptions, kind, key);
      return {
        ...r,
        sourceKind: kind,
        sourceKey:  key,
        label:      opt ? sourceLabel(opt) : r.label,
        token:      r.tokenTouched ? r.token : (opt ? deriveToken(opt.key) : r.token),
      };
    }));
    setStatus(null);
  }

  // Client-side token validation (mirrors the server): format + uniqueness.
  const tokenCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const t = r.token.trim().toLowerCase();
    if (t) acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  function tokenError(r: Row): string | null {
    const t = r.token.trim().toLowerCase();
    if (!t) return "Token is required.";
    if (!TOKEN_RE.test(t)) return "Use lowercase letters, digits, - or _ (1 to 40 characters).";
    if ((tokenCounts[t] ?? 0) > 1) return "Token must be unique.";
    return null;
  }
  const hasTokenErrors = rows.some((r) => tokenError(r) !== null);

  function patchMap(i: number, mapRows: MapRow[]) { patch(i, { valueMap: mapRows }); }
  function addMapRow(i: number) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, valueMap: [...r.valueMap, { from: "", to: "" }] } : r)));
    setStatus(null);
  }

  function save() {
    const drafts: CopyVariableDraft[] = rows.map((r) => ({
      token:      r.token,
      label:      r.label,
      sourceKind: r.sourceKind,
      sourceKey:  r.sourceKey,
      valueMap:   r.valueMap,
      fallback:   r.fallback,
    }));
    startSave(async () => {
      const result = await saveCopyVariablesAction(tenantId, drafts);
      setStatus(result.ok
        ? { kind: "ok", text: "Saved." }
        : { kind: "error", text: result.error ?? "Save failed." });
    });
  }

  return (
    <div>
      {rows.length === 0 && (
        <div className="mb-4 rounded border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          <p>No managed variables yet. The insert dropdown currently shows the default built-ins and string custom attributes.</p>
          <button
            type="button"
            onClick={materialize}
            className="mt-3 rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Materialise defaults
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {rows.map((row, i) => {
          const tokErr = tokenError(row);
          return (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Source</span>
                <select
                  className={inputCls}
                  value={`${row.sourceKind}:${row.sourceKey}`}
                  onChange={(e) => {
                    const [kind, ...rest] = e.target.value.split(":");
                    changeSource(i, kind as "builtin" | "custom", rest.join(":"));
                  }}
                >
                  <optgroup label="Built-in">
                    {sourceOptions.filter((o) => o.kind === "builtin").map((o) => (
                      <option key={`builtin:${o.key}`} value={`builtin:${o.key}`}>{o.label}</option>
                    ))}
                  </optgroup>
                  {sourceOptions.some((o) => o.kind === "custom") && (
                    <optgroup label="Custom attributes">
                      {sourceOptions.filter((o) => o.kind === "custom").map((o) => (
                        <option key={`custom:${o.key}`} value={`custom:${o.key}`}>{o.label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Token (alias)</span>
                <input
                  className={tokErr ? inputErrCls : inputCls}
                  value={row.token}
                  placeholder="device"
                  aria-invalid={tokErr ? true : undefined}
                  onChange={(e) => patch(i, { token: e.target.value, tokenTouched: true })}
                />
                {tokErr && <span className="mt-1 block text-xs text-red-600">{tokErr}</span>}
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Label (optional)</span>
                <input
                  className={inputCls}
                  value={row.label}
                  placeholder="Device"
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
              </label>
            </div>

            {/* Value map: raw -> display, with a "*" catch-all row. */}
            <div className="mt-3">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Value map (optional): raw value to display value. Use{" "}
                <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">*</code> as the catch-all default.
              </span>
              <div className="flex flex-col gap-2">
                {row.valueMap.map((m, j) => (
                  <div key={j} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
                    <input
                      className={inputCls}
                      value={m.from}
                      placeholder="mobile"
                      onChange={(e) => patchMap(i, row.valueMap.map((mm, jj) => (jj === j ? { ...mm, from: e.target.value } : mm)))}
                    />
                    <span className="text-neutral-400">to</span>
                    <input
                      className={inputCls}
                      value={m.to}
                      placeholder="mobiel"
                      onChange={(e) => patchMap(i, row.valueMap.map((mm, jj) => (jj === j ? { ...mm, to: e.target.value } : mm)))}
                    />
                    <button
                      type="button"
                      onClick={() => patchMap(i, row.valueMap.filter((_, jj) => jj !== j))}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addMapRow(i)}
                  className="self-start rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Add mapping
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-end gap-3">
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Fallback (optional, used when the value is missing)</span>
                <input
                  className={inputCls}
                  value={row.fallback}
                  placeholder="your device"
                  onChange={(e) => patch(i, { fallback: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Remove variable
              </button>
            </div>
          </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          disabled={sourceOptions.length === 0}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          Add variable
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={materialize}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Reset to defaults
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={pending || hasTokenErrors}
          title={hasTokenErrors ? "Fix the token errors before saving" : undefined}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
        {hasTokenErrors && !status && (
          <span className="text-sm text-red-600">Fix the token errors before saving.</span>
        )}
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-green-600" : "text-red-600"}`}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
