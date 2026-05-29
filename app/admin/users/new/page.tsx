/**
 * Admin — Create User
 *
 * Form to create a new admin user.  Superadmin only.
 * Renders the shared UserForm in "create" mode.
 */

import { requireSuperAdmin }         from "@/lib/admin-auth/authorization";
import { getAllTenants }             from "@/tenant/server";
import { isAdminUserTenantsAvailable } from "@/data/admin-auth";
import { Text }                      from "@/components/primitives/Text";
import { UserForm }                  from "../UserForm";
import { createUserAction }          from "../actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewUserPage({ searchParams }: Props) {
  // Enforce superadmin
  await requireSuperAdmin();

  const { error } = await searchParams;
  const [tenants, tenantAssignmentsReady] = await Promise.all([
    getAllTenants(),
    isAdminUserTenantsAvailable(),
  ]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Text variant="h2">Create user</Text>
        <Text variant="body-sm" color="muted" className="mt-1">
          New users can log in immediately after creation.
        </Text>
      </div>

      <div className="max-w-2xl">
        <UserForm
          mode="create"
          tenants={tenants}
          action={createUserAction}
          error={error ? decodeURIComponent(error) : null}
          tenantAssignmentsReady={tenantAssignmentsReady}
        />
      </div>
    </div>
  );
}
