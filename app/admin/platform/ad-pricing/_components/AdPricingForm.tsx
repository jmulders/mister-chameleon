"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAdPricingAction, type AdPricing } from "../actions";

export function AdPricingForm({ initial }: { initial: AdPricing }) {
  const router = useRouter();
  const [cpm, setCpm] = useState(initial.cpmCents);
  const [cpc, setCpc] = useState(initial.cpcCents);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const euro = (c: number) => "€" + (Number(c) / 100).toFixed(2);

  const save = () => {
    setMsg(null);
    start(async () => {
      const res = await saveAdPricingAction({ cpmCents: cpm, cpcCents: cpc });
      if (res.ok) { setMsg({ ok: true, text: "Saved." }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  };

  const inputCls = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">CPM (cents / 1000 impressions)</label>
          <input type="number" min={0} value={cpm} onChange={(e) => setCpm(Math.max(0, Number(e.target.value)))} className={inputCls} />
          <p className="mt-1 text-xs text-neutral-400">{euro(cpm)} per 1000 impressions</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-600">CPC (cents / click)</label>
          <input type="number" min={0} value={cpc} onChange={(e) => setCpc(Math.max(0, Number(e.target.value)))} className={inputCls} />
          <p className="mt-1 text-xs text-neutral-400">{euro(cpc)} per click</p>
        </div>
      </div>
      {msg && <p className={"mt-3 text-sm " + (msg.ok ? "text-green-700" : "text-red-600")}>{msg.text}</p>}
      <button onClick={save} disabled={pending}
        className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {pending ? "Saving…" : "Save rate-card"}
      </button>
      {initial.updatedAt && (
        <p className="mt-2 text-xs text-neutral-400">Last updated {new Date(initial.updatedAt).toLocaleString()}</p>
      )}
    </div>
  );
}
