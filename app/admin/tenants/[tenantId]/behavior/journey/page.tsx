/**
 * Admin — Journey Intelligence
 *
 * Behavioral visualization layer for tenant admins.
 * Shows journey state, confidence, friction, and adaptive decisions for any
 * visitor session — designed for marketers and product owners, not developers.
 *
 * Route: /admin/tenants/[tenantId]/behavior/journey
 */

import { notFound }    from "next/navigation";
import { getTenantById } from "@/tenant/server";
import { fetchRecentJourneySessionsAction } from "./actions";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { JourneyInsightClient } from "./_components/JourneyInsightClient";

export const dynamic = "force-dynamic";

export default async function JourneyInsightPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const initialSessions = await fetchRecentJourneySessionsAction(tenantId, 20);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Behavior"
        title="Journey Intelligence"
        description="Understand how any visitor is being experienced and why: journey stage, confidence, friction, and which adaptive outputs are active. Built for strategy calls, demos, and optimization decisions."
      />

      <JourneyInsightClient
        tenantId={tenantId}
        initialSessions={initialSessions}
      />
    </div>
  );
}
