/**
 * Auth guards for server actions.
 *
 * Every exported function in a "use server" file is a public POST endpoint. It
 * can be called from any page of the site with its action id, whatever page
 * imports it, and the proxy deliberately lets action requests through (a
 * redirect breaks the action protocol). The tenant layout check does not run
 * for it either. So each action has to start with one of these:
 *
 *   await requireSuperAdminAction();          // platform-wide settings
 *   await requireTenantAction(tenantId);      // anything on one tenant
 *   await requireAdminAction();               // any signed-in admin
 *   await requireTenantOrPlatformAction(id);  // tenant rows, or platform rows when null
 *
 * They redirect to the login page (or the tenant list) when the check fails,
 * which for an action call means the action body never runs.
 * tests/security/server-actions-guarded.test.ts fails when an action has none.
 */
import "server-only";

import { redirect } from "next/navigation";
import {
  assertTenantAccess,
  getRequiredAdminSession,
  isSuperAdmin,
  requireSuperAdmin,
} from "./authorization";
import type { AdminSession } from "./session";

/** Any signed-in admin: tenant admin or superadmin. */
export async function requireAdminAction(): Promise<AdminSession> {
  return getRequiredAdminSession();
}

/** Superadmin only. */
export async function requireSuperAdminAction(): Promise<AdminSession> {
  return requireSuperAdmin();
}

/**
 * A superadmin, or a tenant admin assigned to this tenant.
 *
 * The tenant id comes from the client. A superadmin may act on any tenant, so
 * for them it is not checked here. For a tenant admin anything that is not a
 * non-empty string is refused before the lookup.
 */
export async function requireTenantAction(tenantId: unknown): Promise<AdminSession> {
  const session = await getRequiredAdminSession();
  if (isSuperAdmin(session)) return session;
  if (typeof tenantId !== "string" || tenantId === "") {
    redirect("/admin/tenants?denied=1");
  }
  await assertTenantAccess(session, tenantId);
  return session;
}

/**
 * For data that is either a tenant's or the platform's own (tenant id null):
 * platform-level rows are superadmin only, a tenant's rows need access to it.
 */
export async function requireTenantOrPlatformAction(tenantId: string | null | undefined): Promise<AdminSession> {
  if (tenantId === null || tenantId === undefined || tenantId === "") return requireSuperAdmin();
  return requireTenantAction(tenantId);
}
