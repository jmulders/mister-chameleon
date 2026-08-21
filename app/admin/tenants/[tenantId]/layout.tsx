/**
 * Tenant Workspace Layout
 *
 * Nested layout for /admin/tenants/[tenantId] and all its sub-routes.
 *
 * Adds a horizontal tab bar (TenantSubNav) immediately below the global
 * admin sidebar, giving operators a consistent workspace header for:
 *   Overview · Pages · AI Logs · Context · Content Status
 *
 * ─── Why a nested layout? ────────────────────────────────────────────────────
 *
 *   Next.js App Router allows layouts to nest.  The outer /admin/layout.tsx
 *   owns the sidebar; this layout owns only the tenant workspace strip —
 *   so the sidebar is never re-mounted when navigating between tabs.
 *
 * ─── Tenant name resolution ───────────────────────────────────────────────────
 *
 *   Loads the tenant from the store so the subnav can display a human-readable
 *   name alongside the slug.  Falls back to the raw tenantId if the tenant
 *   cannot be loaded (partial record, DB error) rather than 404ing — 404 is
 *   handled by the individual page components.
 */

import { Suspense }           from "react";
import { getTenantById }      from "@/tenant/server";
import { isPlatformCmsProvider } from "@/tenant/cms-model";
import { TenantSubNav }       from "@/components/admin/TenantSubNav";
import {
  getRequiredAdminSession,
  assertTenantAccess,
} from "@/lib/admin-auth/authorization";

export default async function TenantWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params:   Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  // ── Server-side tenant access enforcement ──────────────────────────────────
  //
  // getRequiredAdminSession() redirects to /admin/login if the session is
  // missing or expired.  assertTenantAccess() redirects to /admin/tenants if
  // the user is not assigned to this tenant (tenant_admin) or not a superadmin.
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  // ── Best-effort tenant name + role for subnav ──────────────────────────────
  let tenantName   = tenantId;
  let isAdvertiser = false;
  let platformCms  = false;
  try {
    const tenant = await getTenantById(tenantId);
    if (tenant?.name) tenantName = tenant.name;
    isAdvertiser = tenant?.tenantRole === "advertiser";
    platformCms  = isPlatformCmsProvider(tenant?.cms?.provider);
  } catch {
    // Swallow — layout never throws for a missing tenant.
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Tenant tab bar.
          Suspense: TenantSubNav reads useSearchParams() (the Design sub-items
          are ?tab=… links), which Next requires to sit inside a boundary. These
          routes are dynamic anyway (the session read above uses cookies), so the
          fallback is never rendered — it only keeps the build rule satisfied. */}
      <Suspense fallback={null}>
        <TenantSubNav tenantId={tenantId} tenantName={tenantName} isAdvertiser={isAdvertiser} platformCms={platformCms} />
      </Suspense>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
