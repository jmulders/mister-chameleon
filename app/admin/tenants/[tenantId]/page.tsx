/**
 * Admin — Tenant Detail
 *
 * Loads a single tenant from the store and renders the tenant detail view:
 *
 *   1. Page header — tenant ID + package + active-status badges
 *   2. TenantStatusPanel — at-a-glance config snapshot + package capabilities
 *   3. TenantSettingsForm — full interactive settings editor (client component)
 *   4. DevControlsSection — development-only cookie override controls
 *
 * This page is a thin server shell:
 *   • Awaits params (Next.js 16 App Router)
 *   • Loads the tenant via getTenantById()
 *   • 404s if not found
 *   • Renders the panel and form — all interactivity lives in TenantSettingsForm
 *
 * ─── Dev Controls (development only) ──────────────────────────────────────────
 *
 *   Reads the mc_dev_tenant cookie to determine if this tenant is the active
 *   development override.  Shows "Use as active dev tenant" / "Clear override"
 *   buttons that call setDevTenantAction / clearDevTenantAction server actions.
 */

import { cookies }     from "next/headers";
import { notFound }    from "next/navigation";
import Link            from "next/link";
import { getTenantById }     from "@/tenant/server";
import { getPackageDefinition } from "@/tenant";
import { DEV_TENANT_COOKIE } from "@/tenant/dev-tenant-cookie";
import { listDomainsForTenant } from "@/tenant/domain-store";
import { isVercelConfigured }   from "@/lib/vercel-domains";
import { setDevTenantAction, clearDevTenantAction } from "./actions";
import { DesignTokenEditor }       from "@/components/admin/DesignTokenEditor";
import { DesignTokenUpload }       from "@/components/admin/DesignTokenUpload";
import { CmsProvisioningPanel }    from "@/components/admin/CmsProvisioningPanel";
import { CmsCredentialsPanel }     from "@/components/admin/CmsCredentialsPanel";
import { TenantDomainsPanel }      from "@/components/admin/TenantDomainsPanel";
import { Badge }              from "@/components/ui/Badge";
import { Text }               from "@/components/primitives/Text";
import { TenantStatusPanel }         from "@/components/admin/TenantStatusPanel";
import { TenantReadinessChecklist }  from "@/components/admin/TenantReadinessChecklist";
import { SiteBuilderReadiness }      from "@/components/admin/SiteBuilderReadiness";
import { TenantSettingsForm }        from "./TenantSettingsForm";
import type { TenantSettings, PackageKey } from "@/tenant/server";

// ── Secret-field security ──────────────────────────────────────────────────────
//
// Several TenantSettings fields contain secrets that must NEVER be serialised
// into the client component payload:
//
//   ai.liveProvider.apiKey    — AI provider API key
//   ai.shadowProvider.apiKey  — AI shadow provider API key
//   cms.writeToken            — Sanity (or provider) write token
//
// The strip functions remove the actual values before the tenant object crosses
// the server→client boundary.  The record functions capture safe boolean masks
// so the forms can display "key configured" hints without knowing the values.

interface ExistingKeys {
  hasLiveKey:       boolean;
  hasShadowKey:     boolean;
  hasCmsWriteToken: boolean;
}

function recordExistingKeys(tenant: TenantSettings): ExistingKeys {
  return {
    hasLiveKey:       Boolean(tenant.ai.liveProvider?.apiKey),
    hasShadowKey:     Boolean(tenant.ai.shadowProvider?.apiKey),
    hasCmsWriteToken: Boolean(tenant.cms.writeToken),
  };
}

function stripSecrets(tenant: TenantSettings): TenantSettings {
  return {
    ...tenant,
    ai: {
      ...tenant.ai,
      liveProvider: tenant.ai.liveProvider
        ? { ...tenant.ai.liveProvider, apiKey: undefined }
        : undefined,
      shadowProvider: tenant.ai.shadowProvider
        ? { ...tenant.ai.shadowProvider, apiKey: undefined }
        : undefined,
    },
    cms: {
      ...tenant.cms,
      writeToken: undefined,
    },
  };
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";

function packageVariant(key: PackageKey): BadgeVariant {
  switch (key) {
    case "starter": return "default";
    case "growth":  return "primary";
    case "pro":     return "success";
  }
}

const PACKAGE_DISPLAY: Record<PackageKey, string> = {
  starter: "Starter",
  growth:  "Growth",
  pro:     "Pro",
};

// ── Derived active status ─────────────────────────────────────────────────────
//
// A tenant is considered "active" when analytics is enabled and the package
// allows it.  Simple heuristic for the header badge; full state is in the panel.

function isTenantActive(tenant: TenantSettings): boolean {
  const pkg = getPackageDefinition(tenant.packageKey);
  return tenant.features.analytics && pkg.allowedFeatures.analytics;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const [tenant, initialDomains] = await Promise.all([
    getTenantById(tenantId),
    listDomainsForTenant(tenantId),
  ]);

  if (!tenant) {
    notFound();
  }

  const isActive     = isTenantActive(tenant);
  const existingKeys = recordExistingKeys(tenant);
  const safeTenant   = stripSecrets(tenant);

  // ── Dev override state (development only) ──────────────────────────────────
  // Read the mc_dev_tenant cookie to determine if this tenant is currently the
  // active development override.  Dead-code-eliminated in production.
  const devActiveTenantId: string | null =
    process.env.NODE_ENV === "development"
      ? ((await cookies()).get(DEV_TENANT_COOKIE)?.value ?? null)
      : null;
  const isActiveDevTenant = devActiveTenantId === tenantId;

  return (
    <div className="p-8">

      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/admin/tenants"
          className="text-xs text-neutral-400 transition-colors hover:text-brand-700"
        >
          ← All tenants
        </Link>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary title: display name when set, fallback to tenantId */}
          <Text variant="h2">{tenant.name ?? tenant.tenantId}</Text>
          <Badge variant={packageVariant(tenant.packageKey)} size="md">
            {PACKAGE_DISPLAY[tenant.packageKey]}
          </Badge>
          <Badge variant={isActive ? "success" : "outline"} size="md" dot>
            {isActive ? "Active" : "Inactive"}
          </Badge>
          {isActiveDevTenant && (
            <Badge variant="warning" size="md" dot>
              Dev override active
            </Badge>
          )}
        </div>

        {/* Identity sub-line: always shows tenantId; adds slug and domain when set */}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
          <span>
            ID:{" "}
            <code className="font-mono text-neutral-500">{tenant.tenantId}</code>
          </span>
          {tenant.slug && (
            <span>
              Slug:{" "}
              <code className="font-mono text-neutral-500">{tenant.slug}</code>
            </span>
          )}
          {tenant.primaryDomain && (
            <span>
              Domain:{" "}
              <code className="font-mono text-neutral-500">{tenant.primaryDomain}</code>
            </span>
          )}
        </div>
      </div>

      {/* Setup readiness checklist — shown before the status panel so outstanding steps are visible immediately */}
      <TenantReadinessChecklist tenant={tenant} className="mb-6" />

      {/* Site builder readiness — page-system infrastructure and capability gates */}
      <SiteBuilderReadiness tenant={tenant} className="mb-8" />

      {/* At-a-glance status panel + package capability summary */}
      <TenantStatusPanel tenant={tenant} />

      {/* Dev Controls — development only; not rendered in production */}
      {process.env.NODE_ENV === "development" && (
        <DevControlsSection
          tenantId={tenantId}
          isActive={isActiveDevTenant}
          currentOverrideTenantId={devActiveTenantId}
        />
      )}

      {/* CMS credentials — configures the write token used by the CMS
          provisioner.  Secrets are stripped from the safeTenant payload;
          only the boolean hasCmsWriteToken flag is passed to the client. */}
      <CmsCredentialsPanel
        tenantId={tenantId}
        hasCmsWriteToken={existingKeys.hasCmsWriteToken}
        cmsProvider={tenant.cms.provider}
      />

      {/* CMS provisioning — writes starter page and variant documents to Sanity.
          Package-gated sections are included based on the tenant's tier.
          Re-provisioning is idempotent but overwrites existing documents.
          We pass only the non-sensitive fields (no AI keys or write tokens). */}
      <CmsProvisioningPanel
        tenant={{
          tenantId:         tenant.tenantId,
          packageKey:       tenant.packageKey,
          design:           tenant.design,
          cms:              safeTenant.cms,   // writeToken already stripped
          cmsProvisionedAt: tenant.cmsProvisionedAt,
          hasCmsWriteToken: existingKeys.hasCmsWriteToken,
        }}
      />

      {/* Visual design token editor — lets operators adjust the most important
          tokens interactively without touching a JSON file.  Writes into the
          same tokenOverrides model as the JSON upload — both flows are additive
          and fully compatible. */}
      <DesignTokenEditor tenantId={tenantId} currentDesign={tenant.design} />

      {/* Design token upload — lets a designer apply a full JSON token file.
          Tokens are layered on top of the active theme preset.  Server-side
          validation runs in the action.  Compatible with both the legacy flat
          format and the newer grouped format. */}
      <DesignTokenUpload tenantId={tenantId} currentDesign={tenant.design} />

      {/* Custom domain management — add/remove hostnames that route to this
          tenant.  Uses the tenant_domains table for O(1) routing lookups.
          When Vercel integration is configured (VERCEL_API_TOKEN +
          VERCEL_PROJECT_ID), domains are registered on the Vercel project and
          DNS verification records are shown to the operator. */}
      <TenantDomainsPanel
        tenantId={tenantId}
        initialDomains={initialDomains}
        vercelEnabled={isVercelConfigured()}
      />

      {/* Editable settings form — all interactivity is client-side.
          safeTenant has all API key values stripped.
          existingKeys carries boolean presence flags for the "key configured" hint. */}
      <TenantSettingsForm tenant={safeTenant} existingKeys={existingKeys} />

    </div>
  );
}

// ── DevControlsSection ────────────────────────────────────────────────────────

interface DevControlsSectionProps {
  tenantId:               string;
  isActive:               boolean;
  currentOverrideTenantId: string | null;
}

function DevControlsSection({ tenantId, isActive, currentOverrideTenantId }: DevControlsSectionProps) {
  return (
    <div className="mt-6 mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">

      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-amber-900">Dev Controls</span>
        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-700">
          Development only
        </span>
        {isActive && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
            ✓ Active dev tenant
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-1 text-xs text-amber-800">
        Set this tenant as the active development override. The{" "}
        <code className="font-mono font-semibold">mc_dev_tenant</code> cookie will
        be set so all routes resolve this tenant without a{" "}
        <code className="font-mono">?tenant=</code> query param.
      </p>
      {!isActive && currentOverrideTenantId && (
        <p className="mb-3 text-xs text-amber-700">
          Currently overriding to:{" "}
          <code className="font-mono font-semibold">{currentOverrideTenantId}</code>
          {" "}— setting this tenant will replace that override.
        </p>
      )}
      {!currentOverrideTenantId && (
        <p className="mb-3 text-xs text-amber-700">
          No override active — tenant currently resolved from the Host header.
        </p>
      )}
      {isActive && (
        <p className="mb-3 text-xs text-amber-700">
          This tenant is the active override. All routes resolve to{" "}
          <code className="font-mono font-semibold">{tenantId}</code> without a{" "}
          <code className="font-mono">?tenant=</code> param.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Set override — shown when this tenant is NOT the active override */}
        {!isActive && (
          <form action={setDevTenantAction.bind(null, tenantId)}>
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
            >
              Use as active dev tenant
            </button>
          </form>
        )}

        {/* Clear override — shown when this tenant IS the active override */}
        {isActive && (
          <form action={clearDevTenantAction.bind(null, tenantId)}>
            <button
              type="submit"
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
            >
              Clear dev tenant override
            </button>
          </form>
        )}

        {/* Dashboard shortcut — shown when override is active */}
        {isActive && (
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50"
          >
            View in dashboard →
          </a>
        )}
      </div>
    </div>
  );
}
