"use client";

/**
 * BuiltinScenarioOverridesClient
 *
 * Manages the per-tenant OVERRIDE layer over the CODE-DEFINED built-ins — the
 * Quick presets and the Demo "Who are you?" roles — beside the custom-persona
 * editor. Per built-in: show/hide, reorder, relabel (label/icon, + colour for
 * presets), tweak the simulated signals (Advanced, same field editor as custom
 * personas), and Reset to default (drops the override key). The code defaults are
 * never mutated; overrides are applied at render time.
 *
 * Storage: settings.scenarioOverrides (JSONB, no migration). Empty entries are
 * dropped server-side. The legacy scenarioPanel allowlist is folded in at render.
 */

import { useMemo, useState, useTransition } from "react";
import { SCENARIO_PRESET_LIST } from "@/components/scenario/scenario-presets";
import { ROLES } from "@/components/scenario/DemoStageSection";
import {
  FieldPicker, FieldValueInput, deriveDefaultValue,
} from "@/app/dashboard/rules/_components/field-controls";
import { FIELD_REGISTRY } from "@/decision/rules/field-registry";
import {
  PRESET_FIELD_KEYS, PRESET_OPERATOR, overridesFromRows, rowsFromOverrides, type PresetFieldRow,
} from "@/components/scenario/preset-field-map";
import type { RuleFieldKey } from "@/decision/rules/field-registry";
import type { FieldConditionValue } from "@/decision/rules/stored-rule";
import type { TenantScenarioOverride } from "@/tenant/types";
import { saveScenarioOverridesAction } from "../actions";

const COLORS = ["neutral", "blue", "green", "orange", "red", "purple", "amber"] as const;

interface EditOverride {
  hidden?: boolean;
  order?:  number;
  label?:  string;
  icon?:   string;
  color?:  string;
  rows?:   PresetFieldRow[]; // simulated-signal tweaks (Advanced)
}
type OverrideState = Record<string, EditOverride>;

interface BuiltinRow {
  key:      string;
  group:    "preset" | "role";
  defLabel: string;
  defIcon:  string;
  defColor?: string;
}

type SaveState = { mode: "idle" } | { mode: "saving" } | { mode: "saved" } | { mode: "error"; error: string };

function initialState(raw: Record<string, TenantScenarioOverride>): OverrideState {
  const out: OverrideState = {};
  for (const [key, o] of Object.entries(raw ?? {})) {
    out[key] = {
      hidden: o.hidden,
      order:  o.order,
      label:  o.label,
      icon:   o.icon,
      color:  o.color,
      rows:   o.overrides ? rowsFromOverrides(o.overrides as Record<string, unknown>) : undefined,
    };
  }
  return out;
}

/** Convert the editable state back to the storable override map (drop empties). */
function toStorable(state: OverrideState): Record<string, TenantScenarioOverride> {
  const out: Record<string, TenantScenarioOverride> = {};
  for (const [key, e] of Object.entries(state)) {
    const ov = e.rows && e.rows.length > 0 ? overridesFromRows(e.rows) : undefined;
    const o: TenantScenarioOverride = {
      ...(e.hidden ? { hidden: true } : {}),
      ...(typeof e.order === "number" ? { order: e.order } : {}),
      ...(e.label ? { label: e.label } : {}),
      ...(e.icon ? { icon: e.icon } : {}),
      ...(e.color ? { color: e.color } : {}),
      ...(ov && Object.keys(ov).length > 0 ? { overrides: ov } : {}),
    };
    if (Object.keys(o).length > 0) out[key] = o;
  }
  return out;
}

export function BuiltinScenarioOverridesClient({
  tenantId,
  initialOverrides,
}: {
  tenantId: string;
  initialOverrides: Record<string, TenantScenarioOverride>;
}) {
  const [state, setState] = useState<OverrideState>(() => initialState(initialOverrides));
  const [saveState, setSaveState] = useState<SaveState>({ mode: "idle" });
  const [pending, startTransition] = useTransition();

  const rows: BuiltinRow[] = useMemo(() => [
    ...SCENARIO_PRESET_LIST.map((p): BuiltinRow => ({ key: p.key, group: "preset", defLabel: p.label, defIcon: p.icon, defColor: p.color })),
    ...ROLES.map((r): BuiltinRow => ({ key: r.key, group: "role", defLabel: r.label, defIcon: r.icon })),
  ], []);

  // Display order within a group: override.order ?? code index.
  const ordered = (group: "preset" | "role") => {
    const list = rows.filter((r) => r.group === group);
    return list
      .map((r, i) => ({ r, ord: state[r.key]?.order ?? i, i }))
      .sort((a, b) => a.ord - b.ord || a.i - b.i)
      .map((x) => x.r);
  };

  const patch = (key: string, p: Partial<EditOverride>) => {
    setState((s) => ({ ...s, [key]: { ...s[key], ...p } }));
    setSaveState({ mode: "idle" });
  };
  const reset = (key: string) => {
    setState((s) => { const n = { ...s }; delete n[key]; return n; });
    setSaveState({ mode: "idle" });
  };
  const resetAll = () => { setState({}); setSaveState({ mode: "idle" }); };

  // Reorder: reassign explicit order to every item in the group by new position.
  const move = (group: "preset" | "role", key: string, dir: -1 | 1) => {
    const list = ordered(group);
    const idx = list.findIndex((r) => r.key === key);
    const to = idx + dir;
    if (to < 0 || to >= list.length) return;
    const reordered = [...list];
    [reordered[idx], reordered[to]] = [reordered[to], reordered[idx]];
    setState((s) => {
      const n = { ...s };
      reordered.forEach((r, i) => { n[r.key] = { ...n[r.key], order: i }; });
      return n;
    });
    setSaveState({ mode: "idle" });
  };

  // Advanced simulated-signal rows.
  const addRow = (key: string) => {
    const field = PRESET_FIELD_KEYS[0];
    const value = deriveDefaultValue(FIELD_REGISTRY[field], PRESET_OPERATOR) as FieldConditionValue;
    patch(key, { rows: [...(state[key]?.rows ?? []), { field, value }] });
  };
  const setRow = (key: string, i: number, row: PresetFieldRow) => {
    const rws = [...(state[key]?.rows ?? [])]; rws[i] = row; patch(key, { rows: rws });
  };
  const delRow = (key: string, i: number) => {
    const rws = [...(state[key]?.rows ?? [])]; rws.splice(i, 1); patch(key, { rows: rws });
  };

  function save() {
    setSaveState({ mode: "saving" });
    startTransition(async () => {
      const res = await saveScenarioOverridesAction(tenantId, toStorable(state));
      setSaveState(res.ok ? { mode: "saved" } : { mode: "error", error: res.error });
    });
  }

  const dirtyCount = Object.keys(toStorable(state)).length;

  const renderGroup = (group: "preset" | "role", title: string) => (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h3>
      <div className="space-y-2">
        {ordered(group).map((r, i, arr) => {
          const e = state[r.key];
          const overridden = Boolean(e && Object.keys(toStorable({ [r.key]: e })).length > 0);
          const hidden = Boolean(e?.hidden);
          return (
            <div key={r.key} className={`rounded-lg border px-3 py-2 ${overridden ? "border-indigo-200 bg-indigo-50/40" : "border-neutral-200 bg-white"}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => patch(r.key, { hidden: !hidden })}
                  className={`rounded px-2 py-0.5 text-xs font-medium ${hidden ? "bg-neutral-200 text-neutral-500" : "bg-green-100 text-green-700"}`}>
                  {hidden ? "Hidden" : "Shown"}
                </button>
                <input
                  value={e?.label ?? ""} placeholder={r.defLabel}
                  onChange={(ev) => patch(r.key, { label: ev.target.value || undefined })}
                  className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
                />
                <input
                  value={e?.icon ?? ""} placeholder={r.defIcon}
                  onChange={(ev) => patch(r.key, { icon: ev.target.value || undefined })}
                  className="w-14 rounded border border-neutral-300 px-2 py-1 text-center text-sm"
                  title="Icon (emoji)"
                />
                {r.group === "preset" && (
                  <select value={e?.color ?? ""} onChange={(ev) => patch(r.key, { color: ev.target.value || undefined })}
                    className="rounded border border-neutral-300 px-1 py-1 text-xs" title="Badge colour">
                    <option value="">{r.defColor} (default)</option>
                    {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => move(group, r.key, -1)} className="text-[10px] leading-none text-neutral-400 hover:text-neutral-700 disabled:opacity-30">▲</button>
                  <button type="button" disabled={i === arr.length - 1} onClick={() => move(group, r.key, 1)} className="text-[10px] leading-none text-neutral-400 hover:text-neutral-700 disabled:opacity-30">▼</button>
                </div>
                {overridden && (
                  <button type="button" onClick={() => reset(r.key)} title="Reset to default"
                    className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800">↺</button>
                )}
              </div>

              {/* Advanced: simulated-signal overrides */}
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11px] text-neutral-400 hover:text-neutral-600">
                  Advanced: simulated signals{e?.rows?.length ? ` (${e.rows.length})` : ""}
                </summary>
                <div className="mt-2 space-y-1.5 border-l-2 border-neutral-100 pl-2">
                  {(e?.rows ?? []).map((row, ri) => (
                    <div key={ri} className="flex items-center gap-1.5">
                      <FieldPicker value={row.field} allow={PRESET_FIELD_KEYS}
                        onChange={(field: RuleFieldKey) => setRow(r.key, ri, { field, value: deriveDefaultValue(FIELD_REGISTRY[field], PRESET_OPERATOR) as FieldConditionValue })} />
                      <FieldValueInput fieldDef={FIELD_REGISTRY[row.field]} operator={PRESET_OPERATOR} value={row.value}
                        onChange={(value: FieldConditionValue | undefined) => setRow(r.key, ri, { field: row.field, value })} />
                      <button type="button" onClick={() => delRow(r.key, ri)} className="text-xs text-neutral-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addRow(r.key)} className="text-[11px] font-medium text-indigo-600 hover:underline">+ signal</button>
                  {FIELD_REGISTRY_HINT}
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      {renderGroup("preset", "Quick presets")}
      {renderGroup("role", "Personas (Who are you?)")}

      <div className="mt-4 flex items-center gap-3 border-t border-neutral-200 pt-4">
        <button type="button" onClick={save} disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40">
          {saveState.mode === "saving" ? "Saving…" : "Save overrides"}
        </button>
        <button type="button" onClick={resetAll} disabled={pending || dirtyCount === 0}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-40">
          Reset all built-ins
        </button>
        <span className="text-xs text-neutral-400">{dirtyCount} override{dirtyCount === 1 ? "" : "s"}</span>
        {saveState.mode === "saved" && <span className="text-xs text-green-600">✓ Saved.</span>}
        {saveState.mode === "error" && <span className="text-xs text-red-600">{saveState.error}</span>}
      </div>
    </div>
  );
}

const FIELD_REGISTRY_HINT = (
  <p className="text-[10px] text-neutral-400">Deep-merged over the built-in&rsquo;s default signals.</p>
);
