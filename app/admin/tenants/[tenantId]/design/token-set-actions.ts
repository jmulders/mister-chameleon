/**
 * Admin: Design Token Set server actions
 *
 * CRUD + apply for the design token set library (design_token_sets). Each action
 * is admin-guarded. Token payloads are validated on every create/update via
 * saveTokenSet, to which this file passes the real validateDesignTokenUpload.
 * "Apply" reuses the existing applyDesignTokensAction so the
 * merge-into-tokenOverrides logic is not duplicated.
 */

"use server";

import { revalidatePath } from "next/cache";
import { getRequiredAdminSession } from "@/lib/admin-auth/authorization";
import { validateDesignTokenUpload } from "@/tenant/design-token-validator";
import {
  getDesignTokenSetById,
  deleteDesignTokenSet,
} from "@/lib/design-token-sets/design-token-sets-store";
import { saveTokenSet, tokenSetToUploadPayload } from "@/lib/design-token-sets/save-token-set";
import { applyDesignTokensAction } from "@/app/admin/tenants/[tenantId]/actions";
import type { ApplyTokensResult } from "@/app/admin/tenants/[tenantId]/actions";

function designPath(tenantId: string): string {
  return `/admin/tenants/${tenantId}/design`;
}

/**
 * Create a new tenant-scoped token set from the given tokens (the tenant's
 * current tokenOverrides, or a pasted upload JSON).
 */
export async function saveDesignTokenSetAction(
  tenantId: string,
  input: { name: string; tokens: unknown; baseTheme?: string | null; typographyOverride?: Record<string, unknown> | null },
): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> {
  await getRequiredAdminSession();

  const res = await saveTokenSet({
    tenantId,
    name:               input.name,
    tokens:             input.tokens,
    baseTheme:          input.baseTheme ?? null,
    typographyOverride: input.typographyOverride ?? null,
  }, validateDesignTokenUpload);

  if (res.ok) revalidatePath(designPath(tenantId));
  return res;
}

/**
 * Update an existing set (rename and/or change tokens). Tokens are re-validated.
 */
export async function updateDesignTokenSetAction(
  tenantId: string,
  input: { id: string; name: string; tokens: unknown; baseTheme?: string | null; typographyOverride?: Record<string, unknown> | null },
): Promise<{ ok: true; id: string } | { ok: false; errors: string[] }> {
  await getRequiredAdminSession();

  const res = await saveTokenSet({
    id:                 input.id,
    tenantId,
    name:               input.name,
    tokens:             input.tokens,
    baseTheme:          input.baseTheme ?? null,
    typographyOverride: input.typographyOverride ?? null,
  }, validateDesignTokenUpload);

  if (res.ok) revalidatePath(designPath(tenantId));
  return res;
}

/** Delete a set by id. */
export async function deleteDesignTokenSetAction(
  tenantId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  await getRequiredAdminSession();

  const res = await deleteDesignTokenSet(id);
  if (!res.ok) return { ok: false, errors: [res.error] };

  revalidatePath(designPath(tenantId));
  return { ok: true };
}

/**
 * Apply a stored set to the tenant: load it and hand its payload to the existing
 * applyDesignTokensAction, which validates and merges into design.tokenOverrides
 * (and revalidates the public site).
 */
export async function applyDesignTokenSetAction(
  tenantId: string,
  id: string,
): Promise<ApplyTokensResult> {
  await getRequiredAdminSession();

  const set = await getDesignTokenSetById(id);
  if (!set) return { ok: false, errors: [`Token set "${id}" was not found.`] };

  return applyDesignTokensAction(tenantId, tokenSetToUploadPayload(set));
}
