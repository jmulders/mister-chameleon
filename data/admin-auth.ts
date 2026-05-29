/**
 * Admin auth DB queries.
 *
 * All reads and writes use the service-role Supabase client (bypasses RLS).
 * The admin_users table itself has RLS enabled with no permissive policies,
 * so only service-role access is possible — no anon or user-scoped queries work.
 *
 * ─── Supabase typing note ─────────────────────────────────────────────────────
 *
 *   The hand-authored Database type in data/types.ts does not satisfy the full
 *   supabase-js v2 generic constraint (missing PostgrestVersion internals), so
 *   .from("admin_users") is reached via a typed `any` cast to avoid the pre-existing
 *   "never" overload errors that affect all repositories in this codebase.
 *   Return values are then re-typed at the boundary.  This matches the established
 *   pattern in data/repositories/*.ts.
 *
 * ─── Safety rules ─────────────────────────────────────────────────────────────
 *
 *   1. Never return password_hash to callers — strip it at the boundary.
 *   2. Never log two_factor_secret or backup codes.
 *   3. Only select the columns that each caller actually needs.
 */
import "server-only";

import { getDb }                        from "./db";
import type { AdminUserRow, AdminUserInsert } from "./types";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns the admin_users query builder, bypassing the supabase-js generic
 * constraint that produces "never" overload errors for hand-authored types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adminTable(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getDb() as any).from("admin_users");
}

/** Returns the admin_user_tenants query builder. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tenantAssignmentTable(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (getDb() as any).from("admin_user_tenants");
}

function now(): string {
  return new Date().toISOString();
}

// ── Safe user shape (no password hash) ───────────────────────────────────────

/** AdminUserRow with the password hash removed — safe to pass around in server code. */
export type SafeAdminUser = Omit<AdminUserRow, "password_hash">;

/**
 * SafeAdminUser enriched with the list of tenant IDs the user is assigned to.
 * Used in the user management list page.
 */
export type SafeAdminUserWithTenants = SafeAdminUser & {
  tenant_ids: string[];
};

const SAFE_COLUMNS =
  "id, email, name, role, is_active, two_factor_enabled, two_factor_secret, " +
  "two_factor_pending_secret, two_factor_backup_codes, two_factor_enabled_at, " +
  "last_login_at, created_at, updated_at";

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Finds an admin user by email for login.
 * Returns the FULL row including password_hash so the caller can verify it.
 * The caller must not forward the row to client-facing code.
 */
export async function findAdminUserByEmailForLogin(
  email: string,
): Promise<AdminUserRow | null> {
  const { data, error } = await adminTable()
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error || !data) return null;
  return data as AdminUserRow;
}

/**
 * Finds an admin user by ID.
 * Strips the password hash before returning — safe for session hydration.
 */
export async function findAdminUserById(id: string): Promise<SafeAdminUser | null> {
  const { data, error } = await adminTable()
    .select(SAFE_COLUMNS)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as SafeAdminUser;
}

/**
 * Returns all admin users ordered by creation date (newest first).
 * Strips password hashes — safe for the superadmin user-management UI.
 */
export async function listAdminUsers(): Promise<SafeAdminUser[]> {
  const { data, error } = await adminTable()
    .select(SAFE_COLUMNS)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as SafeAdminUser[];
}

/**
 * Returns all admin users with their tenant assignment IDs in a single
 * round-trip pair (two parallel queries, then joined in memory).
 * Superadmin users will have an empty array — they have implicit access to all
 * tenants and do not require rows in admin_user_tenants.
 */
export async function listAdminUsersWithTenants(): Promise<SafeAdminUserWithTenants[]> {
  const [usersResult, assignmentsResult] = await Promise.all([
    adminTable()
      .select(SAFE_COLUMNS)
      .order("created_at", { ascending: false }),
    tenantAssignmentTable()
      .select("user_id, tenant_id"),
  ]);

  if (usersResult.error || !usersResult.data) return [];

  const users = usersResult.data as SafeAdminUser[];
  const assignments = (assignmentsResult.data ?? []) as Array<{
    user_id:   string;
    tenant_id: string;
  }>;

  // Group tenant IDs by user_id
  const byUser = new Map<string, string[]>();
  for (const { user_id, tenant_id } of assignments) {
    const arr = byUser.get(user_id) ?? [];
    arr.push(tenant_id);
    byUser.set(user_id, arr);
  }

  return users.map((u) => ({ ...u, tenant_ids: byUser.get(u.id) ?? [] }));
}

// ── Writes ────────────────────────────────────────────────────────────────────

/** Creates a new admin user. Returns the created row (without password_hash) or null on error. */
export async function createAdminUser(
  insert: AdminUserInsert,
): Promise<SafeAdminUser | null> {
  const { data, error } = await adminTable()
    .insert({ ...insert, email: insert.email.toLowerCase().trim() })
    .select(SAFE_COLUMNS)
    .single();

  if (error) {
    // Log only the message — never log the insert payload (contains password_hash).
    console.error("[admin-auth] createAdminUser error:", error.message);
    return null;
  }
  return data as SafeAdminUser;
}

/**
 * Updates mutable profile fields for a user (name, email, role, is_active).
 * Does NOT update the password — use resetAdminUserPassword() for that.
 * Returns the updated row (without password_hash) or null on error.
 */
export async function updateAdminUser(
  id:      string,
  updates: {
    name?:      string;
    email?:     string;
    role?:      string;
    is_active?: boolean;
  },
): Promise<SafeAdminUser | null> {
  const patch: Record<string, unknown> = { ...updates, updated_at: now() };
  if (updates.email) patch.email = (updates.email as string).toLowerCase().trim();

  const { data, error } = await adminTable()
    .update(patch)
    .eq("id", id)
    .select(SAFE_COLUMNS)
    .single();

  if (error) {
    console.error("[admin-auth] updateAdminUser error:", error.message);
    return null;
  }
  return data as SafeAdminUser;
}

/**
 * Sets a new bcrypt password hash for a user.
 * The caller is responsible for hashing the plaintext before calling this.
 */
export async function resetAdminUserPassword(
  id:           string,
  passwordHash: string,
): Promise<boolean> {
  const { error } = await adminTable()
    .update({ password_hash: passwordHash, updated_at: now() })
    .eq("id", id);
  return !error;
}

/** Applies a partial update to an admin user row. Internal helper. */
async function patchAdminUser(
  id: string,
  updates: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await adminTable()
    .update({ ...updates, updated_at: now() })
    .eq("id", id);
  return !error;
}

/** Records the current timestamp as last_login_at for a user. */
export async function touchLastLogin(id: string): Promise<void> {
  await adminTable()
    .update({ last_login_at: now(), updated_at: now() })
    .eq("id", id);
}

// ── 2FA-specific helpers ──────────────────────────────────────────────────────

/**
 * Stores a pending (unverified) TOTP secret during the setup flow.
 * The pending secret is promoted to the live secret by enableTwoFactor().
 */
export async function setPendingTotpSecret(
  id: string,
  pendingSecret: string,
): Promise<boolean> {
  return patchAdminUser(id, { two_factor_pending_secret: pendingSecret });
}

/**
 * Promotes the pending TOTP secret to the live secret, stores hashed backup codes,
 * and marks 2FA as enabled.
 * Clears two_factor_pending_secret after promotion.
 */
export async function enableTwoFactor(
  id: string,
  hashedBackupCodes: string[],
): Promise<boolean> {
  // Read the pending secret first
  const { data, error: readError } = await adminTable()
    .select("two_factor_pending_secret")
    .eq("id", id)
    .single();

  if (readError || !data?.two_factor_pending_secret) return false;

  const { error } = await adminTable()
    .update({
      two_factor_enabled:        true,
      two_factor_secret:         data.two_factor_pending_secret as string,
      two_factor_pending_secret: null,
      two_factor_backup_codes:   hashedBackupCodes,
      two_factor_enabled_at:     now(),
      updated_at:                now(),
    })
    .eq("id", id);

  return !error;
}

/**
 * Disables 2FA for a user.
 * Clears all TOTP fields — the user will need to re-run setup to re-enable.
 */
export async function disableTwoFactor(id: string): Promise<boolean> {
  return patchAdminUser(id, {
    two_factor_enabled:        false,
    two_factor_secret:         null,
    two_factor_pending_secret: null,
    two_factor_backup_codes:   null,
    two_factor_enabled_at:     null,
  });
}

/**
 * Persists an updated (code-consumed) backup code array after a backup code is used.
 */
export async function persistBackupCodes(
  id: string,
  hashedCodes: string[],
): Promise<boolean> {
  return patchAdminUser(id, { two_factor_backup_codes: hashedCodes });
}

/**
 * Replaces the backup codes with a fresh set.
 */
export async function replaceBackupCodes(
  id: string,
  hashedCodes: string[],
): Promise<boolean> {
  return patchAdminUser(id, { two_factor_backup_codes: hashedCodes });
}

// ── Tenant assignment helpers ─────────────────────────────────────────────────

/**
 * Returns true when the admin_user_tenants table is present and queryable.
 *
 * The table is created by migration 21.  In environments where that migration
 * has not yet run the table does not exist, so any query against it returns a
 * Supabase error.  Callers use this to render appropriate UI (e.g. a "pending
 * migration" notice in the user form) rather than silently failing.
 */
export async function isAdminUserTenantsAvailable(): Promise<boolean> {
  // Run a zero-row probe against the table.  Any DB error (including
  // "relation does not exist") means the table is not yet available.
  const { error } = await tenantAssignmentTable().select("user_id").limit(0);
  return !error;
}

/**
 * Returns the list of tenant IDs assigned to a user.
 * Superadmin users do not have rows here — the caller must short-circuit for
 * superadmins (they can access all tenants without assignments).
 */
export async function getTenantIdsForUser(userId: string): Promise<string[]> {
  const { data, error } = await tenantAssignmentTable()
    .select("tenant_id")
    .eq("user_id", userId);

  if (error || !data) return [];
  return (data as Array<{ tenant_id: string }>).map((r) => r.tenant_id);
}

/**
 * Returns the list of user IDs assigned to a specific tenant.
 * Useful for showing which operators manage a given tenant workspace.
 */
export async function getUserIdsForTenant(tenantId: string): Promise<string[]> {
  const { data, error } = await tenantAssignmentTable()
    .select("user_id")
    .eq("tenant_id", tenantId);

  if (error || !data) return [];
  return (data as Array<{ user_id: string }>).map((r) => r.user_id);
}

/**
 * Replaces the complete set of tenant assignments for a user.
 *
 * Uses delete-then-insert so the caller only supplies the desired final state.
 * Passing an empty array removes all tenant assignments for the user.
 *
 * @param userId    The admin user whose assignments will be replaced.
 * @param tenantIds The desired complete set of tenant IDs.
 * @returns true on success, false if any DB operation failed.
 */
export async function setUserTenantAssignments(
  userId:    string,
  tenantIds: string[],
): Promise<boolean> {
  // Remove all current assignments for this user
  const { error: deleteError } = await tenantAssignmentTable()
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    console.error("[admin-auth] setUserTenantAssignments delete error:", deleteError.message);
    return false;
  }

  // Nothing to insert — user has been unassigned from all tenants
  if (tenantIds.length === 0) return true;

  const rows = tenantIds.map((tenant_id) => ({
    user_id:     userId,
    tenant_id,
    assigned_at: now(),
  }));

  const { error: insertError } = await tenantAssignmentTable().insert(rows);
  if (insertError) {
    console.error("[admin-auth] setUserTenantAssignments insert error:", insertError.message);
    return false;
  }

  return true;
}

/**
 * Adds a single tenant assignment for a user without touching other assignments.
 * No-op if the assignment already exists (upsert semantics).
 */
export async function addUserToTenant(
  userId:   string,
  tenantId: string,
): Promise<boolean> {
  const { error } = await tenantAssignmentTable()
    .upsert({ user_id: userId, tenant_id: tenantId, assigned_at: now() }, { onConflict: "user_id,tenant_id" });

  if (error) {
    console.error("[admin-auth] addUserToTenant error:", error.message);
    return false;
  }
  return true;
}

/**
 * Removes a single tenant assignment for a user without touching other assignments.
 */
export async function removeUserFromTenant(
  userId:   string,
  tenantId: string,
): Promise<boolean> {
  const { error } = await tenantAssignmentTable()
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  if (error) {
    console.error("[admin-auth] removeUserFromTenant error:", error.message);
    return false;
  }
  return true;
}

/**
 * Returns all admin users assigned to a specific tenant, with full safe profile.
 * Excludes superadmins (who have implicit platform-wide access without rows here).
 */
export async function listUsersForTenant(tenantId: string): Promise<SafeAdminUser[]> {
  const userIds = await getUserIdsForTenant(tenantId);
  if (userIds.length === 0) return [];

  const { data, error } = await adminTable()
    .select("id, name, email, role, is_active, two_factor_enabled, last_login_at, created_at")
    .in("id", userIds);

  if (error || !data) return [];
  return data as SafeAdminUser[];
}

/**
 * Returns all superadmin users (platform-wide access, not tenant-scoped).
 */
export async function listSuperAdmins(): Promise<SafeAdminUser[]> {
  const { data, error } = await adminTable()
    .select("id, name, email, role, is_active, two_factor_enabled, last_login_at, created_at")
    .in("role", ["superadmin", "admin"]);

  if (error || !data) return [];
  return data as SafeAdminUser[];
}
