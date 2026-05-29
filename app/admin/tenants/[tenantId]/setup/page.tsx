/**
 * Admin — Tenant Setup
 *
 * Consolidates all provisioning and connectivity concerns that an operator
 * must complete before a tenant site goes live:
 *
 *   1. TenantReadinessChecklist  — full item-by-item checklist
 *   2. ThemePickerPanel          — quick-start theme selection (all presets)
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
import { normalizeThemeKey }    from "@/tenant";
import { getPlatformSanitySettings } from "@/platform/platform-store";
import { TenantReadinessChecklist } from "@/components/admin/TenantReadinessChecklist";
import { ThemePickerPanel }         from "@/components/admin/ThemePickerPanel";
import { SiteBuilderReadiness }     from "@/components/admin/SiteBuilderReadiness";
import { CmsCredentialsPanel }      from "@/components/admin/CmsCredentialsPanel";
import { CreateSitePanel }          from "@/components/admin/CreateSitePanel";
import { TenantDomainsPanel }       from "@/components/admin/TenantDomainsPanel";
import { Text }                     from "@/components/primitives/Text";
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
  const [tenant, initialDomains, platformSanity] = await Promise.all([
    getTenantById(tenantId),
    listDomainsForTenant(tenantId),
    getPlatformSanitySettings(),
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

  const activeTheme = normalizeThemeKey(tenant.design?.theme ?? "default");

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

      {/* 2 — Theme picker */}
      <ThemePickerPanel
        tenantId={tenantId}
        activeTheme={activeTheme}
      />

      {/* 3 — Site-builder infrastructure gates */}
      <SiteBuilderReadiness tenant={tenant} className="mb-8 mt-8" />

      {/* 4 — CMS credentials */}
      <CmsCredentialsPanel
        tenantId={tenantId}
        hasCmsWriteToken={hasCmsWriteTokenSet(tenant)}
        cmsProvider={tenant.cms?.provider ?? "mock"}
        platformWriteTokenConfigured={platformWriteTokenConfigured}
      />

      {/* 5 — Provisioning / site initialisation */}
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
