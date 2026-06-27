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
    <div className="p-8 max-w-4xl space-y-5">
      <div>
        <Link
          href={`/admin/tenants/${tenantId}/integrations`}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Tenant workspace
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">
          ABM — Personalized URLs
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Give a lead a link (e.g. <code className="font-mono text-xs">/go/ax93z</code> or a
          vanity path). The platform redirects them instantly to the target page and
          personalizes for their account. Import a Sales Navigator export to create links
          in bulk.
        </p>
      </div>

      <AbmClient tenantId={tenantId} initialLeads={leads} baseUrl={baseUrl} segments={segments} />
    </div>
  );
}
