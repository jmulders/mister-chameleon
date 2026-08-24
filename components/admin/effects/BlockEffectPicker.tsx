"use client";

/**
 * BlockEffectPicker
 *
 * Declarative per-block effect assignment. Produces a BlockEffectRef (or
 * undefined) that resolveBlockEffects reads across the three tiers
 * (instance ref -> block-type default -> tenant default):
 *
 *   None      -> undefined  (inherit the block-type / tenant default)
 *   Disabled  -> { disabled: true }  (kill-switch: no effects on this block)
 *   Named set -> { effectSet: <key> }  (a set from the effect library)
 *   Inline    -> { effects: [...] }  (effects chosen inline from the registry)
 *
 * Effects are always chosen from the registry/library, never raw JS. English UI.
 */

import { useMemo, useState } from "react";
import type { BlockEffectRef, BlockEffectConfig, EffectSet } from "@/design-system/effects/effect-ref";
import { EffectListEditor, effectInputCls } from "./EffectListEditor";

type Mode = "none" | "disabled" | "set" | "inline";

function modeOf(ref: BlockEffectRef | undefined): Mode {
  if (!ref) return "none";
  if (ref.disabled) return "disabled";
  if (ref.effectSet) return "set";
  if (ref.effects && ref.effects.length > 0) return "inline";
  return "none";
}

export function BlockEffectPicker({
  value,
  onChange,
  effectSets,
}: {
  value:      BlockEffectRef | undefined;
  onChange:   (v: BlockEffectRef | undefined) => void;
  effectSets: readonly EffectSet[];
}) {
  // Mode is local state, not derived from `value`: an inline ref with an empty
  // effects list still resolves to "none" (correct at render), but the editor
  // must stay open so the operator can add the first effect. The picker owns the
  // mode once mounted; `value` is seeded from the block on open.
  const [mode, setMode] = useState<Mode>(() => modeOf(value));
  const inlineEffects = useMemo<BlockEffectConfig[]>(
    () => (value?.effects ? [...value.effects] : []),
    [value],
  );

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    switch (next) {
      case "none":     onChange(undefined); break;
      case "disabled": onChange({ disabled: true }); break;
      case "set":      onChange({ effectSet: effectSets[0]?.key ?? "" }); break;
      case "inline":   onChange({ effects: inlineEffects }); break;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          className={effectInputCls}
          value={mode}
          onChange={(e) => changeMode(e.target.value as Mode)}
          aria-label="Block effect mode"
        >
          <option value="none">None (inherit default)</option>
          <option value="disabled">Disabled (no effects)</option>
          <option value="set" disabled={effectSets.length === 0}>Named set from library</option>
          <option value="inline">Inline effects</option>
        </select>

        {mode === "set" && (
          effectSets.length > 0 ? (
            <select
              className={effectInputCls}
              value={value?.effectSet ?? ""}
              onChange={(e) => onChange({ effectSet: e.target.value })}
              aria-label="Effect set"
            >
              {effectSets.map((s) => (
                <option key={s.id} value={s.key}>{s.name}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontSize: 12, color: "#6b7280" }}>No effect sets yet. Create one in Design -&gt; Block styles.</span>
          )
        )}
      </div>

      {mode === "none" && (
        <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
          This block inherits its effect from the block-type default (Allowed Blocks) or the tenant default.
        </p>
      )}
      {mode === "disabled" && (
        <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
          Effects are turned off for this block, overriding any block-type or tenant default.
        </p>
      )}

      {mode === "inline" && (
        <EffectListEditor
          value={inlineEffects}
          onChange={(effects) => onChange(effects.length > 0 ? { effects } : { effects: [] })}
        />
      )}
    </div>
  );
}
