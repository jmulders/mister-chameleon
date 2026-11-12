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
 * A superadmin, or a tenant admin assigned to this tenant. The tenant id comes
 * from the client, so anything that is not a non-empty string is refused.
 */
export async function requireTenantAction(tenantId: unknown): Promise<AdminSession> {
  const session = await getRequiredAdminSession();
  if (typeof tenantId !== "string" || tenantId === "") {
    redirect("/admin/tenants?denied=1");
  }
  await assertTenantAccess(session, tenantId);
  return session;
}
