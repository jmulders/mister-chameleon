/**
 * Admin — Tenant Workspace › Lead Base
 *
 * Unified view over every visitor/lead profile (anonymous → recognised → known →
 * customer): list, filter, single/bulk delete (erasure), and export. The
 * persisted output of the scoring/segment/enrichment engines; see
 * docs/lead-base-design.md.
 */

import Link                       from "next/link";
import { getTenantById }          from "@/tenant/server";
import { listLeadProfilesAction } from "./actions";
import { getAbmWebhookUrlAction, getAbmWebhookSecretAction, getAbmHubspotTokenAction, getAbmNotifySettingsAction } from "../accounts/actions";
import { listWebhookDeliveriesAction } from "./actions";
import { getCreditBalance } from "@/lib/billing/billing-store";
import { listAudienceSegmentsAction } from "@/app/admin/tenants/[tenantId]/audience-segments/actions";
import { AdminPageHeader }         from "@/components/admin/AdminPageHeader";
import { LeadBaseClient }         from "./_components/LeadBaseClient";
import { LeadCrmSettings }        from "./_components/LeadCrmSettings";

export const dynamic = "force-dynamic";

export default async function LeadBasePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [initialProfiles, tenant, segmentsResult, webhookUrl, webhookSecret, hubspotToken, deliveries, creditBalance, notify] = await Promise.all([
    listLeadProfilesAction(tenantId, {}),
    getTenantById(tenantId),
    listAudienceSegmentsAction(tenantId),
    getAbmWebhookUrlAction(tenantId),
    getAbmWebhookSecretAction(tenantId),
    getAbmHubspotTokenAction(tenantId),
    listWebhookDeliveriesAction(tenantId),
    getCreditBalance(tenantId).catch(() => 0),
    getAbmNotifySettingsAction(tenantId),
  ]);

  const segments = (segmentsResult.ok ? segmentsResult.data : [])
    .filter((s) => s.isActive)
    .map((s) => ({ key: s.key, label: s.label }));

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Audience"
        title="Leads"
        description="Every visitor who arrives, tracked at some identity level. The levels are anonymous, recognised (company), known (named person), or customer. Filter, delete, and export. Pseudonymous and firmographic data only; named-contact PII lives under Target accounts. Profiles are retained for 90 days."
        actions={
          <Link
            href={`/admin/tenants/${tenantId}/audience/leads/performance`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Personalization performance
          </Link>
        }
      />

      {creditBalance <= 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your wallet balance is <strong>€0</strong>. Lead recognitions still run, but the
          per-recognition credit isn&apos;t being billed.{" "}
          <Link href={`/admin/tenants/${tenantId}/billing`} className="font-medium underline">
            Fund the wallet
          </Link>{" "}
          to enable recognition billing.
        </div>
      )}

      <LeadBaseClient tenantId={tenantId} initialProfiles={initialProfiles} segments={segments} scoreConfig={tenant?.enrichment?.leadScoring} />

      <div className="pt-2">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">CRM &amp; outbound integrations</h2>
        <LeadCrmSettings
          tenantId={tenantId}
          initialWebhookUrl={webhookUrl ?? ""}
          initialWebhookSecret={webhookSecret ?? ""}
          initialHubspotToken={hubspotToken ?? ""}
          initialDeliveries={deliveries}
          initialNotify={notify}
        />
      </div>
    </div>
  );
}
