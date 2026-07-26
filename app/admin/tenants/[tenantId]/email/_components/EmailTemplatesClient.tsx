"use client";

import { useState, useTransition } from "react";
import { saveEmailTemplatesAction, type EmailTemplatesOverview, type EmailTemplateInfo } from "../actions";

const card  = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";
const label = "block text-xs font-semibold text-neutral-600 mb-1";
const input = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
const btn   = "inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";

interface Draft { subject: string; blocks: string[] }

export function EmailTemplatesClient({ tenantId, overview }:
  { tenantId: string; overview: EmailTemplatesOverview }) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const out: Record<string, Draft> = {};
    for (const t of overview.templates) out[t.key] = { subject: t.subject, blocks: [...t.blocks] };
    return out;
  });
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (key: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const addBlock = (key: string, block: string) => {
    if (!block) return;
    const cur = drafts[key].blocks;
    if (cur.includes(block)) return;
    set(key, { blocks: [...cur, block] });
  };
  const removeBlock = (key: string, i: number) =>
    set(key, { blocks: drafts[key].blocks.filter((_, idx) => idx !== i) });
  const move = (key: string, i: number, dir: -1 | 1) => {
    const cur = [...drafts[key].blocks];
    const j = i + dir;
    if (j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    set(key, { blocks: cur });
  };
  const resetToDefault = (t: EmailTemplateInfo) =>
    set(t.key, { subject: t.defaultSubject, blocks: [...t.defaultBlocks] });

  const save = () => {
    setMsg(null);
    const templates: Record<string, Draft> = {};
    for (const [k, d] of Object.entries(drafts)) templates[k] = { subject: d.subject, blocks: d.blocks };
    start(async () => {
      const r = await saveEmailTemplatesAction(tenantId, { templates });
      setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  };

  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Templates</h3>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Set the subject line and which adaptive blocks each email uses (and in what order).
        The block content itself comes from Adaptive blocks — this only chooses composition.
        Use <code className="rounded bg-neutral-100 px-1 text-xs">{"{name}"}</code> and{" "}
        <code className="rounded bg-neutral-100 px-1 text-xs">{"{company}"}</code> in the subject.
      </p>

      <div className="mt-4 space-y-5">
        {overview.templates.map((t) => {
          const d = drafts[t.key];
          const available = overview.allowedBlocks.filter((b) => !d.blocks.includes(b));
          return (
            <div key={t.key} className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-800">{t.label} <span className="font-mono text-xs text-neutral-400">({t.key})</span></span>
                <button className="text-xs text-neutral-500 hover:underline" onClick={() => resetToDefault(t)}>Reset to default</button>
              </div>

              <label className={label}>Subject</label>
              <input className={input} value={d.subject} onChange={(e) => set(t.key, { subject: e.target.value })}
                placeholder={t.defaultSubject} />

              <label className={label + " mt-3"}>Blocks (in order)</label>
              {d.blocks.length === 0 && <p className="text-xs text-amber-700">No blocks — the email would be empty. Add at least one.</p>}
              <ul className="space-y-1.5">
                {d.blocks.map((b, i) => (
                  <li key={b + i} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5">
                    <span className="text-xs text-neutral-400">{i + 1}.</span>
                    <span className="flex-1 text-sm capitalize text-neutral-700">{b}</span>
                    <button className={btnGhost} disabled={i === 0} onClick={() => move(t.key, i, -1)}>↑</button>
                    <button className={btnGhost} disabled={i === d.blocks.length - 1} onClick={() => move(t.key, i, 1)}>↓</button>
                    <button className="text-xs text-red-600 hover:underline" onClick={() => removeBlock(t.key, i)}>Remove</button>
                  </li>
                ))}
              </ul>
              {available.length > 0 && (
                <div className="mt-2">
                  <select className={input + " max-w-[220px]"} value="" onChange={(e) => { addBlock(t.key, e.target.value); e.currentTarget.value = ""; }}>
                    <option value="">+ Add block…</option>
                    {available.map((b) => <option key={b} value={b} className="capitalize">{b}</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button className={btn} disabled={pending} onClick={save}>{pending ? "Saving…" : "Save templates"}</button>
        {msg && <span className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-600")}>{msg.text}</span>}
      </div>
    </div>
  );
}
