"use server";

/**
 * Self-service actions (tenant-scoped).
 *
 * Thin wrappers around the self-service store so the settings page can read and
 * flip a tenant's self-service mode.
 */

import { revalidatePath } from "next/cache";
import { isSelfServiceEnabled, setSelfServiceEnabled } from "@/lib/self-service/self-service-store";

export async function getSelfServiceEnabledAction(tenantId: string): Promise<boolean> {
  return isSelfServiceEnabled(tenantId);
}

export async function setSelfServiceEnabledAction(
  tenantId: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await setSelfServiceEnabled(tenantId, enabled);
  if (result.ok) {
    revalidatePath(`/admin/tenants/${tenantId}/settings`);
  }
  return result;
}
