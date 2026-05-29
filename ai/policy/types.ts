/**
 * AI Policy — Types
 *
 * Unified AI governance model for both Phase 1 (variant selection) and
 * Phase 2 (field fill).
 *
 * ─── Why a unified policy? ───────────────────────────────────────────────────
 *
 *   Before Phase 3, Phase 1 and Phase 2 had separate, incompatible controls:
 *     Phase 1 used TenantSettings.ai.mode (global) + TenantSettings.adaptiveSlots
 *     Phase 2 used TenantSettings.fieldFill.confidenceThreshold (per slot)
 *
 *   The unified policy model gives operators a single, consistent mental model:
 *     Every AI sub-system has a mode (disabled | shadow | live) and a threshold.
 *     Both sub-systems follow the same resolution order.
 *
 * ─── Policy scope ────────────────────────────────────────────────────────────
 *
 *   There are two AI sub-systems ("phases"):
 *
 *     selection  — Phase 1: which variant key to serve
 *     fieldFill  — Phase 2: which text to show within the variant
 *
 *   Each sub-system has its own independent policy, allowing operators to run
 *   selection in live mode while field fill is in shadow mode, or disable one
 *   without affecting the other.
 *
 * ─── Resolution order ────────────────────────────────────────────────────────
 *
 *   For each (phase, slot) pair, the policy is resolved through four tiers:
 *
 *     1. Slot override       — per-slot config on the active variant pack/slot
 *                              Rarely set; used for campaign-specific locking.
 *     2. Tenant policy       — stored in TenantSettings.aiPolicies.[phase]
 *                              The primary operator control surface.
 *     3. Platform policy     — stored in platform defaults (env / feature flags)
 *                              Used when no tenant policy is set.
 *     4. System default      — hardcoded fallback defined in this file.
 *                              Always present; guarantees a non-null resolution.
 *
 *   At each tier, only defined (non-undefined) fields override the tier below.
 *   This means a tenant can override only the threshold and inherit the mode
 *   from the platform policy.
 *
 * ─── Execution logic ─────────────────────────────────────────────────────────
 *
 *   disabled  → skip AI entirely; serve rules/CMS content unchanged.
 *
 *   shadow    → run AI; store result in trace for observability.
 *               Do NOT apply AI output to the live response.
 *               Equivalent to a dry-run: operators can see what AI would have done.
 *
 *   live      → run AI; apply output ONLY when confidence ≥ threshold.
 *               If confidence < threshold, fall back to rules/CMS content.
 *               If AI errors, always fall back.
 */

// ── Mode ──────────────────────────────────────────────────────────────────────

/**
 * The operational mode for one AI sub-system.
 *
 *   disabled — AI is not called; original content is always served.
 *   shadow   — AI runs but its output is only logged, never applied to responses.
 *   live     — AI runs and its output is applied when confidence ≥ threshold.
 */
export type AiPolicyMode = "disabled" | "shadow" | "live";

// ── Policy config ─────────────────────────────────────────────────────────────

/**
 * Configuration for one AI sub-system at one resolution tier.
 *
 * All fields are optional so that partial overrides can be layered — a tenant
 * can set only `confidenceThreshold` without having to specify a `mode`.
 */
export interface AiPolicyConfig {
  /**
   * Operational mode for this sub-system.
   * undefined = inherit from the next resolution tier.
   */
  mode?: AiPolicyMode;

  /**
   * Minimum confidence score [0, 1] required to apply AI output in live mode.
   *
   * When AI self-reports confidence below this value, the original content
   * is kept (fail-safe).
   *
   * In shadow mode, this threshold does NOT gate output — it only affects
   * whether the trace marks the result as "would have been applied".
   *
   * undefined = inherit from the next resolution tier.
   * System default: 0.70.
   */
  confidenceThreshold?: number;
}

// ── Per-phase policies ────────────────────────────────────────────────────────

/**
 * AI policies for both sub-systems stored at one resolution tier.
 *
 * `selection` and `fieldFill` are each independently optional — operators
 * can control one phase without having to configure the other.
 */
export interface AiPhasePolicies {
  /** Phase 1 — variant selection policy. */
  selection?: AiPolicyConfig;
  /** Phase 2 — content field fill policy. */
  fieldFill?: AiPolicyConfig;
}

// ── Slot-level policy override ────────────────────────────────────────────────

/**
 * Per-slot AI policy overrides stored on a variant pack or slot config.
 *
 * This is the highest-priority tier in the resolution order.  It is rarely
 * used — only for slot-level campaign locking or A/B experiments that need
 * to override the tenant-level policy for a specific slot.
 *
 * Keyed by CoreSlotId ("hero" | "proof" | "cta").
 */
export interface SlotAiPolicyOverrides {
  hero?:  AiPhasePolicies;
  proof?: AiPhasePolicies;
  cta?:   AiPhasePolicies;
}

// ── Fully resolved policy ─────────────────────────────────────────────────────

/**
 * Fully resolved AI policy for one (phase, slot) pair.
 *
 * Produced by resolveAiPolicy() — all fields are guaranteed to be defined.
 * Consumers read from ResolvedAiPolicy without needing to handle undefined.
 */
export interface ResolvedAiPolicy {
  /** The effective operational mode. Never undefined after resolution. */
  mode: AiPolicyMode;

  /**
   * The effective confidence threshold.
   * Range [0, 1].  Never undefined after resolution.
   * System default: 0.70.
   */
  confidenceThreshold: number;

  /**
   * Which resolution tier supplied the `mode` value.
   * Used in debug traces to show "mode inherited from platform defaults" etc.
   */
  modeSource: "slot_override" | "tenant" | "platform" | "system_default";

  /**
   * Which resolution tier supplied the `confidenceThreshold` value.
   */
  thresholdSource: "slot_override" | "tenant" | "platform" | "system_default";
}

// ── System defaults ───────────────────────────────────────────────────────────

/**
 * System-level default policies applied when no higher-tier config is found.
 *
 * Hardcoded to safe values:
 *   - selection: shadow (observe AI decisions; do not serve them until ready)
 *   - fieldFill: disabled (opt-in only; field fill is never applied without config)
 *
 * Both use a 0.70 confidence threshold when they become live.
 */
export const SYSTEM_DEFAULT_POLICIES: Required<AiPhasePolicies> = {
  selection: { mode: "shadow", confidenceThreshold: 0.70 },
  fieldFill: { mode: "disabled", confidenceThreshold: 0.70 },
} as const;

// ── Policy debug info ─────────────────────────────────────────────────────────

/**
 * AI governance debug info attached to each slot's trace.
 *
 * Shows the resolved policy and whether AI was applied or withheld, enabling
 * the admin debug panel to show exactly what the governance layer decided.
 */
export interface AiPolicyDebugInfo {
  /** The fully resolved policy that was used. */
  resolvedPolicy: ResolvedAiPolicy;

  /**
   * Whether AI was called for this sub-system and slot.
   * false when mode === "disabled".
   */
  aiCalled: boolean;

  /**
   * Whether the AI output was applied to the live response.
   *   true  — mode is "live" and confidence ≥ threshold, or mode is "live" and AI was used.
   *   false — mode is "shadow" (output stored but not applied),
   *           or mode is "live" but confidence < threshold.
   */
  aiApplied: boolean;

  /**
   * The AI confidence score for this call.
   * undefined when AI was not called.
   */
  confidence: number | undefined;

  /**
   * Why AI was not applied, when aiApplied=false.
   *
   * Examples:
   *   "policy_disabled"           — mode is "disabled"
   *   "policy_shadow"             — mode is "shadow", never applied to live
   *   "confidence_below_threshold" — confidence < resolvedPolicy.confidenceThreshold
   *   "ai_error"                  — AI call failed
   *   null                        — AI was applied (aiApplied=true)
   */
  notAppliedReason: string | null;

  /**
   * The AI suggestion — what AI would have done, even in shadow mode.
   * Populated regardless of whether the output was applied.
   * null when AI was not called (mode === "disabled").
   */
  aiSuggestion: Record<string, string> | null;
}
