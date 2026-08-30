/**
 * UserForm
 *
 * Shared form UI for creating and editing admin users.
 * Server component — all inputs are plain HTML; no "use client" needed.
 *
 * Used by:
 *   /admin/users/new/page.tsx      (mode: "create")
 *   /admin/users/[userId]/page.tsx (mode: "edit")
 */

import Link                              from "next/link";
import type { SafeAdminUserWithTenants } from "@/data/admin-auth";
import type { TenantSettings }           from "@/tenant/server";

// ── Shared field style ────────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm " +
  "text-neutral-900 placeholder-neutral-400 shadow-sm " +
  "focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 " +
  "disabled:bg-neutral-50 disabled:text-neutral-500";

const LABEL_CLS = "mb-1.5 block text-sm font-medium text-neutral-700";

// ── Props ─────────────────────────────────────────────────────────────────────

interface UserFormProps {
  /** "create" renders the password field as required; "edit" makes it optional. */
  mode:       "create" | "edit";
  /** Existing user data for pre-filling in edit mode. */
  user?:      SafeAdminUserWithTenants;
  /** All tenants for the assignment checkbox list. */
  tenants:    TenantSettings[];
  /** Server action to invoke on submit. Errors are communicated via redirect searchParams. */
  action:     (formData: FormData) => Promise<void>;
  /** Error message from a prior failed submit (read from searchParams by the page). */
  error?:     string | null;
  /**
   * Whether the admin_user_tenants table exists in the database (migration 21).
   * When false, the assignment section shows a "pending migration" notice and
   * the checkboxes are disabled — no silent loss of submitted assignments.
   */
  tenantAssignmentsReady?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserForm({ mode, user, tenants, action, error, tenantAssignmentsReady = false }: UserFormProps) {
  const isEdit     = mode === "edit";
  const assignedIds = user?.tenant_ids ?? [];

  return (
    <form action={action} className="space-y-6">
      {/* Hidden user ID for edit mode */}
      {isEdit && user && (
        <input type="hidden" name="userId" value={user.id} />
      )}

      {/* Error banner (populated from searchParams by the parent page) */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Profile fields ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Profile</h2>
        </div>
        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          {/* Name */}
          <div>
            <label htmlFor="name" className={LABEL_CLS}>
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              defaultValue={user?.name ?? ""}
              placeholder="Jane Smith"
              className={INPUT_CLS}
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className={LABEL_CLS}>
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={user?.email ?? ""}
              placeholder="jane@example.com"
              className={INPUT_CLS}
            />
          </div>

          {/* Role */}
          <div>
            <label htmlFor="role" className={LABEL_CLS}>
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              name="role"
              required
              defaultValue={user?.role ?? "tenant_admin"}
              className={INPUT_CLS}
            >
              <option value="tenant_admin">Tenant admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
            <p className="mt-1.5 text-xs text-neutral-400">
              Superadmins can access all tenants and manage platform users.
            </p>
          </div>

          {/* is_active — edit only */}
          {isEdit && (
            <div className="flex items-center gap-3 pt-6">
              <input
                id="is_active"
                name="is_active"
                type="checkbox"
                value="1"
                defaultChecked={user?.is_active ?? true}
                className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-neutral-700">
                Account active
              </label>
            </div>
          )}
        </div>
      </section>

      {/* ── Password (create mode only) ──────────────────────────────── */}
      {/* In edit mode, password is changed via the dedicated PasswordResetSection
          on the edit page, keeping profile updates and password resets separate. */}
      {!isEdit && (
        <section className="rounded-xl border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-neutral-900">Password</h2>
          </div>
          <div className="px-6 py-5">
            <label htmlFor="password" className={LABEL_CLS}>
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="Min. 12 characters"
              className={INPUT_CLS}
            />
            <p className="mt-1.5 text-xs text-neutral-400">
              Minimum 12 characters with uppercase, lowercase, and a digit.
            </p>
          </div>
        </section>
      )}

      {/* ── Tenant assignments ────────────────────────────────────────────── */}
      <section className="rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Tenant access</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Superadmins can access all tenants regardless of this list.
            Tenant admins can only access tenants checked here.
          </p>
        </div>
        <div className="px-6 py-5">
          {/* Migration-pending notice ── shown when admin_user_tenants doesn't exist yet */}
          {!tenantAssignmentsReady && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-medium">Tenant assignments not yet available</p>
              <p className="mt-1 text-xs text-amber-700">
                The <code className="rounded bg-amber-100 px-1 font-mono">admin_user_tenants</code>{" "}
                table does not exist: migration 21 has not been applied.
                Checkboxes are shown for preview only; selections will not be saved.{" "}
                <Link
                  href="/admin/setup"
                  className="underline hover:text-amber-900 transition-colors"
                >
                  Apply migration →
                </Link>
              </p>
            </div>
          )}
          {tenants.length === 0 ? (
            <p className="text-sm text-neutral-400">No tenants registered yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {tenants.map((tenant) => {
                const checked = assignedIds.includes(tenant.tenantId);
                return (
                  <li key={tenant.tenantId} className="flex items-center gap-3 py-2.5">
                    <input
                      id={`tenant-${tenant.tenantId}`}
                      name="tenant_ids"
                      type="checkbox"
                      value={tenant.tenantId}
                      defaultChecked={checked}
                      disabled={!tenantAssignmentsReady}
                      className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 disabled:opacity-40"
                    />
                    <label
                      htmlFor={`tenant-${tenant.tenantId}`}
                      className={[
                        "flex flex-1 items-center justify-between gap-2 text-sm",
                        !tenantAssignmentsReady ? "opacity-40" : "",
                      ].join(" ")}
                    >
                      <span className="font-medium text-neutral-800">
                        {tenant.name ?? tenant.tenantId}
                      </span>
                      <span className="text-xs text-neutral-400">{tenant.tenantId}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors"
        >
          {isEdit ? "Save changes" : "Create user"}
        </button>
        <Link
          href="/admin/users"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
