/**
 * Admin — Tenant Workspace › Ad Sync (retargeting)
 *
 * Configure the ad-platform audience sync: define the Lead Base segment, connect
 * Google Ads / Meta / LinkedIn, and push audiences (daily + on demand). Reachable
 * at /admin/tenants/[tenantId]/ad-sync. See docs/lead-base-design.md.
 */

import Link from "next/link";
import { getAdSyncSettingsAction, listAdSyncRunsAction } from "./actions";
import { AdSyncClient } from "./_components/AdSyncClient";

export default async function AdSyncPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [settings, runs] = await Promise.all([
    getAdSyncSettingsAction(tenantId),
    listAdSyncRunsAction(tenantId),
  ]);

  return (
    <div className="p-8 max-w-4xl space-y-5">
      <div>
        <Link
          href={`/admin/tenants/${tenantId}/integrations`}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Tenant workspace
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">
          Retargeting — ad-audience sync
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Push your leads (by lead level) into retargeting audiences on Google Ads,
          Meta and LinkedIn. Emails and phone numbers are SHA-256 hashed on our
          server before they are sent — only hashes leave the platform. A daily job
          reconciles each audience; you can also sync on demand.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>AVG/GDPR:</strong> sharing lead identifiers with ad platforms is a
          separate processing activity that needs a lawful basis (consent or
          legitimate interest) and a processor agreement with each platform. Keep
          &ldquo;alleen leads met toestemming&rdquo; on unless your DPO has confirmed
          another basis.
        </p>
      </div>

      <AdSyncClient tenantId={tenantId} initialSettings={settings} initialRuns={runs} />
    </div>
  );
}
