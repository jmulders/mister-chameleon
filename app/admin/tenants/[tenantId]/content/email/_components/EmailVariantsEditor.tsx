"use client";

/**
 * EmailVariantsEditor
 *
 * Author the variants of each adaptive email template (adaptive emails, phase
 * 2). A variant carries a subject, preview text, and an optional block set,
 * layered over the resolved template. A rule in the rules builder then targets a
 * variant by its key (plan.emailVariants). The block CONTENT still comes from the
 * rules plan and the blocks library, exactly as before.
 *
 * Free-text and rich-HTML block entries are edited on the template itself (the
 * per-tenant override above). A variant reshapes the envelope, subject, preview
 * text, and which adaptive blocks appear.
 */

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import type { EmailVariantEntry, EmailVariantContent } from "@/lib/email/email-variant";
import type { EmailBlockEntry } from "@/lib/email/adaptive-email";
import {
  saveEmailVariantAction,
  deleteEmailVariantAction,
} from "../email-variants-actions";
import { HtmlBlockEditor } from "./HtmlBlockEditor";

type Result = { ok: true } | { ok: false; error: string };

const isText = (b: EmailBlockEntry): b is { text: string } => typeof b === "object" && b !== null && "text" in b;
const isHtml = (b: EmailBlockEntry): b is { html: string } => typeof b === "object" && b !== null && "html" in b;
const btnGhost = "inline-flex items-center rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40";

export interface EmailTemplateMeta {
  key:            string;
  label:          string;
  defaultSubject: string;
  defaultBlocks:  string[];
}

interface Props {
  tenantId:        string;
  blockKeys:       string[];
  templates:       EmailTemplateMeta[];
  initialVariants: Record<string, EmailVariantEntry[]>;
}

const input =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 " +
  "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1";

export function EmailVariantsEditor({ tenantId, blockKeys, templates, initialVariants }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Email variants</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Alternative subject, preview text, and block set per template. Target a variant per recipient
          with a rule in the rules builder. Without a rule, the resolved template is used.
        </p>
      </div>
      <div className="divide-y divide-neutral-100">
        {templates.map((t) => (
          <TemplateVariants
            key={t.key}
            tenantId={tenantId}
            blockKeys={blockKeys}
            template={t}
            initial={initialVariants[t.key] ?? []}
          />
        ))}
      </div>
    </div>
  );
}

// ── Per-template sub-editor ──────────────────────────────────────────────────────

function TemplateVariants({
  tenantId,
  blockKeys,
  template,
  initial,
}: {
  tenantId:  string;
  blockKeys: string[];
  template:  EmailTemplateMeta;
  initial:   EmailVariantEntry[];
}) {
  const [variants, setVariants]   = useState<EmailVariantEntry[]>(initial);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const blank = () => ({
    variantKey: "", label: "", subject: "", preheader: "",
    blocks: [] as EmailBlockEntry[],
  });
  const [draft, setDraft]   = useState(blank);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [saved, setSaved]   = useState(false);
  const [isPending, start]  = useTransition();

  function edit(v: EmailVariantEntry) {
    const c = v.content;
    setEditingKey(v.variantKey);
    setDraft({
      variantKey: v.variantKey, label: v.label ?? "",
      subject: c.subject ?? "", preheader: c.preheader ?? "", blocks: [...(c.blocks ?? [])],
    });
    setShowAdd(true); setError(null); setSaved(false);
  }

  function reset() { setEditingKey(null); setDraft(blank()); setShowAdd(false); }

  // Block-list mutators (adaptive keys + free text + rich HTML, in order).
  const setBlocks = (updater: (cur: EmailBlockEntry[]) => EmailBlockEntry[]) =>
    setDraft((d) => ({ ...d, blocks: updater(d.blocks) }));
  const addKeyBlock = (k: string) => { if (k) setBlocks((cur) => (cur.includes(k) ? cur : [...cur, k])); };
  const addText  = () => setBlocks((cur) => [...cur, { text: "" }]);
  const addHtml  = () => setBlocks((cur) => [...cur, { html: "" }]);
  const setText  = (i: number, text: string) => setBlocks((cur) => cur.map((b, idx) => (idx === i ? { text } : b)));
  const setHtml  = (i: number, html: string) => setBlocks((cur) => cur.map((b, idx) => (idx === i ? { html } : b)));
  const removeBlock = (i: number) => setBlocks((cur) => cur.filter((_, idx) => idx !== i));
  const moveBlock = (i: number, dir: -1 | 1) => setBlocks((cur) => {
    const j = i + dir;
    if (j < 0 || j >= cur.length) return cur;
    const next = [...cur];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  function toContent(): EmailVariantContent {
    return {
      subject:   draft.subject.trim()   || undefined,
      preheader: draft.preheader.trim() || undefined,
      ...(draft.blocks.length > 0 ? { blocks: draft.blocks } : {}),
    };
  }

  function save() {
    const variantKey = draft.variantKey.trim();
    if (!variantKey) { setError("Variant key is required."); return; }
    setError(null);
    const entry: EmailVariantEntry = { variantKey, label: draft.label.trim() || undefined, content: toContent() };
    start(async () => {
      const res: Result = await saveEmailVariantAction(tenantId, template.key, entry);
      if (!res.ok) { setError(res.error); return; }
      setVariants((prev) => [...prev.filter((v) => v.variantKey !== variantKey), entry]);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      reset();
    });
  }

  function remove(variantKey: string) {
    if (!confirm(`Delete variant "${variantKey}"?`)) return;
    start(async () => {
      const res: Result = await deleteEmailVariantAction(tenantId, template.key, variantKey);
      if (!res.ok) { setError(res.error); return; }
      setVariants((prev) => prev.filter((v) => v.variantKey !== variantKey));
      if (editingKey === variantKey) reset();
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-neutral-900">{template.label}</span>
          <span className="ml-2 font-mono text-[11px] text-neutral-400">email:{template.key}</span>
        </div>
        {!showAdd && (
          <button type="button" onClick={() => { reset(); setShowAdd(true); }} disabled={isPending}
            className="text-xs font-medium text-indigo-600 hover:underline">Add variant</button>
        )}
      </div>

      {/* Existing variants */}
      {variants.length > 0 && (
        <ul className="mt-2 divide-y divide-neutral-100">
          {variants.map((v) => (
            <li key={v.variantKey} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="font-mono text-xs text-neutral-900">{v.variantKey}</span>
                {v.label && <span className="ml-2 text-xs text-neutral-500">{v.label}</span>}
                {v.content.subject && (
                  <span className="ml-2 truncate text-[11px] text-neutral-400">{v.content.subject}</span>
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
      {showAdd && (
        <div className="mt-3 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
          <div className="text-xs font-semibold text-neutral-700">
            {editingKey ? `Edit variant "${editingKey}"` : "Add a variant"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Variant key">
              <input className={input} value={draft.variantKey}
                onChange={(e) => setDraft({ ...draft, variantKey: e.target.value })}
                placeholder="e.g. contact_high_intent" disabled={!!editingKey} />
            </Field>
            <Field label="Label (optional)">
              <input className={input} value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="High intent" />
            </Field>
          </div>
          <Field label="Subject">
            <input className={input} value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder={template.defaultSubject} />
          </Field>
          <Field label="Preview text">
            <input className={input} value={draft.preheader}
              onChange={(e) => setDraft({ ...draft, preheader: e.target.value })}
              placeholder="Inbox preview text" />
          </Field>
          <Field label="Blocks (in order)">
            {draft.blocks.length === 0 && (
              <p className="text-[11px] text-neutral-400">
                Leave empty to use the template default ({template.defaultBlocks.join(", ") || "none"}).
              </p>
            )}
            <ul className="space-y-1.5">
              {draft.blocks.map((b, i) => (
                <li key={i} className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{i + 1}.</span>
                    <span className="flex-1 text-sm text-neutral-700">
                      {typeof b === "string"
                        ? <span className="capitalize">{b}</span>
                        : <span className="text-indigo-700">{isHtml(b) ? "HTML" : "Text"}</span>}
                    </span>
                    <button type="button" className={btnGhost} disabled={i === 0} onClick={() => moveBlock(i, -1)}>↑</button>
                    <button type="button" className={btnGhost} disabled={i === draft.blocks.length - 1} onClick={() => moveBlock(i, 1)}>↓</button>
                    <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeBlock(i)}>Remove</button>
                  </div>
                  {isText(b) && (
                    <textarea className={`${input} mt-2`} rows={3} value={b.text}
                      onChange={(e) => setText(i, e.target.value)}
                      placeholder="Type your own copy here. Supports {name} and {company}." />
                  )}
                  {isHtml(b) && (
                    <div className="mt-2"><HtmlBlockEditor value={b.html} onChange={(h) => setHtml(i, h)} /></div>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {blockKeys.filter((k) => !draft.blocks.includes(k)).length > 0 && (
                <select
                  className={`${input} max-w-[200px]`}
                  value=""
                  onChange={(e) => { addKeyBlock(e.target.value); e.currentTarget.value = ""; }}
                >
                  <option value="">Add adaptive block</option>
                  {blockKeys.filter((k) => !draft.blocks.includes(k)).map((k) => (
                    <option key={k} value={k} className="capitalize">{k}</option>
                  ))}
                </select>
              )}
              <button type="button" className={btnGhost} onClick={addText}>Add text</button>
              <button type="button" className={btnGhost} onClick={addHtml}>Add HTML</button>
            </div>
          </Field>

          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={isPending}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
              {isPending ? "Saving" : editingKey ? "Save variant" : "Add variant"}
            </button>
            <button type="button" onClick={reset} disabled={isPending} className="text-sm text-neutral-500 hover:text-neutral-800">Cancel</button>
            {saved && <span className="text-sm text-green-600">Saved</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
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
