"use client";

import { useState, useTransition } from "react";
import { previewAdaptiveEmailAction, sendTestAdaptiveEmailAction, type EmailPreviewResult } from "../actions";

const card = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";
const label = "block text-xs font-semibold text-neutral-600 mb-1";
const input = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50";

export function EmailPreviewClient({ tenantId, templates }:
  { tenantId: string; templates: { key: string; label: string }[] }) {
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
              {res.knownLead ? "known lead" : "no match — default"}
            </span>
            {res.usedBlocks.length > 0 && (
              <span className="text-xs text-neutral-400">blocks: {res.usedBlocks.join(", ")}</span>
            )}
          </div>
          <iframe title="Email preview" srcDoc={res.html}
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
              Personalised for the recipient above, but delivered to this test inbox — no real lead is emailed.
            </p>
            {sendMsg && <p className={"mt-2 text-sm " + (sendMsg.ok ? "text-green-700" : "text-red-600")}>{sendMsg.text}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
