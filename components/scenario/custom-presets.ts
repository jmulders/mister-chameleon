/**
 * Per-tenant custom scenario presets — normalisation + merge with the built-ins.
 *
 * Tenant custom presets are stored as loose JSONB (settings.scenarioPresets). This
 * normalises them to the strict ScenarioPreset shape for the panel, FAIL-OPEN:
 *   - an item missing key/label/overrides, or an item whose key shadows a built-in,
 *     or a duplicate key, is dropped — never breaking the panel.
 *   - icon defaults to "⭐", colour defaults to "purple" when absent/invalid.
 *   - every custom preset is marked `custom: true` so the panel can badge it (★).
 *
 * Keys are auto-namespaced ("custom_<uuid>") at creation (newCustomPresetKey), so a
 * collision with a built-in is structurally impossible; the shadow check is a
 * belt-and-suspenders guard for hand-edited data.
 */

import { SCENARIO_PRESETS, SCENARIO_PRESET_LIST, type ScenarioPreset, type ScenarioPresetColor } from "./scenario-presets";
import type { ScenarioOverrides } from "./scenario-store";

const COLORS: readonly ScenarioPresetColor[] = ["neutral", "blue", "green", "orange", "red", "purple", "amber"];

function normalizeOne(raw: unknown, builtinKeys: ReadonlySet<string>): ScenarioPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.key !== "string" || p.key.length === 0) return null;
  if (typeof p.label !== "string" || p.label.length === 0) return null;
  if (builtinKeys.has(p.key)) return null; // never shadow a built-in preset
  if (typeof p.overrides !== "object" || p.overrides === null || Array.isArray(p.overrides)) return null;

  const color: ScenarioPresetColor =
    typeof p.color === "string" && (COLORS as readonly string[]).includes(p.color)
      ? (p.color as ScenarioPresetColor)
      : "purple";
  const icon = typeof p.icon === "string" && p.icon.length > 0 ? p.icon : "⭐";

  return {
    key:         p.key,
    label:       p.label,
    description: typeof p.description === "string" ? p.description : p.label,
    icon,
    color,
    overrides:   p.overrides as ScenarioOverrides,
    custom:      true,
  };
}

/** Normalise raw tenant custom presets → ScenarioPreset[] (fail-open, de-duped). */
export function normalizeCustomPresets(raw: unknown): ScenarioPreset[] {
  if (!Array.isArray(raw)) return [];
  const builtinKeys = new Set(Object.keys(SCENARIO_PRESETS));
  const seen = new Set<string>();
  const out: ScenarioPreset[] = [];
  for (const item of raw) {
    const p = normalizeOne(item, builtinKeys);
    if (!p || seen.has(p.key)) continue;
    seen.add(p.key);
    out.push(p);
  }
  return out;
}

/** Built-in presets first, then tenant custom presets (stable order). */
export function mergePresetList(customs: readonly ScenarioPreset[]): ScenarioPreset[] {
  return [...SCENARIO_PRESET_LIST, ...customs];
}

/** An auto-namespaced custom preset key that never collides with a built-in. */
export function newCustomPresetKey(): string {
  const uid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  return `custom_${uid}`;
}
