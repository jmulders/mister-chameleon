/**
 * Admin — Tenant Workspace › Integrations › Enrichment Pipeline
 *
 * Accessible at /admin/tenants/[tenantId]/integrations/pipeline
 *
 * Lets platform admins configure the enrichment pipeline for a specific
 * tenant:
 *
 *   • Enable / disable individual stages
 *   • Reorder stages within their wave group (↑ / ↓ buttons)
 *
 * Stage ordering and activation state are persisted to
 * `tenant_pipeline_stages` and picked up by `buildCompanyCrmChain` at
 * runtime via the `stageConfig` option.
 *
 * ─── Wave constraints ─────────────────────────────────────────────────────────
 *
 *   The wave assignment (Wave 1 parallel → Wave 2 parallel → Sequential) is
 *   fixed by dependency constraints and is NOT configurable here.  The UI
 *   shows the wave groupings clearly and only allows reordering within a
 *   group.
 *
 * ─── Always-on stages ─────────────────────────────────────────────────────────
 *
 *   IP Classification and Cloud Detection are internal always-on stages.
 *   They have no stageKey, are not listed in PIPELINE_STAGE_REGISTRY, and
 *   do not appear in the admin UI.
 */

import { notFound }                   from "next/navigation";
import { getTenantById }               from "@/tenant/server";
import { normalizeTenant }             from "@/tenant/normalize";
import { getPipelineConfigAction }     from "./actions";
import { PipelineStageEditor }         from "./_components/PipelineStageEditor";

export default async function TenantPipelinePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // Verify tenant exists
  const raw = await getTenantById(tenantId);
  if (!raw) notFound();
  const tenant = normalizeTenant(raw);

  // Load pipeline config (DB values merged with registry defaults)
  const pipelineConfig = await getPipelineConfigAction(tenantId);

  return (
    <div className="max-w-3xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-neutral-900">
          Enrichment Pipeline
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">
          Configure which enrichment stages run for{" "}
          <span className="font-medium text-neutral-700">
            {tenant.name || tenantId}
          </span>{" "}
          and in what order. Stages run in parallel within each wave group.
        </p>
        {!pipelineConfig.fromDb && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Using platform defaults — no custom configuration saved yet. Reorder
            or toggle a stage to create a custom config for this tenant.
          </p>
        )}
      </div>

      {/* Pipeline editor */}
      <PipelineStageEditor
        tenantId={tenantId}
        initialConfig={pipelineConfig}
      />

      {/* Runtime note */}
      <div className="mt-8 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        <p className="font-medium text-neutral-700 mb-1">Runtime behaviour</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>
            Changes take effect on the <strong>next page render</strong> for
            this tenant — the session enrichment cache is not immediately
            flushed.
          </li>
          <li>
            Disabled stages are omitted from the pipeline entirely — they do
            not consume credits and add no latency.
          </li>
          <li>
            Stages that require credentials (e.g. MaxMind, Leadinfo) are
            automatically skipped if the credentials are not configured, even
            when enabled here.
          </li>
          <li>
            Wave assignments are fixed by dependency constraints and cannot be
            changed. Stages within the same wave run concurrently.
          </li>
        </ul>
      </div>
    </div>
  );
}
