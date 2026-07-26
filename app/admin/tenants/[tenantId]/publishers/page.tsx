/**
 * Advertiser — Publishers (per-advertiser revenue share).
 *
 * The sites this advertiser's ads run on, the revshare they earn, and a manual
 * payout ledger — all scoped to this advertiser. Auth via the tenant workspace.
 */

export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { fetchTenantPublishersOverviewAction } from "./actions";
import { TenantPublishersClient } from "./_components/TenantPublishersClient";

export const dynamic = "force-dynamic";

export default async function TenantPublishersPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const overview = await fetchTenantPublishersOverviewAction(tenantId);

  return (
    <div className="p-8 max-w-4xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Advertiser</div>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Publishers</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Sites this advertiser&apos;s ads run on and the revenue share they earn. Revenue is this advertiser&apos;s
        ad spend on each publisher over the last {overview.windowDays} days (settled + pending); earnings =
        revenue × revshare. The default share comes from platform Ad pricing; override it per publisher here.
      </p>
      <div className="mt-6">
        <TenantPublishersClient tenantId={tenantId} initial={overview} />
      </div>
    </div>
  );
}
