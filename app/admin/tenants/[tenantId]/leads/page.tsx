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
import { listAudienceSegmentsAction } from "@/app/admin/tenants/[tenantId]/audience-segments/actions";
import { LeadBaseClient }         from "./_components/LeadBaseClient";

export const dynamic = "force-dynamic";

export default async function LeadBasePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [initialProfiles, tenant, segmentsResult] = await Promise.all([
    listLeadProfilesAction(tenantId, {}),
    getTenantById(tenantId),
    listAudienceSegmentsAction(tenantId),
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
          ← ABM
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Lead Base</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every visitor is a lead at some identity level — anonymous, recognised
          (company), known (named), or customer. Filter, delete, and export.
          Pseudonymous + firmographic only; named-lead PII lives in ABM. Profiles
          are retained 90 days.
          {tenant ? "" : " (tenant not found)"}
        </p>
      </div>

      <LeadBaseClient tenantId={tenantId} initialProfiles={initialProfiles} segments={segments} />
    </div>
  );
}
