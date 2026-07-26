/**
 * Platform — Ad pricing (advertiser rate-card).
 *
 * Platform-wide default CPM / CPC that advertiser tenants are offered when
 * creating an ad. Advertisers can still override per ad.
 */

import { getAdPricingAction } from "./actions";
import { AdPricingForm } from "./_components/AdPricingForm";

export const dynamic = "force-dynamic";

export default async function AdPricingPage() {
  const res = await getAdPricingAction();
  const initial = res.ok ? res.data : { cpmCents: 500, cpcCents: 20, revsharePct: 0, updatedAt: null };

  return (
    <div className="p-8 max-w-2xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Platform</div>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Ad pricing</h1>
      <p className="mt-1 text-sm text-neutral-600 max-w-xl">
        The platform rate-card. New ads created by advertiser tenants default to these CPM / CPC rates
        (advertisers can still override the rate on an individual ad). Behavioural / geo targeting fees
        are separate and fixed in code.
      </p>
      {!res.ok && <p className="mt-3 text-sm text-red-600">{res.error}</p>}
      <div className="mt-6">
        <AdPricingForm initial={initial} />
      </div>
    </div>
  );
}
