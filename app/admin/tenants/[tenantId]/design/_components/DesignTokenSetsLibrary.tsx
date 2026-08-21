"use client";

/**
 * DesignTokenSetsLibrary
 *
 * A library of saved design token sets on the Advanced tab. A set is a reusable
 * token-override payload (design.tokenOverrides format). Operators can:
 *
 *   - Save the tenant's current token overrides as a named set (or paste an
 *     upload JSON to save instead).
 *   - Apply a set (writes it to the tenant's tokenOverrides and reloads).
 *   - Rename or overwrite a tenant set with the current tokens.
 *   - Delete a tenant set.
 *
 * Platform-wide sets (tenant_id NULL) are shared, so they are apply-only here.
 *
 * This is distinct from the "Start from a token set" dropdown on the Blocks tab,
 * which lists in-JSON block token sets (design.blockTokenSets), a different
 * feature.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DesignTokenSet } from "@/lib/design-token-sets/design-token-sets-store";
import {
  saveDesignTokenSetAction,
  updateDesignTokenSetAction,
  deleteDesignTokenSetAction,
  applyDesignTokenSetAction,
} from "../token-set-actions";

interface Props {
  tenantId: string;
  /** The tenant's current design.tokenOverrides (what "save current" captures). */
  currentTokens: Record<string, unknown>;
  initialSets: DesignTokenSet[];
}

type Msg = { text: string; ok: boolean } | null;

export function DesignTokenSetsLibrary({ tenantId, currentTokens, initialSets }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sets, setSets]   = useState<DesignTokenSet[]>(initialSets);
  const [msg, setMsg]     = useState<Msg>(null);

  const [name, setName]         = useState("");
  const [pasteOn, setPasteOn]   = useState(false);
  const [pasteJson, setPasteJson] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const currentTokenCount = Object.keys(currentTokens ?? {}).length;

  function refreshList() {
    // The saved list comes from the server; a refresh re-runs the page loader.
    router.refresh();
  }

  function reportErrors(errors: string[]) {
    setMsg({ text: errors.join(" "), ok: false });
  }

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed) { setMsg({ text: "Enter a name for the set.", ok: false }); return; }

    let tokens: unknown = currentTokens;
    if (pasteOn) {
      try {
        tokens = JSON.parse(pasteJson);
      } catch {
        setMsg({ text: "The pasted JSON could not be parsed.", ok: false });
        return;
      }
    }

    setMsg(null);
    startTransition(async () => {
      const res = await saveDesignTokenSetAction(tenantId, { name: trimmed, tokens });
      if (!res.ok) { reportErrors(res.errors); return; }
      setName("");
      setPasteJson("");
      setPasteOn(false);
      setMsg({ text: `Saved "${trimmed}".`, ok: true });
      refreshList();
    });
  }

  function applySet(set: DesignTokenSet) {
    setMsg(null);
    startTransition(async () => {
      const res = await applyDesignTokenSetAction(tenantId, set.id);
      if (!res.ok) { reportErrors(res.errors); return; }
      setMsg({ text: `Applied "${set.name}" to this tenant.`, ok: true });
      router.refresh();
    });
  }

  function overwriteWithCurrent(set: DesignTokenSet) {
    setMsg(null);
    startTransition(async () => {
      const res = await updateDesignTokenSetAction(tenantId, { id: set.id, name: set.name, tokens: currentTokens });
      if (!res.ok) { reportErrors(res.errors); return; }
      setMsg({ text: `Updated "${set.name}" with the current tokens.`, ok: true });
      refreshList();
    });
  }

  function commitRename(set: DesignTokenSet) {
    const next = renameValue.trim();
    if (!next) { setMsg({ text: "Enter a name.", ok: false }); return; }
    setMsg(null);
    startTransition(async () => {
      const res = await updateDesignTokenSetAction(tenantId, { id: set.id, name: next, tokens: set.tokens });
      if (!res.ok) { reportErrors(res.errors); return; }
      setRenamingId(null);
      setMsg({ text: `Renamed to "${next}".`, ok: true });
      refreshList();
    });
  }

  function removeSet(set: DesignTokenSet) {
    setMsg(null);
    startTransition(async () => {
      const res = await deleteDesignTokenSetAction(tenantId, set.id);
      if (!res.ok) { reportErrors(res.errors); return; }
      setSets((prev) => prev.filter((s) => s.id !== set.id));
      setMsg({ text: `Deleted "${set.name}".`, ok: true });
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      {/* Format note: grouped theme presets here vs flat block tokens elsewhere */}
      <p className="mb-4 text-xs text-neutral-500 leading-relaxed">
        This accepts the grouped theme-preset format
        (<code className="font-mono">{'{ "theme": "...", "color": {...}, "typography": {...}, ... }'}</code>),
        the overarching design system and header/footer chrome. For flat, per-block tokens use the
        SITE DESIGN TOKENS box on the Blocks tab.
      </p>

      {/* Save current tokens */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-neutral-700 mb-1">Save current tokens as set</label>
        <p className="text-xs text-neutral-500 mb-2">
          Captures the tenant&apos;s current token overrides ({currentTokenCount} keys)
          {pasteOn ? ", or the pasted JSON below," : ""} as a reusable named set.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Set name"
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={saveCurrent}
            disabled={pending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Save set
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600">
            <input type="checkbox" checked={pasteOn} onChange={(e) => setPasteOn(e.target.checked)} />
            Save from pasted grouped theme-preset JSON instead
          </label>
        </div>
        {pasteOn && (
          <textarea
            value={pasteJson}
            onChange={(e) => setPasteJson(e.target.value)}
            placeholder='grouped theme-preset JSON, e.g. {"theme": "aurora-purple-gold", "color": {"primary": "#112233"}, "typography": {"fontHeading": "Inter"}}'
            rows={5}
            className="mt-2 w-full rounded-md border border-neutral-300 px-2.5 py-2 font-mono text-xs"
          />
        )}
      </div>

      {msg && (
        <div className={`mb-4 rounded-md px-3 py-2 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Saved sets */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-2">Saved token sets</h3>
        {sets.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">No saved sets yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {sets.map((set) => {
              const isPlatform = set.tenantId === null;
              const renaming   = renamingId === set.id;
              return (
                <li key={set.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {renaming ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="text-sm font-medium text-neutral-800">{set.name}</span>
                    )}
                    <span
                      className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                        isPlatform
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : "border-neutral-200 bg-neutral-50 text-neutral-600"
                      }`}
                    >
                      {isPlatform ? "Platform" : "This tenant"}
                    </span>
                    <span className="ml-2 text-xs text-neutral-400">
                      {Object.keys(set.tokens ?? {}).length} keys
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applySet(set)}
                      disabled={pending}
                      className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      Apply
                    </button>

                    {!isPlatform && !renaming && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setRenamingId(set.id); setRenameValue(set.name); }}
                          disabled={pending}
                          className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => overwriteWithCurrent(set)}
                          disabled={pending}
                          className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                          title="Overwrite this set with the tenant's current tokens"
                        >
                          Update with current
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSet(set)}
                          disabled={pending}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </>
                    )}

                    {renaming && (
                      <>
                        <button
                          type="button"
                          onClick={() => commitRename(set)}
                          disabled={pending}
                          className="rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
                        >
                          Save name
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
