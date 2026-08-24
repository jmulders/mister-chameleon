"use client";

/**
 * EffectsEditor
 *
 * Admin editor for the declarative block-effects layer. Two parts:
 *
 *   1. Default effects  — applied to every block with no effect ref of its own
 *      (design.defaultEffects). Edited as a list and saved via setDefaultEffectsAction.
 *   2. Effect sets      — the reusable named library (design_effect_sets). Create,
 *      list, and delete named sets a block can reference by name.
 *
 * Effects are DECLARATIVE only: an effect is chosen from the registry and tuned
 * with typed params. There is no raw-JS input anywhere. English UI.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BlockEffectConfig, EffectSet } from "@/design-system/effects/effect-ref";
import { EffectListEditor } from "@/components/admin/effects/EffectListEditor";
import { effectDefinition } from "@/design-system/effects/effect-defs";
import { saveEffectSetAction, deleteEffectSetAction, setDefaultEffectsAction } from "../effect-set-actions";

const inputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50";
const btnPrimary = "rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

// ── Main editor ────────────────────────────────────────────────────────────────

export function EffectsEditor({
  tenantId, effectSets, defaultEffects,
}: {
  tenantId: string;
  effectSets: EffectSet[];
  defaultEffects?: readonly BlockEffectConfig[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [defaults, setDefaults] = useState<BlockEffectConfig[]>([...(defaultEffects ?? [])]);
  const [setName, setSetName] = useState("");
  const [setEffects, setSetEffects] = useState<BlockEffectConfig[]>([]);

  // An effect picked in the Default-effects dropdown but not yet added to the list.
  const [pendingDefault, setPendingDefault] = useState<string | null>(null);
  // When set, an inline confirm is shown before saving an empty default list while
  // a selection is still pending (the "selected but forgot to Add" footgun).
  const [confirmDefault, setConfirmDefault] = useState<string | null>(null);

  function doSaveDefaults(list: BlockEffectConfig[]) {
    setStatus(null);
    setConfirmDefault(null);
    start(async () => {
      const r = await setDefaultEffectsAction(tenantId, list);
      setStatus(r.ok ? { kind: "ok", text: "Default effects saved." } : { kind: "error", text: r.error });
      if (r.ok) router.refresh();
    });
  }
  function saveDefaults() {
    // Warn (don't block) when the list is empty but a selection is still pending:
    // the user likely meant to add it. Deliberately clearing to empty stays possible.
    if (defaults.length === 0 && pendingDefault) { setConfirmDefault(pendingDefault); return; }
    doSaveDefaults(defaults);
  }
  function saveSet() {
    setStatus(null);
    start(async () => {
      const r = await saveEffectSetAction(tenantId, { name: setName, effects: setEffects });
      if (r.ok) { setStatus({ kind: "ok", text: `Saved effect set "${setName}".` }); setSetName(""); setSetEffects([]); router.refresh(); }
      else setStatus({ kind: "error", text: r.error });
    });
  }
  function removeSet(id: string) {
    setStatus(null);
    start(async () => {
      const r = await deleteEffectSetAction(tenantId, id);
      setStatus(r.ok ? { kind: "ok", text: "Effect set deleted." } : { kind: "error", text: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {status && (
        <div style={{ fontSize: 12, color: status.kind === "ok" ? "#15803d" : "#b91c1c" }}>{status.text}</div>
      )}

      <section>
        <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Default effects</h4>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
          Applied to every block that has no effect of its own. A block or a named set below can still override this.
        </p>
        <EffectListEditor value={defaults} onChange={setDefaults} onPendingChange={setPendingDefault} />

        {confirmDefault && (
          <div role="alertdialog" style={{ marginTop: 10, border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 8, padding: "10px 12px" }}>
            <p style={{ fontSize: 12, color: "#92400e", margin: "0 0 8px" }}>
              You selected &quot;{effectDefinition(confirmDefault)?.label ?? confirmDefault}&quot; but haven&apos;t added it.
              Save with no effects anyway?
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className={btnPrimary} disabled={pending}
                onClick={() => { const next = [...defaults, { effect: confirmDefault }]; setDefaults(next); doSaveDefaults(next); }}>
                Add and save
              </button>
              <button type="button" className={btn} disabled={pending} onClick={() => doSaveDefaults([])}>
                Save with no effects
              </button>
              <button type="button" className={btn} disabled={pending} onClick={() => setConfirmDefault(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <button type="button" className={btnPrimary} disabled={pending} onClick={saveDefaults}>
            {pending ? "Saving..." : "Save default effects"}
          </button>
        </div>
      </section>

      <section>
        <h4 style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>Effect sets (library)</h4>
        <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
          Reusable named sets. Assign one to a block by name to give it a specific set of effects.
        </p>

        {effectSets.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {effectSets.map((s) => (
              <li key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px" }}>
                <span style={{ fontSize: 13 }}><strong>{s.name}</strong> <span style={{ color: "#6b7280", fontSize: 11 }}>{s.effects.map((e) => e.effect).join(", ")}</span></span>
                <button type="button" className={btn} disabled={pending} onClick={() => removeSet(s.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ border: "1px dashed #d1d5db", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Create a new set</div>
          <label style={{ fontSize: 12, color: "#374151", display: "block", marginBottom: 10 }}>
            <span style={{ display: "block", marginBottom: 2 }}>Name</span>
            <input className={inputCls} style={{ width: 260 }} value={setName} placeholder="Gentle reveal" onChange={(e) => setSetName(e.target.value)} />
          </label>
          <EffectListEditor value={setEffects} onChange={setSetEffects} />
          <div style={{ marginTop: 10 }}>
            <button type="button" className={btnPrimary} disabled={pending || !setName.trim() || setEffects.length === 0} onClick={saveSet}>
              {pending ? "Saving..." : "Save effect set"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
