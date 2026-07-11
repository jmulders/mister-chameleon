"use client";

/**
 * TenantUsersTables — client-side presentation of the per-tenant user lists.
 *
 * Receives the already-fetched assigned users and superadmins from the server
 * page and renders the same two tables, each sliced through its own
 * usePagination pager so long lists paginate without a server round-trip.
 */

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { usePagination, PaginationControls } from "@/components/admin/Pagination";
import { RemoveUserButton } from "./RemoveUserButton";
import type { SafeAdminUser } from "@/data/admin-auth";

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

// ── Tables ────────────────────────────────────────────────────────────────────

export function TenantUsersTables({
  assignedUsers,
  superAdmins,
  tenantId,
}: {
  assignedUsers: SafeAdminUser[];
  superAdmins:   SafeAdminUser[];
  tenantId:      string;
}) {
  const assignedPager = usePagination(assignedUsers, 25);
  const superPager    = usePagination(superAdmins, 25);

  return (
    <>
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
                {assignedPager.pageItems.map((user) => (
                  <AssignedUserRow key={user.id} user={user} tenantId={tenantId} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4">
            <PaginationControls {...assignedPager} label="gebruikers" />
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
              {superPager.pageItems.map((user) => (
                <SuperAdminRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4">
          <PaginationControls {...superPager} label="superadmins" />
        </div>
      </Card>
    </>
  );
}
