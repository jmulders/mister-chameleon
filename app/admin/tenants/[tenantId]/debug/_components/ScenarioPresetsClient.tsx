"use client";

/**
 * ScenarioPresetsClient
 *
 * Admin CRUD for a tenant's CUSTOM scenario presets (personas), shown in the
 * Scenario Control panel's "Quick presets" next to the built-ins.
 *
 * Each preset has a name, emoji, badge colour, and a set of context-signal rows
 * (field → value). The field/value controls are the SAME ones the rules editor
 * uses (FieldPicker + FieldValueInput, driven by FIELD_REGISTRY), restricted to
 * the settable-signal allowlist (PRESET_FIELD_KEYS) and mapped to ScenarioOverrides
 * via overridesFromRows. Keys are auto-namespaced ("custom_<uuid>") so they never
 * collide with a built-in preset. Purely demo config — no personalisation impact.
 */

import { useState, useTransition } from "react";
import { FIELD_REGISTRY } from "@/decision/rules/field-registry";
import type { RuleFieldKey } from "@/decision/rules/field-registry";
import type { FieldConditionValue } from "@/decision/rules/stored-rule";
import {
  FieldPicker, FieldValueInput, deriveDefaultValue,
} from "@/app/dashboard/rules/_components/field-controls";
import {
  PRESET_FIELD_KEYS, PRESET_OPERATOR, overridesFromRows, rowsFromOverrides,
} from "@/components/scenario/preset-field-map";
import { newCustomPresetKey } from "@/components/scenario/custom-presets";
import type { TenantScenarioPreset } from "@/tenant/types";
import { saveScenarioPresetsAction } from "../actions";
import type { SaveScenarioPresetsResult } from "../actions";

const COLORS = ["neutral", "blue", "green", "orange", "red", "purple", "amber"] as const;

interface Row { field: RuleFieldKey; value: FieldConditionValue | undefined }
interface EditablePreset { key: string; label: string; icon: string; color: string; rows: Row[] }

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

function toEditable(p: TenantScenarioPreset): EditablePreset {
  return {
    key:   p.key,
    label: p.label,
    icon:  p.icon ?? "⭐",
    color: p.color ?? "purple",
    rows:  rowsFromOverrides(p.overrides as Record<string, unknown>),
  };
}

function newRow(): Row {
  const field = PRESET_FIELD_KEYS[0];
  return { field, value: deriveDefaultValue(FIELD_REGISTRY[field], PRESET_OPERATOR) };
}

export function ScenarioPresetsClient({
  tenantId,
  initialPresets,
}: {
  tenantId: string;
  initialPresets: TenantScenarioPreset[];
}) {
  const [presets, setPresets] = useState<EditablePreset[]>(() => initialPresets.map(toEditable));
  const [saveState, setSaveState] = useState<SaveState>({ mode: "idle" });
  const [isPending, startTransition] = useTransition();

  const dirty = () => setSaveState({ mode: "idle" });

  function update(idx: number, patch: Partial<EditablePreset>) {
    setPresets((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
    dirty();
  }
  function updateRow(pi: number, ri: number, patch: Partial<Row>) {
    setPresets((prev) => prev.map((p, i) =>
      i === pi ? { ...p, rows: p.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : p,
    ));
    dirty();
  }
  function addPreset() {
    setPresets((prev) => [...prev, { key: newCustomPresetKey(), label: "", icon: "⭐", color: "purple", rows: [newRow()] }]);
    dirty();
  }
  function deletePreset(idx: number) {
    setPresets((prev) => prev.filter((_, i) => i !== idx));
    dirty();
  }
  function addRow(pi: number) {
    setPresets((prev) => prev.map((p, i) => (i === pi ? { ...p, rows: [...p.rows, newRow()] } : p)));
    dirty();
  }
  function removeRow(pi: number, ri: number) {
    setPresets((prev) => prev.map((p, i) => (i === pi ? { ...p, rows: p.rows.filter((_, j) => j !== ri) } : p)));
    dirty();
  }

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      // Skip presets without a label; map rows → overrides. Empty-override presets
      // are still saved (they just simulate nothing) — the operator's choice.
      const payload: TenantScenarioPreset[] = presets
        .filter((p) => p.label.trim().length > 0)
        .map((p) => ({
          key:       p.key,
          label:     p.label.trim(),
          icon:      p.icon || "⭐",
          color:     p.color,
          overrides: overridesFromRows(p.rows),
        }));
      const result: SaveScenarioPresetsResult = await saveScenarioPresetsAction(tenantId, payload);
      if (result.ok) setSaveState({ mode: "success" });
      else           setSaveState({ mode: "error", message: result.error });
    });
  }

  const isDisabled = isPending || saveState.mode === "saving";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Custom personas</h2>
            <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
              Operator-defined presets shown in the scenario console&rsquo;s Quick presets (marked ★).
              Each sets simulated context signals that run through the real rule engine. Purely a
              demo aid: no effect on live personalisation.
            </p>
          </div>
          <button
            type="button"
            onClick={addPreset}
            disabled={isDisabled}
            className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            + New persona
          </button>
        </div>

        {presets.length === 0 && (
          <p className="rounded-lg border border-dashed border-neutral-300 py-8 text-center text-xs text-neutral-400">
            No custom personas yet. Click &ldquo;New persona&rdquo; to add one.
          </p>
        )}

        <div className="space-y-4">
          {presets.map((p, pi) => (
            <div key={p.key} className="rounded-lg border border-neutral-200 p-4">
              {/* Header: name / icon / color / delete */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={p.label}
                  onChange={(e) => update(pi, { label: e.target.value })}
                  placeholder="Persona name"
                  aria-label="Persona name"
                  className="min-w-[12rem] flex-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm font-medium text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="text"
                  value={p.icon}
                  onChange={(e) => update(pi, { icon: e.target.value })}
                  aria-label="Emoji"
                  maxLength={4}
                  className="w-14 rounded-md border border-neutral-300 px-2 py-1.5 text-center text-sm"
                />
                <select
                  value={p.color}
                  onChange={(e) => update(pi, { color: e.target.value })}
                  aria-label="Colour"
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs text-neutral-700"
                >
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => deletePreset(pi)}
                  disabled={isDisabled}
                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>

              {/* Override rows */}
              <div className="mt-3 space-y-2">
                <p className="text-[11px] font-medium text-neutral-500">Context signals this persona sets</p>
                {p.rows.map((row, ri) => (
                  <div key={ri} className="flex flex-wrap items-start gap-2">
                    <div className="min-w-[13rem] flex-1">
                      <FieldPicker
                        value={row.field}
                        allow={PRESET_FIELD_KEYS}
                        onChange={(field) => updateRow(pi, ri, {
                          field,
                          value: deriveDefaultValue(FIELD_REGISTRY[field], PRESET_OPERATOR),
                        })}
                      />
                    </div>
                    <div className="min-w-[10rem] flex-1">
                      <FieldValueInput
                        fieldDef={FIELD_REGISTRY[row.field]}
                        operator={PRESET_OPERATOR}
                        value={row.value}
                        onChange={(value) => updateRow(pi, ri, { value })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(pi, ri)}
                      aria-label="Remove signal"
                      className="rounded-md border border-neutral-200 px-2 py-2 text-xs text-neutral-400 hover:bg-neutral-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addRow(pi)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  + Add signal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {saveState.mode === "saving" ? "Saving…" : "Save personas"}
        </button>
        {saveState.mode === "success" && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
        {saveState.mode === "error" && <span className="text-xs text-red-600">{saveState.message}</span>}
      </div>
    </div>
  );
}
