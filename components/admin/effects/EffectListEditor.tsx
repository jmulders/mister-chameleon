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

import { useEffect, useState } from "react";
import {
  EFFECT_DEFINITIONS, EFFECT_GROUPS, effectDefinition, type EffectGroupKey,
} from "@/design-system/effects/effect-defs";
import type { BlockEffectConfig } from "@/design-system/effects/effect-ref";

export const effectInputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
export const effectBtn = "rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50";

export function EffectListEditor({
  value, onChange, onPendingChange,
}: {
  value: BlockEffectConfig[];
  onChange: (v: BlockEffectConfig[]) => void;
  /**
   * Fires with the dropdown effect that is SELECTED BUT NOT YET ADDED (or null).
   * Lets the parent warn before a Save that would silently drop it. The dropdown
   * starts on a neutral placeholder, so "pending" only means a real user choice.
   */
  onPendingChange?: (pendingEffectId: string | null) => void;
}) {
  // Neutral placeholder default: "pending" reflects a deliberate selection, not
  // the first option being pre-picked. Reset to "" after each add.
  const [addId, setAddId] = useState<string>("");

  // A selection the user picked but has not added to the list yet.
  const pending = addId && !value.some((e) => e.effect === addId) ? addId : null;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  function add() {
    if (!addId || value.some((e) => e.effect === addId)) return;
    onChange([...value, { effect: addId }]);
    setAddId("");
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
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
        <select className={effectInputCls} value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">Select an effect...</option>
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
        <button type="button" className={effectBtn} onClick={add} disabled={!addId}
          style={!addId ? { opacity: 0.5, cursor: "not-allowed" } : undefined}>
          Add effect
        </button>
      </div>
      {/* The dropdown selection is not saved until it is added to the list. */}
      {pending && (
        <p role="status" style={{ fontSize: 11, color: "#b45309", margin: "0 0 10px" }}>
          Not added yet. Click Add effect to include &quot;{effectDefinition(pending)?.label ?? pending}&quot;.
        </p>
      )}
      {!pending && <div style={{ height: 6 }} />}

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
