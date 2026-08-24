"use client";

/**
 * EffectListEditor
 *
 * Reusable editor for a list of declarative BlockEffectConfig. Effects are chosen
 * from the registry (grouped by entrance / emphasis / continuous) and tuned with
 * typed numeric params. There is no raw-JS input anywhere: this is the picker
 * surface for the declarative effects layer.
 *
 * Extracted from the design EffectsEditor so the per-block picker (adaptive block
 * drawer) and the per-block-type default (Allowed Blocks) reuse the identical UI.
 * English admin UI.
 */

import { useState } from "react";
import {
  EFFECT_DEFINITIONS, EFFECT_GROUPS, effectDefinition, type EffectGroupKey,
} from "@/design-system/effects/effect-defs";
import type { BlockEffectConfig } from "@/design-system/effects/effect-ref";

export const effectInputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
export const effectBtn = "rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50";

export function EffectListEditor({ value, onChange }: { value: BlockEffectConfig[]; onChange: (v: BlockEffectConfig[]) => void }) {
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
        <select className={effectInputCls} value={addId} onChange={(e) => setAddId(e.target.value)}>
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
        <button type="button" className={effectBtn} onClick={add}>Add effect</button>
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
                <button type="button" className={effectBtn} onClick={() => remove(cfg.effect)}>Remove</button>
              </div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 8px" }}>{def.description}</p>
              {def.params && def.params.length > 0 && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {def.params.map((p) => (
                    <label key={p.key} style={{ fontSize: 12, color: "#374151" }}>
                      <span style={{ display: "block", marginBottom: 2 }}>{p.label}{p.unit ? ` (${p.unit})` : ""}</span>
                      <input
                        type="number" className={effectInputCls} style={{ width: 110 }}
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
