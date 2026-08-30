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
import type { TenantDebugSettings, TenantScenarioPanelSettings, TenantScenarioPreset, TenantScenarioOverride } from "@/tenant/types";

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

// ── Scenario custom presets (personas) ──────────────────────────────────────────

export type SaveScenarioPresetsResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save the per-tenant CUSTOM scenario presets (personas). Replaces the whole
 * array. Empty → stored as undefined to keep the settings blob clean. Structural
 * validation runs in validateTenantSettings (via saveTenant); the panel is
 * additionally fail-open on any invalid preset. Revalidates the public site so the
 * console picks up the change immediately.
 */
export async function saveScenarioPresetsAction(
  tenantId: string,
  presets:  TenantScenarioPreset[],
): Promise<SaveScenarioPresetsResult> {
  const stored = await getTenantById(tenantId);

  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  const scenarioPresets = presets.length > 0 ? presets : undefined;

  const updated = {
    ...stored,
    scenarioPresets,
  };

  const result = await saveTenant(updated);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/tenants/${tenantId}/debug`);
  revalidatePath("/", "layout");

  return { ok: true };
}

// ── Scenario built-in overrides (hide / reorder / relabel / reset) ──────────────

export type SaveScenarioOverridesResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Save the per-tenant OVERRIDE map on the code-defined built-ins (Quick presets +
 * Demo roles). Replaces the whole map. A key mapping to an empty object, or an
 * empty map, is dropped to keep the settings blob clean ("reset to default" =
 * remove the key). Structural validation runs in validateTenantSettings; the panel
 * is additionally fail-open. Revalidates the public site so the console updates.
 */
export async function saveScenarioOverridesAction(
  tenantId:  string,
  overrides: Record<string, TenantScenarioOverride>,
): Promise<SaveScenarioOverridesResult> {
  const stored = await getTenantById(tenantId);
  if (!stored) return { ok: false, error: `Tenant "${tenantId}" not found.` };

  // Drop keys whose override object is empty (reset), and drop the whole map when
  // nothing remains.
  const clean: Record<string, TenantScenarioOverride> = {};
  for (const [key, o] of Object.entries(overrides ?? {})) {
    if (o && typeof o === "object" && Object.keys(o).length > 0) clean[key] = o;
  }
  const scenarioOverrides = Object.keys(clean).length > 0 ? clean : undefined;

  const result = await saveTenant({ ...stored, scenarioOverrides });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/debug`);
  revalidatePath("/", "layout");
  return { ok: true };
}
