/**
 * /admin/tenants/[tenantId]/users
 *
 * Per-tenant user management — superadmin only.
 *
 * Shows:
 *   • Assigned users  — tenant_admin users explicitly assigned to this tenant
 *   • Platform admins — superadmin users who have implicit access to all tenants
 *
 * Actions:
 *   • Remove an assigned user from this tenant
 *   • Assign an existing tenant_admin user to this tenant (dropdown + submit)
 *   • Link to create a new user (prefilled with this tenant) via /admin/users/new
 */

import Link                    from "next/link";
import { notFound }            from "next/navigation";
import { requireSuperAdmin }   from "@/lib/admin-auth/authorization";
import { getTenantById }       from "@/tenant/server";
import {
  listUsersForTenant,
  listSuperAdmins,
  listAdminUsers,
  getUserIdsForTenant,
}                              from "@/data/admin-auth";
import { Badge }               from "@/components/ui/Badge";
import { Card, CardContent }   from "@/components/ui/Card";
import { Text }                from "@/components/primitives/Text";
import { addUserToTenantAction }    from "./actions";
import { RemoveUserButton }         from "./_components/RemoveUserButton";
import type { SafeAdminUser }  from "@/data/admin-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLastLogin(ts: string | null): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── User row — assigned tenant_admin ─────────────────────────────────────────

function AssignedUserRow({
  user,
  tenantId,
}: {
  user:     SafeAdminUser;
  tenantId: string;
}) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Avatar + name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
            {initials(user.name)}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">{user.name}</p>
            <p className="text-xs text-neutral-400">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge variant={user.is_active ? "success" : "error"} size="sm" dot>
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      </td>

      {/* 2FA */}
      <td className="px-4 py-3">
        <span className="text-xs text-neutral-500">
          {user.two_factor_enabled ? "✓ On" : "Off"}
        </span>
      </td>

      {/* Last login */}
      <td className="px-4 py-3">
        <span className="text-xs text-neutral-500">{formatLastLogin(user.last_login_at)}</span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/admin/users/${user.id}`}
            className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          >
            Edit
          </Link>
          <RemoveUserButton userId={user.id} tenantId={tenantId} userName={user.name} />
        </div>
      </td>
    </tr>
  );
}

// ── Superadmin row — read-only, implicit access ───────────────────────────────

function SuperAdminRow({ user }: { user: SafeAdminUser }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 bg-violet-50/40 hover:bg-violet-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">
            {initials(user.name)}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">{user.name}</p>
            <p className="text-xs text-neutral-400">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="primary" size="sm">Superadmin</Badge>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-neutral-500">
          {user.two_factor_enabled ? "✓ On" : "Off"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-neutral-500">{formatLastLogin(user.last_login_at)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/admin/users/${user.id}`}
          className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TenantUsersPage({
  params,
  searchParams,
}: {
  params:       Promise<{ tenantId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSuperAdmin();

  const { tenantId } = await params;
  const { error }    = await searchParams;

  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // Fetch assigned users + superadmins in parallel
  const [assignedUsers, superAdmins, allUsers, assignedIds] = await Promise.all([
    listUsersForTenant(tenantId),
    listSuperAdmins(),
    listAdminUsers(),
    getUserIdsForTenant(tenantId),
  ]);

  // Build the "add user" dropdown: tenant_admin users NOT already assigned here
  const assignedIdSet = new Set(assignedIds);
  const unassignedTenantAdmins = allUsers.filter(
    (u) => !["superadmin", "admin"].includes(u.role) && !assignedIdSet.has(u.id),
  );

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Users</h1>
          <Text variant="body-sm" color="muted" className="mt-1">
            Manage who has access to the <strong>{tenant.name ?? tenantId}</strong> workspace.
          </Text>
        </div>
        <Link
          href={`/admin/users/new`}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          + New user
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Assign existing user */}
      {unassignedTenantAdmins.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <p className="mb-3 text-sm font-medium text-neutral-700">Assign an existing user to this tenant</p>
            <form action={addUserToTenantAction} className="flex items-center gap-3">
              <input type="hidden" name="tenantId" value={tenantId} />
              <select
                name="userId"
                required
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                <option value="">Select a user…</option>
                {unassignedTenantAdmins.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
              >
                Assign
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Assigned users table */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          Assigned users
          <span className="ml-2 font-normal text-neutral-400">({assignedUsers.length})</span>
        </h3>
      </div>

      {assignedUsers.length === 0 ? (
        <Card className="mb-6">
          <CardContent>
            <p className="py-6 text-center text-sm text-neutral-400">
              No tenant users assigned yet. Use the dropdown above to assign a user, or create a new one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card padding="none" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {(["User", "Status", "2FA", "Last login", ""] as const).map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignedUsers.map((user) => (
                  <AssignedUserRow key={user.id} user={user} tenantId={tenantId} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Superadmins — implicit access */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-neutral-700">
          Platform admins
          <span className="ml-2 font-normal text-neutral-400">({superAdmins.length})</span>
        </h3>
        <p className="mt-0.5 text-xs text-neutral-400">
          Superadmins have implicit access to all tenants and cannot be removed per-tenant.
        </p>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                {(["User", "Role", "2FA", "Last login", ""] as const).map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {superAdmins.map((user) => (
                <SuperAdminRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
