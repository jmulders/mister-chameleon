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
import { getAbmWebhookUrlAction, getAbmWebhookSecretAction, getAbmHubspotTokenAction } from "../abm/actions";
import { listAudienceSegmentsAction } from "@/app/admin/tenants/[tenantId]/audience-segments/actions";
import { LeadBaseClient }         from "./_components/LeadBaseClient";
import { LeadCrmSettings }        from "./_components/LeadCrmSettings";

export const dynamic = "force-dynamic";

export default async function LeadBasePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [initialProfiles, tenant, segmentsResult, webhookUrl, webhookSecret, hubspotToken] = await Promise.all([
    listLeadProfilesAction(tenantId, {}),
    getTenantById(tenantId),
    listAudienceSegmentsAction(tenantId),
    getAbmWebhookUrlAction(tenantId),
    getAbmWebhookSecretAction(tenantId),
    getAbmHubspotTokenAction(tenantId),
  ]);

  const segments = (segmentsResult.ok ? segmentsResult.data : [])
    .filter((s) => s.isActive)
    .map((s) => ({ key: s.key, label: s.label }));

  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div>
        <Link
          href={`/admin/tenants/${tenantId}/abm`}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Target accounts
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Leads</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every visitor who arrives, tracked at some identity level — anonymous,
          recognised (company), known (named), or customer. Filter, delete, and export.
          Pseudonymous + firmographic only; named-contact PII lives in Target accounts.
          Profiles are retained 90 days.
          {tenant ? "" : " (tenant not found)"}
        </p>
      </div>

      <LeadBaseClient tenantId={tenantId} initialProfiles={initialProfiles} segments={segments} />

      <div className="pt-2">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">CRM &amp; outbound integrations</h2>
        <LeadCrmSettings
          tenantId={tenantId}
          initialWebhookUrl={webhookUrl ?? ""}
          initialWebhookSecret={webhookSecret ?? ""}
          initialHubspotToken={hubspotToken ?? ""}
        />
      </div>
    </div>
  );
}
