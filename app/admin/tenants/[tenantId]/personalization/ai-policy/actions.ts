"use server";

/**
 * Server actions for the AI Policy admin page.
 *
 * Reads and writes TenantSettings.aiPolicies — the unified AI governance
 * configuration covering both Phase 1 (variant selection) and Phase 2
 * (content field fill).
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Policy config is stored as the `aiPolicies` field in TenantSettings.
 *   Follows the read-merge-write pattern: getTenantById → patch → saveTenant.
 *
 * ─── Validation ───────────────────────────────────────────────────────────────
 *
 *   saveAiPolicyAction() validates that:
 *     • mode values are one of "disabled" | "shadow" | "live"
 *     • confidenceThreshold is in [0, 1] when provided
 */

import { revalidatePath }            from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type {
  TenantAiPolicies,
  TenantAiPolicyConfig,
  TenantAiPolicyMode,
} from "@/tenant/types";

// ── Public types ──────────────────────────────────────────────────────────────

export interface AiPolicyFormValue {
  mode:                 TenantAiPolicyMode;
  confidenceThreshold:  number;
}

export interface SaveAiPolicyInput {
  selection: AiPolicyFormValue;
  fieldFill: AiPolicyFormValue;
}

export interface SaveAiPolicyResult {
  ok:     boolean;
  error?: string;
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function getAiPolicyAction(
  tenantId: string,
): Promise<TenantAiPolicies | null> {
  const settings = await getTenantById(tenantId);
  return settings?.aiPolicies ?? null;
}

// ── Save ──────────────────────────────────────────────────────────────────────

export async function saveAiPolicyAction(
  tenantId: string,
  input:    SaveAiPolicyInput,
): Promise<SaveAiPolicyResult> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string." };
  }

  const VALID_MODES: TenantAiPolicyMode[] = ["disabled", "shadow", "live"];

  for (const [phase, value] of Object.entries(input) as Array<["selection" | "fieldFill", AiPolicyFormValue]>) {
    if (!VALID_MODES.includes(value.mode)) {
      return { ok: false, error: `Invalid mode "${value.mode}" for phase "${phase}".` };
    }
    if (value.confidenceThreshold < 0 || value.confidenceThreshold > 1) {
      return { ok: false, error: `Confidence threshold for "${phase}" must be between 0 and 1.` };
    }
  }

  const stored = await getTenantById(tenantId);
  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  const buildConfig = (v: AiPolicyFormValue): TenantAiPolicyConfig => ({
    mode:                v.mode,
    confidenceThreshold: v.confidenceThreshold,
  });

  const aiPolicies: TenantAiPolicies = {
    selection: buildConfig(input.selection),
    fieldFill: buildConfig(input.fieldFill),
  };

  const result = await saveTenant({ ...stored, aiPolicies });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/tenants/${tenantId}/personalization/ai-policy`);
  return { ok: true };
}
