/**
 * Admin: Design Token Set server actions
 *
 * CRUD + apply for the design token set library (design_token_sets). Each action
 * is admin-guarded. Token payloads are validated on every create/update via
 * saveTokenSet, to which this file passes the real validateDesignTokenUpload.
 * "Apply" builds a COMPLETE look (identical to applying a preset): it replaces
 * the token overrides and derives the site-wide block tokens so the adaptive
 * blocks inherit the look, rather than a merge-only tokenOverrides update.
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
import { getTenantById, saveTenant } from "@/tenant/server";
import { buildCompleteLookDesign, mergeUploadTokensIntoOverrides } from "@/lib/design/complete-look";
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

  // Validate the stored payload (it was validated on save; this is defense in
  // depth and yields the appliedKeys / warnings / format for the result).
  const validation = validateDesignTokenUpload(tokenSetToUploadPayload(set));
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const current = await getTenantById(tenantId);
  if (!current) return { ok: false, errors: [`Tenant "${tenantId}" not found.`] };

  // Complete look: replace the overrides with the set's tokens and derive the
  // site-wide block tokens, so hero / proof / cta / feature / conversion adaptive
  // blocks pick up the palette (they render from design.defaultTokens).
  // tokenSetToUploadPayload folds the set's base_theme into the payload theme,
  // which validateDesignTokenUpload has verified; fall back to the current theme.
  const overrides = mergeUploadTokensIntoOverrides({}, validation.tokens);
  const theme     = validation.tokens.theme ?? current.design.theme;
  const design    = buildCompleteLookDesign(current.design, overrides, theme);

  const saveResult = await saveTenant({ ...current, design });
  if (!saveResult.ok) return { ok: false, errors: [saveResult.error] };

  // Re-render the public site (token vars are injected at the [data-site] layer)
  // plus the admin views.
  revalidatePath("/", "layout");
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${tenantId}`);

  return {
    ok:          true,
    appliedKeys: validation.appliedKeys,
    warnings:    validation.warnings,
    format:      validation.format,
  };
}
