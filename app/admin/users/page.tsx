/**
 * Admin — User Management List
 *
 * Superadmin-only page. Lists all admin users with their role, assigned tenants,
 * active status, and last login timestamp. Provides links to create and edit.
 *
 * Access: redirects to /admin/tenants if the current user is not a superadmin.
 */

import Link                        from "next/link";
import { requireSuperAdmin }       from "@/lib/admin-auth/authorization";
import { listAdminUsersWithTenants } from "@/data/admin-auth";
import { Badge }                   from "@/components/ui/Badge";
import { Card, CardContent }       from "@/components/ui/Card";
import { Text }                    from "@/components/primitives/Text";
import type { SafeAdminUserWithTenants } from "@/data/admin-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadgeVariant(role: string): "default" | "primary" | "success" | "warning" | "error" | "outline" {
  return role === "superadmin" ? "primary" : "default";
}

function formatLastLogin(ts: string | null): string {
  if (!ts) return "Never";
  const date = new Date(ts);
  return date.toLocaleDateString("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

function formatRole(role: string): string {
  if (role === "superadmin")  return "Superadmin";
  if (role === "tenant_admin") return "Tenant admin";
  return role;
}

// ── Row component ─────────────────────────────────────────────────────────────

function UserRow({ user }: { user: SafeAdminUserWithTenants }) {
  return (
    <tr className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
      {/* Name + email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">{user.name}</p>
            <p className="text-xs text-neutral-400">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        <Badge variant={roleBadgeVariant(user.role)} size="sm">
          {formatRole(user.role)}
        </Badge>
      </td>

      {/* Assigned tenants */}
      <td className="px-4 py-3">
        {user.role === "superadmin" ? (
          <span className="text-xs text-neutral-400 italic">All tenants</span>
        ) : user.tenant_ids.length === 0 ? (
          <span className="text-xs text-neutral-400">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {user.tenant_ids.slice(0, 3).map((tid) => (
              <span
                key={tid}
                className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
              >
                {tid}
              </span>
            ))}
            {user.tenant_ids.length > 3 && (
              <span className="text-[10px] text-neutral-400">
                +{user.tenant_ids.length - 3} more
              </span>
            )}
          </div>
        )}
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
        <Link
          href={`/admin/users/${user.id}`}
          className="text-xs text-neutral-400 hover:text-brand-700 transition-colors"
          aria-label={`Edit ${user.name}`}
        >
          Edit →
        </Link>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminUsersPage() {
  // Enforce superadmin — redirects to /admin/tenants if not.
  await requireSuperAdmin();

  const users = await listAdminUsersWithTenants();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Text variant="h2">Users</Text>
          <Text variant="body-sm" color="muted" className="mt-1">
            {users.length} admin user{users.length !== 1 ? "s" : ""} registered
          </Text>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors"
        >
          + New user
        </Link>
      </div>

      {/* Table */}
      {users.length === 0 ? (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-sm text-neutral-400">
              No users found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {(["User", "Role", "Assigned tenants", "Status", "2FA", "Last login", ""] as const).map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
