/**
 * Advertiser billing view.
 *
 * Shown instead of the subscription/enrichment billing dashboard when a tenant
 * is an ad account (tenantRole = advertiser). Advertisers are metered per ad
 * impression/click against their prepaid wallet — not on a subscription — so
 * this surface shows only what applies: wallet balance, ad spend, and the recent
 * ledger. A "Full billing / top up" link falls through to the standard page
 * (?full=1) for the Stripe wallet top-up.
 */

import Link from "next/link";
import { AddFundsWidget } from "./AddFundsWidget";

interface LedgerRow {
  entry_type?:     string | null;
  reference_type?: string | null;
  amount?:         number | null;
  amount_cents?:   number | null;
  note?:           string | null;
  created_at?:     string | null;
}

function euros(cents: number | null | undefined): string {
  return "€" + (Number(cents ?? 0) / 100).toFixed(2);
}

export function AdvertiserBilling({
  tenantId, balanceCents, spendThisMonthCents, ledger, topup,
}: {
  tenantId: string;
  balanceCents: number;
  spendThisMonthCents: number;
  ledger: LedgerRow[];
  topup?: "success" | "already" | "cancelled" | null;
}) {
  const base = `/admin/tenants/${tenantId}`;
  const card = "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm";

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Platform · Advertiser</div>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">Billing</h1>
        <p className="mt-1 text-sm text-neutral-600 max-w-2xl">
          This is an ad account. Billing is metered <strong>per impression (CPM) or click (CPC)</strong>
          against a prepaid wallet. There is no subscription. Serving stops when the balance reaches zero.
        </p>
      </div>

      {topup === "success" && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          Payment received. Your ad budget has been topped up.
        </div>
      )}
      {topup === "already" && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm text-neutral-600">
          This top-up was already credited.
        </div>
      )}
      {topup === "cancelled" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Top-up cancelled. No charge was made.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={card}>
          <div className="text-xs font-semibold text-neutral-500">Wallet balance</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900">{euros(balanceCents)}</div>
          {balanceCents <= 0 && <div className="mt-1 text-xs text-amber-700">Empty. Ads won't serve until funded.</div>}
        </div>
        <div className={card}>
          <div className="text-xs font-semibold text-neutral-500">Ad spend (this month)</div>
          <div className="mt-1 text-2xl font-bold text-neutral-900">{euros(spendThisMonthCents)}</div>
        </div>
        <div className={card + " flex flex-col justify-center"}>
          <Link href={`${base}/ads`} className="inline-flex justify-center rounded-md border border-neutral-300 px-3.5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            View campaigns & stats
          </Link>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-base font-semibold text-neutral-900">Add funds</h3>
        <p className="mt-1 text-sm text-neutral-600">Top up your ad budget. You'll be redirected to a secure Stripe checkout.</p>
        <div className="mt-3">
          <AddFundsWidget tenantId={tenantId} />
        </div>
      </div>

      <div className={card}>
        <h3 className="text-base font-semibold text-neutral-900">Recent transactions</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b border-neutral-100">
                <th className="py-2 pr-3">Date</th><th className="pr-3">Type</th><th className="pr-3">Reference</th><th className="pr-3">Note</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && <tr><td colSpan={5} className="py-3 text-neutral-400">No transactions yet.</td></tr>}
              {ledger.map((r, i) => {
                const amt = Number(r.amount ?? r.amount_cents ?? 0);
                return (
                  <tr key={i} className="border-b border-neutral-50">
                    <td className="py-2 pr-3">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                    <td className="pr-3">{r.entry_type ?? "—"}</td>
                    <td className="pr-3">{r.reference_type ?? "—"}</td>
                    <td className="pr-3 text-neutral-500">{r.note ?? ""}</td>
                    <td className={amt < 0 ? "text-red-600" : "text-green-700"}>{euros(amt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Ad spend appears here as <code>ad_spend</code> debits after the daily billing rollup.
        </p>
      </div>
    </div>
  );
}
