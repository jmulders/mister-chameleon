/**
 * Admin — Tenant Workspace › Leads › Personalization performance
 *
 * Does personalization actually convert better? Conversion rate (form submissions)
 * of personalized vs baseline visitors, and per audience segment. See
 * docs/lead-base-design.md.
 */

import Link from "next/link";
import { getPersonalizationPerformanceAction } from "../actions";
import { listAudienceSegmentsAction }          from "@/app/admin/tenants/[tenantId]/audience-segments/actions";
import { PersonalizationReport }               from "../_components/PersonalizationReport";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [perf, segmentsResult] = await Promise.all([
    getPersonalizationPerformanceAction(tenantId),
    listAudienceSegmentsAction(tenantId),
  ]);

  const segmentLabels: Record<string, string> = {};
  if (segmentsResult.ok) for (const s of segmentsResult.data) segmentLabels[s.key] = s.label;

  return (
    <div className="p-8 max-w-6xl space-y-5">
      <div>
        <Link href={`/admin/tenants/${tenantId}/leads`} className="text-xs text-neutral-500 hover:text-neutral-800">
          ← Leads
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-neutral-900">Personalization performance</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Does adaptive content convert? Conversion rate (form submissions) for personalized
          visitors (matched a segment) vs baseline, and per segment. A randomized holdout for
          true causal lift is a planned next step.
        </p>
      </div>

      <PersonalizationReport perf={perf} segmentLabels={segmentLabels} />
    </div>
  );
}
