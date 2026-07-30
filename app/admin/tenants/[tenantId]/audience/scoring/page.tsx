/**
 * Admin — Scoring
 *
 * Tenant-scoped configuration for the visitor scoring system:
 *   - Scoring rules      (which events contribute what score)
 *   - Sequence patterns  (ordered behavioral journeys to detect)
 *   - Decay profiles     (how scores fade with time)
 *
 * All data is scoped to the active tenantId.
 */

import { notFound }  from "next/navigation";
import { getTenantById } from "@/tenant/server";
import {
  getScoringRulesAction,
  getSequencePatternsAction,
  getDecayProfilesAction,
  saveScoringRuleAction,
  deleteScoringRuleAction,
  saveSequencePatternAction,
  deleteSequencePatternAction,
  seedScoringRulesAction,
  seedSequencePatternsAction,
} from "./actions";
import { BehaviorAdminClient } from "./_components/BehaviorAdminClient";

export const dynamic = "force-dynamic";

export default async function BehaviorPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const tenant = await getTenantById(tenantId);
  if (!tenant) return notFound();

  const [scoringRules, sequencePatterns, decayProfiles] = await Promise.all([
    getScoringRulesAction(tenantId),
    getSequencePatternsAction(tenantId),
    getDecayProfilesAction(),
  ]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">Scoring</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Configure how visitor behavior is scored, what sequences signal intent,
          and how scores decay over time.
        </p>
      </div>

      <BehaviorAdminClient
        tenantId={tenantId}
        initialScoringRules={scoringRules}
        initialSequencePatterns={sequencePatterns}
        decayProfiles={decayProfiles}
        saveScoringRuleAction={saveScoringRuleAction.bind(null, tenantId)}
        deleteScoringRuleAction={deleteScoringRuleAction.bind(null, tenantId)}
        saveSequencePatternAction={saveSequencePatternAction.bind(null, tenantId)}
        deleteSequencePatternAction={deleteSequencePatternAction.bind(null, tenantId)}
        seedScoringRulesAction={seedScoringRulesAction.bind(null, tenantId)}
        seedSequencePatternsAction={seedSequencePatternsAction.bind(null, tenantId)}
        journeyHref={`/admin/tenants/${tenantId}/audience/journey`}
      />
    </div>
  );
}
