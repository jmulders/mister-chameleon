"use client";

import { useState, useTransition } from "react";
import { generateVariantAction, saveGeneratedVariantAction } from "../actions";
import { isMetaComplete } from "@/ai/variant-meta";
import type { VariantBrief, GeneratedVariant, GeneratorSlot } from "@/ai/variant-generator";
import type { IntentLevel, FunnelStage, VariantTone } from "@/ai/variant-meta";
import {
  resolveBlockTokenStyle,
  type BlockTokenSet,
} from "@/design-system/theme/block-token-set";

// Shared field styles — indigo focus ring to match the rest of the admin.
const INPUT   = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const LABEL   = "block text-xs font-medium text-neutral-600 mb-1";
const SECTION = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";
const HEADING = "mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500";
/** Placeholder label for an optional, not-yet-chosen select. */
const NONE_OPTION = "— none —";
/** Fallback for an empty readout value. */
const EMPTY = "—";

const SLOTS:   GeneratorSlot[] = ["hero", "proof", "cta"];
const INTENTS: IntentLevel[]   = ["awareness", "consideration", "decision"];
const STAGES:  FunnelStage[]   = ["awareness", "consideration", "decision", "retention"];
const TONES:   VariantTone[]   = ["educational", "inspiring", "direct", "persuasive", "credibility", "urgency"];

/** Serialize a resolved token-style object to an inline style string for the preview wrapper. */
function styleToString(style: React.CSSProperties): string {
  return Object.entries(style)
    .map(([k, v]) => {
      const prop = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${prop}:${String(v)}`;
    })
    .join(";");
}

export function GenerateClient({
  tenantId,
  blockTokenSets = [],
}: {
  tenantId: string;
  blockTokenSets?: readonly BlockTokenSet[];
}) {
  const [brief, setBrief] = useState<VariantBrief>({ slot: "hero", audience: "", renderMode: "content" });
  const [draft, setDraft] = useState<GeneratedVariant | null>(null);
  const [cap, setCap]     = useState<{ count: number; cap: number } | null>(null);
  const [keySuffix, setKeySuffix] = useState("");
  // One typed status channel so success (green) and failure (red) never look alike.
  const [status, setStatus] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start]  = useTransition();

  const setB = <K extends keyof VariantBrief>(k: K, v: VariantBrief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  function generate() {
    setStatus(null); setDraft(null);
    start(async () => {
      const res = await generateVariantAction(tenantId, brief);
      if (!res.ok) { setStatus({ kind: "error", text: res.error }); return; }
      setDraft(res.variant);
      setCap({ count: res.count, cap: res.cap });
    });
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const res = await saveGeneratedVariantAction(tenantId, brief.slot, keySuffix, draft.content, draft.decision);
      if (res.ok) {
        setStatus({ kind: "success", text: `Saved as ${res.key}.` });
        setDraft(null);
        setKeySuffix("");
      } else {
        setStatus({ kind: "error", text: res.error });
      }
    });
  }

  const ready = draft ? isMetaComplete(draft.decision) : false;
  const atCap = cap ? cap.count >= cap.cap : false;

  return (
    <div className="space-y-6">

      {/* Status — distinct success / error banner, never an ambiguous grey line. */}
      {status && (
        <div
          role="status"
          className={
            "rounded-lg border px-4 py-3 text-sm " +
            (status.kind === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          {status.text}
        </div>
      )}

      {/* ── Brief ───────────────────────────────────────────────────────── */}
      <section className={SECTION}>
        <h2 className={HEADING}>Brief</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Slot</label>
              <select className={INPUT} value={brief.slot} onChange={(e) => setB("slot", e.target.value as GeneratorSlot)}>
                {SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Tone <span className="text-neutral-400">(optional)</span></label>
              <select className={INPUT} value={brief.tone ?? ""} onChange={(e) => setB("tone", (e.target.value || undefined) as VariantTone | undefined)}>
                <option value="">{NONE_OPTION}</option>
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
              <label className={LABEL}>Intent level <span className="text-neutral-400">(optional)</span></label>
              <select className={INPUT} value={brief.intentLevel ?? ""} onChange={(e) => setB("intentLevel", (e.target.value || undefined) as IntentLevel | undefined)}>
                <option value="">{NONE_OPTION}</option>
                {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Funnel stage <span className="text-neutral-400">(optional)</span></label>
              <select className={INPUT} value={brief.funnelStage ?? ""} onChange={(e) => setB("funnelStage", (e.target.value || undefined) as FunnelStage | undefined)}>
                <option value="">{NONE_OPTION}</option>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Primary goal <span className="text-neutral-400">(optional)</span></label>
            <input className={INPUT} value={brief.primaryGoal ?? ""} onChange={(e) => setB("primaryGoal", e.target.value)} placeholder="Book a demo" />
          </div>

          <div>
            <label className={LABEL}>Brand voice / constraints <span className="text-neutral-400">(optional)</span></label>
            <textarea className={`${INPUT} resize-none`} rows={2} value={brief.brandNote ?? ""} onChange={(e) => setB("brandNote", e.target.value)} placeholder="Calm, expert, no hype. Avoid 'revolutionary'." />
          </div>

          {/* Render mode — content (default) vs styled block */}
          <div>
            <label className={LABEL}>Render mode</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className={
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors " +
                ((brief.renderMode ?? "content") === "content" ? "border-indigo-300 bg-indigo-50/50" : "border-neutral-200 hover:bg-neutral-50")
              }>
                <input type="radio" name="renderMode" className="mt-0.5" checked={(brief.renderMode ?? "content") === "content"} onChange={() => setB("renderMode", "content")} />
                <span>
                  <span className="font-medium text-neutral-800">Content</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">Swap text; inherits the host&apos;s styling.</span>
                </span>
              </label>
              <label className={
                "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors " +
                (brief.renderMode === "block" ? "border-indigo-300 bg-indigo-50/50" : "border-neutral-200 hover:bg-neutral-50")
              }>
                <input type="radio" name="renderMode" className="mt-0.5" checked={brief.renderMode === "block"} onChange={() => setB("renderMode", "block")} />
                <span>
                  <span className="font-medium text-neutral-800">Block</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">Styled block via design tokens.</span>
                </span>
              </label>
            </div>
          </div>

          {/* Token set (block mode only) — which brand tokens the block adopts */}
          {brief.renderMode === "block" && (
            <div>
              <label className={LABEL}>Token set <span className="text-neutral-400">(optional — defaults to tenant tokens)</span></label>
              <select
                className={INPUT}
                value={brief.tokenSet ?? ""}
                onChange={(e) => setB("tokenSet", e.target.value || undefined)}
              >
                <option value="">Tenant defaults</option>
                {blockTokenSets
                  .filter((s) => !s.slots?.length || s.slots.includes(brief.slot) || s.key === brief.tokenSet)
                  .map((s) => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-neutral-500">
                The AI styles the block with <code>var(--…)</code> design tokens only (no hardcoded
                colours/fonts), so it adopts the chosen set&apos;s brand when the snippet injects it.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={generate}
              disabled={pending || !brief.audience.trim()}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {pending ? "Generating…" : draft ? "Regenerate" : "Generate"}
            </button>
            {!brief.audience.trim() && (
              <span className="text-xs text-neutral-400">Describe the audience to generate.</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Draft ───────────────────────────────────────────────────────── */}
      {draft && (
        <section className={SECTION}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={HEADING + " mb-0"}>Draft</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className={ready ? "rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700" : "rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700"}>
                {ready ? "AI-ready" : "Incomplete metadata"}
              </span>
              {cap && (
                <span className={atCap ? "rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700" : "text-neutral-400"}>
                  {cap.count}/{cap.cap} {brief.slot} variants
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-neutral-50 p-4 text-sm space-y-1.5">
            <p className="font-semibold text-neutral-900">{draft.content.title}</p>
            <p className="text-neutral-600">{draft.content.subtitle}</p>
            {draft.content.ctas && draft.content.ctas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {draft.content.ctas.map((c, i) => (
                  <span key={i} className="inline-block rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs text-neutral-700">{c.label} → {c.href}</span>
                ))}
              </div>
            )}
          </div>

          {/* Block preview — render the AI block with the token-set vars scoped on a
              wrapper, exactly as the snippet injects it. Isolated in an iframe so the
              block's own <style> can't leak into the admin. */}
          {draft.content.renderMode === "block" && draft.content.blockHtml && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Block</span>
                <span className="text-xs text-neutral-500">
                  Preview with {draft.content.tokenSet ? `token set "${draft.content.tokenSet}"` : "tenant default tokens"} — what the snippet injects.
                </span>
              </div>
              <iframe
                title="Block preview"
                className="w-full rounded-lg border border-neutral-200 bg-white"
                style={{ height: 340 }}
                sandbox=""
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;font-family:var(--font-sans,system-ui,sans-serif)}</style></head><body><div style="${styleToString(
                  resolveBlockTokenStyle(
                    { ...(draft.content.tokenSet ? { tokenSet: draft.content.tokenSet } : {}), ...(draft.content.tokens ? { tokens: draft.content.tokens } : {}) },
                    blockTokenSets,
                  ) ?? {},
                )}">${draft.content.blockHtml}</div></body></html>`}
              />
            </div>
          )}

          {/* Decision metadata — aligned label/value grid with an em-dash fallback. */}
          <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="font-medium text-neutral-500">Label</dt>
            <dd className="text-neutral-700">{draft.decision.decisionLabel ?? EMPTY}</dd>
            <dt className="font-medium text-neutral-500">Audience</dt>
            <dd className="text-neutral-700">{draft.decision.intendedAudience ?? EMPTY}</dd>
            <dt className="font-medium text-neutral-500">Tone / intent</dt>
            <dd className="text-neutral-700">{draft.decision.tone ?? EMPTY} · {draft.decision.intentLevel ?? EMPTY}</dd>
            <dt className="font-medium text-neutral-500">Goal</dt>
            <dd className="text-neutral-700">{draft.decision.primaryGoal ?? EMPTY}</dd>
          </dl>

          <div className="mt-4 flex items-end gap-3 border-t border-neutral-100 pt-4">
            <div className="flex-1">
              <label className={LABEL}>Name this variant <span className="text-neutral-400">(key suffix)</span></label>
              <input className={INPUT} value={keySuffix} onChange={(e) => setKeySuffix(e.target.value)} placeholder="linkedin_cfo" />
            </div>
            <button
              onClick={save}
              disabled={pending || atCap}
              className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {pending ? "Saving…" : atCap ? "Cap reached" : "Save variant"}
            </button>
          </div>
          {atCap && <p className="mt-2 text-xs text-red-600">Slot at capacity. Archive or replace an existing variant before adding.</p>}
        </section>
      )}
    </div>
  );
}
