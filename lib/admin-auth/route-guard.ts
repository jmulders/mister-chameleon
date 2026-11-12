/**
 * Auth guards for route handlers.
 *
 * A route handler under /api is a public URL. The proxy only rate-limits it,
 * and the admin layouts never run for it, so a handler that does not check the
 * session itself is open to anyone. Each guard here returns either the session
 * or the response to send back:
 *
 *   const guard = await guardTenantRoute(tenantId);
 *   if (!guard.ok) return guard.response;
 *
 * 401 means no valid session, 403 means a session without the right to do this.
 */
import "server-only";

import { NextResponse } from "next/server";
import {
  canAccessTenant,
  getAdminSessionOrNull,
  isSuperAdmin,
} from "./authorization";
import type { AdminSession } from "./session";

export type RouteGuard =
  | { ok: true;  session: AdminSession }
  | { ok: false; response: NextResponse };

const NO_STORE = { "Cache-Control": "no-store" };

function deny(status: 401 | 403, error: string): RouteGuard {
  return { ok: false, response: NextResponse.json({ error }, { status, headers: NO_STORE }) };
}

/** Any signed-in admin, tenant admin or superadmin. */
export async function guardSessionRoute(): Promise<RouteGuard> {
  const session = await getAdminSessionOrNull();
  if (!session) return deny(401, "Unauthorized");
  return { ok: true, session };
}

/** Platform-wide actions: superadmin only. */
export async function guardSuperAdminRoute(): Promise<RouteGuard> {
  const guard = await guardSessionRoute();
  if (!guard.ok) return guard;
  if (!isSuperAdmin(guard.session)) return deny(403, "Forbidden");
  return guard;
}

/**
 * Actions on one tenant: a superadmin, or a tenant admin assigned to it.
 * A missing or non-string tenant id is refused before any lookup.
 */
export async function guardTenantRoute(tenantId: unknown): Promise<RouteGuard> {
  const guard = await guardSessionRoute();
  if (!guard.ok) return guard;
  if (typeof tenantId !== "string" || tenantId === "") return deny(403, "Forbidden");
  if (!(await canAccessTenant(guard.session, tenantId))) return deny(403, "Forbidden");
  return guard;
}
