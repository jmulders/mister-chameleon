"use server";

/**
 * Tenant Storage Settings — Server Actions
 *
 * Reads and writes the per-tenant storage provider override.
 * Stored inside tenant_settings.settings.storage.activeProvider.
 *
 * Provider credentials (R2 keys, Supabase token, Sanity write token)
 * are always at platform level — only the active provider selection
 * is configurable per tenant.
 */

import { revalidatePath }           from "next/cache";
import {
  getRequiredAdminSession,
  assertTenantAccess,
}                                   from "@/lib/admin-auth/authorization";
import { getTenantById, saveTenant } from "@/tenant/tenant-store";
import { getStorageSettingsAction }  from "@/app/admin/platform/integrations/storage/actions";

export type StorageProviderKey =
  | "cloudflare_r2"
  | "supabase_storage"
  | "sanity_assets"
  | null;        // null = use platform default

export interface TenantStorageState {
  /** Tenant-specific override (null = use platform default). */
  tenantProvider:    StorageProviderKey;
  /** Platform-level active provider (what the platform would use without override). */
  platformProvider:  string;
  /** Display information about which providers are configured at platform level. */
  sanityConfigured:  boolean;
  r2Configured:      boolean;
  supabaseAvailable: true; // Supabase is always available
}

// ── getTenantStorageStateAction ───────────────────────────────────────────────

export async function getTenantStorageStateAction(
  tenantId: string,
): Promise<{ ok: true; state: TenantStorageState } | { ok: false; error: string }> {
  try {
    const session = await getRequiredAdminSession();
    await assertTenantAccess(session, tenantId);

    const [tenant, platformResult] = await Promise.all([
      getTenantById(tenantId),
      getStorageSettingsAction(),
    ]);

    const tenantProvider = (tenant?.storage?.activeProvider ?? null) as StorageProviderKey;

    if (!platformResult.ok) {
      return { ok: false, error: platformResult.error ?? "Could not load platform storage settings." };
    }

    return {
      ok: true,
      state: {
        tenantProvider,
        platformProvider: platformResult.config.effectiveProvider,
        sanityConfigured: platformResult.config.sanityConfigured,
        r2Configured:     platformResult.config.r2Configured,
        supabaseAvailable: true,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ── setTenantStorageProviderAction ────────────────────────────────────────────

/**
 * Set the active storage provider for a tenant.
 * Pass null to clear the override and revert to the platform default.
 */
export async function setTenantStorageProviderAction(
  tenantId: string,
  provider: StorageProviderKey,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await getRequiredAdminSession();
    await assertTenantAccess(session, tenantId);

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return { ok: false, error: `Tenant "${tenantId}" not found.` };
    }

    // Deep-merge: preserve all existing settings, update only storage.activeProvider.
    const updated = {
      ...tenant,
      storage: {
        ...(tenant.storage ?? {}),
        activeProvider: provider,
      },
    };

    await saveTenant(updated);

    revalidatePath(`/admin/tenants/${tenantId}/storage`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
