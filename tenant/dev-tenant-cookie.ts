/**
 * Dev tenant cookie constants — development only.
 *
 * mc_dev_tenant stores the selected development tenant ID in a short-lived
 * cookie so the override persists across navigation without carrying a
 * ?tenant= query param in every URL.
 *
 * The cookie is only read and written in development — production builds
 * tree-shake all references via the NODE_ENV compile-time constant.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   Reading  — getActiveTenant() in tenant/get-active-tenant.ts
 *   Writing  — setDevTenantAction() / clearDevTenantAction() in
 *              app/admin/tenants/[tenantId]/actions.ts
 *   Checking — app/dashboard/layout.tsx (passes value to DashboardNav)
 */

/** Cookie name for the development tenant override. */
export const DEV_TENANT_COOKIE = "mc_dev_tenant";

/** Max-age in seconds — 8 hours (a typical dev session). */
export const DEV_TENANT_COOKIE_MAX_AGE = 60 * 60 * 8;
