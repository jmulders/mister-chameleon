"use server";

/**
 * Server actions for the Adaptive Slot Mode admin page.
 *
 * Reads and writes TenantSettings.adaptiveSlots, which controls whether each
 * core content slot (hero / proof / cta) uses AI-assisted, rules-only, or
 * static selection.
 *
 * ─── Storage ──────────────────────────────────────────────────────────────────
 *
 *   Slot mode config is stored as the `adaptiveSlots` field in TenantSettings.
 *   Follows the read-merge-write pattern used by all other tenant settings
 *   actions: read existing record → patch adaptiveSlots → saveTenant().
 *
 * ─── Validation ───────────────────────────────────────────────────────────────
 *
 *   saveSlotModesAction() validates that:
 *     • every mode value is a known SlotSelectionMode literal
 *     • staticKey is present when mode === "static"
 *     • staticKey strings start with the expected slot prefix
 *
 *   Invalid payloads are rejected with a descriptive error message.
 */

import { revalidatePath }            from "next/cache";
import { getTenantById, saveTenant } from "@/tenant/server";
import type {
  TenantAdaptiveSlotSettings,
  TenantAdaptiveSlotConfig,
  TenantSlotMode,
} from "@/tenant/types";

// ── Key prefix guards ─────────────────────────────────────────────────────────

const SLOT_KEY_PREFIXES: Record<"hero" | "proof" | "cta" | "feature" | "conversion" | "notification", string> = {
  hero:         "hero_",
  proof:        "proof_",
  cta:          "cta_",
  feature:      "feature_",
  conversion:   "conversion_",
  notification: "notification_",
};

// ── Public action — load ──────────────────────────────────────────────────────

/**
 * Load the current adaptive slot mode settings for a tenant.
 * Returns null when no settings are saved (all slots default to "ai-assisted").
 */
export async function getSlotModesAction(
  tenantId: string,
): Promise<TenantAdaptiveSlotSettings | null> {
  const settings = await getTenantById(tenantId);
  return settings?.adaptiveSlots ?? null;
}

// ── Public action — save ──────────────────────────────────────────────────────

export interface SaveSlotModesInput {
  hero:         SlotModeFormValue;
  proof:        SlotModeFormValue;
  cta:          SlotModeFormValue;
  feature:      SlotModeFormValue;
  conversion:   SlotModeFormValue;
  notification: SlotModeFormValue;
}

export interface SlotModeFormValue {
  mode:       TenantSlotMode;
  staticKey?: string;
}

export interface SaveSlotModesResult {
  ok:     boolean;
  error?: string;
}

/**
 * Persist the adaptive slot mode configuration for a tenant.
 *
 * Validates all three slot configs, then writes the merged settings object
 * to the data store.  Revalidates the behavior/slots page path on success.
 */
export async function saveSlotModesAction(
  tenantId: string,
  input:    SaveSlotModesInput,
): Promise<SaveSlotModesResult> {
  if (!tenantId) {
    return { ok: false, error: "tenantId must be a non-empty string." };
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const VALID_MODES: TenantSlotMode[] = ["static", "rules-only", "ai-assisted"];

  for (const [slotId, value] of Object.entries(input) as Array<["hero" | "proof" | "cta" | "feature" | "conversion" | "notification", SlotModeFormValue]>) {
    if (!VALID_MODES.includes(value.mode)) {
      return { ok: false, error: `Invalid mode "${value.mode}" for slot "${slotId}".` };
    }

    if (value.mode === "static") {
      if (!value.staticKey || value.staticKey.trim() === "") {
        return {
          ok:    false,
          error: `A static key is required for slot "${slotId}" when mode is "static".`,
        };
      }
      const prefix = SLOT_KEY_PREFIXES[slotId];
      if (!value.staticKey.startsWith(prefix)) {
        return {
          ok:    false,
          error: `Static key for "${slotId}" must start with "${prefix}" (got "${value.staticKey}").`,
        };
      }
    }
  }

  // ── Read current tenant ───────────────────────────────────────────────────
  const stored = await getTenantById(tenantId);
  if (!stored) {
    return { ok: false, error: `Tenant "${tenantId}" not found.` };
  }

  // ── Build the slot config ─────────────────────────────────────────────────
  const buildSlotConfig = (value: SlotModeFormValue): TenantAdaptiveSlotConfig => ({
    mode:      value.mode,
    ...(value.mode === "static" && value.staticKey
      ? { staticKey: value.staticKey.trim() }
      : {}),
  });

  const adaptiveSlots: TenantAdaptiveSlotSettings = {
    hero:         buildSlotConfig(input.hero),
    proof:        buildSlotConfig(input.proof),
    cta:          buildSlotConfig(input.cta),
    feature:      buildSlotConfig(input.feature),
    conversion:   buildSlotConfig(input.conversion),
    notification: buildSlotConfig(input.notification),
  };

  // ── Write back ────────────────────────────────────────────────────────────
  const result = await saveTenant({ ...stored, adaptiveSlots });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath(`/admin/tenants/${tenantId}/personalization/slots`);
  return { ok: true };
}
