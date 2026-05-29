/**
 * Per-slot AI Selection Modes
 *
 * Controls how each core content slot (hero, proof, cta) sources its variant
 * key in the decision engine.
 *
 * ─── Three modes ─────────────────────────────────────────────────────────────
 *
 *   "static"       — always serve a fixed, operator-chosen key. AI and rules
 *                    are bypassed entirely. Useful for slots where the content
 *                    must stay locked regardless of visitor context.
 *
 *   "rules-only"   — use the rules/fallback plan key. The AI model is never
 *                    consulted for this slot. Its AI-proposed key is still
 *                    recorded in the trace for comparison, but never served.
 *
 *   "ai-assisted"  — AI may select the key when the global confidence policy
 *                    gates pass.  Falls back to the rules key if AI is
 *                    unavailable, below-threshold, or context is too sparse.
 *                    This is the default for all slots (backward-compatible).
 *
 * ─── Default behaviour ───────────────────────────────────────────────────────
 *
 *   When no SlotModeRegistry is provided (or a slot entry is absent), the slot
 *   defaults to "ai-assisted".  This makes the per-slot layer fully backward-
 *   compatible: existing tenants that have never configured slot modes receive
 *   the same behaviour as before — AI may select all three core slots.
 *
 * ─── Precedence ──────────────────────────────────────────────────────────────
 *
 *   Slot mode configuration applies AFTER the global AI confidence policy:
 *
 *     1. Global policy:  context_richness, confidence, validation, key validity
 *     2. Per-slot mode:  static → rules → ai-assisted (slot-level gate)
 *
 *   Hard state rules (from RulesDecisionProvider) always fire BEFORE the AI
 *   layer — a rule that fires provides the `rulesPlan` which is the fallback
 *   for "rules-only" and "ai-assisted" modes when AI is not used.
 *
 * ─── Relationship to AiDecisionProvider ─────────────────────────────────────
 *
 *   AiDecisionProvider accepts an optional `slotRegistry: SlotModeRegistry`
 *   constructor parameter.  When provided, after the global AI call returns,
 *   assembleSlotPlan() is called to compose the final ExperiencePlan one slot
 *   at a time, honouring each slot's configured mode.
 *
 *   When the registry is absent or all three slots are "ai-assisted", the
 *   provider falls back to the existing single-plan path (global AI vs rules).
 *
 * ─── Admin configuration ─────────────────────────────────────────────────────
 *
 *   Stored in TenantSettings.adaptiveSlots (tenant/types.ts).
 *   Managed via /admin/tenants/[tenantId]/behavior/slots.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Selection mode for a single core adaptive slot.
 *
 *   "static"       — fixed key, never changed by rules or AI.
 *   "rules-only"   — rules/fallback plan key only; AI bypassed for this slot.
 *   "ai-assisted"  — AI may select this slot (default).
 */
export type SlotSelectionMode = "static" | "rules-only" | "ai-assisted";

/**
 * The three core adaptive slot IDs that support per-slot mode configuration.
 *
 * Extended slots (feature, conversion) are always rules-driven and are not
 * included in the per-slot AI selection layer.
 */
export type CoreSlotId = "hero" | "proof" | "cta";

/**
 * Configuration for a single core slot's selection behaviour.
 */
export interface AdaptiveSlotConfig {
  /**
   * Which selection mode to apply for this slot.
   *
   * Default when absent: "ai-assisted".
   */
  mode: SlotSelectionMode;

  /**
   * The fixed variant key to serve when mode === "static".
   *
   * Must be a valid key for this slot's type:
   *   hero  → HeroVariantKey  (e.g. "hero_default", "hero_direct_brand")
   *   proof → ProofVariantKey (e.g. "proof_platform", "proof_cases")
   *   cta   → CTAVariantKey   (e.g. "cta_meeting", "cta_demo")
   *
   * When mode === "static" and staticKey is absent or empty, the slot falls
   * back to "rules-only" behaviour as a safety measure (never serves null).
   *
   * Ignored when mode is "rules-only" or "ai-assisted".
   */
  staticKey?: string;
}

/**
 * Per-slot mode configuration registry for all three core slots.
 *
 * All slots are optional — any absent slot defaults to "ai-assisted" mode.
 * An empty registry object is equivalent to all three slots being "ai-assisted".
 *
 * ─── Backward compatibility ───────────────────────────────────────────────────
 *
 *   When this registry is `undefined` (no config saved for this tenant), ALL
 *   slots operate in "ai-assisted" mode — identical to the pre-Phase-1
 *   behaviour where AI chose all slots globally.
 */
export interface SlotModeRegistry {
  hero?:  AdaptiveSlotConfig;
  proof?: AdaptiveSlotConfig;
  cta?:   AdaptiveSlotConfig;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the effective AdaptiveSlotConfig for a slot, applying defaults.
 *
 * Any absent slot or absent mode defaults to "ai-assisted", ensuring full
 * backward compatibility when the registry is partially or fully absent.
 */
export function getSlotConfig(
  registry: SlotModeRegistry | undefined | null,
  slotId:   CoreSlotId,
): AdaptiveSlotConfig {
  return registry?.[slotId] ?? { mode: "ai-assisted" };
}

/**
 * Returns true when ALL three core slots are "ai-assisted" or the registry
 * is absent/empty.
 *
 * Used by AiDecisionProvider as a short-circuit: when all slots are AI-assisted,
 * the existing single-plan assembly path is used (no per-slot overhead), which
 * is the default for tenants that have not configured slot modes.
 */
export function allSlotsAiAssisted(
  registry: SlotModeRegistry | undefined | null,
): boolean {
  if (!registry) return true;
  const slots: CoreSlotId[] = ["hero", "proof", "cta"];
  return slots.every((s) => {
    const cfg = registry[s];
    return !cfg || cfg.mode === "ai-assisted";
  });
}

/**
 * Returns a human-readable label for a SlotSelectionMode value.
 * Used in admin UI display and log annotations.
 */
export function slotModeLabel(mode: SlotSelectionMode): string {
  switch (mode) {
    case "static":       return "Static (locked key)";
    case "rules-only":   return "Rules only";
    case "ai-assisted":  return "AI-assisted";
    default:             return mode;
  }
}
