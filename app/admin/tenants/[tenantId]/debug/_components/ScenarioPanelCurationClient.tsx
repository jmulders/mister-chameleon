"use client";

/**
 * ScenarioPanelCurationClient
 *
 * Per-tenant curation of what the Scenario Control panel (the operator / demo
 * console) offers on the live site:
 *
 *   • Context tab → "Quick presets"  (subset of SCENARIO_PRESETS)
 *   • Demo tab    → "Who are you?"    (subset of roles / the tenant context set)
 *   • Demo tab    → "Simulate time"   (subset of Day / Evening / Weekend)
 *
 * This is EXPLICIT curation, not an auto-filter. An empty selection for a group
 * means "show everything" — identical to the current default — so leaving a group
 * fully unchecked is the safe fallback, never a broken (empty) panel.
 *
 * Labels come straight from the existing definitions so the admin list always
 * matches what the panel renders. Config is stored as JSONB in
 * settings.scenarioPanel (no migration) and revalidates the public site on save.
 */

import { useState, useTransition } from "react";
import { SCENARIO_PRESET_LIST }     from "@/components/scenario/scenario-presets";
import { ROLES, TIME_OPTIONS }      from "@/components/scenario/DemoStageSection";
import type { DemoContext }         from "@/components/scenario/demo-context-sets";
import { saveScenarioPanelAction }  from "../actions";
import type { SaveScenarioPanelResult } from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

type Option = { key: string; label: string; icon?: string };

export interface ScenarioPanelCurationClientProps {
  tenantId:    string;
  /** The tenant's context-set roles (replaces the generic personas) or null. */
  contextRoles: DemoContext[] | null;
  presetKeys:  string[];
  roleKeys:    string[];
  timeOptions: string[];
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

// ── Root component ─────────────────────────────────────────────────────────────

export function ScenarioPanelCurationClient({
  tenantId,
  contextRoles,
  presetKeys:  initialPresetKeys,
  roleKeys:    initialRoleKeys,
  timeOptions: initialTimeOptions,
}: ScenarioPanelCurationClientProps) {
  const presetOptions: Option[] = SCENARIO_PRESET_LIST.map((p) => ({ key: p.key, label: p.label, icon: p.icon }));
  const roleOptions:   Option[] = (contextRoles ?? ROLES).map((r) => ({ key: r.key, label: r.label, icon: r.icon }));
  const timeOptionDefs: Option[] = TIME_OPTIONS.map((t) => ({ key: t.id, label: t.label }));

  const [presets, setPresets] = useState<Set<string>>(new Set(initialPresetKeys));
  const [roles,   setRoles]   = useState<Set<string>>(new Set(initialRoleKeys));
  const [times,   setTimes]   = useState<Set<string>>(new Set(initialTimeOptions));
  const [saveState, setSaveState]   = useState<SaveState>({ mode: "idle" });
  const [isPending, startTransition] = useTransition();

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
    setSaveState({ mode: "idle" });
  }

  function handleSave() {
    startTransition(async () => {
      setSaveState({ mode: "saving" });
      const result: SaveScenarioPanelResult = await saveScenarioPanelAction(tenantId, {
        presetKeys:  [...presets],
        roleKeys:    [...roles],
        timeOptions: [...times].filter(
          (t): t is "day" | "evening" | "weekend" => t === "day" || t === "evening" || t === "weekend",
        ),
      });
      if (result.ok) setSaveState({ mode: "success" });
      else           setSaveState({ mode: "error", message: result.error });
    });
  }

  const isDisabled = isPending || saveState.mode === "saving";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-neutral-900">Scenario panel curation</h2>
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
            Choose which quick presets, personas and time options the scenario console offers for
            this tenant. Leaving a group fully unchecked shows <strong>everything</strong> (the
            default). This only trims the operator / demo console; it never affects personalisation
            or the decision engine.
          </p>
        </div>

        <CheckboxGroup
          title="Quick presets"
          note="Context tab → the one-click behavioural snapshots."
          options={presetOptions}
          selected={presets}
          onToggle={(k) => toggle(presets, setPresets, k)}
          disabled={isDisabled}
        />

        <div className="mt-5 border-t border-neutral-100 pt-5">
          <CheckboxGroup
            title="Who are you?"
            note={
              contextRoles
                ? "Demo tab → this tenant's visitor-context personas."
                : "Demo tab → the persona picker."
            }
            options={roleOptions}
            selected={roles}
            onToggle={(k) => toggle(roles, setRoles, k)}
            disabled={isDisabled}
          />
        </div>

        <div className="mt-5 border-t border-neutral-100 pt-5">
          <CheckboxGroup
            title="Simulate time"
            note="Demo tab → the time-of-day simulator buttons."
            options={timeOptionDefs}
            selected={times}
            onToggle={(k) => toggle(times, setTimes, k)}
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {saveState.mode === "saving" ? "Saving…" : "Save scenario panel"}
        </button>

        {saveState.mode === "success" && (
          <span className="text-xs text-green-600 font-medium">✓ Saved</span>
        )}
        {saveState.mode === "error" && (
          <span className="text-xs text-red-600">{saveState.message}</span>
        )}
      </div>
    </div>
  );
}

// ── Checkbox group helper ───────────────────────────────────────────────────────

function CheckboxGroup({
  title,
  note,
  options,
  selected,
  onToggle,
  disabled,
}: {
  title:    string;
  note:     string;
  options:  Option[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  disabled: boolean;
}) {
  const allShown = selected.size === 0;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-neutral-700">{title}</p>
        <span className="text-[11px] text-neutral-400">
          {allShown ? "Showing all" : `${selected.size} selected`}
        </span>
      </div>
      <p className="mb-3 text-[11px] text-neutral-400 leading-relaxed">{note}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map((opt) => {
          const checked = selected.has(opt.key);
          return (
            <label
              key={opt.key}
              className={`flex items-center gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                checked ? "border-brand-300 bg-brand-50" : "border-neutral-200 bg-white hover:bg-neutral-50"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt.key)}
                disabled={disabled}
                className="h-4 w-4 flex-shrink-0 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              {opt.icon && <span className="text-sm flex-shrink-0" aria-hidden>{opt.icon}</span>}
              <span className="text-xs font-medium text-neutral-900 truncate">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
