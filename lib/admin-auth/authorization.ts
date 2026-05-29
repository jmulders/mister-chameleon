/**
 * Admin Authorization Helpers
 *
 * Server-side utilities for role enforcement and tenant access control.
 *
 * ─── Design ───────────────────────────────────────────────────────────────────
 *
 *   Two tiers of access:
 *
 *     superadmin — can access every tenant, manage all users and platform
 *                  settings, and reach every /admin/* route.
 *
 *     tenant_admin — can only access /admin/tenants/[tenantId] for tenants
 *                    they are explicitly assigned to in admin_user_tenants.
 *                    Platform-wide pages (Users, Integrations, etc.) are
 *                    hidden in the UI and redirect server-side if reached directly.
 *
 * ─── Legacy "admin" role ──────────────────────────────────────────────────────
 *
 *   Migration 20 created admin_users with default role = 'admin'.
 *   Migration 21 (not yet applied in all environments) renames those rows to
 *   'tenant_admin' and adds the admin_user_tenants assignment table.
 *
 *   Until migration 21 has run:
 *     • The role column contains "admin", not "superadmin" or "tenant_admin".
 *     • The admin_user_tenants table does not exist.
 *     • "admin" must be treated as full superadmin access — it was the original
 *       unrestricted bootstrap role before the two-tier model was introduced.
 *
 *   After migration 21 runs:
 *     • Existing "admin" rows are renamed to "tenant_admin".
 *     • New bootstrap users are created with role = "superadmin".
 *     • "admin" will no longer appear in the database, so the fallback is harmless.
 *
 * ─── Usage in Server Components / layouts ─────────────────────────────────────
 *
 *   // Require any authenticated admin session:
 *   const session = await getRequiredAdminSession();
 *
 *   // Require superadmin (or legacy full-access admin):
 *   const session = await requireSuperAdmin();
 *
 *   // Enforce tenant-level access (e.g. in tenant workspace layout):
 *   await assertTenantAccess(session, tenantId);
 *
 * ─── Import rules ─────────────────────────────────────────────────────────────
 *
 *   - Server Components, Route Handlers, Server Actions — safe to import.
 *   - Middleware — DO NOT import (uses getTenantIdsForUser which calls Supabase,
 *     and imports "server-only"). Middleware stays JWT-only.
 *   - Client Components — DO NOT import.
 */
import "server-only";

import { cookies }   from "next/headers";
import { redirect }  from "next/navigation";
import {
  verifySession,
  ADMIN_TOKEN_COOKIE,
  type AdminSession,
} from "./session";
import { getTenantIdsForUser } from "@/data/admin-auth";

// ── Role helpers ──────────────────────────────────────────────────────────────

/**
 * Returns true when the session has full platform-wide access.
 *
 * Matches both "superadmin" (the canonical role going forward) and the legacy
 * "admin" role that existed before migration 21 introduced the two-tier model.
 * The legacy "admin" role was the original unrestricted bootstrap role — it must
 * continue to grant full access until migration 21 renames those rows to
 * "tenant_admin".  Once migration 21 has run, no user will carry "admin" and
 * this fallback becomes a harmless dead branch.
 */
export function isSuperAdmin(session: AdminSession): boolean {
  return session.role === "superadmin" || session.role === "admin";
}

/**
 * Returns true when the session belongs to a tenant-scoped admin.
 * These users can only access tenants explicitly assigned in admin_user_tenants.
 *
 * Note: the legacy "admin" role is intentionally NOT included here — see
 * isSuperAdmin() above for the rationale.
 */
export function isTenantAdmin(session: AdminSession): boolean {
  return session.role === "tenant_admin";
}

// ── Session retrieval ─────────────────────────────────────────────────────────

/**
 * Reads and verifies the admin session from the current request cookies.
 *
 * - Redirects to /admin/login when no valid token is present.
 * - Redirects to /admin/login/2fa when 2FA has not been completed.
 *
 * Call this at the top of any Server Component that needs the session but
 * does NOT want to enforce a specific role.
 */
export async function getRequiredAdminSession(): Promise<AdminSession> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;

  if (!token) redirect("/admin/login");

  const session = await verifySession(token);
  if (!session) redirect("/admin/login");

  if (session.twoFaEnabled && !session.twoFaVerified) {
    redirect("/admin/login/2fa");
  }

  return session;
}

// ── Role enforcement ──────────────────────────────────────────────────────────

/**
 * Ensures the current session is a fully-authenticated superadmin (or legacy
 * full-access admin).  Redirects to /admin/tenants if the user is not.
 *
 * @returns The verified AdminSession so the caller does not need to re-read cookies.
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getRequiredAdminSession();
  if (!isSuperAdmin(session)) {
    // Non-superadmin users land on the tenant list — not an error page.
    redirect("/admin/tenants");
  }
  return session;
}

// ── Tenant access ─────────────────────────────────────────────────────────────

/**
 * Returns true when the session has access to the specified tenant.
 *
 *   superadmin / legacy admin — always true (no DB query needed)
 *   tenant_admin              — true only if tenant_id appears in their
 *                               admin_user_tenants rows
 *
 * When admin_user_tenants does not yet exist in the database (migration 21 not
 * yet applied), getTenantIdsForUser() returns [] and tenant_admin access is
 * denied.  This is safe: only "superadmin" or legacy "admin" users exist before
 * that migration, and they bypass this check via isSuperAdmin().
 */
export async function canAccessTenant(
  session:  AdminSession,
  tenantId: string,
): Promise<boolean> {
  if (isSuperAdmin(session)) return true;
  const assignedIds = await getTenantIdsForUser(session.sub);
  return assignedIds.includes(tenantId);
}

/**
 * Enforces tenant access for the given session and tenantId.
 * Redirects to /admin/tenants with an access-denied indicator when access
 * is not granted.
 *
 * Call from tenant workspace layouts so the check runs once per layout
 * mount rather than per page component.
 */
export async function assertTenantAccess(
  session:  AdminSession,
  tenantId: string,
): Promise<void> {
  const ok = await canAccessTenant(session, tenantId);
  if (!ok) {
    redirect("/admin/tenants?denied=1");
  }
}
