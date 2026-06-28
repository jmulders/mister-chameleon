"use server";

/**
 * Tenant Workspace › Lead Base — Server Actions
 *
 * List + filter the unified visitor/lead profiles, and bulk-delete (right to
 * erasure). Export is done client-side from the filtered rows. PII is never held
 * here (it lives in abm_leads), so the export is pseudonymous + firmographic.
 * See docs/lead-base-design.md.
 */

import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import {
  listVisitorProfiles,
  deleteVisitorProfiles,
  type VisitorProfile,
  type VisitorProfileFilter,
} from "@/lib/lead-base/visitor-profiles-store";

export async function listLeadProfilesAction(
  tenantId: string,
  filter:   VisitorProfileFilter = {},
): Promise<VisitorProfile[]> {
  await getRequiredAdminSession();
  return listVisitorProfiles(tenantId, filter);
}

export async function deleteLeadProfilesAction(
  tenantId: string,
  ids:      string[],
): Promise<{ ok: boolean; deleted: number }> {
  await getRequiredAdminSession();
  const deleted = await deleteVisitorProfiles(tenantId, ids);
  return { ok: deleted > 0, deleted };
}
