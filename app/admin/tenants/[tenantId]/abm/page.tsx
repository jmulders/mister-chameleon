/**
 * Admin — Tenant Workspace › ABM (Account-Based Marketing)
 *
 * Manage personalized-URL leads: create/edit/delete, import from Sales
 * Navigator, and copy the outreach link. Reachable at
 * /admin/tenants/[tenantId]/abm. See docs/abm-personalized-urls.md.
 */

import Link                  from "next/link";
import { getTenantById }     from "@/tenant/server";
import { listAbmLeadsAction } from "./actions";
import { listAudienceSegmentsAction } from "@/app/admin/tenants/[tenantId]/audience-segments/actions";
import { AdminPageHeader }   from "@/components/admin/AdminPageHeader";
import { AbmClient }         from "./_components/AbmClient";

export default async function AbmPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [leads, tenant, segmentsResult] = await Promise.all([
    listAbmLeadsAction(tenantId),
    getTenantById(tenantId),
    listAudienceSegmentsAction(tenantId),
  ]);

  // Only offer active segments in the lead form's dropdown.
  const segments = (segmentsResult.ok ? segmentsResult.data : [])
    .filter((s) => s.isActive)
    .map((s) => ({ key: s.key, label: s.label }));

  // Base for the outreach link. Falls back to a relative path when no primary
  // domain is configured yet.
  const baseUrl = tenant?.primaryDomain ? `https://${tenant.primaryDomain}` : "";

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <AdminPageHeader
        eyebrow="Audience"
        title="Target accounts"
        description="The accounts and contacts you proactively target (outbound). Give each one a personal link, for example /go/ax93z or a vanity path, and the visitor is taken straight to the right page while the site personalizes for their account. Import a CSV to create links in bulk. Visitors who actually arrive show up under Leads."
        actions={
          <Link
            href={`/admin/tenants/${tenantId}/abm/dashboard`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
          >
            Account dashboard
          </Link>
        }
      />

      <AbmClient tenantId={tenantId} initialLeads={leads} baseUrl={baseUrl} segments={segments} />
    </div>
  );
}
