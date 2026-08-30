"use client";

/**
 * WebhookRulesManager
 *
 * Create / edit / delete INDEPENDENT webhook rules (webhook-only rules) right on
 * the Webhooks overview. Each rule = a condition (built from the engine's
 * FIELD_REGISTRY fields) + a destination URL + an optional signing secret. It
 * writes to the rules engine as a webhook-only rule, which fires on match
 * without taking part in the variant decision.
 *
 * The condition editor is a compact flat AND/OR group of field conditions — the
 * common shape for a webhook trigger. A rule whose condition is a nested group
 * (e.g. authored in the full Rules editor) is shown read-only here with a link
 * to edit it there, so nothing is silently flattened.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RuleCondition } from "@/decision/rules/stored-rule";
import type { ConditionFieldOption } from "@/lib/webhooks/condition-field-options";
import { saveWebhookRuleAction, deleteWebhookRuleAction, type RuleWebhookRow } from "../actions";
import { PAYLOAD_FIELD_CATALOG } from "@/lib/webhooks/payload-fields";

const NO_VALUE_OPS = new Set(["exists", "not_exists"]);
const ARRAY_OPS    = new Set(["in", "not_in"]);
const NUMERIC_OPS  = new Set(["greater_than", "greater_than_or_equal", "less_than", "less_than_or_equal"]);

const OPERATOR_LABELS: Record<string, string> = {
  equals: "equals", not_equals: "does not equal", contains: "contains", not_contains: "does not contain",
  in: "is one of", not_in: "is not one of", greater_than: "greater than", greater_than_or_equal: "at least",
  less_than: "less than", less_than_or_equal: "at most", exists: "is set", not_exists: "is not set",
};

interface Row { field: string; operator: string; value: string }

// ── Condition <-> rows ──────────────────────────────────────────────────────────

function valueToInput(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** Flatten a flat field-condition or single-level AND/OR group into editable rows. */
function conditionToRows(c: RuleCondition | undefined): { logic: "and" | "or"; rows: Row[]; editable: boolean } {
  const fallback = { logic: "and" as const, rows: [{ field: "source", operator: "equals", value: "" }], editable: true };
  if (!c) return fallback;
  if (c.type === "field") {
    return { logic: "and", rows: [{ field: c.field, operator: c.operator ?? "equals", value: valueToInput(c.value) }], editable: true };
  }
  if (c.type === "group" && c.conditions.every((k) => k.type === "field")) {
    return {
      logic: c.logic,
      rows: c.conditions.map((k) => {
        const f = k as Extract<RuleCondition, { type: "field" }>;
        return { field: f.field, operator: f.operator ?? "equals", value: valueToInput(f.value) };
      }),
      editable: true,
    };
  }
  // Nested / non-field condition — not editable in the compact editor.
  return { logic: "and", rows: [], editable: false };
}

function rowsToCondition(logic: "and" | "or", rows: Row[], fieldKind: (field: string) => string): RuleCondition {
  const build = (r: Row): RuleCondition => {
    const base = { type: "field" as const, field: r.field as never, operator: r.operator as never };
    if (NO_VALUE_OPS.has(r.operator)) return base as RuleCondition;
    if (ARRAY_OPS.has(r.operator)) {
      return { ...base, value: r.value.split(",").map((s) => s.trim()).filter(Boolean) } as RuleCondition;
    }
    const numeric = NUMERIC_OPS.has(r.operator) || fieldKind(r.field) === "number";
    return { ...base, value: numeric ? Number(r.value) : r.value } as RuleCondition;
  };
  if (rows.length === 1) return build(rows[0]);
  return { type: "group", logic, conditions: rows.map(build) } as RuleCondition;
}

// ── Form ────────────────────────────────────────────────────────────────────────

interface FormState { ruleId?: string; label: string; url: string; secret: string; logic: "and" | "or"; rows: Row[]; payloadFields: string[] }

function emptyForm(): FormState {
  return { label: "", url: "", secret: "", logic: "and", rows: [{ field: "source", operator: "equals", value: "" }], payloadFields: [] };
}

const PAYLOAD_GROUPS: { group: "context" | "firmographic" | "scoring" | "person"; label: string; note?: string }[] = [
  { group: "context",      label: "Context" },
  { group: "firmographic", label: "Firmographic", note: "requires enrichment consent" },
  { group: "scoring",      label: "Scoring",      note: "requires personalization consent" },
  { group: "person",       label: "Person (PII)", note: "requires personalization + enrichment consent" },
];

function RuleForm({
  fields, initial, onCancel, onSave, saving,
}: {
  fields:   ConditionFieldOption[];
  initial:  FormState;
  onCancel: () => void;
  onSave:   (s: FormState) => void;
  saving:   boolean;
}) {
  const [state, setState] = useState<FormState>(initial);
  const fieldKind = useMemo(() => {
    const m = new Map(fields.map((f) => [f.key, f.kind]));
    return (key: string) => m.get(key) ?? "string";
  }, [fields]);
  const opsFor = (key: string) => fields.find((f) => f.key === key)?.operators ?? ["equals"];
  const valuesFor = (key: string) => fields.find((f) => f.key === key)?.allowedValues;

  const setRow = (i: number, patch: Partial<Row>) =>
    setState((s) => ({ ...s, rows: s.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  const addRow = () => setState((s) => ({ ...s, rows: [...s.rows, { field: "source", operator: "equals", value: "" }] }));
  const removeRow = (i: number) => setState((s) => ({ ...s, rows: s.rows.filter((_, j) => j !== i) }));

  return (
    <div className="rounded-xl border border-brand-300 bg-brand-50/50 p-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Label</span>
          <input value={state.label} onChange={(e) => setState({ ...state, label: e.target.value })}
            placeholder="Notify sales on enterprise visits"
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-neutral-600">Destination URL (https)</span>
          <input value={state.url} onChange={(e) => setState({ ...state, url: e.target.value })}
            placeholder="https://hooks.example.com/…"
            className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-400" />
        </label>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-600">Fires when</span>
          {state.rows.length > 1 && (
            <select value={state.logic} onChange={(e) => setState({ ...state, logic: e.target.value as "and" | "or" })}
              className="rounded border border-neutral-200 px-1.5 py-0.5 text-xs">
              <option value="and">all match (AND)</option>
              <option value="or">any match (OR)</option>
            </select>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {state.rows.map((row, i) => {
            const ops = opsFor(row.field);
            const allowed = valuesFor(row.field);
            const noValue = NO_VALUE_OPS.has(row.operator);
            return (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select value={row.field}
                  onChange={(e) => setRow(i, { field: e.target.value, operator: opsFor(e.target.value)[0] })}
                  className="rounded border border-neutral-200 px-2 py-1 text-sm">
                  {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select value={row.operator} onChange={(e) => setRow(i, { operator: e.target.value })}
                  className="rounded border border-neutral-200 px-2 py-1 text-sm">
                  {ops.map((op) => <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>)}
                </select>
                {!noValue && (
                  <input value={row.value} onChange={(e) => setRow(i, { value: e.target.value })}
                    list={allowed ? `vals-${i}` : undefined}
                    placeholder={ARRAY_OPS.has(row.operator) ? "a, b, c" : "value"}
                    className="min-w-32 flex-1 rounded border border-neutral-200 px-2 py-1 text-sm" />
                )}
                {allowed && <datalist id={`vals-${i}`}>{allowed.map((v) => <option key={v} value={v} />)}</datalist>}
                {state.rows.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)}
                    className="rounded px-2 py-1 text-xs text-neutral-400 hover:text-red-600" title="Remove condition">✕</button>
                )}
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addRow}
          className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-800">+ Add condition</button>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-neutral-600">Signing secret (optional)</span>
        <input value={state.secret} onChange={(e) => setState({ ...state, secret: e.target.value })}
          placeholder="Leave blank for unsigned deliveries"
          className="mt-1 w-full rounded border border-neutral-200 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-brand-400" />
        <span className="mt-0.5 block text-[11px] text-neutral-400">When set, deliveries carry an x-mc-signature (HMAC-SHA256) header.</span>
      </label>

      <div>
        <span className="text-xs font-medium text-neutral-600">Payload fields</span>
        <p className="text-[11px] text-neutral-400">
          Added to the payload alongside the anonymous base. Consent-gated fields are dropped when the visitor has not consented.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {PAYLOAD_GROUPS.map(({ group, label, note }) => (
            <div key={group} className="rounded border border-neutral-200 p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {label}
                {note && <span className="ml-1 font-normal normal-case text-amber-600">· {note}</span>}
              </p>
              <div className="mt-1 space-y-1">
                {PAYLOAD_FIELD_CATALOG.filter((f) => f.group === group).map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-xs text-neutral-700">
                    <input
                      type="checkbox"
                      checked={state.payloadFields.includes(f.key)}
                      onChange={(e) => setState((s) => ({
                        ...s,
                        payloadFields: e.target.checked
                          ? [...s.payloadFields, f.key]
                          : s.payloadFields.filter((k) => k !== f.key),
                      }))}
                      className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={() => onSave(state)}
          className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? "Saving…" : "Save webhook rule"}
        </button>
        <button type="button" onClick={onCancel}
          className="rounded border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Manager ───────────────────────────────────────────────────────────────────

export function WebhookRulesManager({
  tenantId, rules, fields, rulesHref,
}: {
  tenantId:  string;
  rules:     RuleWebhookRow[];
  fields:    ConditionFieldOption[];
  rulesHref: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldKind = useMemo(() => {
    const m = new Map(fields.map((f) => [f.key, f.kind]));
    return (key: string) => m.get(key) ?? "string";
  }, [fields]);

  const startNew = () => { setError(null); setEditing(emptyForm()); };
  const startEdit = (r: RuleWebhookRow) => {
    setError(null);
    const parsed = conditionToRows(r.condition);
    if (!parsed.editable) { setError("This rule has a nested condition, edit it in the Rules editor."); return; }
    setEditing({ ruleId: r.ruleId, label: r.label, url: r.url, secret: "", logic: parsed.logic, rows: parsed.rows, payloadFields: r.payloadFields ?? [] });
  };

  const save = (s: FormState) => {
    setError(null);
    const condition = rowsToCondition(s.logic, s.rows, fieldKind);
    startTransition(async () => {
      const res = await saveWebhookRuleAction(tenantId, {
        ruleId: s.ruleId, label: s.label, url: s.url,
        secret: s.secret.trim() || null, condition,
        payloadFields: s.payloadFields,
      });
      if (res.ok) { setEditing(null); router.refresh(); }
      else setError(res.error);
    });
  };

  const remove = (ruleId: string, label: string) => {
    if (!confirm(`Delete webhook rule "${label}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteWebhookRuleAction(tenantId, ruleId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>
      )}

      {rules.length === 0 && !editing && (
        <p className="text-xs text-neutral-400">No independent webhook rules yet.</p>
      )}

      {rules.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                <th className="px-3 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Conditions</th>
                <th className="px-3 py-2 font-medium">Destination</th>
                <th className="px-3 py-2 font-medium">Signed</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.ruleId} className="border-b border-neutral-100 last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-neutral-800">{r.label}</p>
                    <p className="text-xs text-neutral-400">{r.enabled ? "Enabled" : "Disabled"}</p>
                  </td>
                  <td className="px-3 py-2.5"><code className="text-xs font-mono text-neutral-600">{r.conditionSummary}</code></td>
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <code className="block truncate rounded bg-neutral-100 px-2 py-1 text-xs font-mono text-neutral-700" title={r.url}>{r.url}</code>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-500">{r.hasSecret ? "Yes" : "No"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <button type="button" onClick={() => startEdit(r)} className="text-xs font-medium text-brand-600 hover:text-brand-800">Edit</button>
                    <span className="mx-1.5 text-neutral-300">·</span>
                    <button type="button" onClick={() => remove(r.ruleId, r.label)} className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <RuleForm fields={fields} initial={editing} saving={pending}
          onCancel={() => setEditing(null)} onSave={save} />
      ) : (
        <div className="flex items-center gap-3">
          <button type="button" onClick={startNew}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            + New webhook rule
          </button>
          <Link href={rulesHref} className="text-xs text-neutral-400 hover:text-neutral-600">
            Rules with a variant + webhook are edited in the Rules editor →
          </Link>
        </div>
      )}
    </div>
  );
}
