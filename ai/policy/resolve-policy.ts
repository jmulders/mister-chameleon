/**
 * AI Policy — Resolution
 *
 * Implements the 4-tier policy resolution order for the unified AI governance
 * model.
 *
 * ─── Resolution order ────────────────────────────────────────────────────────
 *
 *   For any (phase, slot) pair, the resolved policy is built by merging four
 *   tiers from lowest to highest priority:
 *
 *   Tier 4 (lowest)  — System default (SYSTEM_DEFAULT_POLICIES)
 *   Tier 3           — Platform policy (env / feature flag defaults)
 *   Tier 2           — Tenant policy (TenantSettings.aiPolicies)
 *   Tier 1 (highest) — Slot override (variant pack / slot-level config)
 *
 *   Each tier may define only some fields.  Defined fields override lower tiers;
 *   undefined fields fall through.  The result is always fully defined (all
 *   fields guaranteed non-undefined) via SYSTEM_DEFAULT_POLICIES as the base.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   Call resolveAiPolicy() once per (phase, slot) pair during request handling:
 *
 *     const policy = resolveAiPolicy("selection", "hero", {
 *       tenantPolicies: tenant.aiPolicies,
 *       platformPolicy: getPlatformAiPolicy(),
 *       slotOverride:   slotConfig?.aiOverride,
 *     });
 *
 *   The returned ResolvedAiPolicy is safe to use directly — no further
 *   undefined checks needed.
 */

import type {
  AiPolicyMode,
  AiPolicyConfig,
  AiPhasePolicies,
  SlotAiPolicyOverrides,
  ResolvedAiPolicy,
} from "./types";
import { SYSTEM_DEFAULT_POLICIES } from "./types";

// ── Public types ──────────────────────────────────────────────────────────────

/** The phase that policy resolution is for. */
export type AiPhase = "selection" | "fieldFill";

/** Inputs for resolveAiPolicy(). */
export interface ResolvePolicyInput {
  /**
   * Tenant-level policies from TenantSettings.aiPolicies.
   * undefined = no tenant policy (fall through to platform / system defaults).
   */
  tenantPolicies?: AiPhasePolicies | null;

  /**
   * Platform-level policies (from env vars or feature flags).
   * undefined = no platform policy (fall through to system defaults).
   */
  platformPolicy?: AiPhasePolicies | null;

  /**
   * Slot-level override for the specific slot being resolved.
   * undefined = no slot override.
   */
  slotOverride?: AiPhasePolicies | null;
}

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Resolve the effective AI policy for a specific phase and slot.
 *
 * Merges all four tiers (system default → platform → tenant → slot override)
 * and returns a fully defined ResolvedAiPolicy with source tracking.
 *
 * @param phase        Which AI sub-system: "selection" or "fieldFill".
 * @param _slotId      The core slot being processed ("hero" | "proof" | "cta").
 *                     Reserved for future per-slot tenant policies; currently
 *                     used only for source-tracking in the output.
 * @param input        The available policy tiers for this request.
 *
 * @returns  A fully resolved policy.  All fields are guaranteed non-undefined.
 */
export function resolveAiPolicy(
  phase:   AiPhase,
  _slotId: "hero" | "proof" | "cta",
  input:   ResolvePolicyInput,
): ResolvedAiPolicy {
  // System defaults — Tier 4 (base, always present)
  const systemDefault = SYSTEM_DEFAULT_POLICIES[phase];

  // Platform policy — Tier 3
  const platformPhase = input.platformPolicy?.[phase];

  // Tenant policy — Tier 2
  const tenantPhase   = input.tenantPolicies?.[phase];

  // Slot override — Tier 1 (highest)
  const slotPhase     = input.slotOverride?.[phase];

  // ── Resolve mode ───────────────────────────────────────────────────────────
  let mode:       AiPolicyMode;
  let modeSource: ResolvedAiPolicy["modeSource"];

  if (slotPhase?.mode !== undefined) {
    mode       = slotPhase.mode;
    modeSource = "slot_override";
  } else if (tenantPhase?.mode !== undefined) {
    mode       = tenantPhase.mode;
    modeSource = "tenant";
  } else if (platformPhase?.mode !== undefined) {
    mode       = platformPhase.mode;
    modeSource = "platform";
  } else {
    mode       = systemDefault.mode!;
    modeSource = "system_default";
  }

  // ── Resolve confidenceThreshold ────────────────────────────────────────────
  let confidenceThreshold: number;
  let thresholdSource:     ResolvedAiPolicy["thresholdSource"];

  if (slotPhase?.confidenceThreshold !== undefined) {
    confidenceThreshold = clampThreshold(slotPhase.confidenceThreshold);
    thresholdSource     = "slot_override";
  } else if (tenantPhase?.confidenceThreshold !== undefined) {
    confidenceThreshold = clampThreshold(tenantPhase.confidenceThreshold);
    thresholdSource     = "tenant";
  } else if (platformPhase?.confidenceThreshold !== undefined) {
    confidenceThreshold = clampThreshold(platformPhase.confidenceThreshold);
    thresholdSource     = "platform";
  } else {
    confidenceThreshold = systemDefault.confidenceThreshold!;
    thresholdSource     = "system_default";
  }

  return { mode, confidenceThreshold, modeSource, thresholdSource };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Determine whether AI should be called for a given resolved policy.
 * AI is NOT called when mode === "disabled".
 */
export function shouldCallAi(policy: ResolvedAiPolicy): boolean {
  return policy.mode !== "disabled";
}

/**
 * Determine whether AI output should be applied to the live response.
 *
 * Returns true only when:
 *   - mode is "live", AND
 *   - confidence is undefined (model did not score) OR confidence ≥ threshold
 *
 * In shadow mode, output is NEVER applied.
 * In disabled mode, AI was not called.
 */
export function shouldApplyAi(
  policy:     ResolvedAiPolicy,
  confidence: number | undefined,
): boolean {
  if (policy.mode !== "live") return false;
  if (confidence === undefined) return true; // no confidence score = apply (model chose not to score)
  return confidence >= policy.confidenceThreshold;
}

/**
 * Build the notAppliedReason string for debug traces.
 *
 * Returns null when AI was applied (use this to set FieldFillTrace.fallbackReason
 * and AiPolicyDebugInfo.notAppliedReason).
 */
export function buildNotAppliedReason(
  policy:     ResolvedAiPolicy,
  aiCalled:   boolean,
  aiApplied:  boolean,
  confidence: number | undefined,
  aiError?:   boolean,
): string | null {
  if (aiApplied) return null;

  if (!aiCalled) {
    return "policy_disabled";
  }
  if (aiError) {
    return "ai_error";
  }
  if (policy.mode === "shadow") {
    return "policy_shadow";
  }
  if (confidence !== undefined && confidence < policy.confidenceThreshold) {
    return `confidence_below_threshold (${confidence.toFixed(2)} < ${policy.confidenceThreshold.toFixed(2)})`;
  }
  return "unknown";
}

/**
 * Build an AiPolicyDebugInfo record.
 *
 * Convenience constructor used by both Phase 1 and Phase 2 trace builders.
 */
export function buildPolicyDebugInfo(
  resolvedPolicy: ResolvedAiPolicy,
  aiCalled:       boolean,
  aiApplied:      boolean,
  confidence:     number | undefined,
  aiSuggestion:   Record<string, string> | null,
  aiError?:       boolean,
): import("./types").AiPolicyDebugInfo {
  return {
    resolvedPolicy,
    aiCalled,
    aiApplied,
    confidence,
    notAppliedReason: buildNotAppliedReason(resolvedPolicy, aiCalled, aiApplied, confidence, aiError),
    aiSuggestion,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/** Clamp a confidence threshold to the valid [0, 1] range. */
function clampThreshold(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ── Platform policy factory ───────────────────────────────────────────────────

/**
 * Read the platform-level AI policies from environment variables.
 *
 * These form Tier 3 of the resolution order.  Operators set these via infra
 * config to establish safe platform-wide defaults before any tenant has
 * configured their own policies.
 *
 * Environment variables:
 *   MC_AI_SELECTION_MODE          — "disabled" | "shadow" | "live"
 *   MC_AI_SELECTION_THRESHOLD     — float in [0, 1]
 *   MC_AI_FIELD_FILL_MODE         — "disabled" | "shadow" | "live"
 *   MC_AI_FIELD_FILL_THRESHOLD    — float in [0, 1]
 *
 * Falls back to undefined for each field when the env var is absent/invalid.
 * Absent fields fall through to system defaults in resolveAiPolicy().
 */
export function getPlatformAiPolicy(): AiPhasePolicies {
  const parseMode = (raw: string | undefined): AiPolicyMode | undefined => {
    if (raw === "disabled" || raw === "shadow" || raw === "live") return raw;
    return undefined;
  };

  const parseThreshold = (raw: string | undefined): number | undefined => {
    if (raw === undefined) return undefined;
    const n = parseFloat(raw);
    return isNaN(n) ? undefined : clampThreshold(n);
  };

  const selectionMode      = parseMode(process.env.MC_AI_SELECTION_MODE);
  const selectionThreshold = parseThreshold(process.env.MC_AI_SELECTION_THRESHOLD);
  const fieldFillMode      = parseMode(process.env.MC_AI_FIELD_FILL_MODE);
  const fieldFillThreshold = parseThreshold(process.env.MC_AI_FIELD_FILL_THRESHOLD);

  const selection: AiPolicyConfig = {};
  if (selectionMode      !== undefined) selection.mode                = selectionMode;
  if (selectionThreshold !== undefined) selection.confidenceThreshold = selectionThreshold;

  const fieldFill: AiPolicyConfig = {};
  if (fieldFillMode      !== undefined) fieldFill.mode                = fieldFillMode;
  if (fieldFillThreshold !== undefined) fieldFill.confidenceThreshold = fieldFillThreshold;

  const result: AiPhasePolicies = {};
  if (Object.keys(selection).length > 0) result.selection = selection;
  if (Object.keys(fieldFill).length > 0) result.fieldFill = fieldFill;

  return result;
}
