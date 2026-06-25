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

/**
 * Whether the `?tenant=` / `x-tenant-override` mechanism is active.
 *
 * Enabled in:
 *   - local development (`NODE_ENV === "development"`), and
 *   - Vercel preview / staging deployments (`VERCEL_ENV === "preview"`),
 * so a staging URL can be pointed at any real tenant for testing.
 *
 * NEVER enabled in production: production deployments run with
 * `VERCEL_ENV === "production"`, where tenant resolution stays strictly
 * host-based.
 *
 * Note on bundling: `NODE_ENV` is a compile-time constant (its dev branch is
 * tree-shaken from production bundles). `VERCEL_ENV` is read at runtime, so the
 * preview branch is present in the production bundle but only ever executes when
 * the runtime env is "preview" — i.e. never on the production deployment.
 */
export function isTenantOverrideEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
}
