/**
 * Admin — Ads (advertiser tenant management)
 *
 * Route: /admin/tenants/[tenantId]/ads
 *
 * Turn a tenant into an advertiser, approve publisher domains, create/pause ads,
 * and see impression/click/spend stats. The serving + billing engine lives in
 * lib/ads; this is the management surface. See docs/design/ad-network-*.md.
 */

import { notFound }        from "next/navigation";
import { getTenantById }   from "@/tenant/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { fetchAdsOverviewAction } from "./actions";
import { AdsClient }       from "./_components/AdsClient";

export const dynamic = "force-dynamic";

export default async function AdsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const overview = await fetchAdsOverviewAction(tenantId);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="Ads"
        description="Run this tenant as an ad account: its siteKey is embedded by publisher sites and its adaptive slots are served as ads. Impressions and clicks are metered against the wallet."
      />
      <AdsClient tenantId={tenantId} initial={overview} />
    </div>
  );
}
