/**
 * Admin — Tenant Workspace › Experiments
 *
 * Tenant-scoped plan-based A/B experiment management.  Shows:
 *
 *   1. GlobalExperimentsToggle — master on/off switch for all experiment
 *      evaluation for this tenant.  When off, ExperimentDecisionProvider
 *      skips all plan experiment evaluation regardless of individual status.
 *
 *   2. CreatePlanExperimentForm — create a new plan experiment tied to a rule,
 *      with a challenger plan that overrides one or more slots.
 *
 *   3. PlanExperimentsTable — list of all plan experiments with per-experiment
 *      draft → active → paused → ended lifecycle management.
 *
 * ─── Data flow ─────────────────────────────────────────────────────────────────
 *
 *   Global toggle:      stored in TenantSettings.experiments.enabled (JSONB).
 *                       Persisted via setTenantExperimentsEnabledAction.
 *
 *   Per-experiment:     stored in the `plan_experiments` table (Supabase).
 *                       Persisted via createPlanExperimentAction /
 *                       updatePlanExperimentAction / deletePlanExperimentAction.
 *
 *   Rule list:          loaded from the tenant's StoredRulesConfig so the
 *                       create form can show a rule selector with human-readable
 *                       labels and the control plan preview.
 *
 * ─── Experiment semantics ──────────────────────────────────────────────────────
 *
 *   Each plan experiment targets one rule by rule_id.  When that rule matches a
 *   visitor and the experiment is active:
 *
 *     bucket 0 (control)    → rule's plan unchanged
 *     bucket 1 (challenger) → rule's plan + challenger_plan overrides
 *
 *   This tests complete, coherent psychological journeys against each other
 *   rather than individual slots in isolation (macro-optimisation).
 */

import { notFound }                    from "next/navigation";
import { getTenantById }               from "@/tenant/server";
import { normalizeTenant }             from "@/tenant/normalize";
import { listAllPlanExperiments }      from "@/data/repositories/plan-experiments-repository";
import { loadTenantRulesConfig }       from "@/decision/rules/load-tenant-rules";
import { fetchVariantCatalogue }       from "@/decision/rules/fetch-variant-catalogue";
import { setTenantExperimentsEnabledAction } from "./actions";
import { GlobalExperimentsToggle }     from "./_components/GlobalExperimentsToggle";
import { PlanExperimentsTable }        from "./_components/PlanExperimentsTable";
import { CreatePlanExperimentForm }    from "./_components/CreatePlanExperimentForm";
import { Text }                        from "@/components/primitives/Text";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantExperimentsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const rawTenant = await getTenantById(tenantId);
  if (!rawTenant) notFound();

  const tenant = normalizeTenant(rawTenant);

  // Load plan experiments, rules config, and variant catalogue in parallel.
  const [planExperimentsResult, rulesConfig, variantCatalogue] = await Promise.all([
    listAllPlanExperiments(tenantId),
    loadTenantRulesConfig(tenantId),
    fetchVariantCatalogue(tenantId),
  ]);

  // Build the rule list for the create/edit forms.
  // Include id, label, and the rule's plan so the create form can show the
  // control plan preview when a rule is selected.
  const rules = (rulesConfig?.rules ?? [])
    .filter((r) => r.enabled !== false)
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({
      id:    r.id,
      label: r.label,
      plan:  r.plan as {
        heroKey?:  string;
        proofKey?: string;
        ctaKey?:   string;
      },
    }));

  // Resolve global toggle from tenant settings.
  const experimentsEnabled = tenant.experiments?.enabled ?? true;

  // Bind the server action so the toggle component doesn't need tenantId.
  const boundSetEnabled = setTenantExperimentsEnabledAction.bind(null, tenantId);

  return (
    <div className="p-8">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-neutral-900">Experiments</h1>
        <p className="text-sm text-neutral-500">
          Plan-based A/B experiments for{" "}
          <span className="font-medium text-neutral-700">
            {tenant.name ?? tenant.tenantId}
          </span>
          .{" "}
          Each experiment targets a specific rule and tests a complete challenger plan against the
          rule&apos;s control plan, enabling macro-optimisation of full psychological journeys.
        </p>
      </div>

      {/* ── Global toggle ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <GlobalExperimentsToggle
          initialEnabled={experimentsEnabled}
          setEnabledAction={boundSetEnabled}
        />
      </div>

      {/* ── Create plan experiment form ───────────────────────────────────── */}
      <div className="mb-6">
        <CreatePlanExperimentForm
          tenantId={tenantId}
          rules={rules}
          variantCatalogue={variantCatalogue}
        />
      </div>

      {/* ── Plan experiments table ────────────────────────────────────────── */}
      <div className="mb-2">
        <h2 className="text-base font-semibold text-neutral-800">All plan experiments</h2>
      </div>

      {planExperimentsResult.ok ? (
        <PlanExperimentsTable
          experiments={planExperimentsResult.data}
          experimentsEnabled={experimentsEnabled}
          tenantId={tenantId}
          variantCatalogue={variantCatalogue}
          rules={rules}
        />
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Error loading plan experiments:</strong> {planExperimentsResult.error}
        </div>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div className="mt-8 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          How plan experiments work
        </p>
        <div className="space-y-2 text-xs text-neutral-600">
          <p>
            <strong>Engine master switch (above):</strong> When disabled, no experiments run for
            this tenant. Every visitor receives the rules-based plan unchanged.
          </p>
          <p>
            <strong>Rule targeting.</strong> Each experiment is linked to a specific rule by ID.
            The experiment only evaluates when that rule matches the visitor.  The rule provides
            the audience segmentation; the experiment randomises within that segment.
          </p>
          <p>
            <strong>Bucket assignment:</strong> Bucket 0 receives the rule&apos;s plan unchanged
            (control). Bucket 1 receives the challenger plan merged on top (only the slots you
            specified are different). Both buckets are part of the same deterministic hash.
            The same session always gets the same bucket.
          </p>
          <p>
            <strong>Status lifecycle:</strong>{" "}
            <code className="rounded bg-neutral-200 px-1 font-mono">draft</code> (not yet live).{" "}
            <code className="rounded bg-neutral-200 px-1 font-mono">active</code> (running).{" "}
            <code className="rounded bg-neutral-200 px-1 font-mono">paused</code> (traffic blocked without ending).{" "}
            <code className="rounded bg-neutral-200 px-1 font-mono">ended</code> (archived, not resumable).
          </p>
          <p>
            <strong>One active experiment per rule:</strong> If two active experiments target the
            same rule, the one created first is used. The second is skipped with a logged warning.
          </p>
        </div>
      </div>

    </div>
  );
}
