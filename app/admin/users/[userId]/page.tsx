/**
 * Admin — Edit User
 *
 * Edit form for an existing admin user.  Superadmin only.
 * Shows the shared UserForm in "edit" mode, plus a separate password-reset
 * section and key metadata (2FA status, last login, created date).
 */

import { notFound }                  from "next/navigation";
import { requireSuperAdmin }         from "@/lib/admin-auth/authorization";
import {
  findAdminUserById,
  getTenantIdsForUser,
  isAdminUserTenantsAvailable,
}                                    from "@/data/admin-auth";
import { getAllTenants }             from "@/tenant/server";
import { Badge }                     from "@/components/ui/Badge";
import { Text }                      from "@/components/primitives/Text";
import { UserForm }                  from "../UserForm";
import { updateUserAction, resetPasswordAction } from "../actions";
import type { SafeAdminUserWithTenants } from "@/data/admin-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Metadata section ──────────────────────────────────────────────────────────

function UserMeta({ user }: { user: SafeAdminUserWithTenants }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Account info</h2>
      </div>
      <dl className="divide-y divide-neutral-100 px-6">
        <div className="flex items-center justify-between py-3">
          <dt className="text-xs font-medium text-neutral-500">User ID</dt>
          <dd className="font-mono text-xs text-neutral-700">{user.id}</dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-xs font-medium text-neutral-500">Two-factor auth</dt>
          <dd>
            <Badge
              variant={user.two_factor_enabled ? "success" : "outline"}
              size="sm"
            >
              {user.two_factor_enabled ? "Enabled" : "Disabled"}
            </Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-xs font-medium text-neutral-500">Last login</dt>
          <dd className="text-xs text-neutral-700">{formatDate(user.last_login_at)}</dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-xs font-medium text-neutral-500">Created</dt>
          <dd className="text-xs text-neutral-700">{formatDate(user.created_at)}</dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-xs font-medium text-neutral-500">Last updated</dt>
          <dd className="text-xs text-neutral-700">{formatDate(user.updated_at)}</dd>
        </div>
      </dl>
    </section>
  );
}

// ── Password-reset section ─────────────────────────────────────────────────────

function PasswordResetSection({ userId, success }: { userId: string; success: boolean }) {
  const INPUT_CLS =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm " +
    "text-neutral-900 placeholder-neutral-400 shadow-sm " +
    "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">Reset password</h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          Set a new password for this user. They will be able to log in immediately.
        </p>
      </div>
      <div className="px-6 py-5">
        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Password has been reset successfully.
          </div>
        )}
        <form action={resetPasswordAction} className="flex items-end gap-3">
          <input type="hidden" name="userId" value={userId} />
          <div className="flex-1">
            <label
              htmlFor="newPassword"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Min. 12 characters"
              className={INPUT_CLS}
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-colors"
          >
            Set password
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-400">
          Minimum 12 characters with uppercase, lowercase, and a digit.
        </p>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params:       Promise<{ userId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}

export default async function EditUserPage({ params, searchParams }: Props) {
  // Enforce superadmin
  await requireSuperAdmin();

  const { userId }       = await params;
  const { success, error } = await searchParams;

  // Load user, tenants, and migration status in parallel
  const [userBase, tenants, tenantAssignmentsReady] = await Promise.all([
    findAdminUserById(userId),
    getAllTenants(),
    isAdminUserTenantsAvailable(),
  ]);

  if (!userBase) notFound();

  // Enrich with tenant IDs (returns [] gracefully when table doesn't exist yet)
  const tenantIds = await getTenantIdsForUser(userId);
  const user: SafeAdminUserWithTenants = { ...userBase, tenant_ids: tenantIds };

  const passwordResetSuccess = success === "password_reset";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <Text variant="h2">{user.name}</Text>
          <p className="text-sm text-neutral-400">{user.email}</p>
        </div>
      </div>

      <div className="grid max-w-4xl gap-6 lg:grid-cols-3">
        {/* Left column — edit form (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          <UserForm
            mode="edit"
            user={user}
            tenants={tenants}
            action={updateUserAction}
            error={error ? decodeURIComponent(error) : null}
            tenantAssignmentsReady={tenantAssignmentsReady}
          />

          {/* Password reset — separate form so it doesn't interfere with profile save */}
          <PasswordResetSection userId={userId} success={passwordResetSuccess} />
        </div>

        {/* Right column — metadata (1/3 width) */}
        <div>
          <UserMeta user={user} />
        </div>
      </div>
    </div>
  );
}
