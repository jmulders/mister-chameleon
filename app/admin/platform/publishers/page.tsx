/**
 * Platform — Publishers (ad-network revenue share).
 *
 * Revenue generated per publisher domain and the share they earn. Set the
 * default share on Ad pricing; override per publisher here (super-admin).
 */

import { fetchPublishersOverviewAction } from "./actions";
import { PublishersClient } from "./_components/PublishersClient";

export const dynamic = "force-dynamic";

export default async function PublishersPage() {
  const overview = await fetchPublishersOverviewAction();

  return (
    <div className="p-8 max-w-4xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Platform</div>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Publishers</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        Sites that serve your advertisers&apos; ads and the revenue share they earn. Revenue is the ad spend
        generated on each publisher over the last {overview.windowDays} days (settled + pending); earnings =
        revenue × revshare. Set the default share on Ad pricing; override it per publisher here.
      </p>
      <div className="mt-6">
        <PublishersClient initial={overview} />
      </div>
    </div>
  );
}
