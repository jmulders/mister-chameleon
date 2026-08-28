"use client";

/**
 * Shared, registry-driven field/value controls.
 *
 * Extracted verbatim from RulesEditor.tsx so BOTH the rules editor and the tenant
 * scenario-preset editor (admin) can reuse the same field picker + adaptive value
 * input, driven entirely by FIELD_REGISTRY metadata. Behaviour is byte-for-byte
 * identical to the previous in-RulesEditor definitions — this is a pure move.
 *
 * Exports:
 *   - inputCls / selectCls   shared Tailwind class strings
 *   - GROUP_LABELS           <optgroup> heading labels per field group
 *   - COMMON_FIELD_KEYS      curated "Common" shortlist
 *   - FieldPicker            searchable, grouped field combobox
 *   - FieldValueInput        adaptive value input (enum / number / boolean / text)
 *   - deriveDefaultValue     sensible default value for a (fieldDef, operator) pair
 */

import React, { useEffect, useRef, useState } from "react";
import {
  FIELD_REGISTRY,
  FIELD_KEYS_BY_GROUP,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
} from "@/decision/rules/field-registry";
import type { RuleFieldKey, FieldOperator, FieldGroup } from "@/decision/rules/field-registry";
import type { FieldConditionValue } from "@/decision/rules/stored-rule";

// ── Shared class strings ───────────────────────────────────────────────────────

export const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export const selectCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// ── Field group labels (for <optgroup> headings) ───────────────────────────────

export const GROUP_LABELS: Record<FieldGroup, string> = {
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

/**
 * A short, curated shortlist of the most-used fields, surfaced in a "Common"
 * optgroup at the top of the field picker so non-technical authors don't have
 * to scan the full ~150-field list. Every key here also still appears in its
 * normal category below under "All fields". Order is intentional.
 */
export const COMMON_FIELD_KEYS: readonly RuleFieldKey[] = [
  "channelGroup",
  "source",
  "entryPath",
  "pathname",
  "device",
  "visitType",
  "hasCampaignParam",
  "pageViewCount",
  "funnelStage",
  "contentInterestCategory",
  "isReturningVisitor",
  "isBot",
];

// ── FieldPicker ────────────────────────────────────────────────────────────────

export function FieldPicker({ value, onChange, allow }: {
  value: RuleFieldKey;
  onChange: (k: RuleFieldKey) => void;
  /** Optional allowlist — when given, only these field keys are offered. Omitting
   *  it keeps the full-registry behaviour (unchanged for the rules editor). */
  allow?: readonly RuleFieldKey[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowSet = allow ? new Set<string>(allow) : null;
  const def = FIELD_REGISTRY[value];
  const q   = query.trim().toLowerCase();
  const matches = (k: RuleFieldKey) =>
    (!allowSet || allowSet.has(k)) &&
    (!q ||
    FIELD_REGISTRY[k].label.toLowerCase().includes(q) ||
    GROUP_LABELS[FIELD_REGISTRY[k].group].toLowerCase().includes(q) ||
    k.toLowerCase().includes(q));

  const sections: Array<{ label: string; keys: RuleFieldKey[] }> = [];
  const common = COMMON_FIELD_KEYS.filter(matches);
  if (common.length) sections.push({ label: "Common", keys: [...common] });
  for (const [group, keys] of Object.entries(FIELD_KEYS_BY_GROUP) as [FieldGroup, readonly RuleFieldKey[]][]) {
    const filtered = keys.filter(matches);
    if (filtered.length) sections.push({ label: GROUP_LABELS[group], keys: [...filtered] });
  }
  const rows = sections.flatMap((s) => s.keys.map((key) => ({ key, section: s.label })));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => {
    if (open) { setQuery(""); setActiveIdx(0); const t = setTimeout(() => inputRef.current?.focus(), 0); return () => clearTimeout(t); }
  }, [open]);
  useEffect(() => { setActiveIdx(0); }, [query]);

  const choose = (k: RuleFieldKey) => { onChange(k); setOpen(false); };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown")      { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); const r = rows[activeIdx]; if (r) choose(r.key); }
    else if (e.key === "Escape")    { e.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); } }}
        className={`${selectCls} flex items-center justify-between text-left`}
      >
        <span className="truncate">
          {def ? (
            <>
              <span className="text-neutral-400">{GROUP_LABELS[def.group]}</span>
              <span className="mx-1 text-neutral-300">&rsaquo;</span>
              <span className="text-neutral-900">{def.label}</span>
            </>
          ) : "Choose a field"}
        </span>
        <span aria-hidden="true" className="ml-2 shrink-0 text-neutral-400">&#9662;</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search fields"
              aria-label="Search fields"
              className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <ul role="listbox" aria-label="Fields" className="max-h-64 overflow-auto px-1 pb-2">
            {rows.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-neutral-400">No fields match.</li>
            )}
            {rows.map((row, idx) => {
              const prev = rows[idx - 1];
              const showHeader = !prev || prev.section !== row.section;
              const active   = idx === activeIdx;
              const selected = row.key === value;
              return (
                <li key={`${row.section}-${row.key}`} role="presentation">
                  {showHeader && (
                    <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      {row.section}
                    </div>
                  )}
                  <div
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => choose(row.key)}
                    className={`cursor-pointer rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-brand-50 text-brand-800" : "text-neutral-700"} ${selected ? "font-medium" : ""}`}
                  >
                    {FIELD_REGISTRY[row.key].label}
                    {selected && <span className="ml-1.5 text-xs text-brand-500">selected</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── FieldValueInput ────────────────────────────────────────────────────────────

/**
 * Adaptive value input component driven entirely by FieldDefinition metadata.
 *
 * The component never needs to know about specific field names or operator
 * semantics beyond what is present in the fieldDef.
 */
export function FieldValueInput({
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
  // in / not_in - comma-separated text input; value is stored as string[]
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

  // boolean - select true / false
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

  // numeric ordering operators - number input
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

  // categorical with equals / not_equals - select from allowedValues
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

  // nullable_string and all other cases - text input
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

export function deriveDefaultValue(
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
