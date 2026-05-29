"use server";

/**
 * Snippet Admin — Server Actions
 *
 * Generates and saves the snippet site key for a tenant, and toggles
 * the snippet integration on/off.
 */

import { revalidatePath }    from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import { generateSiteKey }   from "@/lib/snippet/generate-site-key";
import { getRequiredAdminSession, assertTenantAccess } from "@/lib/admin-auth/authorization";

export type SnippetActionResult =
  | { ok: true;  siteKey?: string }
  | { ok: false; error: string };

// ── Generate / Regenerate site key ────────────────────────────────────────────

/**
 * Generates a new snippet site key for the tenant and saves it to TenantSettings.
 * Overwrites any previously existing key — clients using the old key will
 * immediately lose personalisation until they update their script tag.
 */
export async function generateSnippetSiteKeyAction(
  tenantId: string,
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const siteKey = generateSiteKey();
  const now     = new Date().toISOString();

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      siteKey,
      siteKeyGeneratedAt: now,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true, siteKey };
}

// ── Toggle snippet enabled ─────────────────────────────────────────────────────

/**
 * Enables or disables the snippet integration for a tenant.
 * When disabled, /api/snippet/decide returns 403 for this tenant's site key.
 */
export async function setSnippetEnabledAction(
  tenantId: string,
  enabled: boolean,
): Promise<SnippetActionResult> {
  const session = await getRequiredAdminSession();
  await assertTenantAccess(session, tenantId);

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  await saveTenant({
    ...tenant,
    snippet: {
      ...tenant.snippet,
      enabled,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}/snippet`);

  return { ok: true };
}
