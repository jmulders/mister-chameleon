"use server";

/**
 * Read-only detection: does a platform Content entry (platform_cms_content)
 * exist for the same variant_type + variant_key as an adaptive block?
 *
 * Snippet slots resolve PLATFORM-FIRST (cms/providers/platform-first-variants.ts):
 * a platform_cms_content row wins over the tenant's adaptive_blocks row for the
 * same key. So an adaptive-block variant edited in Personalization -> Blocks can
 * be silently shadowed by a like-named Content entry. The block editor uses this
 * to warn the operator. This does NOT change resolution — detection only.
 */

import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";
import { hasPlatformContentEntry } from "./platform-content-entry";

export async function checkPlatformContentOverrideAction(
  tenantId: string,
  variantType: string,
  variantKey: string,
): Promise<{ overridden: boolean }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  return { overridden: await hasPlatformContentEntry(tenantId, variantType, variantKey) };
}
