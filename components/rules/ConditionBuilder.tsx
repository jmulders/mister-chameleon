"use client";

/**
 * ConditionBuilder — shared visual condition editor
 *
 * Extracted from RulesEditor so it can be reused in both:
 *   - app/dashboard/rules/_components/RulesEditor.tsx
 *   - app/admin/tenants/[tenantId]/audience-segments/_components/SegmentsClient.tsx
 *
 * Exports:
 *   FlatGroupEditor   — the top-level multi-condition editor (use this)
 *   toEditorGroup     — convert a stored RuleCondition → EditorGroup
 *   fromEditorGroup   — serialise an EditorGroup → compact RuleCondition
 *   defaultLeaf       — factory for a blank leaf condition
 *   EditorLeaf        — type alias
 *   EditorGroup       — type alias
 */

import { useId }    from "react";
import type {
  RuleCondition,
  FieldCondition,
  NamedCondition,
  ContextCondition,
  ConditionField,
  NamedConditionId,
  FieldConditionValue,
} from "@/decision/rules/stored-rule";
import { NAMED_CONDITIONS } from "@/decision/rules/stored-rule";
import {
  FIELD_REGISTRY,
  FIELD_KEYS_BY_GROUP,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
} from "@/decision/rules/field-registry";
import type { RuleFieldKey, FieldOperator, FieldGroup } from "@/decision/rules/field-registry";
import {
  CONTEXT_REGISTRY,
  ALL_CONTEXT_IDS,
} from "@/decision/rules/context-library";
import type { ContextId }    from "@/decision/rules/context-library";
import { PRESET_CONDITIONS } from "@/decision/rules/preset-conditions";

// ── Internal model ─────────────────────────────────────────────────────────────

/** A leaf is any non-group condition — the only editable unit in this UI. */
export type EditorLeaf = FieldCondition | NamedCondition | ContextCondition;

/**
 * The internal flat model for a rule's condition block.
 *
 * `logic`  — "and" → all leaves must match; "or" → any leaf must match.
 * `leaves` — ordered list of leaf conditions. Always ≥ 1 entry.
 */
export type EditorGroup = {
  logic:  "and" | "or";
  leaves: EditorLeaf[];
};

/** Convert any stored RuleCondition to the flat EditorGroup model. */
export function toEditorGroup(condition: RuleCondition): EditorGroup {
  if (condition.type === "group") {
    const leaves = condition.conditions.filter(
      (c): c is EditorLeaf =>
        c.type === "field" || c.type === "named" || c.type === "context",
    );
    return {
      logic:  condition.logic,
      leaves: leaves.length > 0 ? [...leaves] : [defaultLeaf()],
    };
  }
  return { logic: "and", leaves: [condition as EditorLeaf] };
}

/**
 * Serialise an EditorGroup back to the most compact RuleCondition.
 *   1 leaf  → the leaf itself (no group wrapper)
 *   2+ leaves → GroupCondition
 */
export function fromEditorGroup(group: EditorGroup): RuleCondition {
  if (group.leaves.length === 1) return group.leaves[0];
  return { type: "group", logic: group.logic, conditions: group.leaves };
}

/** The default leaf added when a user clicks "+ Add condition". */
export function defaultLeaf(): EditorLeaf {
  return { type: "field", field: "source", operator: "equals", value: "google" };
}

// ── Label maps ─────────────────────────────────────────────────────────────────

const GROUP_LABELS: Record<FieldGroup, string> = {
  traffic:        "Traffic & Acquisition",
  device_session: "Device & Session",
  behavior:       "Behaviour & History",
  tenant_page:    "Tenant & Page",
  enrichment:     "Enrichment",
  time:           "Time",
  client_device:  "Client Device",
  derived:        "Derived Signals",
  interest:       "Interest Profiles",
  audience:       "Audience Segments",
};

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

// ── Shared CSS ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const selectCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// ── Field primitive ────────────────────────────────────────────────────────────

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

// ── Derive sensible default value when field / operator changes ────────────────

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

// ── FieldValueInput ────────────────────────────────────────────────────────────

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

// ── FieldConditionEditor ───────────────────────────────────────────────────────

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

  const effectiveOp: FieldOperator = validOperators.includes(operator)
    ? operator
    : validOperators[0];

  const handleFieldChange = (newField: RuleFieldKey) => {
    const def     = FIELD_REGISTRY[newField];
    const firstOp = def.operators[0];
    onChange(newField, firstOp, deriveDefaultValue(def, firstOp));
  };

  const handleOperatorChange = (newOp: FieldOperator) => {
    const newValue = NO_VALUE_OPERATORS.has(newOp)
      ? undefined
      : NO_VALUE_OPERATORS.has(effectiveOp)
        ? deriveDefaultValue(fieldDef, newOp)
        : value;
    onChange(field, newOp, newValue);
  };

  return (
    <>
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
            onChange={(newValue) => onChange(field, effectiveOp, newValue)}
          />
        </Field>
      )}
    </>
  );
}

// ── ConditionRow ───────────────────────────────────────────────────────────────

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

  const handleTypeChange = (type: "field" | "named" | "context") => {
    if (type === "field") {
      onChange({ type: "field", field: "source", operator: "equals", value: "google" });
    } else if (type === "named") {
      onChange({ type: "named", name: "returning_cta_clicked" });
    } else {
      onChange({ type: "context", contextId: ALL_CONTEXT_IDS[0] as ContextId });
    }
  };

  return (
    <div>
      {showLogicLabel && (
        <div className="flex items-center gap-2 py-1 pl-1">
          <span className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            {logic}
          </span>
        </div>
      )}

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
        {/* Header: type selector + remove */}
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2">
          <select
            value={leaf.type}
            onChange={(e) => handleTypeChange(e.target.value as "field" | "named" | "context")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Condition type"
          >
            <option value="field">Field condition</option>
            <option value="named">Named condition</option>
            <option value="context">Context condition</option>
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

          {leaf.type === "context" && (
            <Field
              label="Context"
              hint="Reusable named predicate from the Context Library. Evaluated once per request."
            >
              <select
                value={leaf.contextId}
                onChange={(e) =>
                  onChange({ type: "context", contextId: e.target.value as ContextId })
                }
                className={selectCls}
              >
                {ALL_CONTEXT_IDS.map((id) => {
                  const ctx = CONTEXT_REGISTRY[id];
                  return (
                    <option key={id} value={id}>
                      {ctx?.label ?? id}
                    </option>
                  );
                })}
              </select>
              {leaf.contextId && CONTEXT_REGISTRY[leaf.contextId] && (
                <p className="mt-1.5 text-xs text-neutral-500">
                  {CONTEXT_REGISTRY[leaf.contextId].description}
                </p>
              )}
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FlatGroupEditor ────────────────────────────────────────────────────────────

/**
 * Multi-condition editor for a rule or segment's condition block.
 *
 * Renders a flat list of leaf conditions (field / named / context) with an
 * AND / OR logic toggle when more than one condition is present.
 *
 * The parent holds the source-of-truth condition; all mutations propagate
 * upward via `onChange`.
 *
 * Serialisation:
 *   1 condition  → the leaf itself (no group wrapper)
 *   2+ conditions → GroupCondition { type: "group", logic, conditions }
 */
export function FlatGroupEditor({
  condition,
  onChange,
}: {
  condition: RuleCondition;
  onChange:  (c: RuleCondition) => void;
}) {
  const group = toEditorGroup(condition);
  const emit  = (next: EditorGroup) => onChange(fromEditorGroup(next));

  const handleLogicChange = (logic: "and" | "or") => emit({ ...group, logic });

  const handleLeafChange = (i: number, leaf: EditorLeaf) =>
    emit({ ...group, leaves: group.leaves.map((l, idx) => (idx === i ? leaf : l)) });

  const handleAddLeaf = () =>
    emit({ ...group, leaves: [...group.leaves, defaultLeaf()] });

  const handleRemoveLeaf = (i: number) => {
    if (group.leaves.length <= 1) return;
    emit({ ...group, leaves: group.leaves.filter((_, idx) => idx !== i) });
  };

  const isMulti = group.leaves.length > 1;

  const genericPresets = PRESET_CONDITIONS.filter((p) => p.group === "generic");
  const careersPresets = PRESET_CONDITIONS.filter((p) => p.group === "careers");

  const handlePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = PRESET_CONDITIONS.find((p) => p.key === e.target.value);
    if (!preset) return;
    emit({ logic: preset.logic, leaves: [...preset.leaves] });
    e.target.value = "";
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 px-1">
        {isMulti ? "Conditions" : "Condition"}
      </legend>

      {/* Quick preset selector */}
      <div className="flex items-center justify-between gap-2 -mt-1">
        <span className="text-xs text-neutral-400">Start from a preset or build manually below.</span>
        <select
          defaultValue=""
          onChange={handlePresetSelect}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-500 shadow-sm hover:border-neutral-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          aria-label="Apply a quick preset condition"
        >
          <option value="" disabled>Quick preset…</option>
          <optgroup label="Generic / B2B SaaS">
            {genericPresets.map((p) => (
              <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
            ))}
          </optgroup>
          <optgroup label="Careers / Werken-bij">
            {careersPresets.map((p) => (
              <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* AND / OR logic selector (only for 2+ conditions) */}
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

      {/* Condition rows */}
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
