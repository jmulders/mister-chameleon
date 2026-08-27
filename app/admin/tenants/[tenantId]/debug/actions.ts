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
import type { TenantDebugSettings, TenantScenarioPanelSettings } from "@/tenant/types";

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

// ── Scenario panel curation ─────────────────────────────────────────────────────

export type SaveScenarioPanelResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save the per-tenant Scenario Control panel curation (which presets / roles /
 * time options the operator console offers).
 *
 * Config lives in `settings.scenarioPanel` (JSONB — no migration). An EMPTY
 * selection for a field means "show everything" (the runtime fallback), so we
 * store only non-empty arrays and drop the whole object when nothing is curated,
 * keeping the stored settings clean and identical to the pre-feature default.
 *
 * Revalidates the public site (layout) so the change is live immediately.
 */
export async function saveScenarioPanelAction(
  tenantId: string,
  panel:    TenantScenarioPanelSettings,
): Promise<SaveScenarioPanelResult> {
  const stored = await getTenantById(tenantId);

  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // Keep only non-empty string arrays; an empty selection === "show all".
  const clean: {
    presetKeys?:  string[];
    roleKeys?:    string[];
    timeOptions?: ("day" | "evening" | "weekend")[];
  } = {};
  if (panel.presetKeys && panel.presetKeys.length > 0)   clean.presetKeys  = [...panel.presetKeys];
  if (panel.roleKeys && panel.roleKeys.length > 0)       clean.roleKeys    = [...panel.roleKeys];
  if (panel.timeOptions && panel.timeOptions.length > 0) clean.timeOptions = [...panel.timeOptions];

  const scenarioPanel = Object.keys(clean).length > 0 ? clean : undefined;

  const updated = {
    ...stored,
    scenarioPanel,
  };

  const result = await saveTenant(updated);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/tenants/${tenantId}/debug`);
  // Revalidate the whole site layout — the console is mounted from app/(site)/layout.
  revalidatePath("/", "layout");

  return { ok: true };
}
