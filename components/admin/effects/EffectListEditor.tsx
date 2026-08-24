"use client";

/**
 * EffectListEditor
 *
 * Reusable editor for a list of declarative BlockEffectConfig. Effects are chosen
 * from the registry (grouped by entrance / emphasis / continuous) and tuned with
 * typed numeric / select params. There is no raw-JS input anywhere: this is the
 * picker surface for the declarative effects layer.
 *
 * Extracted from the design EffectsEditor so the per-block picker (adaptive block
 * drawer), the per-block-type default (Allowed Blocks) and the Design -> Block
 * styles editors all reuse the identical UI. English admin UI.
 *
 * Constraints enforced here (so every picker behaves the same):
 *   - Max ONE effect per group (entrance / emphasis / continuous). Adding a second
 *     effect in an occupied group replaces the one already there. Cross-group
 *     combinations (e.g. a reveal entrance + a hover-lift) stay possible. This
 *     avoids the two-entrances pitfall where two entrances fight over the reveal.
 *   - Each added effect can be swapped in place via a dropdown (no Remove + Add);
 *     params whose keys still exist on the new effect are carried over.
 */

import { useEffect, useState } from "react";
import {
  EFFECT_DEFINITIONS, EFFECT_GROUPS, effectDefinition, type EffectGroupKey,
} from "@/design-system/effects/effect-defs";
import type { BlockEffectConfig } from "@/design-system/effects/effect-ref";
import { addEffectToList, swapEffectInList, isSwapTargetDisabled } from "./effect-list-ops";
import { EffectSwatch } from "./EffectSwatch";

export const effectInputCls = "rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
export const effectBtn = "rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50";

type EffectDef = (typeof EFFECT_DEFINITIONS)[number];

function groupByGroup(): Record<EffectGroupKey, EffectDef[]> {
  const byGroup: Record<EffectGroupKey, EffectDef[]> = { entrance: [], emphasis: [], continuous: [] };
  for (const d of EFFECT_DEFINITIONS) byGroup[d.group].push(d);
  return byGroup;
}

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
  // A short note shown when adding an effect replaced one in the same group.
  const [replacedNote, setReplacedNote] = useState<string | null>(null);

  // A selection the user picked but has not added to the list yet.
  const pending = addId && !value.some((e) => e.effect === addId) ? addId : null;
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  const byGroup = groupByGroup();

  function add() {
    if (!addId) return;
    const def = effectDefinition(addId);
    if (!def) return;
    const { next, replacedLabel } = addEffectToList(value, addId);
    if (next === value) { setAddId(""); return; } // already present, nothing to do
    onChange(next);
    setAddId("");
    setReplacedNote(replacedLabel ? `Replaced ${replacedLabel} (one ${def.group} effect at a time).` : null);
  }

  function remove(id: string) {
    onChange(value.filter((e) => e.effect !== id));
    setReplacedNote(null);
  }

  /** Swap an added effect for another, in place, carrying over compatible params. */
  function swap(oldId: string, newId: string) {
    const next = swapEffectInList(value, oldId, newId);
    if (next === value) return;
    onChange(next);
    setReplacedNote(null);
  }

  function setParam(id: string, key: string, raw: string, type: "number" | "select") {
    onChange(value.map((e) => {
      if (e.effect !== id) return e;
      const params: Record<string, string | number> = { ...(e.params ?? {}) };
      if (raw === "") delete params[key];
      else params[key] = type === "number" ? Number(raw) : raw;
      return Object.keys(params).length > 0 ? { effect: e.effect, params } : { effect: e.effect };
    }));
  }

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
      <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 6px" }}>
        One effect per group (entrance, emphasis, continuous). Adding a second in a group replaces it; combine across groups (e.g. a reveal and a hover-lift).
      </p>
      {/* The dropdown selection is not saved until it is added to the list. */}
      {pending && (
        <p role="status" style={{ fontSize: 11, color: "#b45309", margin: "0 0 10px" }}>
          Not added yet. Click Add effect to include &quot;{effectDefinition(pending)?.label ?? pending}&quot;.
        </p>
      )}
      {!pending && replacedNote && (
        <p role="status" style={{ fontSize: 11, color: "#6b7280", margin: "0 0 10px" }}>{replacedNote}</p>
      )}
      {!pending && !replacedNote && <div style={{ height: 6 }} />}

      {value.length === 0 && <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>No effects yet.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((cfg) => {
          const def = effectDefinition(cfg.effect);
          if (!def) return null;
          return (
            <div key={cfg.effect} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {/* Looping demo of this effect (registry-driven); click to replay. */}
                  <EffectSwatch config={cfg} />
                  {/* In-place swap: change the effect without Remove + Add. */}
                  <select
                    className={effectInputCls}
                    style={{ fontWeight: 600, maxWidth: 220 }}
                    value={cfg.effect}
                    aria-label="Change effect"
                    onChange={(e) => swap(cfg.effect, e.target.value)}
                  >
                    {EFFECT_GROUPS.map((g) => (
                      byGroup[g.key].length > 0 && (
                        <optgroup key={g.key} label={g.label}>
                          {byGroup[g.key].map((d) => (
                            <option key={d.id} value={d.id} disabled={isSwapTargetDisabled(value, cfg.effect, d.id)}>
                              {d.label}{d.defaultOff ? " (advanced)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )
                    ))}
                  </select>
                  {def.defaultOff && <span style={{ fontSize: 10, color: "#b45309" }}>advanced, default-off, off under reduced-motion</span>}
                </div>
                <button type="button" className={effectBtn} onClick={() => remove(cfg.effect)}>Remove</button>
              </div>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "4px 0 8px" }}>{def.description}</p>
              {def.params && def.params.length > 0 && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {def.params.map((p) => (
                    <label key={p.key} style={{ fontSize: 12, color: "#374151" }}>
                      <span style={{ display: "block", marginBottom: 2 }}>{p.label}{p.unit ? ` (${p.unit})` : ""}</span>
                      {p.type === "select" ? (
                        <select
                          className={effectInputCls} style={{ width: 130 }}
                          value={String(cfg.params?.[p.key] ?? p.default)}
                          onChange={(e) => setParam(cfg.effect, p.key, e.target.value, "select")}
                        >
                          {p.options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number" className={effectInputCls} style={{ width: 110 }}
                          min={p.min} max={p.max} step={p.step}
                          placeholder={String(p.default)}
                          value={cfg.params?.[p.key] ?? ""}
                          onChange={(e) => setParam(cfg.effect, p.key, e.target.value, "number")}
                        />
                      )}
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
