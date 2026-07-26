"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setTenantPublisherRevshareAction,
  setTenantPublisherAccountAction,
  recordTenantPublisherPayoutAction,
  type PublishersOverview,
  type PublisherRow,
} from "../actions";

const euro = (c: number) => "€" + (Number(c) / 100).toFixed(2);
const when = (iso: string) => new Date(iso).toLocaleDateString();
const input = "w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";
const btn = "inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50";
const lbl = "block text-[11px] font-semibold text-neutral-500 mb-0.5";

export function TenantPublishersClient({ tenantId, initial }: { tenantId: string; initial: PublishersOverview }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const totalOutstanding = initial.publishers.reduce((t, p) => t + p.outstandingCents, 0);
  const totalEarned      = initial.publishers.reduce((t, p) => t + p.lifetimeEarnedCents, 0);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setErr(null);
    start(async () => { const r = await fn(); if (!r.ok) setErr(r.error); else router.refresh(); });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-sm text-neutral-500">
        Default revshare <span className="font-semibold text-neutral-700">{initial.defaultRevsharePct}%</span>
        {" · "}Lifetime earned {euro(totalEarned)} · Outstanding <span className="font-semibold text-neutral-700">{euro(totalOutstanding)}</span>
      </div>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      {initial.publishers.length === 0 ? (
        <p className="text-sm text-neutral-400">No publisher activity yet — rows appear once this advertiser&apos;s ads are served on a publisher site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3">Publisher</th>
                <th className="pr-3">Rev (30d)</th>
                <th className="pr-3">Revshare</th>
                <th className="pr-3">Earned</th>
                <th className="pr-3">Paid</th>
                <th className="pr-3">Outstanding</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initial.publishers.map((p) => (
                <PublisherRowView key={p.domain} tenantId={tenantId} row={p} defaultPct={initial.defaultRevsharePct}
                  pending={pending} run={run}
                  open={openId === p.domain} onToggle={() => setOpenId(openId === p.domain ? null : p.domain)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type RunFn = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;

function PublisherRowView({ tenantId, row, defaultPct, pending, run, open, onToggle }:
  { tenantId: string; row: PublisherRow; defaultPct: number; pending: boolean; run: RunFn; open: boolean; onToggle: () => void }) {
  const [rev, setRev]       = useState(row.overridePct?.toString() ?? "");
  const [name, setName]     = useState(row.name ?? "");
  const [email, setEmail]   = useState(row.contactEmail ?? "");
  const [vat, setVat]       = useState(row.vatNumber ?? "");
  const [coc, setCoc]       = useState(row.cocNumber ?? "");
  const [notes, setNotes]   = useState(row.payoutNotes ?? "");
  const [payAmt, setPayAmt] = useState((row.outstandingCents / 100).toFixed(2));
  const [payNote, setPayNote] = useState("");

  return (
    <>
      <tr className="border-b border-neutral-50">
        <td className="py-2 pr-3 font-medium">{row.name ? `${row.name} · ${row.domain}` : row.domain}</td>
        <td className="pr-3">{euro(row.revenue30dCents)}</td>
        <td className="pr-3">{row.revsharePct}%{row.overridePct == null && <span className="text-neutral-400"> (def)</span>}</td>
        <td className="pr-3">{euro(row.lifetimeEarnedCents)}</td>
        <td className="pr-3">{euro(row.paidCents)}</td>
        <td className="pr-3 font-semibold">{euro(row.outstandingCents)}</td>
        <td className="text-right">
          <button className={btnGhost} onClick={onToggle}>{open ? "Close" : "Manage"}</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-neutral-50/60 p-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Revshare */}
              <div>
                <div className="mb-1 text-xs font-semibold text-neutral-600">Revshare</div>
                <label className={lbl}>Override % (blank = default {defaultPct}%)</label>
                <div className="flex gap-2">
                  <input type="number" min={0} max={100} value={rev} placeholder={`${defaultPct}`}
                    onChange={(e) => setRev(e.target.value)} className={input + " max-w-[110px]"} />
                  <button className={btn} disabled={pending}
                    onClick={() => run(() => setTenantPublisherRevshareAction(tenantId, row.domain, rev.trim() === "" ? null : Math.min(100, Math.max(0, Number(rev)))))}>
                    Save
                  </button>
                </div>
              </div>

              {/* Contact / tax */}
              <div>
                <div className="mb-1 text-xs font-semibold text-neutral-600">Contact &amp; details</div>
                <div className="space-y-1.5">
                  <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className={input} placeholder="Contact email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <div className="flex gap-1.5">
                    <input className={input} placeholder="VAT" value={vat} onChange={(e) => setVat(e.target.value)} />
                    <input className={input} placeholder="CoC / KvK" value={coc} onChange={(e) => setCoc(e.target.value)} />
                  </div>
                  <input className={input} placeholder="Payout notes (IBAN, terms…)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <button className={btn} disabled={pending}
                    onClick={() => run(() => setTenantPublisherAccountAction(tenantId, row.domain, { name, contactEmail: email, vatNumber: vat, cocNumber: coc, payoutNotes: notes }))}>
                    Save details
                  </button>
                </div>
              </div>

              {/* Payout */}
              <div>
                <div className="mb-1 text-xs font-semibold text-neutral-600">Record payout</div>
                <p className="mb-1 text-[11px] text-neutral-400">Logs an offline/manual payment — no money is moved. Outstanding: {euro(row.outstandingCents)}.</p>
                <label className={lbl}>Amount (€)</label>
                <input className={input + " max-w-[140px]"} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
                <input className={input + " mt-1.5"} placeholder="Note (e.g. bank transfer May)" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                <button className={btn + " mt-1.5"} disabled={pending}
                  onClick={() => run(() => recordTenantPublisherPayoutAction(tenantId, row.domain, Math.round(Number(payAmt) * 100), payNote))}>
                  Record payout
                </button>
                {row.payouts.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
                    {row.payouts.slice(0, 6).map((po, i) => (
                      <li key={i}>{when(po.paidAt)} · {euro(po.amountCents)}{po.note ? ` · ${po.note}` : ""}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
