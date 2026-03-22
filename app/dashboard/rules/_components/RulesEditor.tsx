"use client";

/**
 * RulesEditor
 *
 * Internal UI for inspecting and editing homepage decision rules.
 * Supports creating, editing, reordering, and deleting rules.
 *
 * ─── Field metadata ─────────────────────────────────────────────────────────────
 *
 *   All field labels, valid operators, and allowed values come from
 *   FIELD_REGISTRY (decision/rules/field-registry.ts) — the single source of
 *   truth shared with the validator and the runtime evaluator.
 *
 * ─── Multi-condition model ─────────────────────────────────────────────────────
 *
 *   Internally the editor works with an EditorGroup — a flat list of leaf
 *   conditions (field or named) plus an AND / OR logic selector.
 *
 *   On save the group is serialised back to the most compact RuleCondition:
 *     • 1 leaf  → the leaf itself (preserves backwards-compatibility with
 *                 existing single-condition rules stored before R4)
 *     • 2+ leaves → GroupCondition { type: "group", logic, conditions }
 *
 *   On load any existing RuleCondition is converted to EditorGroup:
 *     • field / named → single-leaf group with logic = "and"
 *     • group         → uses stored logic; only direct field/named children
 *                       are editable (nested sub-groups are silently dropped;
 *                       the flat editor cannot express them)
 *
 * ─── Safety ────────────────────────────────────────────────────────────────────
 *
 *   All variant key selects are bound to the explicit ALLOWED_* constants.
 *   Condition fields, operators, and values are constrained to what the field
 *   registry permits for the selected field.
 *
 *   The final save is validated server-side in saveRulesAction() regardless
 *   of client-side state; the server is the authoritative validator.
 *
 * ─── Persistence ───────────────────────────────────────────────────────────────
 *
 *   Changes are held in local React state until the user clicks "Save changes".
 *   Saving calls saveRulesAction() which writes to decision/rules/runtime-rules.json.
 */

import { useState, useCallback, useId } from "react";
import {
  saveRulesAction,
  resetRulesAction,
} from "../actions";
import type {
  StoredRulesConfig,
  StoredRule,
  StoredDefaultPlan,
  RuleCondition,
  FieldCondition,
  NamedCondition,
  ConditionField,
  NamedConditionId,
  FieldConditionValue,
} from "@/decision/rules/stored-rule";
import {
  NAMED_CONDITIONS,
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
  formatCondition,
} from "@/decision/rules/stored-rule";
import {
  FIELD_REGISTRY,
  FIELD_KEYS_BY_GROUP,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
} from "@/decision/rules/field-registry";
import type {
  RuleFieldKey,
  FieldOperator,
  FieldGroup,
} from "@/decision/rules/field-registry";
import type { HeroVariantKey, ProofVariantKey, CTAVariantKey } from "@/decision/types";

// ── Internal editor model ──────────────────────────────────────────────────────
//
// The editor always works with a flat list of leaf conditions.  No nested groups
// are exposed in this editor — a GroupCondition arriving from storage that contains
// nested group children will have those nested children stripped on load.

/** A leaf is any non-group condition — the only editable unit in this UI. */
type EditorLeaf = FieldCondition | NamedCondition;

/**
 * The internal flat model for a rule's condition block.
 *
 * `logic`  — "and" → all leaves must match; "or" → any leaf must match.
 * `leaves` — ordered list of field / named conditions.  Always ≥ 1 entry.
 */
type EditorGroup = {
  logic:  "and" | "or";
  leaves: EditorLeaf[];
};

/** Convert any stored RuleCondition to the flat EditorGroup model. */
function toEditorGroup(condition: RuleCondition): EditorGroup {
  if (condition.type === "group") {
    // Only include direct leaf children — nested sub-groups are not editable here.
    const leaves = condition.conditions.filter(
      (c): c is EditorLeaf => c.type === "field" || c.type === "named",
    );
    return {
      logic:  condition.logic,
      leaves: leaves.length > 0 ? [...leaves] : [defaultLeaf()],
    };
  }
  // field or named — single-leaf group
  return { logic: "and", leaves: [condition as EditorLeaf] };
}

/**
 * Serialise an EditorGroup back to the most compact RuleCondition.
 *   1 leaf  → the leaf itself (no group wrapper, backwards-compatible)
 *   2+ leaves → GroupCondition
 */
function fromEditorGroup(group: EditorGroup): RuleCondition {
  if (group.leaves.length === 1) return group.leaves[0];
  return { type: "group", logic: group.logic, conditions: group.leaves };
}

/** The default leaf added when a user clicks "+ Add condition". */
function defaultLeaf(): EditorLeaf {
  return { type: "field", field: "source", operator: "equals", value: "google" };
}

// ── Editable rule (client-side draft) ─────────────────────────────────────────

/** A StoredRule that may be in an incomplete/invalid draft state during editing. */
type EditableRule = StoredRule & {
  _editOpen: boolean;
};

// ── Variant key labels ─────────────────────────────────────────────────────────

const HERO_KEY_LABELS: Record<HeroVariantKey, string> = {
  hero_google_problem:  "Google Problem — search / solution intent",
  hero_linkedin_vision: "LinkedIn Vision — thought-leadership intent",
  hero_direct_brand:    "Direct Brand — unattributed / returning",
};

const PROOF_KEY_LABELS: Record<ProofVariantKey, string> = {
  proof_cases:    "Cases — concrete case studies & ROI numbers",
  proof_vision:   "Vision — analyst quotes & industry recognition",
  proof_platform: "Platform — scale & reliability stats",
};

const CTA_KEY_LABELS: Record<CTAVariantKey, string> = {
  cta_guide:    "Guide — get the free personalisation guide",
  cta_platform: "Platform — start building for free",
  cta_meeting:  "Meeting — book a 20-minute intro call",
};

// ── Field group labels (for <optgroup> headings) ───────────────────────────────

const GROUP_LABELS: Record<FieldGroup, string> = {
  traffic:        "Traffic & Acquisition",
  device_session: "Device & Session",
  behavior:       "Behaviour & History",
  tenant_page:    "Tenant & Page",
};

// ── Operator labels ────────────────────────────────────────────────────────────

const OPERATOR_LABELS: Record<FieldOperator, string> = {
  equals:                "equals",
  not_equals:            "does not equal",
  in:                    "is one of",
  not_in:                "is not one of",
  greater_than:          "is greater than",
  greater_than_or_equal: "is ≥",
  less_than:             "is less than",
  less_than_or_equal:    "is ≤",
  contains:              "contains",
  not_contains:          "does not contain",
  exists:                "exists (not null)",
  not_exists:            "does not exist (null)",
};

// ── New rule template ──────────────────────────────────────────────────────────

let _nextPriority = 100;

function newEditableRule(): EditableRule {
  _nextPriority += 10;
  return {
    id:        `homepage.rule_${Date.now()}`,
    priority:  _nextPriority,
    label:     "",
    condition: { type: "field", field: "source", operator: "equals", value: "google" },
    plan: {
      heroKey:  "hero_direct_brand",
      proofKey: "proof_platform",
      ctaKey:   "cta_meeting",
    },
    reason:    "",
    _editOpen: true,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

interface RulesEditorProps {
  initialConfig: StoredRulesConfig;
}

export function RulesEditor({ initialConfig }: RulesEditorProps) {
  const [rules, setRules] = useState<EditableRule[]>(
    () => initialConfig.rules.map((r) => ({ ...r, _editOpen: false })),
  );
  const [defaultPlan, setDefaultPlan] = useState<StoredDefaultPlan>(initialConfig.defaultPlan);
  const [defaultEditOpen, setDefaultEditOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── Mutation helpers ─────────────────────────────────────────────────────────

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveStatus("idle");
    setSaveError(null);
    setFieldErrors([]);
  }, []);

  const updateRule = useCallback(
    (id: string, patch: Partial<EditableRule>) => {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      markDirty();
    },
    [markDirty],
  );

  const toggleEdit = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, _editOpen: !r._editOpen } : r)),
    );
  }, []);

  const deleteRule = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id));
      markDirty();
    },
    [markDirty],
  );

  const addRule = useCallback(() => {
    setRules((prev) => [...prev, newEditableRule()]);
    markDirty();
  }, [markDirty]);

  const moveRule = useCallback(
    (id: string, direction: "up" | "down") => {
      setRules((prev) => {
        const sorted = [...prev].sort((a, b) => a.priority - b.priority);
        const idx = sorted.findIndex((r) => r.id === id);
        if (direction === "up" && idx > 0) {
          const swapPriority = sorted[idx - 1].priority;
          sorted[idx - 1] = { ...sorted[idx - 1], priority: sorted[idx].priority };
          sorted[idx]     = { ...sorted[idx], priority: swapPriority };
        }
        if (direction === "down" && idx < sorted.length - 1) {
          const swapPriority = sorted[idx + 1].priority;
          sorted[idx + 1] = { ...sorted[idx + 1], priority: sorted[idx].priority };
          sorted[idx]     = { ...sorted[idx], priority: swapPriority };
        }
        return sorted;
      });
      markDirty();
    },
    [markDirty],
  );

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    setFieldErrors([]);

    const config: StoredRulesConfig = {
      schemaVersion: 1,
      updatedAt:     new Date().toISOString(),
      rules:         rules.map(({ _editOpen: _, ...r }) => r),
      defaultPlan,
    };

    const result = await saveRulesAction(config);

    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);
    } else {
      setSaveStatus("error");
      setSaveError(result.error);
      if ("fieldErrors" in result && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    }
  }, [rules, defaultPlan]);

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = useCallback(async () => {
    setSaveStatus("saving");
    const result = await resetRulesAction();
    if (result.ok) {
      window.location.reload();
    } else {
      setSaveStatus("error");
      setSaveError(result.error);
    }
    setConfirmReset(false);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-neutral-900">Homepage Rules</h1>
          <p className="text-sm text-neutral-500">
            Decision rules that map visitor signals to content variant sets.
            Rules are evaluated in priority order — first match wins.
          </p>
        </div>
        <SaveBar
          isDirty={isDirty}
          saveStatus={saveStatus}
          onSave={handleSave}
          onReset={() => setConfirmReset(true)}
        />
      </div>

      {/* ── Status messages ─────────────────────────────────────────────── */}
      {saveStatus === "error" && saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-800">{saveError}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-red-700">
              {fieldErrors.map((e, i) => (
                <li key={i} className="font-mono text-xs">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {saveStatus === "saved" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Rules saved to <code className="font-mono text-xs">decision/rules/runtime-rules.json</code>.
        </div>
      )}

      {/* ── Rules ───────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">Rules</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {sortedRules.length} rule{sortedRules.length === 1 ? "" : "s"} · evaluated top to bottom
            </p>
          </div>
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
          >
            <span aria-hidden className="text-neutral-400">+</span>
            Add rule
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {sortedRules.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-400">
              No rules yet. Click &ldquo;Add rule&rdquo; to create one.
            </div>
          )}
          {sortedRules.map((rule, idx) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={idx}
              total={sortedRules.length}
              onChange={(patch) => updateRule(rule.id, patch)}
              onToggleEdit={() => toggleEdit(rule.id)}
              onDelete={() => deleteRule(rule.id)}
              onMove={(dir) => moveRule(rule.id, dir)}
            />
          ))}
        </div>
      </section>

      {/* ── Default plan ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-neutral-800">Default plan</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Applied when no rule matches (direct traffic, unknown sources).
          </p>
        </div>
        <DefaultPlanCard
          plan={defaultPlan}
          editOpen={defaultEditOpen}
          onToggleEdit={() => setDefaultEditOpen((v) => !v)}
          onChange={(patch) => {
            setDefaultPlan((prev) => ({ ...prev, ...patch }));
            markDirty();
          }}
        />
      </section>

      {/* ── Reset confirmation ───────────────────────────────────────────── */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900 mb-2">Reset to defaults?</h3>
            <p className="text-sm text-neutral-600 mb-6">
              This will overwrite your saved rules with the code-defined defaults and reload the page.
              Any unsaved changes will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SaveBar ────────────────────────────────────────────────────────────────────

function SaveBar({
  isDirty,
  saveStatus,
  onSave,
  onReset,
}: {
  isDirty:    boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave:     () => void;
  onReset:    () => void;
}) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      {isDirty && (
        <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
      )}
      <button
        type="button"
        onClick={onReset}
        disabled={saveStatus === "saving"}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
      >
        Reset to defaults
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saveStatus === "saving" || !isDirty}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveStatus === "saving" ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

// ── RuleCard ───────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule:         EditableRule;
  index:        number;
  total:        number;
  onChange:     (patch: Partial<EditableRule>) => void;
  onToggleEdit: () => void;
  onDelete:     () => void;
  onMove:       (dir: "up" | "down") => void;
}

function RuleCard({
  rule,
  index,
  total,
  onChange,
  onToggleEdit,
  onDelete,
  onMove,
}: RuleCardProps) {
  const isFirst = index === 0;
  const isLast  = index === total - 1;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* ── Summary row ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-xs font-mono font-semibold text-neutral-600">
          {rule.priority}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">
            {rule.label || <span className="italic text-neutral-400">Unnamed rule</span>}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5 font-mono truncate">
            {formatCondition(rule.condition)}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <PlanBadge block="hero"  value={rule.plan.heroKey} />
          <PlanBadge block="proof" value={rule.plan.proofKey} />
          <PlanBadge block="cta"   value={rule.plan.ctaKey} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <IconButton label="Move up"   onClick={() => onMove("up")}   disabled={isFirst} icon={<ArrowUpIcon />} />
          <IconButton label="Move down" onClick={() => onMove("down")} disabled={isLast}  icon={<ArrowDownIcon />} />
          <button
            type="button"
            onClick={onToggleEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            {rule._editOpen ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {/* ── Edit panel ────────────────────────────────────────────────── */}
      {rule._editOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Left column: identity + conditions */}
            <div className="flex flex-col gap-4">
              <Field label="Label">
                <input
                  type="text"
                  value={rule.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                  placeholder="e.g. Google traffic on mobile"
                  className={inputCls}
                />
              </Field>

              <Field label="Priority" hint="Lower number = higher priority. Must be unique.">
                <input
                  type="number"
                  value={rule.priority}
                  min={1}
                  max={9999}
                  onChange={(e) =>
                    onChange({ priority: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className={inputCls}
                />
              </Field>

              <Field label="Reason" hint="Shown in debug output and analytics events.">
                <input
                  type="text"
                  value={rule.reason}
                  onChange={(e) => onChange({ reason: e.target.value })}
                  placeholder="e.g. Traffic source indicates search/problem intent."
                  className={inputCls}
                />
              </Field>

              <FlatGroupEditor
                condition={rule.condition}
                onChange={(condition) => onChange({ condition })}
              />
            </div>

            {/* Right column: plan */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Variant Plan
              </p>

              <Field label="Hero variant">
                <select
                  value={rule.plan.heroKey}
                  onChange={(e) =>
                    onChange({ plan: { ...rule.plan, heroKey: e.target.value as HeroVariantKey } })
                  }
                  className={selectCls}
                >
                  {ALLOWED_HERO_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k} — {HERO_KEY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Proof variant">
                <select
                  value={rule.plan.proofKey}
                  onChange={(e) =>
                    onChange({ plan: { ...rule.plan, proofKey: e.target.value as ProofVariantKey } })
                  }
                  className={selectCls}
                >
                  {ALLOWED_PROOF_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k} — {PROOF_KEY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="CTA variant">
                <select
                  value={rule.plan.ctaKey}
                  onChange={(e) =>
                    onChange({ plan: { ...rule.plan, ctaKey: e.target.value as CTAVariantKey } })
                  }
                  className={selectCls}
                >
                  {ALLOWED_CTA_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {k} — {CTA_KEY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-5 flex justify-end border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onDelete}
              className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
            >
              Delete rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DefaultPlanCard ────────────────────────────────────────────────────────────

function DefaultPlanCard({
  plan,
  editOpen,
  onToggleEdit,
  onChange,
}: {
  plan:         StoredDefaultPlan;
  editOpen:     boolean;
  onToggleEdit: () => void;
  onChange:     (patch: Partial<StoredDefaultPlan>) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-dashed border-neutral-300 text-xs font-mono text-neutral-400">
          —
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900">Default (no match)</p>
          <p className="text-xs text-neutral-500 mt-0.5">Applied when no rule fires.</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <PlanBadge block="hero"  value={plan.heroKey} />
          <PlanBadge block="proof" value={plan.proofKey} />
          <PlanBadge block="cta"   value={plan.ctaKey} />
        </div>
        <button
          type="button"
          onClick={onToggleEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          {editOpen ? "Done" : "Edit"}
        </button>
      </div>

      {editOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Field label="Reason" hint="Shown in debug output and analytics events.">
                <input
                  type="text"
                  value={plan.reason}
                  onChange={(e) => onChange({ reason: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              <Field label="Hero variant">
                <select
                  value={plan.heroKey}
                  onChange={(e) => onChange({ heroKey: e.target.value as HeroVariantKey })}
                  className={selectCls}
                >
                  {ALLOWED_HERO_KEYS.map((k) => (
                    <option key={k} value={k}>{k} — {HERO_KEY_LABELS[k]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Proof variant">
                <select
                  value={plan.proofKey}
                  onChange={(e) => onChange({ proofKey: e.target.value as ProofVariantKey })}
                  className={selectCls}
                >
                  {ALLOWED_PROOF_KEYS.map((k) => (
                    <option key={k} value={k}>{k} — {PROOF_KEY_LABELS[k]}</option>
                  ))}
                </select>
              </Field>
              <Field label="CTA variant">
                <select
                  value={plan.ctaKey}
                  onChange={(e) => onChange({ ctaKey: e.target.value as CTAVariantKey })}
                  className={selectCls}
                >
                  {ALLOWED_CTA_KEYS.map((k) => (
                    <option key={k} value={k}>{k} — {CTA_KEY_LABELS[k]}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FlatGroupEditor ────────────────────────────────────────────────────────────

/**
 * Multi-condition editor for a rule's condition block.
 *
 * Renders a flat list of leaf conditions (field or named) with an AND / OR
 * logic toggle at the top when more than one condition is present.
 *
 * The internal EditorGroup model is derived from the incoming RuleCondition prop
 * on every render — the parent holds the source-of-truth condition and all
 * mutations propagate upward via onChange.
 *
 * Save behaviour:
 *   • 1 condition  → saved as the leaf itself (no group wrapper)
 *   • 2+ conditions → saved as GroupCondition { type: "group", logic, conditions }
 */
function FlatGroupEditor({
  condition,
  onChange,
}: {
  condition: RuleCondition;
  onChange:  (c: RuleCondition) => void;
}) {
  const group = toEditorGroup(condition);

  const emit = (next: EditorGroup) => onChange(fromEditorGroup(next));

  const handleLogicChange = (logic: "and" | "or") => {
    emit({ ...group, logic });
  };

  const handleLeafChange = (i: number, leaf: EditorLeaf) => {
    const leaves = group.leaves.map((l, idx) => (idx === i ? leaf : l));
    emit({ ...group, leaves });
  };

  const handleAddLeaf = () => {
    emit({ ...group, leaves: [...group.leaves, defaultLeaf()] });
  };

  const handleRemoveLeaf = (i: number) => {
    if (group.leaves.length <= 1) return;
    const leaves = group.leaves.filter((_, idx) => idx !== i);
    emit({ ...group, leaves });
  };

  const isMulti = group.leaves.length > 1;

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 px-1">
        {isMulti ? "Conditions" : "Condition"}
      </legend>

      {/* ── AND / OR logic selector (only shown for 2+ conditions) ───── */}
      {isMulti && (
        <div className="flex items-center gap-2 rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2">
          <span className="text-xs text-neutral-500 font-medium shrink-0">Match</span>
          <select
            value={group.logic}
            onChange={(e) => handleLogicChange(e.target.value as "and" | "or")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Logic operator"
          >
            <option value="and">ALL</option>
            <option value="or">ANY</option>
          </select>
          <span className="text-xs text-neutral-500 shrink-0">of the following conditions</span>
        </div>
      )}

      {/* ── Condition rows ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {group.leaves.map((leaf, i) => (
          <ConditionRow
            key={i}
            leaf={leaf}
            index={i}
            isOnly={!isMulti}
            showLogicLabel={isMulti && i > 0}
            logic={group.logic}
            onChange={(next) => handleLeafChange(i, next)}
            onRemove={() => handleRemoveLeaf(i)}
          />
        ))}
      </div>

      {/* ── Add condition ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleAddLeaf}
        className="mt-1 self-start text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
      >
        + Add condition
      </button>
    </fieldset>
  );
}

// ── ConditionRow ───────────────────────────────────────────────────────────────

/**
 * A single leaf condition within a FlatGroupEditor.
 *
 * Renders a type selector (field / named) in the header bar alongside the
 * remove button, then the appropriate body: FieldConditionEditor for field
 * conditions or a named-condition selector for named ones.
 *
 * `isOnly`           — true when this is the only condition in the group;
 *                      hides the Remove button (can't reduce to zero conditions).
 * `showLogicLabel`   — true for all rows after the first when multi-condition;
 *                      renders a small AND/OR badge as a visual separator.
 */
function ConditionRow({
  leaf,
  isOnly,
  showLogicLabel,
  logic,
  onChange,
  onRemove,
}: {
  leaf:           EditorLeaf;
  index:          number;
  isOnly:         boolean;
  showLogicLabel: boolean;
  logic:          "and" | "or";
  onChange:       (l: EditorLeaf) => void;
  onRemove:       () => void;
}) {
  const namedConditions = Object.entries(NAMED_CONDITIONS) as [
    NamedConditionId,
    { label: string; description: string },
  ][];

  const handleTypeChange = (type: "field" | "named") => {
    if (type === "field") {
      onChange({ type: "field", field: "source", operator: "equals", value: "google" });
    } else {
      onChange({ type: "named", name: "returning_cta_clicked" });
    }
  };

  return (
    <div>
      {/* AND / OR connector label between rows */}
      {showLogicLabel && (
        <div className="flex items-center gap-2 py-1 pl-1">
          <span className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            {logic}
          </span>
        </div>
      )}

      {/* Condition card */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
        {/* Header: type selector + remove */}
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2">
          <select
            value={leaf.type}
            onChange={(e) => handleTypeChange(e.target.value as "field" | "named")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Condition type"
          >
            <option value="field">Field condition</option>
            <option value="named">Named condition</option>
          </select>

          {!isOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-neutral-400 hover:text-red-600 transition-colors"
              aria-label="Remove condition"
            >
              Remove
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-3 flex flex-col gap-3">
          {leaf.type === "field" && (
            <FieldConditionEditor
              field={leaf.field}
              operator={leaf.operator ?? "equals"}
              value={leaf.value}
              onChange={(field, operator, value) =>
                onChange({ type: "field", field, operator, value })
              }
            />
          )}

          {leaf.type === "named" && (
            <Field label="Named condition">
              <select
                value={leaf.name}
                onChange={(e) =>
                  onChange({ type: "named", name: e.target.value as NamedConditionId })
                }
                className={selectCls}
              >
                {namedConditions.map(([name, meta]) => (
                  <option key={name} value={name}>{meta.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-neutral-500">
                {NAMED_CONDITIONS[leaf.name].description}
              </p>
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FieldConditionEditor ───────────────────────────────────────────────────────

/**
 * Registry-driven field condition editor.
 *
 * Field picker    — groups all FIELD_REGISTRY entries into <optgroup> sections.
 * Operator picker — constrained to operators valid for the selected field
 *                   (from fieldDef.operators).
 * Value input     — adapts to field kind and operator:
 *                     categorical + equals/not_equals  → <select> from allowedValues
 *                     boolean                          → <select> true / false
 *                     number or ordering operator      → <input type="number">
 *                     in / not_in                      → <input> comma-separated
 *                     nullable_string / other          → <input type="text">
 *                     exists / not_exists              → no value input shown
 */
function FieldConditionEditor({
  field,
  operator,
  value,
  onChange,
}: {
  field:    ConditionField;
  operator: FieldOperator;
  value:    FieldConditionValue | undefined;
  onChange: (field: ConditionField, operator: FieldOperator, value: FieldConditionValue | undefined) => void;
}) {
  const fieldDef       = FIELD_REGISTRY[field as RuleFieldKey];
  const validOperators = fieldDef?.operators ?? (["equals"] as readonly FieldOperator[]);

  // Clamp operator to what the selected field allows
  const effectiveOp: FieldOperator = validOperators.includes(operator)
    ? operator
    : validOperators[0];

  const handleFieldChange = (newField: RuleFieldKey) => {
    const def      = FIELD_REGISTRY[newField];
    const firstOp  = def.operators[0];
    const firstVal = deriveDefaultValue(def, firstOp);
    onChange(newField, firstOp, firstVal);
  };

  const handleOperatorChange = (newOp: FieldOperator) => {
    const newValue = NO_VALUE_OPERATORS.has(newOp)
      ? undefined
      : NO_VALUE_OPERATORS.has(effectiveOp)
        ? deriveDefaultValue(fieldDef, newOp)
        : value;
    onChange(field, newOp, newValue);
  };

  const handleValueChange = (newValue: FieldConditionValue | undefined) => {
    onChange(field, effectiveOp, newValue);
  };

  return (
    <>
      {/* Field picker — grouped by FieldGroup */}
      <Field label="Field">
        <select
          value={field}
          onChange={(e) => handleFieldChange(e.target.value as RuleFieldKey)}
          className={selectCls}
        >
          {(Object.entries(FIELD_KEYS_BY_GROUP) as [FieldGroup, readonly RuleFieldKey[]][]).map(
            ([group, keys]) => (
              <optgroup key={group} label={GROUP_LABELS[group]}>
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {FIELD_REGISTRY[k].label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
        {fieldDef && (
          <p className="mt-1 text-xs text-neutral-400">{fieldDef.description}</p>
        )}
      </Field>

      {/* Operator picker */}
      <Field label="Operator">
        <select
          value={effectiveOp}
          onChange={(e) => handleOperatorChange(e.target.value as FieldOperator)}
          className={selectCls}
        >
          {validOperators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </Field>

      {/* Value input — hidden for existence operators */}
      {!NO_VALUE_OPERATORS.has(effectiveOp) && (
        <Field
          label="Value"
          hint={
            ARRAY_VALUE_OPERATORS.has(effectiveOp)
              ? "Separate multiple values with commas"
              : undefined
          }
        >
          <FieldValueInput
            fieldDef={fieldDef}
            operator={effectiveOp}
            value={value}
            onChange={handleValueChange}
          />
        </Field>
      )}
    </>
  );
}

// ── FieldValueInput ────────────────────────────────────────────────────────────

/**
 * Adaptive value input component driven entirely by FieldDefinition metadata.
 *
 * The component never needs to know about specific field names or operator
 * semantics beyond what is present in the fieldDef.
 */
function FieldValueInput({
  fieldDef,
  operator,
  value,
  onChange,
}: {
  fieldDef: typeof FIELD_REGISTRY[RuleFieldKey];
  operator: FieldOperator;
  value:    FieldConditionValue | undefined;
  onChange: (v: FieldConditionValue | undefined) => void;
}) {
  // in / not_in — comma-separated text input; value is stored as string[]
  if (ARRAY_VALUE_OPERATORS.has(operator)) {
    const displayValue = Array.isArray(value)
      ? (value as (string | number)[]).join(", ")
      : typeof value === "string" ? value : "";
    return (
      <input
        type="text"
        value={displayValue}
        placeholder="value1, value2, value3"
        onChange={(e) => {
          const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
          onChange(arr.length > 0 ? arr : undefined);
        }}
        className={inputCls}
      />
    );
  }

  // boolean — select true / false
  if (fieldDef.kind === "boolean") {
    return (
      <select
        value={String(value ?? "true")}
        onChange={(e) => onChange(e.target.value === "true")}
        className={selectCls}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // numeric ordering operators — number input
  if (fieldDef.kind === "number" || NUMERIC_OPERATORS.has(operator)) {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        placeholder="0"
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className={inputCls}
      />
    );
  }

  // categorical with equals / not_equals — select from allowedValues
  if (
    fieldDef.kind === "categorical" &&
    fieldDef.allowedValues &&
    (operator === "equals" || operator === "not_equals")
  ) {
    return (
      <select
        value={typeof value === "string" ? value : (fieldDef.allowedValues[0] ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
      >
        {fieldDef.allowedValues.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }

  // nullable_string and all other cases — text input
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      placeholder="enter value…"
      onChange={(e) => onChange(e.target.value !== "" ? e.target.value : undefined)}
      className={inputCls}
    />
  );
}

// ── Derive a sensible default value when the field or operator changes ─────────

function deriveDefaultValue(
  def:      typeof FIELD_REGISTRY[RuleFieldKey],
  operator: FieldOperator,
): FieldConditionValue | undefined {
  if (NO_VALUE_OPERATORS.has(operator))    return undefined;
  if (ARRAY_VALUE_OPERATORS.has(operator)) return def.allowedValues ? [def.allowedValues[0]] : [];
  if (def.kind === "boolean")              return true;
  if (def.kind === "number")               return 0;
  if (def.allowedValues)                   return def.allowedValues[0];
  return "";
}

// ── PlanBadge ──────────────────────────────────────────────────────────────────

const BADGE_COLORS: Record<"hero" | "proof" | "cta", string> = {
  hero:  "bg-violet-50 text-violet-700 border-violet-200",
  proof: "bg-sky-50    text-sky-700    border-sky-200",
  cta:   "bg-amber-50  text-amber-700  border-amber-200",
};

function PlanBadge({ block, value }: { block: "hero" | "proof" | "cta"; value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${BADGE_COLORS[block]}`}
      title={`${block}: ${value}`}
    >
      {value}
    </span>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-700">
        {label}
      </label>
      <div id={id}>{children}</div>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label:    string;
  icon:     React.ReactNode;
  onClick:  () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}

// ── Shared class strings ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const selectCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// ── SVG icons ──────────────────────────────────────────────────────────────────

function ArrowUpIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 12V4M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 4v8m4-3-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
