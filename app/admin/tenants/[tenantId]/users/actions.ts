"use server";

import { redirect }           from "next/navigation";
import { isRedirectError }    from "next/dist/client/components/redirect-error";
import { requireSuperAdmin }  from "@/lib/admin-auth/authorization";
import {
  addUserToTenant,
  removeUserFromTenant,
  listAdminUsers,
  getTenantIdsForUser,
  setUserTenantAssignments,
} from "@/data/admin-auth";

function encodeErr(msg: string): string {
  return encodeURIComponent(msg);
}

/**
 * Adds an existing user to a tenant by inserting a single assignment row.
 * Superadmin only.
 */
export async function addUserToTenantAction(formData: FormData): Promise<void> {
  const tenantId = (formData.get("tenantId") as string | null)?.trim() ?? "";
  const userId   = (formData.get("userId")   as string | null)?.trim() ?? "";
  const BACK = `/admin/tenants/${tenantId}/users`;

  try {
    await requireSuperAdmin();

    if (!tenantId || !userId) {
      redirect(`${BACK}?error=${encodeErr("Missing tenant or user ID.")}`);
    }

    const ok = await addUserToTenant(userId, tenantId);
    if (!ok) {
      redirect(`${BACK}?error=${encodeErr("Failed to add user to tenant.")}`);
    }

    redirect(BACK);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[addUserToTenantAction]", err);
    redirect(`${BACK}?error=${encodeErr("An unexpected error occurred.")}`);
  }
}

/**
 * Removes a user from a tenant by deleting their single assignment row.
 * Superadmin only.
 */
export async function removeUserFromTenantAction(formData: FormData): Promise<void> {
  const tenantId = (formData.get("tenantId") as string | null)?.trim() ?? "";
  const userId   = (formData.get("userId")   as string | null)?.trim() ?? "";
  const BACK = `/admin/tenants/${tenantId}/users`;

  try {
    await requireSuperAdmin();

    if (!tenantId || !userId) {
      redirect(`${BACK}?error=${encodeErr("Missing tenant or user ID.")}`);
    }

    const ok = await removeUserFromTenant(userId, tenantId);
    if (!ok) {
      redirect(`${BACK}?error=${encodeErr("Failed to remove user from tenant.")}`);
    }

    redirect(BACK);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[removeUserFromTenantAction]", err);
    redirect(`${BACK}?error=${encodeErr("An unexpected error occurred.")}`);
  }
}
