/**
 * Asset Picker — server action
 *
 * Lightweight server action for the AssetPickerModal client component.
 * Returns tenant-scoped assets for display in the asset picker grid.
 *
 * ─── Usage in server components ──────────────────────────────────────────────
 *
 *   import { loadAssetsForPickerAction } from "@/lib/assets/asset-picker-action";
 *   import { AssetPickerModal }           from "@/components/admin/AssetPickerModal";
 *
 *   // In a server component that has admin session:
 *   <AssetPickerModal
 *     tenantId={tenantId}
 *     loadAssets={loadAssetsForPickerAction}
 *     onSelect={...}
 *     trigger={<button>Pick image</button>}
 *   />
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This action requires an active admin session.
 *   Tenant access is asserted before returning any data.
 */

"use server";

import { createClient }    from "@supabase/supabase-js";
import {
  getRequiredAdminSession,
  assertTenantAccess,
}                          from "@/lib/admin-auth/authorization";
import { getAssets }       from "@/lib/assets/tenant-assets";
import type { TenantAsset } from "@/lib/assets/tenant-assets";

/**
 * Load all image assets for a tenant, newest first.
 * Returns a maximum of 200 assets — sufficient for the picker grid.
 *
 * Suitable to pass as `loadAssets` to `<AssetPickerModal>`.
 */
export async function loadAssetsForPickerAction(
  tenantId: string,
): Promise<TenantAsset[]> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const client = createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );

  // Load ALL asset types (image + video); the AssetPickerModal filters by its
  // mode client-side. Hardcoding "image" here starved the video picker, which
  // then showed "No video assets in library yet" even with videos present.
  return getAssets(client, tenantId, { limit: 200 });
}
