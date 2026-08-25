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
import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

/**
 * True when a platform_cms_content row exists for this tenant + variant_type +
 * variant_key. Pure read (no auth), so it can be reused/tested; the server action
 * below wraps it with the admin-session + tenant-access checks.
 */
export async function hasPlatformContentEntry(
  tenantId: string,
  variantType: string,
  variantKey: string,
): Promise<boolean> {
  if (!tenantId || !variantType || !variantKey) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getDb() as any;
    const { data, error } = await db
      .from("platform_cms_content")
      .select("variant_key")
      .eq("tenant_id", tenantId)
      .eq("variant_type", variantType)
      .eq("variant_key", variantKey)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch (err) {
    logger.error("[blocks] platform-content override check failed", { tenantId, variantType, variantKey, err });
    return false;
  }
}

export async function checkPlatformContentOverrideAction(
  tenantId: string,
  variantType: string,
  variantKey: string,
): Promise<{ overridden: boolean }> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);
  return { overridden: await hasPlatformContentEntry(tenantId, variantType, variantKey) };
}
