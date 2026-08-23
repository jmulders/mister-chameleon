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
import {
  EFFECT_DEFINITIONS, EFFECT_GROUPS, effectDefinition, type EffectGroupKey,
} from "@/design-system/effects/effect-defs";
import type { BlockEffectConfig, EffectSet } from "@/design-system/effects/effect-ref";
import { saveEffectSetAction, deleteEffectSetAction, setDefaultEffectsAction } from "../effect-set-actions";

const inputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50";
const btnPrimary = "rounded bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60";

// ── A reusable editor for a list of BlockEffectConfig ──────────────────────────

function EffectListEditor({ value, onChange }: { value: BlockEffectConfig[]; onChange: (v: BlockEffectConfig[]) => void }) {
  const [addId, setAddId] = useState<string>(EFFECT_DEFINITIONS[0]?.id ?? "");

  function add() {
    if (!addId || value.some((e) => e.effect === addId)) return;
    onChange([...value, { effect: addId }]);
  }
  function remove(id: string) { onChange(value.filter((e) => e.effect !== id)); }
  function setParam(id: string, key: string, raw: string) {
    onChange(value.map((e) => {
      if (e.effect !== id) return e;
      const params = { ...(e.params ?? {}) };
      if (raw === "") delete params[key]; else params[key] = Number(raw);
      return Object.keys(params).length > 0 ? { effect: e.effect, params } : { effect: e.effect };
    }));
  }

  const byGroup: Record<EffectGroupKey, Array<(typeof EFFECT_DEFINITIONS)[number]>> = { entrance: [], emphasis: [], continuous: [] };
  for (const d of EFFECT_DEFINITIONS) byGroup[d.group].push(d);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <select className={inputCls} value={addId} onChange={(e) => setAddId(e.target.value)}>
          {EFFECT_GROUPS.map((g) => (
            byGroup[g.key].length > 0 && (
              <optgroup key={g.key} label={g.label}>
                {byGroup[g.key].map((d) => (
                  <option key={d.id} value={d.id}>{d.label}{d.defaultOff ? " (advanced)" : ""}</option>
                ))}
              </optgroup>
            )
          ))}
        </select>
        <button type="button" className={btn} onClick={add}>Add effect</button>
      </div>

      {value.length === 0 && <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>No effects yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((cfg) => {
          const def = effectDefinition(cfg.effect);
          if (!def) return null;
          return (
            <div key={cfg.effect} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{def.label}{def.defaultOff ? <span style={{ fontSize: 10, color: "#b45309", marginLeft: 6 }}>advanced, default-off, off under reduced-motion</span> : null}</span>
                <button type="button" className={btn} onClick={() => remove(cfg.effect)}>Remove</button>
              </div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 8px" }}>{def.description}</p>
              {def.params && def.params.length > 0 && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {def.params.map((p) => (
                    <label key={p.key} style={{ fontSize: 12, color: "#374151" }}>
                      <span style={{ display: "block", marginBottom: 2 }}>{p.label}{p.unit ? ` (${p.unit})` : ""}</span>
                      <input
                        type="number" className={inputCls} style={{ width: 110 }}
                        min={p.min} max={p.max} step={p.step}
                        placeholder={String(p.default)}
                        value={cfg.params?.[p.key] ?? ""}
                        onChange={(e) => setParam(cfg.effect, p.key, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

  function saveDefaults() {
    setStatus(null);
    start(async () => {
      const r = await setDefaultEffectsAction(tenantId, defaults);
      setStatus(r.ok ? { kind: "ok", text: "Default effects saved." } : { kind: "error", text: r.error });
      if (r.ok) router.refresh();
    });
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
        <EffectListEditor value={defaults} onChange={setDefaults} />
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
