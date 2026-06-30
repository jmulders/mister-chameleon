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
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <a
            href={`/admin/tenants/${tenantId}/behavior`}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Scoring
          </a>
          <span className="text-neutral-300">/</span>
          <span className="text-sm text-neutral-500">Journey Intelligence</span>
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">Journey Intelligence</h1>
        <p className="mt-1 text-sm text-neutral-500 max-w-xl">
          Understand how any visitor is being experienced and why — journey stage,
          confidence, friction, and which adaptive outputs are active.
          Designed for strategy calls, demos, and optimization decisions.
        </p>
      </div>

      <JourneyInsightClient
        tenantId={tenantId}
        initialSessions={initialSessions}
      />
    </div>
  );
}
