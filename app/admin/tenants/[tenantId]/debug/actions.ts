"use server";

/**
 * Tenant Debug — Server Actions
 *
 * Persists the tenant's on-site debug overlay settings.
 *
 * ─── What this controls ───────────────────────────────────────────────────────
 *
 *   showDebugOverlay  boolean            Master switch for the debug overlay.
 *   debugLevel        "off"|"summary"|"full"  Granularity when overlay is on.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   This action writes only to the `debug` sub-object of TenantSettings.
 *   All other tenant fields (AI keys, CMS tokens, enrichment config, etc.)
 *   are preserved via the re-read-merge-write pattern.
 *
 *   The runtime context-building and decision logic is NEVER disabled here —
 *   only the rendered debug output is gated.
 */

import { revalidatePath }           from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type { TenantDebugSettings }  from "@/tenant/types";

// ── Result type ───────────────────────────────────────────────────────────────

export type SaveDebugSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

// ── Action ────────────────────────────────────────────────────────────────────

/**
 * Save the debug overlay settings for a tenant.
 *
 * Merges the new debug settings on top of the existing record so no other
 * tenant fields are affected.
 *
 * @param tenantId  The tenant to update.
 * @param debug     The new debug settings to persist.
 */
export async function saveTenantDebugSettingsAction(
  tenantId: string,
  debug:    TenantDebugSettings,
): Promise<SaveDebugSettingsResult> {
  const stored = await getTenantById(tenantId);

  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  const updated = {
    ...stored,
    debug,
  };

  const result = await saveTenant(updated);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Revalidate the debug settings page so the next load shows the saved values.
  revalidatePath(`/admin/tenants/${tenantId}/debug`);
  // Revalidate the homepage so the debug overlay change takes effect immediately.
  revalidatePath("/");

  return { ok: true };
}
