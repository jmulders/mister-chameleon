/**
 * Per-tenant OVERRIDE layer over the code-defined built-ins (Quick presets and
 * Demo "Who are you?" roles). The code defaults are never mutated; this layer is
 * applied at render time:
 *
 *   hide · reorder · relabel (label/icon/colour) · tweak simulated signals
 *   (deep-merge over the built-in's `overrides`) · reset-to-default (drop the key)
 *
 * FAIL-OPEN everywhere: a malformed override is ignored, an override for an
 * unknown key is a no-op, and applying overrides never yields an empty list.
 *
 * Back-compat: the older `scenarioPanel` allowlist curation is FOLDED into this
 * layer — a built-in absent from a non-empty allowlist becomes `hidden: true` —
 * so existing per-tenant curation keeps working under the single mechanism.
 */

import { SCENARIO_PRESETS, SCENARIO_PRESET_LIST, type ScenarioPreset, type ScenarioPresetColor } from "./scenario-presets";
import type { ScenarioOverrides } from "./scenario-store";
import type { TenantScenarioOverride, TenantScenarioPanelSettings } from "@/tenant/types";

const COLORS: readonly ScenarioPresetColor[] = ["neutral", "blue", "green", "orange", "red", "purple", "amber"];

export interface NormalizedOverride {
  hidden?:    boolean;
  order?:     number;
  label?:     string;
  icon?:      string;
  color?:     ScenarioPresetColor;
  overrides?: Record<string, unknown>;
}
export type OverrideMap = Record<string, NormalizedOverride>;

/** Normalise a raw scenarioOverrides JSONB blob → a strict map (fail-open). */
export function normalizeScenarioOverrides(raw: unknown): OverrideMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: OverrideMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const v = value as Record<string, unknown>;
    const o: NormalizedOverride = {};
    if (typeof v.hidden === "boolean") o.hidden = v.hidden;
    if (typeof v.order === "number" && Number.isFinite(v.order)) o.order = v.order;
    if (typeof v.label === "string" && v.label.length > 0) o.label = v.label;
    if (typeof v.icon === "string" && v.icon.length > 0) o.icon = v.icon;
    if (typeof v.color === "string" && (COLORS as readonly string[]).includes(v.color)) o.color = v.color as ScenarioPresetColor;
    if (v.overrides && typeof v.overrides === "object" && !Array.isArray(v.overrides)) {
      o.overrides = v.overrides as Record<string, unknown>;
    }
    // Drop an all-empty override (equivalent to "reset to default").
    if (Object.keys(o).length > 0) out[key] = o;
  }
  return out;
}

/**
 * Fold a `scenarioPanel` allowlist into an override map (back-compat). For a group
 * whose allowlist is non-empty, every built-in key NOT in the allowlist gets
 * `hidden: true`, UNLESS an explicit override already exists for it (explicit wins).
 * An empty/absent allowlist leaves the group untouched (show-all default).
 */
export function foldPanelIntoOverrides(
  overrides: OverrideMap,
  panel: TenantScenarioPanelSettings | null | undefined,
  builtinKeys: { preset: readonly string[]; role: readonly string[] },
): OverrideMap {
  if (!panel) return overrides;
  const merged: OverrideMap = { ...overrides };
  const hideAbsent = (allow: readonly string[] | undefined, all: readonly string[]) => {
    if (!allow || allow.length === 0) return;
    const allowSet = new Set(allow);
    all.forEach((k, i) => {
      if (allowSet.has(k)) {
        // Preserve the allowlist's ORDER for visible items (unless already ordered).
        const pos = allow.indexOf(k);
        if (merged[k]?.order === undefined) merged[k] = { ...merged[k], order: pos };
      } else if (merged[k] === undefined) {
        merged[k] = { hidden: true };
      } else if (merged[k].hidden === undefined && merged[k].order === undefined && !merged[k].label && !merged[k].icon && !merged[k].color && !merged[k].overrides) {
        merged[k] = { ...merged[k], hidden: true };
      }
      void i;
    });
  };
  hideAbsent(panel.presetKeys, builtinKeys.preset);
  hideAbsent(panel.roleKeys, builtinKeys.role);
  return merged;
}

/** Deep-merge a partial override bag over a base overrides bag (shallow is enough). */
function mergeOverrides(base: ScenarioOverrides, patch?: Record<string, unknown>): ScenarioOverrides {
  if (!patch || Object.keys(patch).length === 0) return base;
  return { ...base, ...patch } as ScenarioOverrides;
}

/**
 * Apply the override map to the built-in Quick presets: hide, reorder, relabel,
 * and deep-merge simulated-signal tweaks. Returns the visible list (never empty)
 * plus the set of keys that carry an override (for the "overridden" badge).
 */
export function applyPresetOverrides(
  overrides: OverrideMap,
  baseList: readonly ScenarioPreset[] = SCENARIO_PRESET_LIST,
): { presets: ScenarioPreset[]; overridden: Set<string> } {
  const overridden = new Set<string>();
  const withOrder = baseList
    .map((p, index) => {
      const o = overrides[p.key];
      if (o) overridden.add(p.key);
      return { p, o, index };
    })
    .filter(({ o }) => !o?.hidden)
    .sort((a, b) => (a.o?.order ?? a.index) - (b.o?.order ?? b.index) || a.index - b.index)
    .map(({ p, o }): ScenarioPreset => o
      ? {
          ...p,
          label:     o.label ?? p.label,
          icon:      o.icon  ?? p.icon,
          color:     o.color ?? p.color,
          overrides: mergeOverrides(p.overrides, o.overrides),
        }
      : p);
  // Fail-open: if everything was hidden, fall back to the full base list.
  return { presets: withOrder.length > 0 ? withOrder : [...baseList], overridden };
}

/** The effective simulated overrides for a built-in key, tenant tweak applied. */
export function effectivePresetOverrides(key: string, tenant: OverrideMap): ScenarioOverrides | null {
  const base = SCENARIO_PRESETS[key];
  if (!base) return null;
  return mergeOverrides(base.overrides, tenant[key]?.overrides);
}

/** Structural shape of a Demo "Who are you?" role for override application. */
export interface OverridableRole { key: string; label: string; icon?: string }

/**
 * Apply the override map to the Demo roles: hide, reorder, relabel (label/icon).
 * Role colour stays the code default (roles use hex, not the preset colour family);
 * a role's SIMULATED signals are tweaked via {@link effectivePresetOverrides} when
 * the role is selected. Never returns an empty list (fail-open).
 */
export function applyRoleOverrides<T extends OverridableRole>(
  overrides: OverrideMap,
  roles: readonly T[],
): { roles: T[]; overridden: Set<string> } {
  const overridden = new Set<string>();
  const out = roles
    .map((r, index) => {
      const o = overrides[r.key];
      if (o) overridden.add(r.key);
      return { r, o, index };
    })
    .filter(({ o }) => !o?.hidden)
    .sort((a, b) => (a.o?.order ?? a.index) - (b.o?.order ?? b.index) || a.index - b.index)
    .map(({ r, o }): T => o ? { ...r, label: o.label ?? r.label, ...(o.icon ? { icon: o.icon } : {}) } : r);
  return { roles: out.length > 0 ? out : [...roles], overridden };
}
