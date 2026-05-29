"use server";

import { redirect }           from "next/navigation";
import { isRedirectError }    from "next/dist/client/components/redirect-error";
import { requireSuperAdmin }  from "@/lib/admin-auth/authorization";
import {
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  setUserTenantAssignments,
}                             from "@/data/admin-auth";
import {
  hashPassword,
  validatePasswordStrength,
} from "@/lib/admin-auth/password";

// ── Internal auth helper ──────────────────────────────────────────────────────

/**
 * Enforces superadmin access for server actions.
 *
 * Delegates to requireSuperAdmin() which handles all role variants:
 *   • "superadmin"   — canonical post-migration-21 role
 *   • "admin"        — legacy pre-migration-21 role (treated as full superadmin)
 *
 * Redirects to /admin/login if not authenticated, /admin/tenants if not superadmin.
 */
async function assertSuperAdminAction(): Promise<void> {
  await requireSuperAdmin();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses the tenant checkboxes from a FormData.
 * Multiple values submitted under the same key "tenant_ids".
 */
function parseTenantIds(formData: FormData): string[] {
  return formData.getAll("tenant_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function formString(formData: FormData, key: string): string {
  return (formData.get(key) as string | null)?.trim() ?? "";
}

/** Encodes an error message as a safe URL query parameter value. */
function encodeErr(msg: string): string {
  return encodeURIComponent(msg);
}

// ── createUserAction ──────────────────────────────────────────────────────────

/**
 * Creates a new admin user.  Superadmin only.
 *
 * On validation or DB failure: redirects to /admin/users/new?error=<message>.
 * On success:                  redirects to /admin/users.
 *
 * Form fields:
 *   name         — display name (required)
 *   email        — email address (required, must be unique)
 *   role         — "superadmin" | "tenant_admin" (required)
 *   password     — plaintext password (required, validated for strength)
 *   tenant_ids[] — zero or more tenant slugs
 */
export async function createUserAction(formData: FormData): Promise<void> {
  const BACK = "/admin/users/new";
  try {
    await assertSuperAdminAction();

    const name     = formString(formData, "name");
    const email    = formString(formData, "email");
    const role     = formString(formData, "role");
    const password = formString(formData, "password");

    if (!name)  redirect(`${BACK}?error=${encodeErr("Name is required.")}`);
    if (!email) redirect(`${BACK}?error=${encodeErr("Email is required.")}`);
    if (!role || !["superadmin", "tenant_admin"].includes(role)) {
      redirect(`${BACK}?error=${encodeErr("Please select a valid role.")}`);
    }

    const pwError = validatePasswordStrength(password);
    if (pwError) redirect(`${BACK}?error=${encodeErr(pwError)}`);

    const passwordHash = await hashPassword(password);
    const created = await createAdminUser({
      name,
      email,
      role,
      password_hash: passwordHash,
      is_active:     true,
    });

    if (!created) {
      redirect(`${BACK}?error=${encodeErr("Failed to create user. The email address may already be in use.")}`);
    }

    const tenantIds = parseTenantIds(formData);
    await setUserTenantAssignments(created.id, tenantIds);

    redirect("/admin/users");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[createUserAction]", err);
    redirect(`${BACK}?error=${encodeErr("An unexpected error occurred. Please try again.")}`);
  }
}

// ── updateUserAction ──────────────────────────────────────────────────────────

/**
 * Updates an existing admin user's profile and tenant assignments.
 * Superadmin only.
 *
 * On failure:  redirects to /admin/users/[userId]?error=<message>.
 * On success:  redirects to /admin/users.
 *
 * Form fields:
 *   userId       — UUID of the user to update (hidden field, required)
 *   name         — display name (required)
 *   email        — email address (required)
 *   role         — "superadmin" | "tenant_admin" (required)
 *   is_active    — "1" when checked, absent when unchecked
 *   tenant_ids[] — zero or more tenant slugs
 */
export async function updateUserAction(formData: FormData): Promise<void> {
  const userId = formString(formData, "userId");
  const BACK = `/admin/users/${userId}`;

  try {
    await assertSuperAdminAction();

    if (!userId) redirect(`/admin/users?error=${encodeErr("User ID is missing.")}`);

    const name     = formString(formData, "name");
    const email    = formString(formData, "email");
    const role     = formString(formData, "role");
    const isActive = formData.get("is_active") === "1";

    if (!name)  redirect(`${BACK}?error=${encodeErr("Name is required.")}`);
    if (!email) redirect(`${BACK}?error=${encodeErr("Email is required.")}`);
    if (!role || !["superadmin", "tenant_admin"].includes(role)) {
      redirect(`${BACK}?error=${encodeErr("Please select a valid role.")}`);
    }

    const updated = await updateAdminUser(userId, { name, email, role, is_active: isActive });
    if (!updated) {
      redirect(`${BACK}?error=${encodeErr("Failed to update user. The email address may already be in use.")}`);
    }

    const tenantIds = parseTenantIds(formData);
    await setUserTenantAssignments(userId, tenantIds);

    redirect("/admin/users");
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[updateUserAction]", err);
    redirect(`${BACK}?error=${encodeErr("An unexpected error occurred. Please try again.")}`);
  }
}

// ── resetPasswordAction ───────────────────────────────────────────────────────

/**
 * Resets a user's password.  Superadmin only.
 *
 * On failure:  redirects to /admin/users/[userId]?error=<message>.
 * On success:  redirects to /admin/users/[userId]?success=password_reset.
 *
 * Form fields:
 *   userId      — UUID of the user (hidden field, required)
 *   newPassword — new plaintext password (required, validated for strength)
 */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const userId = formString(formData, "userId");
  const BACK = `/admin/users/${userId}`;

  try {
    await assertSuperAdminAction();

    if (!userId) redirect(`/admin/users?error=${encodeErr("User ID is missing.")}`);

    const newPassword = formString(formData, "newPassword");

    const pwError = validatePasswordStrength(newPassword);
    if (pwError) redirect(`${BACK}?error=${encodeErr(pwError)}`);

    const newHash = await hashPassword(newPassword);
    const ok = await resetAdminUserPassword(userId, newHash);
    if (!ok) redirect(`${BACK}?error=${encodeErr("Failed to reset password. Please try again.")}`);

    redirect(`${BACK}?success=password_reset`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("[resetPasswordAction]", err);
    redirect(`${BACK}?error=${encodeErr("An unexpected error occurred. Please try again.")}`);
  }
}
