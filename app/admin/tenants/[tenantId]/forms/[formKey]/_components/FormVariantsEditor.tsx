"use client";

/**
 * FormVariantsEditor
 *
 * Author the variants of a form (forms-as-adaptive-blocks, phase 2.2). Each
 * variant carries a layout (template + contact panel) and copy. A rule in the
 * rules builder then targets a variant by its key (plan.formVariants). Field-set
 * overrides are supported by the engine; a UI for them comes later.
 */

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { FormVariantEntry, FormVariantContent } from "@/forms/context/variant";

type Result = { ok: true } | { ok: false; error: string };
type Template = "single" | "split-left" | "split-right";

interface Props {
  initialVariants: FormVariantEntry[];
  saveAction:   (entry: FormVariantEntry) => Promise<Result>;
  deleteAction: (variantKey: string) => Promise<Result>;
}

const input =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 " +
  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1";

const blankDraft = {
  variantKey: "", label: "", template: "single" as Template,
  title: "", intro: "", submitLabel: "", successMessage: "",
  cpName: "", cpRole: "", cpPhoto: "", cpPhone: "", cpEmail: "",
};

export function FormVariantsEditor({ initialVariants, saveAction, deleteAction }: Props) {
  const [variants, setVariants] = useState<FormVariantEntry[]>(initialVariants);
  const [draft, setDraft]       = useState({ ...blankDraft });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);
  const [isPending, start]      = useTransition();

  function edit(v: FormVariantEntry) {
    const c = v.content;
    const cp = c.layout?.contactPanel;
    setEditingKey(v.variantKey);
    setDraft({
      variantKey: v.variantKey, label: v.label ?? "",
      template: (c.layout?.template ?? "single") as Template,
      title: c.title ?? "", intro: c.intro ?? "", submitLabel: c.submitLabel ?? "", successMessage: c.successMessage ?? "",
      cpName: cp?.name ?? "", cpRole: cp?.role ?? "", cpPhoto: cp?.photoUrl ?? "", cpPhone: cp?.phone ?? "", cpEmail: cp?.email ?? "",
    });
    setError(null); setSaved(false);
  }

  function reset() { setEditingKey(null); setDraft({ ...blankDraft }); }

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
    return {
      title:          draft.title.trim()          || undefined,
      intro:          draft.intro.trim()          || undefined,
      submitLabel:    draft.submitLabel.trim()    || undefined,
      successMessage: draft.successMessage.trim() || undefined,
      layout,
    };
  }

  function save() {
    const variantKey = draft.variantKey.trim();
    if (!variantKey) { setError("Variant key is required."); return; }
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

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Variants</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Alternative layouts + copy for this form. Target a variant per visitor with a rule in the
          rules builder (it sets the form variant key). Without a rule, the default form is shown.
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
            <option value="split-left">Split — contact panel left</option>
            <option value="split-right">Split — contact panel right</option>
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
