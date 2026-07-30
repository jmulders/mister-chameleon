"use server";

/**
 * Server actions for the AI Field Fill admin page.
 *
 * Reads and writes TenantSettings.fieldFill, which controls whether AI may
 * rewrite individual text fields within a CMS-fetched variant block.
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Field fill config is stored as the `fieldFill` field in TenantSettings.
 *   Follows the read-merge-write pattern used by all other tenant settings
 *   actions: read existing record → patch fieldFill → saveTenant().
 *
 * ─── Validation ───────────────────────────────────────────────────────────────
 *
 *   saveFieldFillAction() validates that:
 *     • confidenceThreshold is in [0, 1] when provided
 *     • field paths are non-empty strings
 *     • maxWords / maxChars are positive integers when provided
 */

import { revalidatePath }            from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type {
  TenantFieldFillSettings,
  TenantSlotFieldFillConfig,
  TenantFieldFillSpec,
} from "@/tenant/types";

// ── Public types ──────────────────────────────────────────────────────────────

export interface FieldFillSpecFormValue {
  aiEnabled:  boolean;
  maxWords?:  number;
  maxChars?:  number;
  style?:     string;
}

export interface SlotFieldFillFormValue {
  enabled:              boolean;
  confidenceThreshold?: number;
  fields:               Record<string, FieldFillSpecFormValue>;
}

export interface SaveFieldFillInput {
  hero:  SlotFieldFillFormValue;
  proof: SlotFieldFillFormValue;
  cta:   SlotFieldFillFormValue;
}

export interface SaveFieldFillResult {
  ok:     boolean;
  error?: string;
}

// ── Public action — load ──────────────────────────────────────────────────────

/**
 * Load the current AI field fill settings for a tenant.
 * Returns null when no settings are saved (all slots default to disabled).
 */
export async function getFieldFillAction(
  tenantId: string,
): Promise<TenantFieldFillSettings | null> {
  const settings = await getTenantById(tenantId);
  return settings?.fieldFill ?? null;
}

// ── Public action — save ──────────────────────────────────────────────────────

/**
 * Persist the AI field fill configuration for a tenant.
 *
 * Validates all three slot configs, then writes the merged settings object
 * to the data store.  Revalidates the behavior/field-fill page path on success.
 */
export async function saveFieldFillAction(
  tenantId: string,
  input:    SaveFieldFillInput,
): Promise<SaveFieldFillResult> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string." };
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  for (const [slotId, slot] of Object.entries(input) as Array<["hero" | "proof" | "cta", SlotFieldFillFormValue]>) {
    if (slot.confidenceThreshold !== undefined) {
      if (
        typeof slot.confidenceThreshold !== "number" ||
        slot.confidenceThreshold < 0 ||
        slot.confidenceThreshold > 1
      ) {
        return {
          ok:    false,
          error: `Confidence threshold for "${slotId}" must be a number between 0 and 1.`,
        };
      }
    }

    for (const [fieldPath, spec] of Object.entries(slot.fields)) {
      if (!fieldPath || fieldPath.trim() === "") {
        return { ok: false, error: `Empty field path found in slot "${slotId}".` };
      }
      if (spec.maxWords !== undefined && (spec.maxWords <= 0 || !Number.isInteger(spec.maxWords))) {
        return {
          ok:    false,
          error: `maxWords for "${slotId}.${fieldPath}" must be a positive integer.`,
        };
      }
      if (spec.maxChars !== undefined && (spec.maxChars <= 0 || !Number.isInteger(spec.maxChars))) {
        return {
          ok:    false,
          error: `maxChars for "${slotId}.${fieldPath}" must be a positive integer.`,
        };
      }
    }
  }

  // ── Read current tenant ───────────────────────────────────────────────────
  const stored = await getTenantById(tenantId);
  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // ── Build config ──────────────────────────────────────────────────────────
  const buildSlotConfig = (slot: SlotFieldFillFormValue): TenantSlotFieldFillConfig => {
    const fields: Record<string, TenantFieldFillSpec> = {};

    for (const [fieldPath, spec] of Object.entries(slot.fields)) {
      fields[fieldPath] = {
        aiEnabled: spec.aiEnabled,
        ...(spec.maxWords !== undefined ? { maxWords: spec.maxWords } : {}),
        ...(spec.maxChars !== undefined ? { maxChars: spec.maxChars } : {}),
        ...(spec.style?.trim()          ? { style:    spec.style.trim() } : {}),
      };
    }

    return {
      enabled: slot.enabled,
      fields,
      ...(slot.confidenceThreshold !== undefined ? { confidenceThreshold: slot.confidenceThreshold } : {}),
    };
  };

  const fieldFill: TenantFieldFillSettings = {
    hero:  buildSlotConfig(input.hero),
    proof: buildSlotConfig(input.proof),
    cta:   buildSlotConfig(input.cta),
  };

  // ── Write back ────────────────────────────────────────────────────────────
  const result = await saveTenant({ ...stored, fieldFill });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/tenants/${tenantId}/personalization/field-fill`);
  return { ok: true };
}
