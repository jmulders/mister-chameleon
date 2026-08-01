"use client";

import { useState, useTransition } from "react";
import {
  previewAdaptiveEmailAction, sendTestAdaptiveEmailAction, setFormSubmitTriggerAction,
  fetchBatchAudienceAction, sendBatchAction,
  type EmailPreviewResult, type BatchAudienceResult,
} from "../actions";
import type { BatchSendSummary } from "@/lib/email/send-adaptive-batch";

const card = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";
const label = "block text-xs font-semibold text-neutral-600 mb-1";
const input = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";

const btnGhost = "inline-flex items-center rounded-md border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";

function BatchCampaignCard({ tenantId, templates }:
  { tenantId: string; templates: { key: string; label: string }[] }) {
  const [tpl, setTpl]         = useState(templates[0]?.key ?? "");
  const [industry, setInd]    = useState("");
  const [size, setSize]       = useState("");
  const [aud, setAud]         = useState<BatchAudienceResult | null>(null);
  const [selected, setSel]    = useState<Set<string>>(new Set());
  const [err, setErr]         = useState<string | null>(null);
  const [loading, startLoad]  = useTransition();
  const [summary, setSummary] = useState<BatchSendSummary | null>(null);
  const [sending, startSend]  = useTransition();

  const load = () => {
    setErr(null); setSummary(null);
    startLoad(async () => {
      const r = await fetchBatchAudienceAction(tenantId, {
        industry: industry || undefined, companySize: size || undefined,
      });
      if (r.ok) {
        setAud(r.data);
        setSel(new Set(r.data.candidates.map((c) => c.leadId)));
      } else { setAud(null); setErr(r.error); }
    });
  };

  const toggle = (id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const send = () => {
    if (!aud) return;
    const n = selected.size;
    if (n === 0) { setErr("Select at least one recipient."); return; }
    if (!window.confirm(`Send "${templates.find((t) => t.key === tpl)?.label}" to ${n} recipient${n === 1 ? "" : "s"}? This delivers real email.`)) return;
    setErr(null);
    startSend(async () => {
      const r = await sendBatchAction(tenantId, { templateKey: tpl, leadIds: [...selected] });
      if (r.ok) setSummary(r.data);
      else setErr(r.error);
    });
  };

  return (
    <div className={card}>
      <h3 className="text-base font-semibold text-neutral-900">Batch campaign (ABM)</h3>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Send a template to your known leads at once. Each email is personalised per recipient;
        suppression and per-campaign de-dupe are always applied, so a re-run won&apos;t double-mail.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Template</label>
          <select className={input} value={tpl} onChange={(e) => setTpl(e.target.value)}>
            {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Industry</label>
          <select className={input} value={industry} onChange={(e) => setInd(e.target.value)}>
            <option value="">Any</option>
            {(aud?.industries ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Company size</label>
          <select className={input} value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">Any</option>
            {(aud?.companySizes ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <button className={btnGhost} disabled={loading} onClick={load}>
          {loading ? "Loading…" : aud ? "Refresh audience" : "Load audience"}
        </button>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {aud && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
            <span><strong className="text-neutral-900">{aud.candidates.length}</strong> mailable</span>
            <span className="text-neutral-400">·</span>
            <span>{aud.withEmail} of {aud.totalLeads} leads have an email</span>
            <span className="text-neutral-400">·</span>
            <span><strong className="text-neutral-900">{selected.size}</strong> selected</span>
          </div>

          {aud.candidates.length === 0 ? (
            <p className="rounded-md bg-neutral-50 px-3 py-6 text-center text-sm text-neutral-400">
              No mailable leads match these filters.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-neutral-50">
                  <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Industry</th>
                  </tr>
                </thead>
                <tbody>
                  {aud.candidates.map((c) => (
                    <tr key={c.leadId} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected.has(c.leadId)} onChange={() => toggle(c.leadId)} />
                      </td>
                      <td className="px-3 py-2 text-neutral-700">{c.email}</td>
                      <td className="px-3 py-2 text-neutral-500">{c.name ?? "—"}</td>
                      <td className="px-3 py-2 text-neutral-500">{c.company ?? "—"}</td>
                      <td className="px-3 py-2 text-neutral-500">{c.industry ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {aud.candidates.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <button className={btn} disabled={sending || selected.size === 0} onClick={send}>
                {sending ? "Sending…" : `Send campaign to ${selected.size}`}
              </button>
              <button className={btnGhost} disabled={sending}
                onClick={() => setSel(new Set(aud.candidates.map((c) => c.leadId)))}>
                Select all
              </button>
              <button className={btnGhost} disabled={sending} onClick={() => setSel(new Set())}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-medium text-neutral-900">Campaign sent.</p>
          <p className="mt-1 text-neutral-600">
            {summary.sent} sent · {summary.suppressed} suppressed · {summary.duplicate} skipped (dupe) · {summary.failed} failed
            <span className="text-neutral-400"> ({summary.total} total)</span>
          </p>
          {summary.failed > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-600">
              {summary.results.filter((r) => r.status === "failed").slice(0, 10)
                .map((r) => <li key={r.email}>{r.email}: {r.error ?? "failed"}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function EmailPreviewClient({ tenantId, templates, formSubmit }:
  { tenantId: string; templates: { key: string; label: string }[]; formSubmit: { enabled: boolean; templateKey: string } }) {
  const [email, setEmail]       = useState("");
  const [templateKey, setTpl]   = useState(templates[0]?.key ?? "");
  const [res, setRes]           = useState<EmailPreviewResult | null>(null);
  const [err, setErr]           = useState<string | null>(null);
  const [pending, start]        = useTransition();
  const [testTo, setTestTo]     = useState("");
  const [sendMsg, setSendMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, startSend]    = useTransition();

  const run = () => {
    setErr(null); setSendMsg(null);
    start(async () => {
      const r = await previewAdaptiveEmailAction(tenantId, { email, templateKey });
      if (r.ok) setRes(r.data);
      else { setRes(null); setErr(r.error); }
    });
  };

  const sendTest = () => {
    setSendMsg(null);
    startSend(async () => {
      const r = await sendTestAdaptiveEmailAction(tenantId, { email, templateKey, testTo });
      setSendMsg(r.ok ? { ok: true, text: `Sent to ${testTo}.` } : { ok: false, text: r.error });
    });
  };

  const [trigOn, setTrigOn]     = useState(formSubmit.enabled);
  const [trigTpl, setTrigTpl]   = useState(formSubmit.templateKey || (templates[0]?.key ?? ""));
  const [trigMsg, setTrigMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [trigSaving, startTrig] = useTransition();

  const saveTrigger = () => {
    setTrigMsg(null);
    startTrig(async () => {
      const r = await setFormSubmitTriggerAction(tenantId, { enabled: trigOn, templateKey: trigTpl });
      setTrigMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error });
    });
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={label}>Template</label>
            <select className={input} value={templateKey} onChange={(e) => setTpl(e.target.value)}>
              {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Recipient email</label>
            <div className="flex gap-2">
              <input className={input} type="email" placeholder="lead@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} />
              <button className={btn} disabled={pending || !email.trim()} onClick={run}>
                {pending ? "Rendering…" : "Preview"}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          If the email matches a known lead (captured via a form), its firmographics personalise the content;
          otherwise you see the default variant.
        </p>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </div>

      {res && (
        <div className={card}>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-neutral-900">Subject:</span>
            <span className="text-neutral-700">{res.subject}</span>
            <span className={"rounded px-1.5 py-0.5 text-xs " + (res.knownLead ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500")}>
              {res.knownLead ? "known lead" : "no match (default)"}
            </span>
            {res.usedBlocks.length > 0 && (
              <span className="text-xs text-neutral-400">blocks: {res.usedBlocks.join(", ")}</span>
            )}
          </div>
          <iframe title="Email preview" srcDoc={res.html} sandbox=""
            className="h-[600px] w-full rounded-md border border-neutral-200 bg-white" />

          <div className="mt-3 border-t border-neutral-100 pt-3">
            <label className={label}>Send this to a test address (real delivery via Resend/SMTP)</label>
            <div className="flex gap-2">
              <input className={input} type="email" placeholder="you@yourcompany.com" value={testTo}
                onChange={(e) => setTestTo(e.target.value)} />
              <button className={btn} disabled={sending || !testTo.trim()} onClick={sendTest}>
                {sending ? "Sending…" : "Send test"}
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Personalised for the recipient above, but delivered to this test inbox. No real lead is emailed.
            </p>
            {sendMsg && <p className={"mt-2 text-sm " + (sendMsg.ok ? "text-green-700" : "text-red-600")}>{sendMsg.text}</p>}
          </div>
        </div>
      )}

      <div className={card}>
        <h3 className="text-base font-semibold text-neutral-900">Send automatically on form submit</h3>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          When on, a form submitter is emailed the chosen template after their submission is captured
          (deduped per lead, a repeat submitter isn&apos;t re-mailed). Opt-in; off by default.
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={trigOn} onChange={(e) => setTrigOn(e.target.checked)} /> Enabled
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 sm:max-w-xs">
              <label className={label}>Template</label>
              <select className={input} value={trigTpl} onChange={(e) => setTrigTpl(e.target.value)} disabled={!trigOn}>
                {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <button className={btn} disabled={trigSaving} onClick={saveTrigger}>{trigSaving ? "Saving…" : "Save"}</button>
          </div>
        </div>
        {trigMsg && <p className={"mt-2 text-sm " + (trigMsg.ok ? "text-green-700" : "text-red-600")}>{trigMsg.text}</p>}
      </div>

      <BatchCampaignCard tenantId={tenantId} templates={templates} />
    </div>
  );
}
