/**
 * Admin — Tenant Personalization Stats
 *
 * Diagnostic panels for a tenant's personalization, split out of the Rules
 * editor page so the editor stays focused on authoring. Read-only:
 *
 *   - Variant usage vs the tenant's content budget
 *   - Slot assignment matrix (which rule drives which slot)
 *   - Score distribution across real sessions (is the INPUT discriminative?)
 *   - Rule-fire counts (do the rules actually fire?)
 *
 * All data is loaded server-side; the panels are the same components the Rules
 * page used to render inline.
 */

import { notFound }        from "next/navigation";
import { getTenantById }   from "@/tenant/server";
import { normalizeTenant } from "@/tenant/normalize";
import { getTenantRulesAction }       from "../actions";
import { VariantUsagePanel }          from "../_components/VariantUsagePanel";
import { RulesMatrix }                from "../_components/RulesMatrix";
import { ScoreDistributionPanel }     from "../_components/ScoreDistributionPanel";
import { RuleFireStatsPanel }         from "../_components/RuleFireStatsPanel";
import { fetchVariantCatalogue }      from "@/decision/rules/fetch-variant-catalogue";
import { computeVariantUsage, resolveContentBudget } from "@/decision/rules/variant-usage";
import { getScoreDistribution }       from "@/lib/lead-base/score-distribution";
import { getRuleFireStats }           from "@/lib/observability/rule-fire-store";
import { getPlatformContentBudgetSettings } from "@/platform/platform-store";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantPersonalizationStatsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  const [result, variantCatalogue, budgetResult, scoreDistribution, ruleFireStats] =
    await Promise.all([
      getTenantRulesAction(tenantId),
      fetchVariantCatalogue(tenantId),
      getPlatformContentBudgetSettings(),
      getScoreDistribution(tenantId),
      getRuleFireStats(tenantId),
    ]);

  if (!result.ok) {
    return (
      <div className="p-8">
        <PageHeader tenant={tenant} />
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error loading stats:</strong> {result.error}
        </div>
      </div>
    );
  }

  const usage  = computeVariantUsage(result.config, variantCatalogue);
  const budget = resolveContentBudget(budgetResult.ok ? (budgetResult.data ?? {}) : {});

  return (
    <div className="p-8">
      <PageHeader tenant={tenant} />

      {/* ── Variant usage vs content budget ───────────────────────────────── */}
      <div className="mt-6">
        <VariantUsagePanel usage={usage} budget={budget} />
      </div>

      {/* ── Slot assignment matrix ────────────────────────────────────────── */}
      <div className="mt-8">
        <RulesMatrix config={result.config} />
      </div>

      {/* ── Score distribution over real sessions ─────────────────────────── */}
      <div className="mt-8">
        <ScoreDistributionPanel distribution={scoreDistribution} />
      </div>

      {/* ── Rule-fire counts — do the rules actually fire? ────────────────── */}
      <div className="mt-8">
        <RuleFireStatsPanel
          rules={result.config.rules.map((r) => ({ id: r.id, label: r.label }))}
          stats={ruleFireStats}
        />
      </div>
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────────

function PageHeader({
  tenant,
}: {
  tenant: { tenantId: string; name?: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-xl font-semibold text-neutral-900">Personalization stats</h1>
      <p className="text-sm text-neutral-500">
        Diagnostics for{" "}
        <span className="font-medium text-neutral-700">
          {tenant.name ?? tenant.tenantId}
        </span>
        : variant usage, slot coverage, score distribution, and rule-fire counts.
        Read-only — author rules on the Rules tab.
      </p>
    </div>
  );
}
