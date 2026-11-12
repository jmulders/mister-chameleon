/**
 * Does a platform Content entry exist for this variant? Server-side read.
 */
import "server-only";

import { getDb } from "@/data/db";
import { logger } from "@/lib/logger";

/**
 * True when a platform_cms_content row exists for this tenant + variant_type +
 * variant_key. Pure read, no auth: the snippet path calls it on every slot.
 *
 * It lives here and not in platform-content-override.ts because that file is
 * "use server", and every export of such a file is a public endpoint. The
 * server action there wraps this with the session and tenant checks.
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
