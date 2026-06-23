/**
 * Admin — Tenant Setup
 *
 * Consolidates all provisioning and connectivity concerns that an operator
 * must complete before a tenant site goes live:
 *
 *   1. TenantReadinessChecklist  — full item-by-item checklist
 *   2. Design link               — theme + tokens now live in the Design section
 *   3. SiteBuilderReadiness      — page-system infrastructure gates
 *   4. CmsCredentialsPanel       — write token for CMS provisioner (secret-safe)
 *   5. CreateSitePanel           — first-time bootstrap / re-initialise
 *   6. TenantDomainsPanel        — custom domain management + Vercel integration
 *
 * None of these panels expose secret values.  The CMS write-token is
 * represented as a boolean presence flag (hasCmsWriteToken) — the raw value
 * is stripped before crossing the server→client boundary.
 */

import { notFound }         from "next/navigation";
import { getTenantById }    from "@/tenant/server";
import { listDomainsForTenant } from "@/tenant/domain-store";
import { isVercelConfigured }   from "@/lib/vercel-domains";
import Link                      from "next/link";
import { getPlatformSanitySettings, getPlatformForgeSettings, forgeFlags } from "@/platform/platform-store";
import { TenantReadinessChecklist } from "@/components/admin/TenantReadinessChecklist";
import { SiteBuilderReadiness }     from "@/components/admin/SiteBuilderReadiness";
import { CmsCredentialsPanel }      from "@/components/admin/CmsCredentialsPanel";
import { CreateSitePanel }          from "@/components/admin/CreateSitePanel";
import { TenantDomainsPanel }       from "@/components/admin/TenantDomainsPanel";
import { StatamicDeployPanel }      from "@/components/admin/StatamicDeployPanel";
import { TenantCmsDeployCard }      from "@/components/admin/TenantCmsDeployCard";
import { StatamicSetupGuide }       from "@/components/admin/StatamicSetupGuide";
import { TenantProvisionCard }       from "@/components/admin/TenantProvisionCard";
import { TenantFinalizeCard }         from "@/components/admin/TenantFinalizeCard";
import type { TenantSettings } from "@/tenant/server";

// ── Secret masking ────────────────────────────────────────────────────────────

function hasCmsWriteTokenSet(tenant: TenantSettings): boolean {
  return Boolean(tenant.cms?.writeToken);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantSetupPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [tenant, initialDomains, platformSanity, platformForge] = await Promise.all([
    getTenantById(tenantId),
    listDomainsForTenant(tenantId),
    getPlatformSanitySettings(),
    getPlatformForgeSettings(),
  ]);

  if (!tenant) notFound();

  // A platform-level write token is available when either the DB platform
  // settings or the env var fallbacks have a token.  The panel uses this to
  // suppress the false-alarm amber warning on tenants that have no per-tenant
  // token but don't need one because provisioning will use the platform token.
  const platformWriteTokenConfigured = Boolean(
    (platformSanity.ok ? platformSanity.data?.writeToken : null) ||
    process.env.SANITY_API_WRITE_TOKEN ||
    process.env.SANITY_WRITE_TOKEN,
  );

  // Show the Forge deploy panel when the tenant's CMS is explicitly set to Statamic.
  // The operator first selects "statamic" as the CMS provider in tenant Settings,
  // then comes here to deploy the Statamic site.
  const forgeData            = platformForge.ok ? platformForge.data : null;
  const forgeIsConfigured    = Boolean(forgeData?.apiKey);
  const forgeDefaultServerId = forgeData ? forgeFlags(forgeData).defaultServerId : null;
  const showDeployPanel      = tenant.cms?.provider === "statamic";

  return (
    <div className="p-8 max-w-3xl">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-neutral-900">Setup</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Complete the steps below to choose a theme, connect your CMS,
          initialise the site, and configure your custom domains.
        </p>
      </div>

      {/* 1 — Readiness checklist */}
      <TenantReadinessChecklist tenant={tenant} className="mb-8" />

      {/* 2 — Theme & design (lives in the Design section) */}
      <Link
        href={`/admin/tenants/${tenantId}/design`}
        className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
      >
        <div>
          <p className="text-sm font-semibold text-neutral-900">Thema &amp; design</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Kies een preset of bouw een eigen look in de Design-sectie — presets, builder, typografie en tokens.
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-indigo-600">Open Design →</span>
      </Link>

      {/* 3 — Site-builder infrastructure gates */}
      <SiteBuilderReadiness tenant={tenant} className="mb-8 mt-8" />

      {/* 4 — CMS credentials */}
      <CmsCredentialsPanel
        tenantId={tenantId}
        hasCmsWriteToken={hasCmsWriteTokenSet(tenant)}
        cmsProvider={tenant.cms?.provider ?? "mock"}
        platformWriteTokenConfigured={platformWriteTokenConfigured}
      />

      {/* 5 — One-click automated provisioning (repo + Ploi app) */}
      {showDeployPanel && <TenantProvisionCard tenantId={tenantId} />}

      {/* 5 — Finalize: wire statamicBaseUrl + domain + sites.yaml */}
      {showDeployPanel && (
        <TenantFinalizeCard
          tenantId={tenantId}
          currentBaseUrl={tenant.cms?.statamicBaseUrl ?? undefined}
        />
      )}

      {/* 5 — Statamic instance setup guide (only for Statamic tenants) */}
      {showDeployPanel && (
        <StatamicSetupGuide
          tenantId={tenantId}
          siteKey={tenant.snippet?.siteKey}
        />
      )}

      {/* 5a — Forge: deploy a fresh Statamic site (only for Statamic tenants) */}
      {showDeployPanel && (
        <StatamicDeployPanel
          tenantId={tenantId}
          existingBaseUrl={tenant.cms?.statamicBaseUrl ?? undefined}
          defaultServerId={forgeDefaultServerId}
          forgeConfigured={forgeIsConfigured}
        />
      )}

      {/* 5a-bis — One-click redeploy of this tenant's Statamic instance (Ploi) */}
      {showDeployPanel && (
        <TenantCmsDeployCard
          tenantId={tenantId}
          configured={Boolean(tenant.deploy?.cmsDeployHookUrl)}
        />
      )}

      {/* 5b — Provisioning / site initialisation */}
      <CreateSitePanel
        tenantId={tenantId}
        siteInitializedAt={tenant.siteInitializedAt}
      />

      {/* 6 — Custom domains */}
      <TenantDomainsPanel
        tenantId={tenantId}
        initialDomains={initialDomains}
        vercelEnabled={isVercelConfigured()}
      />

    </div>
  );
}
