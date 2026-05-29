"use server";

/**
 * Tenant Experiments — Server Actions
 *
 * Persists the tenant-level experiments settings (global enabled toggle) and
 * manages plan-based experiments (create, update status, delete).
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   experimentsEnabled is stored under TenantSettings.experiments.enabled in
 *   the tenant_settings JSONB column.  Follows the same re-read-merge-write
 *   pattern used by the debug settings action.
 *
 *   Plan experiments are stored in the plan_experiments table.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Only the `experiments` sub-object is touched when toggling the master
 *   switch.  All other tenant fields are preserved.
 */

import { revalidatePath }            from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import {
  createPlanExperiment,
  updatePlanExperiment,
  deletePlanExperiment,
  type PlanExperimentInsert,
  type PlanExperimentUpdatePatch,
} from "@/data/repositories/plan-experiments-repository";

// ── Result type ───────────────────────────────────────────────────────────────

export type SaveExperimentsSettingsResult =
  | { ok: true }
  | { ok: false; error: string };

// ── setTenantExperimentsEnabledAction ─────────────────────────────────────────

/**
 * Toggle the tenant-level experiments master switch.
 *
 * Reads the current tenant record, sets experiments.enabled, and writes back.
 * Revalidates both the experiments admin page and the homepage so the change
 * takes effect immediately for the next visitor request.
 *
 * @param tenantId  The tenant to update.
 * @param enabled   The new global experiments enabled state.
 */
export async function setTenantExperimentsEnabledAction(
  tenantId: string,
  enabled: boolean,
): Promise<SaveExperimentsSettingsResult> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string" };
  }

  const stored = await getTenantById(tenantId);
  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  const updated = {
    ...stored,
    experiments: {
      ...stored.experiments,
      enabled,
    },
  };

  const result = await saveTenant(updated);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/tenants/${tenantId}/experiments`);
  // Revalidate the homepage so experiment evaluation changes take effect
  // for the next visitor request.
  revalidatePath("/");

  return { ok: true };
}

// ── Plan experiment actions ───────────────────────────────────────────────────

export type PlanExperimentActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Create a new plan experiment.
 * Validates required fields and delegates to the repository.
 */
export async function createPlanExperimentAction(
  tenantId: string,
  input: PlanExperimentInsert,
): Promise<PlanExperimentActionResult> {
  if (!input.id?.trim())      return { ok: false, error: "Experiment ID is required." };
  if (!input.name?.trim())    return { ok: false, error: "Name is required." };
  if (!input.rule_id?.trim()) return { ok: false, error: "Rule ID is required." };

  const tf = input.traffic_fraction ?? 1.0;
  if (tf <= 0 || tf > 1) return { ok: false, error: "Traffic fraction must be between 1 and 100%." };

  const cp = input.challenger_plan ?? {};
  if (!cp.heroKey && !cp.proofKey && !cp.ctaKey && !cp.featureKey && !cp.conversionKey) {
    return { ok: false, error: "Challenger plan must override at least one slot." };
  }

  const result = await createPlanExperiment({
    ...input,
    id:               input.id.trim(),
    name:             input.name.trim(),
    tenant_id:        tenantId,
    rule_id:          input.rule_id.trim(),
    status:           input.status ?? "draft",
    traffic_fraction: tf,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/experiments`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Update a plan experiment (name, status, traffic, challenger_plan).
 */
export async function updatePlanExperimentAction(
  tenantId: string,
  id: string,
  patch: PlanExperimentUpdatePatch,
): Promise<PlanExperimentActionResult> {
  if (!id) return { ok: false, error: "Experiment ID is required." };

  // Set ended_at when transitioning to ended.
  const finalPatch: PlanExperimentUpdatePatch = {
    ...patch,
    ...(patch.status === "ended" && patch.ended_at === undefined
      ? { ended_at: new Date().toISOString() }
      : {}),
  };

  const result = await updatePlanExperiment(tenantId, id, finalPatch);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/experiments`);
  revalidatePath("/");
  return { ok: true };
}

/**
 * Permanently delete a plan experiment.
 */
export async function deletePlanExperimentAction(
  tenantId: string,
  id: string,
): Promise<PlanExperimentActionResult> {
  if (!id) return { ok: false, error: "Experiment ID is required." };

  const result = await deletePlanExperiment(tenantId, id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/experiments`);
  revalidatePath("/");
  return { ok: true };
}
