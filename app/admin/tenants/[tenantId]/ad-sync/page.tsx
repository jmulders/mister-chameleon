/**
 * Admin — Tenant Workspace › Ad Sync (retargeting)
 *
 * Configure the ad-platform audience sync: define the Lead Base segment, connect
 * Google Ads / Meta / LinkedIn, and push audiences (daily + on demand). Reachable
 * at /admin/tenants/[tenantId]/ad-sync. See docs/lead-base-design.md.
 */

import { getAdSyncSettingsAction, listAdSyncRunsAction } from "./actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
    <div className="p-8 max-w-4xl space-y-6">
      <AdminPageHeader
        eyebrow="Audience"
        title="Retargeting"
        description="Push your leads (by lead level) into retargeting audiences on Google Ads, Meta and LinkedIn. Emails and phone numbers are SHA-256 hashed on our server before sending, so only hashes ever leave the platform. A daily job reconciles each audience, and you can also sync on demand."
      />

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
        <strong>AVG/GDPR:</strong> sharing lead identifiers with ad platforms is a
        separate processing activity that needs a lawful basis (consent or
        legitimate interest) and a processor agreement with each platform. Keep
        &ldquo;alleen leads met toestemming&rdquo; on unless your DPO has confirmed
        another basis.
      </p>

      <AdSyncClient tenantId={tenantId} initialSettings={settings} initialRuns={runs} />
    </div>
  );
}
