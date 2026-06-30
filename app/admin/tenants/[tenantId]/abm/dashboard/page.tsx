/**
 * Admin — Tenant Workspace › Target accounts › Account dashboard
 *
 * Sales view: every target account (ABM lead) joined with its observed activity
 * from the Lead Base — who engaged, how hot, and CRM-sync status. See
 * docs/lead-base-design.md.
 */

import Link from "next/link";
import { getTenantById }          from "@/tenant/server";
import { listAbmDashboardAction } from "../actions";
import { AbmDashboard }           from "../_components/AbmDashboard";

export const dynamic = "force-dynamic";

export default async function AbmDashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [rows, tenant] = await Promise.all([
    listAbmDashboardAction(tenantId),
    getTenantById(tenantId),
  ]);
  const baseUrl = tenant?.primaryDomain ? `https://${tenant.primaryDomain}` : "";

  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div>
        <Link href={`/admin/tenants/${tenantId}/abm`} className="text-xs text-neutral-500 hover:text-neutral-800">
          ← Target accounts
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">ABM account dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your target accounts joined with their observed activity from the Lead Base — who
          engaged, how hot, and whether they&apos;re synced to your CRM. Hottest first.
        </p>
      </div>

      <AbmDashboard rows={rows} baseUrl={baseUrl} />
    </div>
  );
}
