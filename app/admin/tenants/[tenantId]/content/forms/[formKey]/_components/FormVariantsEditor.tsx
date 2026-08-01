"use client";

/**
 * FormVariantsEditor
 *
 * Author the variants of a form (forms-as-adaptive-blocks, phase 2.2). Each
 * variant carries a layout (template + contact panel), copy, and an optional
 * presented field set (drop / relabel / reorder of the definition's fields).
 * A rule in the rules builder then targets a variant by its key
 * (plan.formVariants).
 *
 * Field-set safety mirrors the engine (forms/context/variant.ts): the variant
 * may only drop (optional), relabel, or reorder fields — the definition still
 * owns each field's type and validation, and a dropped REQUIRED field is
 * re-added at submit time. So the checkbox for a required field is locked on.
 */

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { FormVariantEntry, FormVariantContent } from "@/forms/context/variant";
import type { FormField } from "@/forms/types";
import type { VariantTone } from "@/ai/variant-meta";

type Result = { ok: true } | { ok: false; error: string };
type Template = "single" | "split-left" | "split-right";
type DraftResult = { ok: true; copy: { title: string; intro: string; submitLabel: string; successMessage: string } } | { ok: false; error: string };

const TONES: VariantTone[] = ["educational", "inspiring", "direct", "persuasive", "credibility", "urgency"];

/** One editable row in the field-set editor, seeded from a definition field. */
interface FieldRow {
  key:         string;
  type:        string;
  required:    boolean;
  include:     boolean;
  label:       string; // override; empty = use the definition label
  placeholder: string; // override; empty = use the definition placeholder
}

interface Props {
  definitionFields: FormField[];
  initialVariants:  FormVariantEntry[];
  saveAction:   (entry: FormVariantEntry) => Promise<Result>;
  deleteAction: (variantKey: string) => Promise<Result>;
  draftAction:  (audience: string, tone?: VariantTone) => Promise<DraftResult>;
}

const input =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 " +
  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1";

// ── Field-set helpers ────────────────────────────────────────────────────────

/** Build editor rows from the definition and (optionally) a variant's fields. */
function seedRows(defFields: FormField[], variantFields: readonly FormField[] | undefined): FieldRow[] {
  const baseRow = (f: FormField): FieldRow => ({
    key:         f.key,
    type:        f.type,
    required:    !!f.validation?.required,
    include:     true,
    label:       "",
    placeholder: "",
  });
  if (!variantFields || variantFields.length === 0) return defFields.map(baseRow);

  const defByKey = new Map(defFields.map((f) => [f.key, f]));
  const rows: FieldRow[] = [];
  const seen = new Set<string>();
  for (const vf of variantFields) {
    const df = defByKey.get(vf.key);
    if (!df || seen.has(vf.key)) continue;
    seen.add(vf.key);
    rows.push({
      key:         df.key,
      type:        df.type,
      required:    !!df.validation?.required,
      include:     true,
      label:       vf.label && vf.label !== df.label ? vf.label : "",
      placeholder: vf.placeholder && vf.placeholder !== df.placeholder ? vf.placeholder : "",
    });
  }
  // Append any definition fields the variant omitted. Required ones stay on
  // (the engine re-adds them anyway); optional ones default to excluded.
  for (const df of defFields) {
    if (seen.has(df.key)) continue;
    rows.push({
      key:         df.key,
      type:        df.type,
      required:    !!df.validation?.required,
      include:     !!df.validation?.required,
      label:       "",
      placeholder: "",
    });
  }
  return rows;
}

/** True when the rows are the full definition, in order, with no overrides. */
function isPristine(rows: FieldRow[], defFields: FormField[]): boolean {
  if (rows.length !== defFields.length) return false;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].key !== defFields[i].key) return false;
    if (!rows[i].include) return false;
    if (rows[i].label.trim() || rows[i].placeholder.trim()) return false;
  }
  return true;
}

/** Build the variant's stored field set from the editor rows. */
function buildFields(rows: FieldRow[], defFields: FormField[]): FormField[] {
  const defByKey = new Map(defFields.map((f) => [f.key, f]));
  const out: FormField[] = [];
  for (const r of rows) {
    if (!r.include) continue;
    const df = defByKey.get(r.key);
    if (!df) continue;
    out.push({
      ...df,
      ...(r.label.trim() ? { label: r.label.trim() } : {}),
      ...(r.placeholder.trim() ? { placeholder: r.placeholder.trim() } : {}),
    } as FormField);
  }
  return out;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FormVariantsEditor({ definitionFields, initialVariants, saveAction, deleteAction, draftAction }: Props) {
  const [variants, setVariants] = useState<FormVariantEntry[]>(initialVariants);
  const [aiAudience, setAiAudience] = useState("");
  const [aiTone, setAiTone]         = useState<VariantTone | "">("");
  const [aiError, setAiError]       = useState<string | null>(null);
  const [aiPending, startAi]        = useTransition();
  const blankDraft = () => ({
    variantKey: "", label: "", template: "single" as Template,
    title: "", intro: "", submitLabel: "", successMessage: "",
    cpName: "", cpRole: "", cpPhoto: "", cpPhone: "", cpEmail: "",
    fields: seedRows(definitionFields, undefined),
  });
  const [draft, setDraft]           = useState(blankDraft);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [showFields, setShowFields] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [saved, setSaved]           = useState(false);
  const [isPending, start]          = useTransition();

  function edit(v: FormVariantEntry) {
    const c = v.content;
    const cp = c.layout?.contactPanel;
    setEditingKey(v.variantKey);
    setDraft({
      variantKey: v.variantKey, label: v.label ?? "",
      template: (c.layout?.template ?? "single") as Template,
      title: c.title ?? "", intro: c.intro ?? "", submitLabel: c.submitLabel ?? "", successMessage: c.successMessage ?? "",
      cpName: cp?.name ?? "", cpRole: cp?.role ?? "", cpPhoto: cp?.photoUrl ?? "", cpPhone: cp?.phone ?? "", cpEmail: cp?.email ?? "",
      fields: seedRows(definitionFields, c.fields),
    });
    setShowFields(!!c.fields && c.fields.length > 0);
    setError(null); setSaved(false);
  }

  function reset() { setEditingKey(null); setDraft(blankDraft()); setShowFields(false); }

  function aiDraft() {
    if (!aiAudience.trim()) { setAiError("Describe the audience first."); return; }
    setAiError(null);
    startAi(async () => {
      const res = await draftAction(aiAudience.trim(), aiTone || undefined);
      if (!res.ok) { setAiError(res.error); return; }
      setDraft((d) => ({ ...d, title: res.copy.title, intro: res.copy.intro, submitLabel: res.copy.submitLabel, successMessage: res.copy.successMessage }));
    });
  }

  // ── Field-row mutators ──────────────────────────────────────────────────────
  function patchRow(idx: number, patch: Partial<FieldRow>) {
    setDraft((d) => ({ ...d, fields: d.fields.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  }
  function moveRow(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const j = idx + dir;
      if (j < 0 || j >= d.fields.length) return d;
      const next = [...d.fields];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, fields: next };
    });
  }

  function toContent(): FormVariantContent {
    const layout = draft.template === "single"
      ? { template: "single" as const }
      : {
          template: draft.template,
          contactPanel: {
            name:     draft.cpName.trim()  || undefined,
            role:     draft.cpRole.trim()  || undefined,
            photoUrl: draft.cpPhoto.trim() || undefined,
            phone:    draft.cpPhone.trim() || undefined,
            email:    draft.cpEmail.trim() || undefined,
          },
        };
    const fields = isPristine(draft.fields, definitionFields)
      ? undefined
      : buildFields(draft.fields, definitionFields);
    return {
      title:          draft.title.trim()          || undefined,
      intro:          draft.intro.trim()          || undefined,
      submitLabel:    draft.submitLabel.trim()    || undefined,
      successMessage: draft.successMessage.trim() || undefined,
      layout,
      ...(fields ? { fields } : {}),
    };
  }

  function save() {
    const variantKey = draft.variantKey.trim();
    if (!variantKey) { setError("Variant key is required."); return; }
    if (!draft.fields.some((r) => r.include)) { setError("At least one field must be included."); return; }
    setError(null);
    const entry: FormVariantEntry = { variantKey, label: draft.label.trim() || undefined, content: toContent() };
    start(async () => {
      const res = await saveAction(entry);
      if (!res.ok) { setError(res.error); return; }
      setVariants((prev) => [...prev.filter((v) => v.variantKey !== variantKey), entry]);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      reset();
    });
  }

  function remove(variantKey: string) {
    if (!confirm(`Delete variant "${variantKey}"?`)) return;
    start(async () => {
      const res = await deleteAction(variantKey);
      if (!res.ok) { setError(res.error); return; }
      setVariants((prev) => prev.filter((v) => v.variantKey !== variantKey));
      if (editingKey === variantKey) reset();
    });
  }

  const includedCount    = draft.fields.filter((r) => r.include).length;
  const fieldsCustomised = !isPristine(draft.fields, definitionFields);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Variants</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Alternative layouts, copy, and fields for this form. Target a variant per visitor with a rule
          in the rules builder (it sets the form variant key). Without a rule, the default form is shown.
        </p>
      </div>

      {/* Existing variants */}
      {variants.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {variants.map((v) => (
            <li key={v.variantKey} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <span className="font-mono text-xs text-neutral-900">{v.variantKey}</span>
                {v.label && <span className="ml-2 text-xs text-neutral-500">{v.label}</span>}
                <span className="ml-2 inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                  {v.content.layout?.template ?? "single"}
                </span>
                {v.content.fields && v.content.fields.length > 0 && (
                  <span className="ml-2 inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-600">
                    {v.content.fields.length} field{v.content.fields.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="flex flex-shrink-0 gap-2">
                <button type="button" onClick={() => edit(v)} disabled={isPending}
                  className="text-xs font-medium text-indigo-600 hover:underline">Edit</button>
                <button type="button" onClick={() => remove(v.variantKey)} disabled={isPending}
                  className="text-xs font-medium text-red-600 hover:underline">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit form */}
      <div className="px-5 py-4 space-y-4 border-t border-neutral-100 bg-neutral-50/40">
        <div className="text-xs font-semibold text-neutral-700">
          {editingKey ? `Edit variant "${editingKey}"` : "Add a variant"}
        </div>

        {/* AI draft */}
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <div className="text-[11px] font-semibold text-indigo-700 mb-1.5">Draft with AI</div>
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${input} min-w-[12rem] flex-1`} value={aiAudience}
              onChange={(e) => setAiAudience(e.target.value)}
              placeholder="Who is this for? e.g. enterprise buyer comparing vendors" />
            <select className={`${input} max-w-[9rem]`} value={aiTone}
              onChange={(e) => setAiTone(e.target.value as VariantTone | "")}>
              <option value="">Tone (auto)</option>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" onClick={aiDraft} disabled={aiPending}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {aiPending ? "Drafting" : "Draft copy"}
            </button>
          </div>
          {aiError && <p className="mt-1 text-xs text-red-600">{aiError}</p>}
          <p className="mt-1 text-[11px] text-indigo-500/80">Fills the heading, intro, submit label, and thank-you message. Edit before saving.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Variant key">
            <input className={input} value={draft.variantKey}
              onChange={(e) => setDraft({ ...draft, variantKey: e.target.value })}
              placeholder="e.g. contact_werving" disabled={!!editingKey} />
          </Field>
          <Field label="Label (optional)">
            <input className={input} value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Werving" />
          </Field>
        </div>

        <Field label="Template">
          <select className={input} value={draft.template}
            onChange={(e) => setDraft({ ...draft, template: e.target.value as Template })}>
            <option value="single">Single column</option>
            <option value="split-left">Split with contact panel left</option>
            <option value="split-right">Split with contact panel right</option>
          </select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Heading"><input className={input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Submit label"><input className={input} value={draft.submitLabel} onChange={(e) => setDraft({ ...draft, submitLabel: e.target.value })} /></Field>
        </div>
        <Field label="Intro"><input className={input} value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} /></Field>
        <Field label="Thank-you message"><input className={input} value={draft.successMessage} onChange={(e) => setDraft({ ...draft, successMessage: e.target.value })} /></Field>

        {draft.template !== "single" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact name"><input className={input} value={draft.cpName} onChange={(e) => setDraft({ ...draft, cpName: e.target.value })} /></Field>
            <Field label="Contact role"><input className={input} value={draft.cpRole} onChange={(e) => setDraft({ ...draft, cpRole: e.target.value })} /></Field>
            <Field label="Photo URL"><input className={input} value={draft.cpPhoto} onChange={(e) => setDraft({ ...draft, cpPhoto: e.target.value })} /></Field>
            <Field label="Phone"><input className={input} value={draft.cpPhone} onChange={(e) => setDraft({ ...draft, cpPhone: e.target.value })} /></Field>
            <Field label="Email"><input className={input} value={draft.cpEmail} onChange={(e) => setDraft({ ...draft, cpEmail: e.target.value })} /></Field>
          </div>
        )}

        {/* Field set (collapsible) */}
        <div className="rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setShowFields((s) => !s)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-xs font-medium text-neutral-700">
              Fields
              <span className="ml-2 font-normal text-neutral-400">
                {fieldsCustomised ? `customised (${includedCount} shown)` : "all fields (default)"}
              </span>
            </span>
            <span className="text-xs text-neutral-400">{showFields ? "Hide" : "Edit"}</span>
          </button>

          {showFields && (
            <div className="space-y-2 border-t border-neutral-100 px-3 py-3">
              <p className="text-[11px] text-neutral-500">
                Untick to hide an optional field, override its label or placeholder, or reorder with the
                arrows. Required fields stay on. Type and validation always come from the definition.
              </p>
              {draft.fields.map((r, i) => (
                <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={r.include}
                    disabled={r.required}
                    onChange={(e) => patchRow(i, { include: e.target.checked })}
                    title={r.required ? "Required, always included" : "Include this field"}
                    className="h-4 w-4 accent-neutral-900 disabled:opacity-50"
                  />
                  <span className="w-28 shrink-0 font-mono text-[11px] text-neutral-600" title={`${r.key} (${r.type})`}>
                    {r.key}
                    {r.required && <span className="ml-1 text-red-400">*</span>}
                  </span>
                  <input
                    className={`${input} min-w-[7rem] flex-1 py-1`}
                    value={r.label}
                    onChange={(e) => patchRow(i, { label: e.target.value })}
                    placeholder="label override"
                    disabled={!r.include}
                  />
                  <input
                    className={`${input} min-w-[7rem] flex-1 py-1`}
                    value={r.placeholder}
                    onChange={(e) => patchRow(i, { placeholder: e.target.value })}
                    placeholder="placeholder override"
                    disabled={!r.include}
                  />
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => moveRow(i, -1)} disabled={i === 0}
                      className="rounded border border-neutral-200 px-1.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-30" title="Move up">↑</button>
                    <button type="button" onClick={() => moveRow(i, 1)} disabled={i === draft.fields.length - 1}
                      className="rounded border border-neutral-200 px-1.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-30" title="Move down">↓</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={isPending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {isPending ? "Saving…" : editingKey ? "Save variant" : "Add variant"}
          </button>
          {editingKey && (
            <button type="button" onClick={reset} disabled={isPending} className="text-sm text-neutral-500 hover:text-neutral-800">Cancel</button>
          )}
          {saved && <span className="text-sm text-green-600">Saved</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
