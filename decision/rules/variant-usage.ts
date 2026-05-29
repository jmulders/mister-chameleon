/**
 * Variant Usage Analysis
 *
 * Pure utility functions that compute per-slot usage statistics by cross-
 * referencing the stored rules config against the variant catalogue.
 *
 * No DB calls, no Sanity calls — everything is derived from the two data
 * structures that are already available on the tenant rules admin page:
 *
 *   • StoredRulesConfig  — which variant keys the rules reference
 *   • VariantCatalogue   — which variant keys exist (platform + CMS)
 *
 * ─── Usage metrics ─────────────────────────────────────────────────────────────
 *
 *   ruleCount  — number of rules (including defaultPlan) that reference this key.
 *   isDefault  — true when the key appears in the defaultPlan (always fires).
 *
 *   ruleCount = 0  → dead content: the key exists in Sanity but no rule points
 *                    to it.  Safe to archive or delete.
 *   ruleCount = 1  → single-use: this key is only used by one specific rule.
 *                    Consider whether a more general key could serve the same
 *                    purpose — two archetypes that look very similar are usually
 *                    better served by one shared variant.
 *   ruleCount ≥ 2  → reused: the key is shared across multiple archetypes.
 *                    This is the target state — healthy variant vocabulary.
 */

import type { StoredRulesConfig } from "./stored-rule";
import type { VariantCatalogue, VariantEntry, VariantSource } from "./variant-catalogue";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Usage data for a single variant key. */
export interface VariantUsageStat {
  /** The variant key string (e.g. "hero_direct_brand"). */
  key:        string;
  /** Human-readable label from the catalogue. */
  label:      string;
  /** Where the variant comes from. */
  source:     VariantSource;
  /**
   * Number of rules (including the defaultPlan) that reference this key in
   * the given slot.  Zero = dead content.
   */
  ruleCount:  number;
  /**
   * Whether this key is set in the defaultPlan for this slot.
   * A default key always "fires" (it's the fallback when no rule matches) so
   * it is never truly dead even if ruleCount = 1.
   */
  isDefault:  boolean;
}

/** Usage summary for one adaptive slot. */
export interface SlotUsageSummary {
  /** Slot identifier. */
  slot:    "hero" | "proof" | "cta" | "feature" | "conversion";
  /** Human-readable slot label. */
  label:   string;
  /** Total number of variants in the catalogue for this slot. */
  total:   number;
  /** Number of variants referenced by ≥ 1 rule. */
  active:  number;
  /** Number of variants referenced by ≥ 2 rules (shared / reused). */
  reused:  number;
  /** Number of variants referenced by 0 rules (dead content). */
  unused:  number;
  /** Per-variant stats, sorted by ruleCount descending then key ascending. */
  variants: VariantUsageStat[];
}

/** Usage stats for all five adaptive slots. */
export interface AllSlotUsage {
  hero:       SlotUsageSummary;
  proof:      SlotUsageSummary;
  cta:        SlotUsageSummary;
  feature:    SlotUsageSummary;
  conversion: SlotUsageSummary;
}

// ── Slot metadata ──────────────────────────────────────────────────────────────

const SLOT_LABELS: Record<keyof AllSlotUsage, string> = {
  hero:       "Hero",
  proof:      "Proof",
  cta:        "CTA",
  feature:    "Feature",
  conversion: "Conversion",
};

// ── Core computation ───────────────────────────────────────────────────────────

/**
 * Compute variant usage statistics for all five slots.
 *
 * @param config    The current StoredRulesConfig (rules + defaultPlan).
 * @param catalogue The merged platform + CMS variant catalogue.
 */
export function computeVariantUsage(
  config:    StoredRulesConfig,
  catalogue: VariantCatalogue,
): AllSlotUsage {
  // Build a frequency map for each slot: variantKey → ruleCount
  type FreqMap = Map<string, number>;

  const freq: Record<keyof AllSlotUsage, FreqMap> = {
    hero:       new Map(),
    proof:      new Map(),
    cta:        new Map(),
    feature:    new Map(),
    conversion: new Map(),
  };

  // Helper: increment a slot's frequency map by 1 for the given key.
  function bump(slot: keyof AllSlotUsage, key: string | undefined): void {
    if (!key) return;
    freq[slot].set(key, (freq[slot].get(key) ?? 0) + 1);
  }

  // Count the defaultPlan.
  bump("hero",       config.defaultPlan.heroKey);
  bump("proof",      config.defaultPlan.proofKey);
  bump("cta",        config.defaultPlan.ctaKey);
  bump("feature",    config.defaultPlan.featureKey);
  bump("conversion", config.defaultPlan.conversionKey);

  // Count each rule's plan.
  for (const rule of config.rules) {
    if (rule.enabled === false) continue; // skip disabled rules
    bump("hero",       rule.plan.heroKey);
    bump("proof",      rule.plan.proofKey);
    bump("cta",        rule.plan.ctaKey);
    bump("feature",    rule.plan.featureKey);
    bump("conversion", rule.plan.conversionKey);
  }

  // Build the SlotUsageSummary for one slot.
  function buildSlot(
    slot:     keyof AllSlotUsage,
    entries:  VariantEntry[],
  ): SlotUsageSummary {
    const defaultKey = getDefaultKey(config, slot);

    const variants: VariantUsageStat[] = entries.map((entry) => ({
      key:       entry.key,
      label:     entry.label,
      source:    entry.source,
      ruleCount: freq[slot].get(entry.key) ?? 0,
      isDefault: entry.key === defaultKey,
    }));

    // Also include keys referenced by rules but absent from the catalogue
    // (e.g. a CMS variant that was deleted after the rule was saved).
    const catalogueKeys = new Set(entries.map((e) => e.key));
    for (const [key, count] of freq[slot]) {
      if (!catalogueKeys.has(key)) {
        variants.push({
          key,
          label:     key,
          source:    "cms-tenant",
          ruleCount: count,
          isDefault: key === defaultKey,
        });
      }
    }

    // Sort: highest ruleCount first, then alphabetically.
    variants.sort((a, b) =>
      b.ruleCount !== a.ruleCount
        ? b.ruleCount - a.ruleCount
        : a.key.localeCompare(b.key),
    );

    const active = variants.filter((v) => v.ruleCount > 0).length;
    const reused = variants.filter((v) => v.ruleCount >= 2).length;
    const unused = variants.filter((v) => v.ruleCount === 0).length;

    return {
      slot,
      label:    SLOT_LABELS[slot],
      total:    variants.length,
      active,
      reused,
      unused,
      variants,
    };
  }

  return {
    hero:       buildSlot("hero",       catalogue.hero),
    proof:      buildSlot("proof",      catalogue.proof),
    cta:        buildSlot("cta",        catalogue.cta),
    feature:    buildSlot("feature",    catalogue.feature),
    conversion: buildSlot("conversion", catalogue.conversion),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDefaultKey(
  config: StoredRulesConfig,
  slot:   keyof AllSlotUsage,
): string | undefined {
  switch (slot) {
    case "hero":       return config.defaultPlan.heroKey;
    case "proof":      return config.defaultPlan.proofKey;
    case "cta":        return config.defaultPlan.ctaKey;
    case "feature":    return config.defaultPlan.featureKey;
    case "conversion": return config.defaultPlan.conversionKey;
  }
}

// ── Budget helpers ─────────────────────────────────────────────────────────────

/**
 * Default content budget ceilings per slot.
 *
 * These represent the maximum number of Sanity documents (platform + CMS)
 * that should exist for each slot before the team reviews whether existing
 * variants can be consolidated.
 *
 * Override via the Platform → Variants settings page (stored in platform_settings
 * under the "content_budget" key).
 */
export const CONTENT_BUDGET_DEFAULTS = {
  heroMax:       16,
  proofMax:      14,
  ctaMax:        20,
  featureMax:    5,
  conversionMax: 4,
} as const;

export type ContentBudget = {
  heroMax:       number;
  proofMax:      number;
  ctaMax:        number;
  featureMax:    number;
  conversionMax: number;
};

/** Slot → budget key mapping. */
export const SLOT_BUDGET_KEY: Record<keyof AllSlotUsage, keyof ContentBudget> = {
  hero:       "heroMax",
  proof:      "proofMax",
  cta:        "ctaMax",
  feature:    "featureMax",
  conversion: "conversionMax",
};

/**
 * Merge stored budget overrides on top of the defaults.
 * Passes through undefined/null fields as the default value.
 */
export function resolveContentBudget(
  overrides: Partial<ContentBudget>,
): ContentBudget {
  return {
    heroMax:       overrides.heroMax       ?? CONTENT_BUDGET_DEFAULTS.heroMax,
    proofMax:      overrides.proofMax      ?? CONTENT_BUDGET_DEFAULTS.proofMax,
    ctaMax:        overrides.ctaMax        ?? CONTENT_BUDGET_DEFAULTS.ctaMax,
    featureMax:    overrides.featureMax    ?? CONTENT_BUDGET_DEFAULTS.featureMax,
    conversionMax: overrides.conversionMax ?? CONTENT_BUDGET_DEFAULTS.conversionMax,
  };
}

/**
 * Returns the health status for a slot given its current total vs. budget.
 *
 * "ok"      — below 75 % of the budget ceiling.
 * "warning" — between 75 % and 100 % of the budget ceiling.
 * "over"    — at or above the budget ceiling.
 */
export function slotBudgetStatus(
  total:  number,
  budget: number,
): "ok" | "warning" | "over" {
  if (total >= budget)         return "over";
  if (total >= budget * 0.75)  return "warning";
  return "ok";
}
