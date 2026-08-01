/**
 * Tenant Blueprints — Admin Page
 *
 * Marketplace view of all available blueprints for a tenant.
 * Operators can preview and activate a blueprint from here.
 *
 * Route: /admin/tenants/[tenantId]/content/blueprints
 */

import { notFound }             from "next/navigation";
import { cookies }              from "next/headers";
import { getTenantById }        from "@/tenant/server";
import { DEV_TENANT_COOKIE }    from "@/tenant/dev-tenant-cookie";
import { ALL_BLUEPRINTS }       from "@/blueprints/blueprint-registry";
import { BlueprintsClient }     from "./_components/BlueprintsClient";

interface Props {
  params: Promise<{ tenantId: string }>;
}

export default async function BlueprintsPage({ params }: Props) {
  const { tenantId } = await params;

  const tenantSettings = await getTenantById(tenantId);
  if (!tenantSettings) notFound();

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Blueprint Marketplace</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Activate a pre-built industry setup to instantly scaffold pages, rules,
          scoring, and sequences. Existing customizations are preserved by default.
        </p>
      </div>

      <BlueprintsClient
        tenantId={tenantId}
        blueprints={ALL_BLUEPRINTS.map((b) => ({
          key:                    b.key,
          name:                   b.name,
          description:            b.description,
          longDescription:        b.longDescription ?? null,
          industry:               b.industry,
          tags:                   b.tags ?? [],
          recommendedThemePreset: b.recommendedThemePreset ?? null,
          pageCount:              b.pages.length,
          ruleCount:              b.rules.length,
          scoringRuleCount:       b.scoringRules.length,
          sequenceCount:          b.sequencePatterns.length,
          pages:                  b.pages.map((p) => ({
            slug:   p.slug,
            title:  p.title,
            blocks: p.blocks.map((blk) => blk.type),
          })),
          rules: b.rules.map((r) => ({
            label:  r.label,
            reason: r.reason,
          })),
          scoringRules: b.scoringRules.map((sr) => ({
            label:      sr.label,
            event_type: sr.event_type,
            score:      sr.score,
          })),
        }))}
      />
    </div>
  );
}
