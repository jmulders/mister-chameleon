"use client";

import { useState, useTransition } from "react";
import { createAdTopUpCheckoutAction } from "../../ads/actions";

const PRESETS = [2500, 5000, 10000, 25000]; // cents

/**
 * Advertiser wallet top-up. 1:1 — you pay X euros, you get X euros of ad budget.
 * Redirects to a one-off Stripe checkout; the return credits the wallet.
 */
export function AddFundsWidget({ tenantId }: { tenantId: string }) {
  const [amount, setAmount]   = useState(5000);
  const [err, setErr]         = useState<string | null>(null);
  const [pending, start]      = useTransition();

  const go = () => {
    setErr(null);
    start(async () => {
      const res = await createAdTopUpCheckoutAction(tenantId, amount);
      if (!res.ok) { setErr(res.error); return; }
      window.location.href = res.url;
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setAmount(c)}
            className={
              "rounded-md border px-3 py-1.5 text-sm " +
              (amount === c
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-neutral-300 text-neutral-700 hover:bg-neutral-50")
            }
          >
            €{(c / 100).toFixed(0)}
          </button>
        ))}
        <span className="mx-1 text-neutral-300">|</span>
        <span className="text-sm text-neutral-500">€</span>
        <input
          type="number"
          min={5}
          value={Math.round(amount / 100)}
          onChange={(e) => setAmount(Math.max(500, Math.round(Number(e.target.value) * 100)))}
          className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        onClick={go}
        disabled={pending}
        className="mt-3 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {pending ? "Redirecting…" : `Add €${(amount / 100).toFixed(0)} to wallet`}
      </button>
      <p className="mt-2 text-xs text-neutral-400">
        1:1, you pay this exact amount and it becomes ad budget (1 credit = €0.01). No subscription.
      </p>
    </div>
  );
}
