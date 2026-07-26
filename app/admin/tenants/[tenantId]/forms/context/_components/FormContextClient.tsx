"use client";

import { useMemo, useState, useTransition } from "react";
import { saveFormContextAction } from "../actions";
import type { FormContextRule, FormOverlay, TenantFormContext } from "@/forms/context/types";
import type { FormField } from "@/forms";

const card  = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";
const label = "block text-xs font-semibold text-neutral-600 mb-1";
const input = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
const btn   = "inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50";

type FormInfo = { key: string; title: string; description?: string; fields: readonly FormField[] };

/** Parse the fields JSON draft, falling back to the base fields on empty/invalid. */
function parseFieldsSafe(json: string, base: readonly FormField[]): { fields: readonly FormField[]; invalid: boolean } {
  if (!json.trim()) return { fields: base, invalid: false };
  try {
    const p = JSON.parse(json);
    if (Array.isArray(p)) return { fields: p as FormField[], invalid: false };
    return { fields: base, invalid: true };
  } catch {
    return { fields: base, invalid: true };
  }
}

/** Editor-local overlay state (fields kept as JSON text while editing). */
interface OverlayDraft {
  title:          string;
  intro:          string;
  submitLabel:    string;
  successMessage: string;
  redirectPath:   string;
  fieldsJson:     string;
}

function emptyDraft(): OverlayDraft {
  return { title: "", intro: "", submitLabel: "", successMessage: "", redirectPath: "", fieldsJson: "" };
}

function genId(): string {
  try { return crypto.randomUUID(); } catch { return `r_${Date.now()}_${Math.round(Math.random() * 1e6)}`; }
}

export function FormContextClient({ tenantId, initial, forms }:
  { tenantId: string; initial: TenantFormContext; forms: FormInfo[] }) {
  const [rules, setRules] = useState<FormContextRule[]>(() => [...(initial.rules ?? [])]);

  // overlays[formKey][segment] = OverlayDraft
  const [overlays, setOverlays] = useState<Record<string, Record<string, OverlayDraft>>>(() => {
    const out: Record<string, Record<string, OverlayDraft>> = {};
    for (const [fk, bySeg] of Object.entries(initial.overlays ?? {})) {
      out[fk] = {};
      for (const [seg, ov] of Object.entries(bySeg ?? {})) {
        out[fk][seg] = {
          title:          ov.title ?? "",
          intro:          ov.intro ?? "",
          submitLabel:    ov.submitLabel ?? "",
          successMessage: ov.successMessage ?? "",
          redirectPath:   ov.redirectPath ?? "",
          fieldsJson:     ov.fields && ov.fields.length > 0 ? JSON.stringify(ov.fields, null, 2) : "",
        };
      }
    }
    return out;
  });

  const [saving, start] = useTransition();
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  const segments = useMemo(
    () => [...new Set(rules.map((r) => r.segment).filter(Boolean))],
    [rules],
  );

  // ── Rule editing ───────────────────────────────────────────────────────────
  const addRule = () => setRules((rs) => [...rs, {
    id: genId(), label: "New rule", segment: "", priority: (rs.length + 1) * 10, enabled: true, conditions: {},
  }]);
  const updateRule = (id: string, patch: Partial<FormContextRule>) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updateCond = (id: string, patch: Partial<FormContextRule["conditions"]>) =>
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, conditions: { ...r.conditions, ...patch } } : r)));
  const removeRule = (id: string) => setRules((rs) => rs.filter((r) => r.id !== id));

  // ── Overlay editing ────────────────────────────────────────────────────────
  const getDraft = (fk: string, seg: string): OverlayDraft => overlays[fk]?.[seg] ?? emptyDraft();
  const setDraft = (fk: string, seg: string, patch: Partial<OverlayDraft>) =>
    setOverlays((o) => ({ ...o, [fk]: { ...(o[fk] ?? {}), [seg]: { ...getDraft(fk, seg), ...patch } } }));

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = () => {
    setMsg(null);
    // Build overlays payload, parsing fields JSON.
    const payload: Record<string, Record<string, FormOverlay>> = {};
    for (const [fk, bySeg] of Object.entries(overlays)) {
      for (const [seg, d] of Object.entries(bySeg)) {
        const ov: {
          title?: string; intro?: string; submitLabel?: string;
          successMessage?: string; redirectPath?: string; fields?: readonly FormField[];
        } = {};
        if (d.title.trim())          ov.title = d.title.trim();
        if (d.intro.trim())          ov.intro = d.intro.trim();
        if (d.submitLabel.trim())    ov.submitLabel = d.submitLabel.trim();
        if (d.successMessage.trim()) ov.successMessage = d.successMessage.trim();
        if (d.redirectPath.trim())   ov.redirectPath = d.redirectPath.trim();
        if (d.fieldsJson.trim()) {
          try {
            const parsed = JSON.parse(d.fieldsJson);
            ov.fields = parsed;
          } catch {
            setMsg({ ok: false, text: `Fields JSON for "${fk}" / "${seg}" is not valid JSON.` });
            return;
          }
        }
        if (Object.keys(ov).length > 0) {
          payload[fk] ??= {};
          payload[fk][seg] = ov;
        }
      }
    }
    start(async () => {
      const r = await saveFormContextAction(tenantId, { rules, overlays: payload });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Rules ──────────────────────────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Rules → segment</h3>
            <p className="mt-0.5 text-sm text-neutral-500">
              First matching rule (by priority, low first) decides the visitor&apos;s segment. Leave all conditions blank for a catch-all.
            </p>
          </div>
          <button className={btnGhost} onClick={addRule}>+ Add rule</button>
        </div>

        {rules.length === 0 && <p className="mt-4 text-sm text-neutral-400">No rules yet — every visitor sees the base form.</p>}

        <div className="mt-4 space-y-4">
          {rules.map((r) => (
            <div key={r.id} className="rounded-lg border border-neutral-200 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className={label}>Label</label>
                  <input className={input} value={r.label} onChange={(e) => updateRule(r.id, { label: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Segment id</label>
                  <input className={input} value={r.segment} placeholder="e.g. paid-google"
                    onChange={(e) => updateRule(r.id, { segment: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Priority</label>
                  <input type="number" className={input} value={r.priority}
                    onChange={(e) => updateRule(r.id, { priority: Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-3">
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={r.enabled !== false} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} /> Enabled
                  </label>
                  <button className="ml-auto text-xs text-red-600 hover:underline" onClick={() => removeRule(r.id)}>Remove</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Cond label="Path starts with" v={r.conditions.pathStartsWith} on={(v) => updateCond(r.id, { pathStartsWith: v })} placeholder="/pricing" />
                <Cond label="Path exact" v={r.conditions.pathExact} on={(v) => updateCond(r.id, { pathExact: v })} placeholder="/contact" />
                <Cond label="Country (ISO)" v={r.conditions.country} on={(v) => updateCond(r.id, { country: v })} placeholder="NL" />
                <Cond label="utm_source" v={r.conditions.utmSource} on={(v) => updateCond(r.id, { utmSource: v })} placeholder="google" />
                <Cond label="utm_medium" v={r.conditions.utmMedium} on={(v) => updateCond(r.id, { utmMedium: v })} placeholder="cpc" />
                <Cond label="utm_campaign" v={r.conditions.utmCampaign} on={(v) => updateCond(r.id, { utmCampaign: v })} placeholder="spring" />
                <Cond label="Query key" v={r.conditions.queryKey} on={(v) => updateCond(r.id, { queryKey: v })} placeholder="plan" />
                <Cond label="Query value" v={r.conditions.queryValue} on={(v) => updateCond(r.id, { queryValue: v })} placeholder="pro" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Overlays per form ──────────────────────────────────────────────── */}
      {forms.map((f) => (
        <div key={f.key} className={card}>
          <h3 className="text-base font-semibold text-neutral-900">Form: {f.title} <span className="text-neutral-400 text-sm">({f.key})</span></h3>
          {segments.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-400">Add a rule above to create a segment, then set per-segment overrides here.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {segments.map((seg) => {
                const d = getDraft(f.key, seg);
                return (
                  <details key={seg} className="rounded-lg border border-neutral-200">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-neutral-800">
                      Segment: {seg}
                    </summary>
                    <div className="space-y-3 border-t border-neutral-100 px-3 py-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div><label className={label}>Heading</label>
                          <input className={input} value={d.title} onChange={(e) => setDraft(f.key, seg, { title: e.target.value })} placeholder="(inherit base)" /></div>
                        <div><label className={label}>Submit label (CTA)</label>
                          <input className={input} value={d.submitLabel} onChange={(e) => setDraft(f.key, seg, { submitLabel: e.target.value })} placeholder="(inherit)" /></div>
                      </div>
                      <div><label className={label}>Intro / sub-text</label>
                        <input className={input} value={d.intro} onChange={(e) => setDraft(f.key, seg, { intro: e.target.value })} placeholder="(inherit base)" /></div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div><label className={label}>Thank-you message (inline)</label>
                          <input className={input} value={d.successMessage} onChange={(e) => setDraft(f.key, seg, { successMessage: e.target.value })} placeholder="(inherit)" /></div>
                        <div><label className={label}>Thank-you page (redirect path)</label>
                          <input className={input} value={d.redirectPath} onChange={(e) => setDraft(f.key, seg, { redirectPath: e.target.value })} placeholder="/thank-you-demo" />
                          <p className="mt-1 text-[11px] text-neutral-400">If set, the visitor is sent here after submit instead of the inline message. Must start with &quot;/&quot;.</p></div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <label className={label}>Fields (JSON) — leave empty to keep the base fields</label>
                          <button className="text-xs text-indigo-600 hover:underline"
                            onClick={() => setDraft(f.key, seg, { fieldsJson: JSON.stringify(f.fields, null, 2) })}>
                            Copy base fields
                          </button>
                        </div>
                        <textarea className={input + " font-mono text-xs"} rows={6} value={d.fieldsJson}
                          onChange={(e) => setDraft(f.key, seg, { fieldsJson: e.target.value })}
                          placeholder='[{"key":"email","type":"email","label":"Work email","validation":{"required":true,"email":true}}]' />
                      </div>

                      {(() => {
                        const parsed = parseFieldsSafe(d.fieldsJson, f.fields);
                        return (
                          <div>
                            {parsed.invalid && (
                              <p className="mb-1 text-xs text-red-600">Fields JSON is invalid — preview falls back to the base fields.</p>
                            )}
                            <FormPreview
                              title={d.title.trim() || f.title}
                              intro={d.intro.trim() || f.description}
                              submitLabel={d.submitLabel.trim() || "Submit"}
                              fields={parsed.fields}
                              thankYou={d.successMessage.trim() || undefined}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button className={btn} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save contextual forms"}</button>
        {msg && <span className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-600")}>{msg.text}</span>}
      </div>
    </div>
  );
}

function Cond({ label: l, v, on, placeholder }:
  { label: string; v: string | undefined; on: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={label}>{l}</label>
      <input className={input} value={v ?? ""} placeholder={placeholder} onChange={(e) => on(e.target.value)} />
    </div>
  );
}

// ── Live preview ────────────────────────────────────────────────────────────────

const previewInput = "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-400";

/** A non-interactive mock of what the visitor would see for this segment. */
function FormPreview({ title, intro, submitLabel, fields, thankYou }:
  { title?: string; intro?: string; submitLabel: string; fields: readonly FormField[]; thankYou?: string }) {
  const visible = fields.filter((f) => f.type !== "hidden");
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Preview</div>
      {title && <div className="text-lg font-semibold text-neutral-900">{title}</div>}
      {intro && <p className="mt-1 text-sm text-neutral-600">{intro}</p>}
      <div className="mt-3 space-y-3">
        {visible.length === 0 && <p className="text-xs text-neutral-400">No visible fields.</p>}
        {visible.map((f) => <PreviewField key={f.key} field={f} />)}
      </div>
      <button type="button" disabled className={btn + " mt-4 cursor-default opacity-90"}>{submitLabel}</button>
      {thankYou && (
        <p className="mt-3 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700">After submit: {thankYou}</p>
      )}
    </div>
  );
}

function PreviewField({ field }: { field: FormField }) {
  const req = field.validation?.required === true;
  const lbl = (
    <label className="mb-1 block text-xs font-medium text-neutral-700">
      {field.label}{req && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" disabled /> {field.label}{req && <span className="text-red-500">*</span>}
      </label>
    );
  }
  if (field.type === "textarea") {
    return <div>{lbl}<div className={previewInput + " h-16"}>{field.placeholder ?? ""}</div></div>;
  }
  if (field.type === "select") {
    return <div>{lbl}<div className={previewInput}>{field.placeholder ?? "Select an option"} ▾</div></div>;
  }
  return <div>{lbl}<div className={previewInput}>{field.placeholder ?? ""}</div></div>;
}
