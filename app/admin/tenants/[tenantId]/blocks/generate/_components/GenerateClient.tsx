"use client";

import { useState, useTransition } from "react";
import { generateVariantAction, saveGeneratedVariantAction } from "../actions";
import { isMetaComplete } from "@/ai/variant-meta";
import type { VariantBrief, GeneratedVariant, GeneratorSlot } from "@/ai/variant-generator";
import type { IntentLevel, FunnelStage, VariantTone } from "@/ai/variant-meta";

const INPUT = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";
const LABEL = "block text-xs font-medium text-neutral-600 mb-1";

const SLOTS:   GeneratorSlot[] = ["hero", "proof", "cta"];
const INTENTS: IntentLevel[]   = ["awareness", "consideration", "decision"];
const STAGES:  FunnelStage[]   = ["awareness", "consideration", "decision", "retention"];
const TONES:   VariantTone[]   = ["educational", "inspiring", "direct", "persuasive", "credibility", "urgency"];

export function GenerateClient({ tenantId }: { tenantId: string }) {
  const [brief, setBrief] = useState<VariantBrief>({ slot: "hero", audience: "" });
  const [draft, setDraft] = useState<GeneratedVariant | null>(null);
  const [cap, setCap]     = useState<{ count: number; cap: number } | null>(null);
  const [keySuffix, setKeySuffix] = useState("");
  const [msg, setMsg]     = useState<string | null>(null);
  const [pending, start]  = useTransition();

  const setB = <K extends keyof VariantBrief>(k: K, v: VariantBrief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  function generate() {
    setMsg(null); setDraft(null);
    start(async () => {
      const res = await generateVariantAction(tenantId, brief);
      if (!res.ok) { setMsg(res.error); return; }
      setDraft(res.variant);
      setCap({ count: res.count, cap: res.cap });
    });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await saveGeneratedVariantAction(tenantId, brief.slot, keySuffix, draft.content, draft.decision);
      setMsg(res.ok ? `Saved as ${res.key}.` : res.error);
      if (res.ok) { setDraft(null); setKeySuffix(""); }
    });
  }

  const ready = draft ? isMetaComplete(draft.decision) : false;
  const atCap = cap ? cap.count >= cap.cap : false;

  return (
    <div className="space-y-6">
      {/* Brief */}
      <section className="rounded-lg border border-neutral-200 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Slot</label>
            <select className={INPUT} value={brief.slot} onChange={(e) => setB("slot", e.target.value as GeneratorSlot)}>
              {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Tone</label>
            <select className={INPUT} value={brief.tone ?? ""} onChange={(e) => setB("tone", (e.target.value || undefined) as VariantTone | undefined)}>
              <option value="">—</option>
              {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Audience</label>
          <input className={INPUT} value={brief.audience} onChange={(e) => setB("audience", e.target.value)} placeholder="First-time visitors from LinkedIn, logistics CFOs" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Intent level</label>
            <select className={INPUT} value={brief.intentLevel ?? ""} onChange={(e) => setB("intentLevel", (e.target.value || undefined) as IntentLevel | undefined)}>
              <option value="">—</option>
              {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Funnel stage</label>
            <select className={INPUT} value={brief.funnelStage ?? ""} onChange={(e) => setB("funnelStage", (e.target.value || undefined) as FunnelStage | undefined)}>
              <option value="">—</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Primary goal</label>
          <input className={INPUT} value={brief.primaryGoal ?? ""} onChange={(e) => setB("primaryGoal", e.target.value)} placeholder="Book a demo" />
        </div>
        <div>
          <label className={LABEL}>Brand voice / constraints <span className="text-neutral-400">(optional)</span></label>
          <textarea className={`${INPUT} resize-none`} rows={2} value={brief.brandNote ?? ""} onChange={(e) => setB("brandNote", e.target.value)} placeholder="Calm, expert, no hype. Avoid 'revolutionary'." />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={generate} disabled={pending || !brief.audience.trim()} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
            {pending ? "Generating…" : "Generate"}
          </button>
          {msg && <span className="text-xs text-neutral-500">{msg}</span>}
        </div>
      </section>

      {/* Draft */}
      {draft && (
        <section className="rounded-lg border border-neutral-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Draft</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className={ready ? "rounded bg-green-50 px-2 py-0.5 text-green-700" : "rounded bg-amber-50 px-2 py-0.5 text-amber-700"}>
                {ready ? "AI-ready" : "Incomplete metadata"}
              </span>
              {cap && (
                <span className={atCap ? "rounded bg-red-50 px-2 py-0.5 text-red-700" : "text-neutral-500"}>
                  {cap.count}/{cap.cap} {brief.slot} variants
                </span>
              )}
            </div>
          </div>

          <div className="rounded-md bg-neutral-50 p-3 text-sm space-y-1">
            <p className="font-semibold text-neutral-900">{draft.content.title}</p>
            <p className="text-neutral-600">{draft.content.subtitle}</p>
            {draft.content.ctas?.map((c, i) => (
              <span key={i} className="mr-2 inline-block rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-700">{c.label} → {c.href}</span>
            ))}
          </div>

          <div className="text-xs text-neutral-500 space-y-0.5">
            <p><span className="font-medium text-neutral-700">Label:</span> {draft.decision.decisionLabel ?? "—"}</p>
            <p><span className="font-medium text-neutral-700">Audience:</span> {draft.decision.intendedAudience ?? "—"}</p>
            <p><span className="font-medium text-neutral-700">Tone / intent:</span> {draft.decision.tone ?? "—"} · {draft.decision.intentLevel ?? "—"}</p>
            <p><span className="font-medium text-neutral-700">Goal:</span> {draft.decision.primaryGoal ?? "—"}</p>
          </div>

          <div className="flex items-end gap-3 pt-2 border-t border-neutral-100">
            <div className="flex-1">
              <label className={LABEL}>Name this variant (key suffix)</label>
              <input className={INPUT} value={keySuffix} onChange={(e) => setKeySuffix(e.target.value)} placeholder="linkedin_cfo" />
            </div>
            <button onClick={save} disabled={pending || atCap} className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
              {pending ? "Saving…" : atCap ? "Cap reached" : "Save variant"}
            </button>
            <button onClick={generate} disabled={pending} className="text-xs text-neutral-500 hover:text-neutral-800">Regenerate</button>
          </div>
          {atCap && <p className="text-xs text-red-600">Slot at capacity — archive or replace an existing variant before adding.</p>}
        </section>
      )}
    </div>
  );
}
