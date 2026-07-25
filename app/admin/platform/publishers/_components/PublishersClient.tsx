"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPublisherRevshareAction, type PublishersOverview, type PublisherRow } from "../actions";

const euro = (c: number) => "€" + (Number(c) / 100).toFixed(2);

export function PublishersClient({ initial }: { initial: PublishersOverview }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const totalRev  = initial.publishers.reduce((t, p) => t + p.revenueCents, 0);
  const totalEarn = initial.publishers.reduce((t, p) => t + p.earningsCents, 0);

  const save = (domain: string, pct: number | null) => {
    setErr(null);
    start(async () => {
      const r = await setPublisherRevshareAction(domain, pct);
      if (!r.ok) setErr(r.error); else router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 text-sm text-neutral-500">
        Default revshare: <span className="font-semibold text-neutral-700">{initial.defaultRevsharePct}%</span>
        {" · "}Revenue {euro(totalRev)} · Publisher earnings {euro(totalEarn)} (last {initial.windowDays}d)
      </div>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      {initial.publishers.length === 0 ? (
        <p className="text-sm text-neutral-400">No publisher activity yet — rows appear once ads are served on a publisher site.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3">Publisher</th>
                <th className="pr-3">Impr.</th>
                <th className="pr-3">Clicks</th>
                <th className="pr-3">Revenue</th>
                <th className="pr-3">Revshare</th>
                <th className="pr-3">Earnings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {initial.publishers.map((p) => (
                <PublisherRowView key={p.domain} row={p} defaultPct={initial.defaultRevsharePct}
                  canEdit={initial.isSuperAdmin} pending={pending} onSave={save} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PublisherRowView({ row, defaultPct, canEdit, pending, onSave }:
  { row: PublisherRow; defaultPct: number; canEdit: boolean; pending: boolean; onSave: (domain: string, pct: number | null) => void }) {
  const [val, setVal] = useState(row.overridePct?.toString() ?? "");
  return (
    <tr className="border-b border-neutral-50">
      <td className="py-2 pr-3 font-medium">{row.domain}</td>
      <td className="pr-3">{row.impressions.toLocaleString()}</td>
      <td className="pr-3">{row.clicks.toLocaleString()}</td>
      <td className="pr-3">{euro(row.revenueCents)}</td>
      <td className="pr-3">
        {canEdit ? (
          <div className="flex items-center gap-1">
            <input type="number" min={0} max={100} value={val} placeholder={`${defaultPct}`}
              onChange={(e) => setVal(e.target.value)}
              className="w-16 rounded border border-neutral-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none" />
            <span className="text-xs text-neutral-400">%</span>
          </div>
        ) : (
          <span>{row.revsharePct}%{row.overridePct == null && <span className="text-neutral-400"> (default)</span>}</span>
        )}
      </td>
      <td className="pr-3">{euro(row.earningsCents)}</td>
      <td className="text-right">
        {canEdit && (
          <button disabled={pending}
            onClick={() => onSave(row.domain, val.trim() === "" ? null : Math.min(100, Math.max(0, Number(val))))}
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50">
            Save
          </button>
        )}
      </td>
    </tr>
  );
}
