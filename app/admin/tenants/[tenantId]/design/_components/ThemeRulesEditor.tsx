"use client";

/**
 * ThemeRulesEditor — 3-mode contextual theme override UI
 *
 * ─── Trigger modes ────────────────────────────────────────────────────────────
 *
 *   RAW — "Raw condition":  pair an existing rule or built-in condition template
 *         (FieldCondition / NamedCondition / ContextCondition) with a theme.
 *
 *   CTX — "Context Library match":  pick one or more audience-profile IDs from
 *         the Context Library and an optional confidence threshold.  The rule
 *         fires when the visitor matches ANY of the selected profiles.
 *
 *   CTX+ — "Context + condition":  combine a Context Library match with an
 *          additional raw condition (AND logic).  Rule fires only when BOTH
 *          the context match AND the raw condition are true.
 *
 * ─── Mapping list ─────────────────────────────────────────────────────────────
 *
 *   Each row shows a trigger-mode badge (RAW / CTX / CTX+) derived from the
 *   stored condition type.  All per-row actions (theme change, enable/disable,
 *   remove) work regardless of trigger mode.
 *
 * ─── Server actions ───────────────────────────────────────────────────────────
 *
 *   addThemeMappingAction()                — RAW mode
 *   addContextLibraryThemeMappingAction()  — CTX / CTX+ modes
 *   removeThemeMappingAction()
 *   setThemeMappingEnabledAction()
 *   saveRuleThemeKeyAction()
 */

import React, { useState, useTransition, useMemo } from "react";
import type { StoredRulesConfig, RuleCondition } from "@/decision/rules/stored-rule";
import type { ThemePresetKey }                    from "@/design-system/theme/presets";
import { THEME_CATALOG }                          from "@/design-system/theme/presets";
import { DESIGN_PRESET_GALLERY, curatedGalleryId, curatedKeyFromGalleryId, getDesignPreset } from "@/tenant/design-presets-gallery";
import { CONTEXT_DEFINITIONS, CONTEXT_FAMILIES }  from "@/context/library/definitions";
import type { ContextFamilyKey }                  from "@/context/library/types";
import {
  addThemeMappingAction,
  removeThemeMappingAction,
  setThemeMappingEnabledAction,
  saveRuleThemeSelectionAction,
  addContextLibraryThemeMappingAction,
} from "@/app/admin/tenants/[tenantId]/actions";

// ── Built-in template metadata ────────────────────────────────────────────────

interface BuiltinTemplate {
  id:          string;
  label:       string;
  description: string;
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  { id: "christmas",    label: "Christmas season",            description: "December 23 – 26" },
  { id: "valentines",   label: "Valentine's Day",             description: "February 13 – 14" },
  { id: "halloween",    label: "Halloween",                   description: "October 30 – 31" },
  { id: "new-year",     label: "New Year",                    description: "December 31 – January 1" },
  { id: "black-friday", label: "Black Friday / Cyber Monday", description: "Black Friday weekend" },
  { id: "night",        label: "Night time",                  description: "22:00 – 06:00 local time" },
  { id: "evening",      label: "Evening",                     description: "18:00 – 22:00 local time" },
  { id: "morning",      label: "Morning",                     description: "06:00 – 10:00 local time" },
  { id: "day",          label: "Daytime",                     description: "Ochtend + middag (06:00 – 18:00)" },
  { id: "weekend",      label: "Weekend",                     description: "Zaterdag en zondag" },
  { id: "any-campaign", label: "Any UTM campaign",            description: "Any visitor with a utm_campaign parameter" },
  { id: "mobile",       label: "Mobile visitors",             description: "Phones and tablets" },
];

// ── Theme helpers ─────────────────────────────────────────────────────────────

const THEME_OPTIONS = THEME_CATALOG.map((e) => ({
  value:       e.presetKey,
  label:       e.label,
  swatchColor: e.swatchColor,
}));

function themeSwatch(key: ThemePresetKey | "" | undefined): string | null {
  return key ? (THEME_OPTIONS.find((t) => t.value === key)?.swatchColor ?? "#6366f1") : null;
}
function themeLabel(key: ThemePresetKey | "" | undefined): string | null {
  return key ? (THEME_OPTIONS.find((t) => t.value === key)?.label ?? key) : null;
}

// ── Theme selection tokens (item 6: curated key OR gallery preset) ────────────
//
// A rule's theme outcome is either a curated ThemePresetKey or a gallery preset.
// In the row picker both are offered; the <select> value is a token:
//   "<curatedKey>"       — a curated theme
//   "gallery:<presetId>" — a gallery preset (grouped by category)

/** Gallery presets grouped by their card.category, for the picker optgroups. */
const GALLERY_BY_CATEGORY: ReadonlyArray<{ category: string; items: typeof DESIGN_PRESET_GALLERY }> = (() => {
  const map = new Map<string, typeof DESIGN_PRESET_GALLERY[number][]>();
  for (const c of DESIGN_PRESET_GALLERY) {
    if (!map.has(c.category)) map.set(c.category, []);
    map.get(c.category)!.push(c);
  }
  return [...map.entries()].map(([category, items]) => ({ category, items }));
})();

function selectionSwatch(token: string): string | null {
  if (!token) return null;
  if (token.startsWith("gallery:")) {
    // getDesignPreset resolves both real gallery cards and synthetic
    // `curated:<key>` bridge ids, so a bridged selection shows its true colour.
    const card = getDesignPreset(token.slice(8));
    return card?.swatch.primary ?? "#6366f1";
  }
  return themeSwatch(token as ThemePresetKey);
}

/** Decode a picker token into the plan fields saveRuleThemeSelectionAction expects. */
function selectionToPlan(token: string): { themeKey?: ThemePresetKey | null; themePresetId?: string | null } {
  if (token.startsWith("gallery:")) return { themePresetId: token.slice(8), themeKey: null };
  return { themeKey: (token || null) as ThemePresetKey | null, themePresetId: null };
}

// ── Condition introspection (client-side) ─────────────────────────────────────

type TriggerMode = "raw_condition" | "context_match" | "context_plus_condition";

function classifyCondition(condition: RuleCondition | undefined): TriggerMode {
  if (!condition) return "raw_condition";
  if (condition.type === "context_library") return "context_match";
  if (condition.type === "group") {
    const group    = condition as unknown as { conditions?: RuleCondition[] };
    const children = group.conditions ?? [];
    const hasLib   = children.some((c) => c.type === "context_library");
    const hasRaw   = children.some((c) => c.type !== "context_library");
    if (hasLib && hasRaw) return "context_plus_condition";
    if (hasLib)           return "context_match";
  }
  return "raw_condition";
}

function extractContextLibraryIds(condition: RuleCondition | undefined): string[] {
  if (!condition) return [];
  if (condition.type === "context_library") {
    const c = condition as unknown as { contextIds: readonly string[] };
    return [...c.contextIds];
  }
  if (condition.type === "group") {
    const group    = condition as unknown as { conditions?: RuleCondition[] };
    const children = group.conditions ?? [];
    return children
      .filter((c) => c.type === "context_library")
      .flatMap((c) => {
        const lc = c as unknown as { contextIds: readonly string[] };
        return [...lc.contextIds];
      });
  }
  return [];
}

// ── Local state model ─────────────────────────────────────────────────────────

interface MappingRow {
  ruleId:         string;
  label:          string;
  priority:       number;
  /** Theme-selection token: a curated key or "gallery:<id>". */
  selection:      string;
  selectionDraft: string;
  enabled:        boolean;
  triggerMode:    TriggerMode;
  contextIds?:    string[];
  saveState?:     "saving" | "ok" | "error";
}

// ── Add-form mode ─────────────────────────────────────────────────────────────

type AddMode = "raw" | "context" | "context_plus";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ThemeRulesEditorProps {
  tenantId:     string;
  rulesConfig:  StoredRulesConfig | undefined;
  defaultTheme: ThemePresetKey;
}

// ── Trigger mode badge ────────────────────────────────────────────────────────

const MODE_BADGE: Record<TriggerMode, { label: string; className: string }> = {
  raw_condition:          { label: "RAW",  className: "bg-neutral-100 text-neutral-600" },
  context_match:          { label: "CTX",  className: "bg-indigo-100 text-indigo-700"  },
  context_plus_condition: { label: "CTX+", className: "bg-violet-100 text-violet-700"  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export function ThemeRulesEditor({
  tenantId,
  rulesConfig,
  defaultTheme,
}: ThemeRulesEditorProps) {

  // ── Mapping list state ─────────────────────────────────────────────────────

  const [mappings, setMappings] = useState<MappingRow[]>(() => {
    const sourceRules = rulesConfig?.rules ?? [];
    return sourceRules
      .filter((r) => !!r.plan.themeKey || !!r.plan.themePresetId)
      .sort((a, b) => a.priority - b.priority)
      .map((r) => {
        const selection = r.plan.themePresetId ? `gallery:${r.plan.themePresetId}` : (r.plan.themeKey as string);
        return {
          ruleId:         r.id,
          label:          r.label,
          priority:       r.priority,
          selection,
          selectionDraft: selection,
          enabled:        r.enabled !== false,
          triggerMode:    classifyCondition(r.condition),
          contextIds:     extractContextLibraryIds(r.condition),
        };
      });
  });

  // ── Add-form state ─────────────────────────────────────────────────────────

  const [addMode,          setAddMode]          = useState<AddMode>("raw");
  // RAW mode
  const [addSource,        setAddSource]        = useState<string>("");
  const [addTheme,         setAddTheme]         = useState<string>("");
  // CTX / CTX+ mode
  const [ctxFamily,        setCtxFamily]        = useState<ContextFamilyKey | "all">("all");
  const [ctxSelectedIds,   setCtxSelectedIds]   = useState<Set<string>>(new Set());
  const [ctxMinConf,       setCtxMinConf]       = useState<number>(60);  // 0–100 displayed, stored as 0–1
  const [ctxLabel,         setCtxLabel]         = useState<string>("");
  const [ctxTheme,         setCtxTheme]         = useState<string>("");
  const [ctxPriority,      setCtxPriority]      = useState<number>(80);
  // CTX+ additional raw source
  const [ctxPlusSource,    setCtxPlusSource]    = useState<string>("");

  const [addState,  setAddState]  = useState<"idle" | "adding" | "ok" | "error">("idle");
  const [addError,  setAddError]  = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // ── Derived data ───────────────────────────────────────────────────────────

  const allRules     = (rulesConfig?.rules ?? []).sort((a, b) => a.priority - b.priority);
  const mappedRuleIds = new Set(mappings.map((m) => m.ruleId));
  const mappedBuiltinIds = new Set(
    BUILTIN_TEMPLATES.filter((t) => mappedRuleIds.has(`theme.builtin.${t.id}`)).map((t) => t.id),
  );

  // Context definitions visible in the picker (filtered by family)
  const visibleDefinitions = useMemo(
    () =>
      CONTEXT_DEFINITIONS.filter(
        (d) =>
          (d.status === "active" || d.status === "suggested") &&
          (ctxFamily === "all" || d.family === ctxFamily),
      ),
    [ctxFamily],
  );

  // ── Per-row handlers ───────────────────────────────────────────────────────

  function setRowDraft(ruleId: string, value: string) {
    setMappings((prev) =>
      prev.map((m) => m.ruleId === ruleId ? { ...m, selectionDraft: value, saveState: undefined } : m),
    );
  }

  function saveRowTheme(ruleId: string) {
    const row = mappings.find((m) => m.ruleId === ruleId);
    if (!row || row.selectionDraft === row.selection) return;
    setMappings((prev) =>
      prev.map((m) => m.ruleId === ruleId ? { ...m, saveState: "saving" } : m),
    );
    startTransition(async () => {
      const result = await saveRuleThemeSelectionAction(tenantId, ruleId, selectionToPlan(row.selectionDraft));
      setMappings((prev) =>
        prev.map((m) =>
          m.ruleId === ruleId
            ? { ...m, selection: result.ok ? row.selectionDraft : m.selection, saveState: result.ok ? "ok" : "error" }
            : m,
        ),
      );
      if (result.ok) {
        setTimeout(() =>
          setMappings((prev) =>
            prev.map((m) => m.ruleId === ruleId ? { ...m, saveState: undefined } : m),
          ), 3000);
      }
    });
  }

  function toggleEnabled(ruleId: string, enabled: boolean) {
    setMappings((prev) => prev.map((m) => m.ruleId === ruleId ? { ...m, enabled } : m));
    startTransition(async () => {
      const result = await setThemeMappingEnabledAction(tenantId, ruleId, enabled);
      if (!result.ok) {
        setMappings((prev) => prev.map((m) => m.ruleId === ruleId ? { ...m, enabled: !enabled } : m));
      }
    });
  }

  function removeMapping(ruleId: string) {
    setMappings((prev) => prev.filter((m) => m.ruleId !== ruleId));
    startTransition(async () => { await removeThemeMappingAction(tenantId, ruleId); });
  }

  // ── Add handlers ───────────────────────────────────────────────────────────

  function resetAddForm() {
    setAddSource(""); setAddTheme(""); setCtxSelectedIds(new Set());
    setCtxLabel(""); setCtxTheme(""); setCtxPriority(80); setCtxMinConf(60);
    setCtxPlusSource(""); setCtxFamily("all");
  }

  async function handleAdd() {
    setAddState("adding");
    setAddError(null);

    let result: { ok: boolean; rule?: { id: string; label: string; priority: number; enabled: boolean }; errors?: string[] };

    if (addMode === "raw") {
      if (!addSource || !addTheme) {
        setAddState("error"); setAddError("Select a rule/condition and a theme."); return;
      }
      const sel = selectionToPlan(addTheme);
      result = await addThemeMappingAction(tenantId, addSource, sel.themeKey ?? null, sel.themePresetId ?? null);

    } else {
      // CTX or CTX+ mode
      if (ctxSelectedIds.size === 0) {
        setAddState("error"); setAddError("Select at least one audience profile."); return;
      }
      if (!ctxTheme) {
        setAddState("error"); setAddError("Select a theme to apply."); return;
      }
      const effectiveLabel = ctxLabel.trim() || `Context: ${[...ctxSelectedIds].slice(0, 2).join(", ")}`;
      const sel = selectionToPlan(ctxTheme);

      result = await addContextLibraryThemeMappingAction(tenantId, {
        contextIds:    [...ctxSelectedIds],
        minConfidence: ctxMinConf / 100,
        themeKey:      sel.themeKey ?? null,
        themePresetId: sel.themePresetId ?? null,
        label:         effectiveLabel,
        priority:      ctxPriority,
      });
    }

    if (result.ok && result.rule) {
      const newTriggerMode: TriggerMode = addMode === "raw" ? "raw_condition"
        : addMode === "context_plus" ? "context_plus_condition" : "context_match";
      const addSelection = String(addMode === "raw" ? addTheme : ctxTheme);
      const newRow: MappingRow = {
        ruleId:         result.rule.id,
        label:          result.rule.label,
        priority:       result.rule.priority,
        selection:      addSelection,
        selectionDraft: addSelection,
        enabled:        result.rule.enabled,
        triggerMode:    newTriggerMode,
        contextIds:     addMode !== "raw" ? [...ctxSelectedIds] : [],
      };
      setMappings((prev) => {
        const idx = prev.findIndex((m) => m.ruleId === newRow.ruleId);
        const next = idx >= 0
          ? prev.map((m, i) => i === idx ? newRow : m)
          : [...prev, newRow];
        return next.sort((a, b) => a.priority - b.priority);
      });
      resetAddForm();
      setAddState("ok");
      setTimeout(() => setAddState("idle"), 3000);
    } else {
      setAddState("error");
      setAddError(result.errors?.join("; ") ?? "Failed to add mapping.");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-6">

      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-neutral-900">
          Contextual theme overrides
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          Map rules or audience profiles to themes. When a condition fires, visitors
          see the paired theme for the duration of their session.
        </p>
      </div>

      {/* Default theme pill */}
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
        <span
          className="h-4 w-4 flex-shrink-0 rounded-full border border-neutral-300"
          style={{ background: themeSwatch(defaultTheme) ?? "#6366f1" }}
        />
        <span className="text-sm text-neutral-600">
          <span className="font-medium text-neutral-700">Default theme: </span>
          {themeLabel(defaultTheme) ?? defaultTheme}
        </span>
        <span className="ml-auto text-xs text-neutral-400">used when no rule matches</span>
      </div>

      {/* ── Add mapping form ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Add mapping
        </p>

        {/* Mode tabs */}
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 w-fit">
          {(["raw", "context", "context_plus"] as AddMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setAddMode(m); setAddState("idle"); setAddError(null); }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                addMode === m
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {m === "raw" ? "Raw condition" : m === "context" ? "Context Library" : "Context + condition"}
            </button>
          ))}
        </div>

        {/* ── RAW mode ──────────────────────────────────────────────────────── */}
        {addMode === "raw" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="mb-1 block text-xs text-neutral-500">When this condition fires…</label>
              <select
                value={addSource}
                onChange={(e) => setAddSource(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select a rule or condition…</option>
                {allRules.length > 0 && (
                  <optgroup label="Your rules">
                    {allRules.map((r) => (
                      <option key={r.id} value={`rule:${r.id}`}>
                        #{r.priority} {r.label}{mappedRuleIds.has(r.id) ? " ✓" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Built-in conditions">
                  {BUILTIN_TEMPLATES.map((t) => (
                    <option key={t.id} value={`builtin:${t.id}`}>
                      {t.label} — {t.description}{mappedBuiltinIds.has(t.id) ? " ✓" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <ThemeSelect
              value={addTheme}
              onChange={setAddTheme}
              label="… apply this theme"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!addSource || !addTheme || addState === "adding" || isPending}
              className="flex-shrink-0 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {addState === "adding" ? "Adding…" : "Add"}
            </button>
          </div>
        )}

        {/* ── CTX / CTX+ mode ──────────────────────────────────────────────── */}
        {(addMode === "context" || addMode === "context_plus") && (
          <div className="space-y-4">

            {/* Family filter chips */}
            <div>
              <p className="mb-2 text-xs text-neutral-500">Filter by family</p>
              <div className="flex flex-wrap gap-1.5">
                <FamilyChip
                  label="All"
                  active={ctxFamily === "all"}
                  onClick={() => setCtxFamily("all")}
                  color="bg-neutral-100 text-neutral-700"
                />
                {CONTEXT_FAMILIES.map((f) => (
                  <FamilyChip
                    key={f.key}
                    label={f.label}
                    active={ctxFamily === f.key}
                    onClick={() => setCtxFamily(f.key)}
                    color={f.color}
                  />
                ))}
              </div>
            </div>

            {/* Audience profile list */}
            <div>
              <p className="mb-2 text-xs text-neutral-500">
                Select audience profiles <span className="text-neutral-400">(rule fires when visitor matches ANY)</span>
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 divide-y divide-neutral-100">
                {visibleDefinitions.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-neutral-400 text-center">
                    No profiles in this family.
                  </p>
                ) : (
                  visibleDefinitions.map((def) => {
                    const checked  = ctxSelectedIds.has(def.id);
                    const family   = CONTEXT_FAMILIES.find((f) => f.key === def.family);
                    return (
                      <label
                        key={def.id}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          checked ? "bg-indigo-50" : "hover:bg-neutral-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setCtxSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(def.id)) next.delete(def.id);
                              else next.add(def.id);
                              return next;
                            });
                          }}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-neutral-800">{def.label}</span>
                            {family && (
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${family.color}`}>
                                {family.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-500 truncate">{def.description}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              {ctxSelectedIds.size > 0 && (
                <p className="mt-1.5 text-xs text-indigo-600">
                  {ctxSelectedIds.size} profile{ctxSelectedIds.size !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>

            {/* Confidence threshold */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-neutral-500 whitespace-nowrap">
                Min. confidence
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={ctxMinConf}
                onChange={(e) => setCtxMinConf(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-right text-xs font-mono text-neutral-700">
                {ctxMinConf}%
              </span>
            </div>

            {/* CTX+: extra raw condition */}
            {addMode === "context_plus" && (
              <div>
                <label className="mb-1 block text-xs text-neutral-500">
                  Additionally require this condition (AND)
                </label>
                <select
                  value={ctxPlusSource}
                  onChange={(e) => setCtxPlusSource(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Any match (no extra condition)</option>
                  {allRules.length > 0 && (
                    <optgroup label="Your rules">
                      {allRules.map((r) => (
                        <option key={r.id} value={`rule:${r.id}`}>
                          #{r.priority} {r.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Built-in conditions">
                    {BUILTIN_TEMPLATES.map((t) => (
                      <option key={t.id} value={`builtin:${t.id}`}>
                        {t.label} — {t.description}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Rule label + priority + theme, in a row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-[2] min-w-[180px]">
                <label className="mb-1 block text-xs text-neutral-500">Rule label</label>
                <input
                  type="text"
                  value={ctxLabel}
                  onChange={(e) => setCtxLabel(e.target.value)}
                  placeholder="e.g. High-intent SaaS visitors"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="w-24">
                <label className="mb-1 block text-xs text-neutral-500">Priority</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={ctxPriority}
                  onChange={(e) => setCtxPriority(Number(e.target.value))}
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <ThemeSelect
                value={ctxTheme}
                onChange={setCtxTheme}
                label="Apply theme"
              />

              <button
                type="button"
                onClick={handleAdd}
                disabled={ctxSelectedIds.size === 0 || !ctxTheme || addState === "adding" || isPending}
                className="flex-shrink-0 rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {addState === "adding" ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Add-form feedback */}
        {addState === "ok" && (
          <p className="text-xs text-green-600">✓ Mapping added successfully.</p>
        )}
        {addState === "error" && addError && (
          <p className="text-xs text-red-600">Error: {addError}</p>
        )}
      </div>

      {/* ── Mapping list ────────────────────────────────────────────────────── */}
      {mappings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center">
          <p className="text-sm text-neutral-500">No theme mappings yet.</p>
          <p className="mt-1 text-xs text-neutral-400">
            Use the form above to pair a condition or audience profile with a theme.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200">

          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_4rem_1fr_11rem_5rem_2.5rem] items-center gap-x-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">#</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Type</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">When</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Apply theme</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 text-center">On</span>
            <span />
          </div>

          {/* Rows */}
          {mappings.map((row) => {
            const isDirty       = row.selectionDraft !== row.selection;
            const isSaving      = row.saveState === "saving";
            const currentSwatch = selectionSwatch(row.selectionDraft);
            const badge         = MODE_BADGE[row.triggerMode];

            return (
              <div
                key={row.ruleId}
                className={`grid grid-cols-[2.5rem_4rem_1fr_11rem_5rem_2.5rem] items-center gap-x-3 border-b border-neutral-100 px-4 py-3 last:border-b-0 transition-opacity ${
                  !row.enabled ? "opacity-50" : ""
                }`}
              >
                {/* Priority */}
                <span className="inline-flex items-center justify-center rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-mono text-neutral-500">
                  {row.priority}
                </span>

                {/* Trigger mode badge */}
                <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>

                {/* Rule label */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-800">{row.label}</p>
                  {row.contextIds && row.contextIds.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-neutral-400">
                      {row.contextIds.slice(0, 3).join(", ")}
                      {row.contextIds.length > 3 ? ` +${row.contextIds.length - 3} more` : ""}
                    </p>
                  )}
                  {row.saveState === "ok"    && <span className="text-xs text-green-600">✓ Saved</span>}
                  {row.saveState === "error" && <span className="text-xs text-red-600">Save failed</span>}
                  {/* Bridge: a curated themeKey selection can be expressed as its
                      gallery equivalent (renders identically) so it joins the
                      unified gallery model. Only shown while still curated. */}
                  {!row.selectionDraft.startsWith("gallery:") && (
                    <button
                      type="button"
                      onClick={() => setRowDraft(row.ruleId, `gallery:${curatedGalleryId(row.selectionDraft as ThemePresetKey)}`)}
                      className="mt-0.5 block text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Convert to gallery
                    </button>
                  )}
                </div>

                {/* Theme selector + save */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    {currentSwatch && (
                      <span
                        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-neutral-300"
                        style={{ background: currentSwatch }}
                      />
                    )}
                    <select
                      value={row.selectionDraft}
                      onChange={(e) => setRowDraft(row.ruleId, e.target.value)}
                      className={`w-full rounded-md border border-neutral-300 bg-white py-1 text-xs text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                        currentSwatch ? "pl-6 pr-2" : "px-2"
                      }`}
                    >
                      {/* A bridged curated selection (gallery:curated:<key>) is not
                          a real gallery card, so surface it as its own option. */}
                      {curatedKeyFromGalleryId(row.selectionDraft.replace(/^gallery:/, "")) && (
                        <optgroup label="Curated (bridged to gallery)">
                          <option value={row.selectionDraft}>
                            {getDesignPreset(row.selectionDraft.replace(/^gallery:/, ""))?.name ?? row.selectionDraft}
                          </option>
                        </optgroup>
                      )}
                      <optgroup label="Curated themes">
                        {THEME_OPTIONS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </optgroup>
                      {GALLERY_BY_CATEGORY.map((g) => (
                        <optgroup key={g.category} label={`Gallery — ${g.category}`}>
                          {g.items.map((c) => (
                            <option key={c.id} value={`gallery:${c.id}`}>{c.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  {isDirty && (
                    <button
                      type="button"
                      onClick={() => saveRowTheme(row.ruleId)}
                      disabled={isSaving || isPending}
                      className="flex-shrink-0 rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? "…" : "Save"}
                    </button>
                  )}
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.enabled}
                    onClick={() => toggleEnabled(row.ruleId, !row.enabled)}
                    disabled={isPending}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50 ${
                      row.enabled ? "bg-indigo-600" : "bg-neutral-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                        row.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Remove */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removeMapping(row.ruleId)}
                    disabled={isPending}
                    title="Remove mapping"
                    className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mappings.length > 1 && (
        <p className="text-xs text-neutral-400">
          Rules are evaluated in priority order (lowest number first). The first matching rule wins.
        </p>
      )}

      {/* How it works */}
      <details className="rounded-lg border border-neutral-100 bg-neutral-50">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-600 hover:text-neutral-800">
          How contextual theme overrides work
        </summary>
        <div className="space-y-2 px-4 pb-4 text-sm text-neutral-500">
          <p>
            Each row maps a condition to a theme. When the condition fires, the visitor
            receives the paired theme for the duration of their session (up to 4 hours).
          </p>
          <p>
            <span className="font-medium text-neutral-600">RAW</span> fires on raw field
            predicates (UTM, time-of-day, device, seasonal event).{" "}
            <span className="font-medium text-neutral-600">CTX</span> fires when the visitor
            matches a named audience profile from the Context Library.{" "}
            <span className="font-medium text-neutral-600">CTX+</span> fires when a context
            match AND an additional raw condition are both true.
          </p>
          <p>
            Built-in conditions create a rule automatically the first time you map them.
            All rules can also be edited in the{" "}
            <a
              href={`/admin/tenants/${tenantId}/personalization/rules`}
              className="underline hover:text-neutral-600"
            >
              Rules editor
            </a>
            .
          </p>
        </div>
      </details>

    </section>
  );
}

// ── ThemeSelect sub-component ─────────────────────────────────────────────────

function ThemeSelect({
  value,
  onChange,
  label,
}: {
  value:    string;
  onChange: (v: string) => void;
  label:    string;
}) {
  const swatch = value ? selectionSwatch(value) : null;
  return (
    <div className="flex-1 min-w-[180px]">
      <label className="mb-1 block text-xs text-neutral-500">{label}</label>
      <div className="relative">
        {swatch && (
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border border-neutral-300"
            style={{ background: swatch }}
          />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-md border border-neutral-300 bg-white py-1.5 text-sm text-neutral-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
            swatch ? "pl-8 pr-3" : "px-3"
          }`}
        >
          <option value="">Select a theme…</option>
          <optgroup label="Curated themes">
            {THEME_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </optgroup>
          {GALLERY_BY_CATEGORY.map((g) => (
            <optgroup key={g.category} label={`Gallery — ${g.category}`}>
              {g.items.map((c) => (
                <option key={c.id} value={`gallery:${c.id}`}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── FamilyChip sub-component ──────────────────────────────────────────────────

function FamilyChip({
  label,
  active,
  onClick,
  color,
}: {
  label:   string;
  active:  boolean;
  onClick: () => void;
  color:   string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
        active ? color + " ring-2 ring-current ring-offset-1" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      }`}
    >
      {label}
    </button>
  );
}
