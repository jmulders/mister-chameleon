"use server";

/**
 * Retention policy actions (tenant-scoped).
 *
 * Thin wrappers around the retention-policy store so the settings page can
 * read and update a tenant's post-termination deletion window.
 */

import { revalidatePath } from "next/cache";
import {
  getRetentionPolicy,
  setRetentionPolicy,
  type RetentionPolicy,
} from "@/lib/retention/retention-policy-store";
import { requireTenantAction } from "@/lib/admin-auth/action-guard";

export async function getRetentionPolicyAction(tenantId: string): Promise<RetentionPolicy> {
  await requireTenantAction(tenantId);

  return getRetentionPolicy(tenantId);
}

export async function setRetentionPolicyAction(
  tenantId: string,
  postTerminationDeletionDays: number,
  effectiveFrom: string | null,
): Promise<{ ok: true; policy: RetentionPolicy } | { ok: false; error: string }> {
  await requireTenantAction(tenantId);

  const result = await setRetentionPolicy(tenantId, { postTerminationDeletionDays, effectiveFrom });
  if (result.ok) {
    revalidatePath(`/admin/tenants/${tenantId}/settings`);
  }
  return result;
}
